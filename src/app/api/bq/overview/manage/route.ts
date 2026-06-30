import { NextResponse } from "next/server";
import { runQuery, getBqClient } from "@/lib/bigquery";
import { PROJECT_ID, DATASET_ID, VIEW_ID, TABLE_ID, FULL_TABLE_ID } from "@/lib/config";
import { MANAGE_EXCLUDE_COLS, SCHEMA_COLS, MAPPED_COLS, METADATA_COLS } from "@/lib/schema";

const PAGE_SIZE = 5000;

/**
 * GET /api/bq/overview/manage
 * Returns column list + available years
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
    try {
        // Derive columns from schema constant — no BQ query needed
        const columns = SCHEMA_COLS.filter((c) => !MANAGE_EXCLUDE_COLS.has(c));

        // Years are fetched client-side via /api/bq/overview (shared endpoint)
        // to avoid duplicate concurrent BQ queries that cause Vercel timeout
        return NextResponse.json({ columns });
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

        // Normalize year range — always ensure minYear <= maxYear
        const rawFrom = body.fromYear as number | undefined;
        const rawTo = body.toYear as number | undefined;
        if (rawFrom != null && rawTo != null && rawFrom > rawTo) {
            body.fromYear = rawTo;
            body.toYear = rawFrom;
        }

        if (action === "count") {
            const { fromYear, toYear } = body as {
                action: string;
                fromYear: number;
                toYear: number;
            };
            // Use base table for count — no JOINs needed, much faster
            const query = `
                SELECT COUNT(*) AS total
                FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
                WHERE nam_qt BETWEEN ${fromYear} AND ${toYear}
            `;
            const rows = await runQuery<{ total: number }>(query);
            return NextResponse.json({ total: rows[0]?.total ?? 0 });
        }

        if (action === "load") {
            const { fromYear, toYear, page = 0 } = body as {
                action: string;
                fromYear: number;
                toYear: number;
                page?: number;
            };
            const offset = page * PAGE_SIZE;

            // Only fetch total on first page — client caches it for subsequent pages
            let total = 0;
            if (page === 0) {
                const countQuery = `
                    SELECT COUNT(*) AS total
                    FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
                    WHERE nam_qt BETWEEN ${fromYear} AND ${toYear}
                `;
                const countRows = await runQuery<{ total: number }>(countQuery);
                total = countRows[0]?.total ?? 0;
            }

            // Paginated fetch from VIEW
            const query = `
                SELECT *
                FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
                WHERE nam_qt BETWEEN ${fromYear} AND ${toYear}
                ORDER BY nam_qt DESC, thang_qt DESC, ma_cskcb
                LIMIT ${PAGE_SIZE} OFFSET ${offset}
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
            return NextResponse.json({
                data: cleaned,
                ...(page === 0 ? { total } : {}),
                page,
                pageSize: PAGE_SIZE,
                hasMore: cleaned.length === PAGE_SIZE,
            });
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
 * Deletes rows by composite key — batched for performance
 */
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { rows } = body as { rows: Record<string, unknown>[] };

        if (!rows || rows.length === 0) {
            return NextResponse.json({ deletedCount: 0, total: 0 });
        }

        const ROW_KEY_COLS = [
            "ma_cskcb", "ma_bn", "ma_loaikcb", "ngay_vao", "ngay_ra",
        ];
        const DATETIME_COLS = new Set(["ngay_vao", "ngay_ra"]);

        const client = getBqClient();
        let deletedCount = 0;
        const errors: string[] = [];

        /** Build WHERE conditions for a single row */
        const buildRowCondition = (row: Record<string, unknown>): string => {
            const conditions: string[] = [];
            for (const col of ROW_KEY_COLS) {
                let val = row[col];
                if (val != null && typeof val === "object" && "value" in (val as Record<string, unknown>)) {
                    val = (val as Record<string, unknown>).value;
                }
                if (val === null || val === undefined) {
                    conditions.push(`${col} IS NULL`);
                } else if (typeof val === "number") {
                    conditions.push(`${col} = ${val}`);
                } else if (DATETIME_COLS.has(col)) {
                    const safeVal = String(val).replace(/'/g, "\\'");
                    conditions.push(`${col} = DATETIME('${safeVal}')`);
                } else {
                    const safeVal = String(val).replace(/'/g, "\\'");
                    conditions.push(`${col} = '${safeVal}'`);
                }
            }

            // Also match on upload_timestamp to uniquely identify the exact row
            let ts = row["upload_timestamp"];
            if (ts != null && typeof ts === "object" && "value" in (ts as Record<string, unknown>)) {
                ts = (ts as Record<string, unknown>).value;
            }
            if (ts != null) {
                const safeTs = String(ts).replace(/'/g, "\\'");
                conditions.push(`upload_timestamp = TIMESTAMP('${safeTs}')`);
            }

            return `(${conditions.join(" AND ")})`;
        };

        // Batch rows into chunks to avoid exceeding BigQuery query size limits
        const BATCH_SIZE = 500;
        for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
            const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);
            const rowConditions = batch.map(buildRowCondition);
            const whereClause = rowConditions.join("\n    OR ");
            const deleteQ = `DELETE FROM \`${FULL_TABLE_ID}\` WHERE ${whereClause}`;

            console.log(`[DELETE] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${batch.length} rows`);
            try {
                const [job] = await client.createQueryJob({ query: deleteQ });
                await job.getQueryResults();
                // Must call getMetadata() after job completes to get DML stats
                const [meta] = await job.getMetadata();
                const numDmlAffectedRows = meta?.statistics?.query?.numDmlAffectedRows;
                console.log("[DELETE] Affected rows:", numDmlAffectedRows);
                deletedCount += Number(numDmlAffectedRows) || 0;
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error("[DELETE] Error:", msg);
                if (msg.includes("streaming buffer")) {
                    errors.push("Dữ liệu vừa import chưa thể xóa ngay. Vui lòng đợi 30 phút và thử lại.");
                } else {
                    errors.push(msg);
                }
            }
        }

        return NextResponse.json({
            deletedCount,
            total: rows.length,
            ...(errors.length > 0 ? { errors } : {}),
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * PUT /api/bq/overview/manage
 * Body: { originalRow: Record<string, unknown>, updatedFields: Record<string, unknown> }
 * Updates a single row by composite key
 */
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { originalRow, updatedFields } = body as {
            originalRow: Record<string, unknown>;
            updatedFields: Record<string, unknown>;
        };

        if (!originalRow || !updatedFields || Object.keys(updatedFields).length === 0) {
            return NextResponse.json({ error: "Không có thay đổi nào." }, { status: 400 });
        }

        // Only allow updating SCHEMA_COLS (not mapped/metadata)
        const schemaSet = new Set<string>(SCHEMA_COLS);
        const forbiddenCols = Object.keys(updatedFields).filter(
            (c) => !schemaSet.has(c) || MAPPED_COLS.has(c) || METADATA_COLS.has(c)
        );
        if (forbiddenCols.length > 0) {
            return NextResponse.json(
                { error: `Không được sửa cột: ${forbiddenCols.join(", ")}` },
                { status: 400 }
            );
        }

        const ROW_KEY_COLS = ["ma_cskcb", "ma_bn", "ma_loaikcb", "ngay_vao", "ngay_ra"];
        const DATETIME_COLS = new Set(["ngay_vao", "ngay_ra"]);

        // Build WHERE clause to identify the exact row
        const conditions: string[] = [];
        for (const col of ROW_KEY_COLS) {
            let val = originalRow[col];
            if (val != null && typeof val === "object" && "value" in (val as Record<string, unknown>)) {
                val = (val as Record<string, unknown>).value;
            }
            if (val === null || val === undefined) {
                conditions.push(`${col} IS NULL`);
            } else if (typeof val === "number") {
                conditions.push(`${col} = ${val}`);
            } else if (DATETIME_COLS.has(col)) {
                const safeVal = String(val).replace(/'/g, "\\'");
                conditions.push(`${col} = DATETIME('${safeVal}')`);
            } else {
                const safeVal = String(val).replace(/'/g, "\\'");
                conditions.push(`${col} = '${safeVal}'`);
            }
        }

        // Also match on upload_timestamp for exact row identification
        let ts = originalRow["upload_timestamp"];
        if (ts != null && typeof ts === "object" && "value" in (ts as Record<string, unknown>)) {
            ts = (ts as Record<string, unknown>).value;
        }
        if (ts != null) {
            const safeTs = String(ts).replace(/'/g, "\\'");
            conditions.push(`upload_timestamp = TIMESTAMP('${safeTs}')`);
        }

        // Build SET clause
        const setClauses: string[] = [];
        for (const [col, val] of Object.entries(updatedFields)) {
            if (val === null || val === undefined || val === "") {
                setClauses.push(`${col} = NULL`);
            } else if (typeof val === "number") {
                setClauses.push(`${col} = ${val}`);
            } else if (DATETIME_COLS.has(col)) {
                const safeVal = String(val).replace(/'/g, "\\'");
                setClauses.push(`${col} = DATETIME('${safeVal}')`);
            } else {
                const safeVal = String(val).replace(/'/g, "\\'");
                setClauses.push(`${col} = '${safeVal}'`);
            }
        }

        const updateQuery = `
            UPDATE \`${FULL_TABLE_ID}\`
            SET ${setClauses.join(", ")}
            WHERE ${conditions.join(" AND ")}
        `;

        console.log("[UPDATE] Query:", updateQuery);

        const client = getBqClient();
        const [job] = await client.createQueryJob({ query: updateQuery });
        await job.getQueryResults();
        const [meta] = await job.getMetadata();
        const affected = Number(meta?.statistics?.query?.numDmlAffectedRows) || 0;

        return NextResponse.json({ updatedCount: affected });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        if (msg.includes("streaming buffer")) {
            return NextResponse.json(
                { error: "Dữ liệu vừa import chưa thể sửa ngay. Vui lòng đợi 30 phút và thử lại." },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
