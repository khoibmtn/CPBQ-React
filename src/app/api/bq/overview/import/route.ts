import { NextResponse } from "next/server";
import { getBqClient } from "@/lib/bigquery";
import {
    FULL_TABLE_ID,
} from "@/lib/config";
import { SCHEMA_COLS, ROW_KEY_COLS } from "@/lib/schema";

/* ── Route config ── */
export const maxDuration = 60;

type Row = Record<string, unknown>;

/* ═══════════════════════════════════════════════════════════════════════════════
   POST /api/bq/overview/import — Duplicate check ONLY
   Body: JSON { keys: [ {ma_cskcb, ma_bn, ma_loaikcb, ngay_vao, ngay_ra}, ... ] }

   Client does: parse Excel → transform → validate → summary.
   Server only checks which rows already exist in BigQuery.
   Returns: { duplicateIndices: [0, 3, 7, ...] }

   Payload size: ~5 cols × N rows → ~1.4 MB for 14k rows (well under 4.5 MB limit)
   ═══════════════════════════════════════════════════════════════════════════════ */

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const keys: Row[] = body.keys || [];

        if (!keys.length) {
            return NextResponse.json({ duplicateIndices: [] });
        }

        const client = getBqClient();
        const dupIndices = await getDuplicateIndices(client, keys);

        return NextResponse.json({
            duplicateIndices: Array.from(dupIndices),
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PUT /api/bq/overview/import — Upload rows to BigQuery
   Body: JSON { rows: [...], mode: "new" | "overwrite" }

   Client sends pre-transformed rows in CHUNKS (~1500 rows per request).
   Server uploads to BigQuery.
   ═══════════════════════════════════════════════════════════════════════════════ */

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const rows: Row[] = body.rows || [];
        const mode: string = body.mode || "new";

        if (!rows.length) {
            return NextResponse.json({ error: "Không có dòng nào.", uploaded: 0 });
        }

        const client = getBqClient();

        if (mode === "overwrite") {
            const DATETIME_COLS = new Set(["ngay_vao", "ngay_ra"]);
            let deletedCount = 0;

            for (const row of rows) {
                const conditions: string[] = [];
                for (const col of ROW_KEY_COLS) {
                    const val = row[col];
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
                const whereClause = conditions.join(" AND ");
                try {
                    const deleteQ = `DELETE FROM \`${FULL_TABLE_ID}\` WHERE ${whereClause}`;
                    const [job] = await client.createQueryJob({ query: deleteQ });
                    await job.getQueryResults();
                    const affected = Number(job.metadata?.statistics?.query?.numDmlAffectedRows) || 0;
                    deletedCount += affected;
                } catch (e: unknown) {
                    console.error("[OVERWRITE-DELETE]", e instanceof Error ? e.message : e);
                }
            }

            const uploaded = await uploadToBigQuery(client, rows);
            return NextResponse.json({ uploaded, deleted: deletedCount, mode: "overwrite" });
        } else {
            // mode="new": upload directly (client already filtered out duplicates)
            const uploaded = await uploadToBigQuery(client, rows);
            return NextResponse.json({ uploaded, mode: "new" });
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

function bqScalar(val: unknown): string {
    if (val == null) return "";
    if (typeof val === "object" && val !== null && "value" in (val as Record<string, unknown>)) {
        return String((val as Record<string, unknown>).value ?? "");
    }
    return String(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDuplicateIndices(client: any, rows: Row[]): Promise<Set<number>> {
    const dupIndices = new Set<number>();
    const maBnList = [
        ...new Set(rows.map((r) => r.ma_bn).filter(Boolean).map(String)),
    ];
    if (maBnList.length === 0) return dupIndices;

    const keyCols = ROW_KEY_COLS.join(", ");
    const BATCH_SIZE = 5000;

    for (let i = 0; i < maBnList.length; i += BATCH_SIZE) {
        const batch = maBnList.slice(i, i + BATCH_SIZE);
        const inList = batch.map((m) => `'${m.replace(/'/g, "\\'")}'`).join(", ");
        const query = `SELECT ${keyCols} FROM \`${FULL_TABLE_ID}\` WHERE ma_bn IN (${inList})`;

        try {
            const [job] = await client.createQueryJob({ query });
            const [bqRows] = await job.getQueryResults();
            if (bqRows.length === 0) continue;

            const bqKeys = new Set(
                bqRows.map((bqRow: Row) =>
                    ROW_KEY_COLS.map((c) => bqScalar(bqRow[c])).join("|")
                )
            );

            rows.forEach((row, idx) => {
                const rowKey = ROW_KEY_COLS.map((c) => bqScalar(row[c])).join("|");
                if (bqKeys.has(rowKey)) dupIndices.add(idx);
            });
        } catch {
            // Skip batch errors
        }
    }
    return dupIndices;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function uploadToBigQuery(client: any, rows: Row[]): Promise<number> {
    const allowedCols = [...SCHEMA_COLS, "upload_timestamp", "source_file"];
    const allowedSet = new Set(allowedCols);

    const cleanRows = rows.map((row) => {
        const r: Row = {};
        for (const [key, val] of Object.entries(row)) {
            if (allowedSet.has(key)) r[key] = val;
        }
        return r;
    });

    const BATCH = 200;
    let uploaded = 0;

    for (let i = 0; i < cleanRows.length; i += BATCH) {
        const batch = cleanRows.slice(i, i + BATCH);

        const valueRows = batch.map((row) => {
            const vals = allowedCols.map((col) => {
                const v = row[col];
                if (v === null || v === undefined) return "NULL";
                if (typeof v === "number") return String(v);
                const s = String(v).replace(/'/g, "\\'");
                return `'${s}'`;
            });
            return `(${vals.join(", ")})`;
        });

        const colList = allowedCols.join(", ");
        const query = `INSERT INTO \`${FULL_TABLE_ID}\` (${colList}) VALUES ${valueRows.join(",\n")}`;

        try {
            const [job] = await client.createQueryJob({ query });
            await job.getQueryResults();
            uploaded += batch.length;
        } catch (err: unknown) {
            console.error("[UPLOAD] DML INSERT error:", err instanceof Error ? err.message : err);
        }
    }
    return uploaded;
}
