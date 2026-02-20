import { NextResponse } from "next/server";
import { runQuery, getBqClient } from "@/lib/bigquery";
import { PROJECT_ID, DATASET_ID, VIEW_ID, FULL_TABLE_ID } from "@/lib/config";
import { MANAGE_EXCLUDE_COLS } from "@/lib/schema";

/**
 * GET /api/bq/overview/manage
 * Returns column list from the view (for search builder)
 */
export async function GET() {
    try {
        const query = `SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\` LIMIT 0`;
        const client = getBqClient();
        const [job] = await client.createQueryJob({ query });
        const [rows] = await job.getQueryResults();

        // Get column names from metadata
        const metadata = job.metadata?.configuration?.query;
        let columns: string[] = [];

        if (rows.length === 0) {
            // Use schema from job metadata
            const [, , response] = await job.getQueryResults({ maxResults: 0 });
            const schema = response?.schema?.fields;
            if (schema) {
                columns = schema
                    .map((f: { name?: string }) => f.name || "")
                    .filter((c: string) => c && !MANAGE_EXCLUDE_COLS.has(c));
            }
        }

        // Count by year range
        const yearsQuery = `
            SELECT DISTINCT nam_qt
            FROM \`${FULL_TABLE_ID}\`
            ORDER BY nam_qt DESC
        `;
        const yearsRows = await runQuery<{ nam_qt: number }>(yearsQuery);
        const years = yearsRows.map((r) => r.nam_qt);

        return NextResponse.json({ columns, years });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

interface SearchCondition {
    field: string;
    keyword: string;
    operator?: "AND" | "OR";
}

/**
 * POST /api/bq/overview/manage
 * Body: { action: "search" | "count" | "load", ... }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body as { action: string };

        if (action === "count") {
            const { fromYear, toYear } = body as {
                action: string;
                fromYear: number;
                toYear: number;
            };
            const query = `
                SELECT COUNT(*) AS total
                FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
                WHERE nam_qt BETWEEN ${fromYear} AND ${toYear}
            `;
            const rows = await runQuery<{ total: number }>(query);
            return NextResponse.json({ total: rows[0]?.total ?? 0 });
        }

        if (action === "load") {
            const { fromYear, toYear } = body as {
                action: string;
                fromYear: number;
                toYear: number;
            };
            const query = `
                SELECT *
                FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
                WHERE nam_qt BETWEEN ${fromYear} AND ${toYear}
                ORDER BY nam_qt DESC, thang_qt DESC, ma_cskcb
            `;
            const rows = await runQuery(query);
            // Remove excluded columns
            const cleaned = rows.map((row: Record<string, unknown>) => {
                const r = { ...row };
                for (const col of MANAGE_EXCLUDE_COLS) {
                    delete r[col];
                }
                return r;
            });
            return NextResponse.json({ data: cleaned, total: cleaned.length });
        }

        if (action === "search") {
            const { conditions, fromYear, toYear, limit = 10000 } = body as {
                action: string;
                conditions: SearchCondition[];
                fromYear: number;
                toYear: number;
                limit?: number;
            };

            const whereParts = [`nam_qt BETWEEN ${fromYear} AND ${toYear}`];
            const activeConds = conditions.filter(
                (c) => c.keyword?.trim()
            );

            if (activeConds.length > 0) {
                const condClauses: { clause: string; operator: string }[] = [];
                for (const cond of activeConds) {
                    const keyword = cond.keyword.trim().toLowerCase().replace(/'/g, "\\'");
                    const clause = `LOWER(CAST(\`${cond.field}\` AS STRING)) LIKE '%${keyword}%'`;
                    condClauses.push({
                        clause,
                        operator: cond.operator || "AND",
                    });
                }

                let expr = condClauses[0].clause;
                for (let i = 1; i < condClauses.length; i++) {
                    const op = condClauses[i].operator;
                    expr = `(${expr} ${op} ${condClauses[i].clause})`;
                }
                whereParts.push(`(${expr})`);
            }

            const whereSql = whereParts.join(" AND ");
            const query = `
                SELECT * FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
                WHERE ${whereSql}
                LIMIT ${limit}
            `;
            const rows = await runQuery(query);
            const cleaned = rows.map((row: Record<string, unknown>) => {
                const r = { ...row };
                for (const col of MANAGE_EXCLUDE_COLS) {
                    delete r[col];
                }
                return r;
            });
            return NextResponse.json({ data: cleaned, total: cleaned.length });
        }

        return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 }
        );
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * DELETE /api/bq/overview/manage
 * Body: { rows: Record<string, unknown>[] }
 * Deletes rows by composite key
 */
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { rows } = body as { rows: Record<string, unknown>[] };

        const ROW_KEY_COLS = [
            "ma_cskcb", "ma_bn", "ma_loaikcb", "ngay_vao", "ngay_ra",
        ];

        const client = getBqClient();
        let deletedCount = 0;

        for (const row of rows) {
            const conditions: string[] = [];
            for (const col of ROW_KEY_COLS) {
                const val = row[col];
                if (val === null || val === undefined) {
                    conditions.push(`${col} IS NULL`);
                } else if (typeof val === "number") {
                    conditions.push(`${col} = ${val}`);
                } else {
                    const safeVal = String(val).replace(/'/g, "\\'");
                    conditions.push(`${col} = '${safeVal}'`);
                }
            }
            const whereClause = conditions.join(" AND ");
            const deleteQ = `DELETE FROM \`${FULL_TABLE_ID}\` WHERE ${whereClause}`;
            try {
                const [job] = await client.createQueryJob({ query: deleteQ });
                await job.getQueryResults();
                deletedCount++;
            } catch {
                // Skip individual row errors
            }
        }

        return NextResponse.json({ deletedCount, total: rows.length });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
