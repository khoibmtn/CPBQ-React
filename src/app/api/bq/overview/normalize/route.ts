import { NextResponse } from "next/server";
import { getBqClient } from "@/lib/bigquery";
import { FULL_TABLE_ID, DATASET_ID, PROJECT_ID } from "@/lib/config";
import { SCHEMA_COLS, ROW_KEY_COLS } from "@/lib/schema";

export const maxDuration = 60;

type Row = Record<string, unknown>;

/* ═══════════════════════════════════════════════════════════════════════════════
   POST /api/bq/overview/normalize
   Body: { action: "compare" | "execute", ... }

   compare: Count BQ rows per (ma_cskcb, thang_qt, nam_qt) group and compare
            with Excel keys for duplicate detection.
   execute: DELETE all rows for chosen groups, INSERT Excel rows with
            is_normalized=true.
   ═══════════════════════════════════════════════════════════════════════════════ */

interface GroupKey {
    ma_cskcb: string;
    thang_qt: number;
    nam_qt: number;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const action: string = body.action;

        if (action === "compare") {
            return handleCompare(body);
        } else if (action === "execute") {
            return handleExecute(body);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/* ── Compare ── */

async function handleCompare(body: {
    groups: GroupKey[];
    excelKeys: Record<string, { dupCount: number; count: number; cost: number; subs: { label: string; count: number; cost: number }[] }>;
}) {
    const { groups, excelKeys } = body;
    if (!groups?.length) {
        return NextResponse.json({ comparisons: [] });
    }

    const client = getBqClient();
    const comparisons = [];

    for (const g of groups) {
        const groupId = `${g.ma_cskcb}|${g.thang_qt}|${g.nam_qt}`;
        const excelGroup = excelKeys[groupId] || { dupCount: 0, count: 0, cost: 0, subs: [] };

        // Count total BQ rows, sum cost, and breakdown normalized/raw for this group
        const countQuery = `
            SELECT COUNT(*) as cnt,
                   COALESCE(SUM(CAST(t_tongchi AS FLOAT64)), 0) as total_cost,
                   COUNTIF(is_normalized = TRUE) as normalized_cnt
            FROM \`${FULL_TABLE_ID}\`
            WHERE ma_cskcb = '${esc(g.ma_cskcb)}'
              AND thang_qt = ${Number(g.thang_qt)}
              AND nam_qt = ${Number(g.nam_qt)}
        `;
        const [countJob] = await client.createQueryJob({ query: countQuery });
        const [countRows] = await countJob.getQueryResults();
        const bqCount = Number(countRows[0]?.cnt || 0);
        const bqCost = Number(countRows[0]?.total_cost || 0);
        const bqNormalized = Number(countRows[0]?.normalized_cnt || 0);
        const bqRaw = bqCount - bqNormalized;

        const dupCount = excelGroup.dupCount || 0;

        // Get BQ breakdown by nội trú / ngoại trú using lookup table
        const lookupTable = `\`${PROJECT_ID}.${DATASET_ID}.lookup_loaikcb\``;
        const subQuery = `
            SELECT
                COALESCE(lk.ml2, CASE WHEN CAST(t.ma_loaikcb AS INT64) = 1 THEN 'Nội trú' ELSE 'Ngoại trú' END) AS loai,
                COUNT(*) as cnt,
                COALESCE(SUM(CAST(t.t_tongchi AS FLOAT64)), 0) as total_cost
            FROM \`${FULL_TABLE_ID}\` t
            LEFT JOIN ${lookupTable} lk ON CAST(t.ma_loaikcb AS INT64) = CAST(lk.ma_loaikcb AS INT64)
            WHERE t.ma_cskcb = '${esc(g.ma_cskcb)}'
              AND t.thang_qt = ${Number(g.thang_qt)}
              AND t.nam_qt = ${Number(g.nam_qt)}
            GROUP BY loai
        `;
        const [subJob] = await client.createQueryJob({ query: subQuery });
        const [subRows] = await subJob.getQueryResults();
        const bqSubs = subRows.map((r: Row) => ({
            label: String(r.loai),
            count: Number(r.cnt || 0),
            cost: Number(r.total_cost || 0),
        }));

        comparisons.push({
            ma_cskcb: g.ma_cskcb,
            thang_qt: g.thang_qt,
            nam_qt: g.nam_qt,
            bqCount,
            excelCount: excelGroup.count,
            dupCount,
            bqOnlyCount: bqCount - dupCount,
            excelOnlyCount: excelGroup.count - dupCount,
            diff: excelGroup.count - bqCount,
            bqCost,
            excelCost: excelGroup.cost || 0,
            bqSubs,
            excelSubs: excelGroup.subs || [],
            bqNormalized,
            bqRaw,
        });
    }

    return NextResponse.json({ comparisons });
}

/* ── Execute ── */

async function handleExecute(body: {
    groups: { ma_cskcb: string; thang_qt: number; nam_qt: number; rows: Row[]; skipDelete?: boolean }[];
}) {
    const { groups } = body;
    if (!groups?.length) {
        return NextResponse.json({ error: "No groups to normalize" }, { status: 400 });
    }

    const client = getBqClient();
    const results = [];

    for (const g of groups) {
        let deleted = 0;

        // Step 1: DELETE all existing rows (skip for subsequent chunks)
        if (!g.skipDelete) {
            const deleteQuery = `
                DELETE FROM \`${FULL_TABLE_ID}\`
                WHERE ma_cskcb = '${esc(g.ma_cskcb)}'
                  AND thang_qt = ${Number(g.thang_qt)}
                  AND nam_qt = ${Number(g.nam_qt)}
            `;
            const [delJob] = await client.createQueryJob({ query: deleteQuery });
            await delJob.getQueryResults();
            // Must call getMetadata() after job completes to get DML stats
            const [delMeta] = await delJob.getMetadata();
            deleted = Number(delMeta?.statistics?.query?.numDmlAffectedRows) || 0;
        }

        // Step 2: INSERT all Excel rows with normalization metadata
        const inserted = await insertNormalizedRows(client, g.rows);

        results.push({
            ma_cskcb: g.ma_cskcb,
            thang_qt: g.thang_qt,
            nam_qt: g.nam_qt,
            deleted,
            inserted,
        });
    }

    return NextResponse.json({ results });
}

/* ── Helpers ── */

function esc(val: unknown): string {
    return String(val ?? "").replace(/'/g, "\\'");
}

function bqScalar(val: unknown): string {
    if (val == null) return "";
    if (typeof val === "object" && val !== null && "value" in (val as Record<string, unknown>)) {
        return String((val as Record<string, unknown>).value ?? "");
    }
    return String(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertNormalizedRows(client: any, rows: Row[]): Promise<number> {
    const allowedCols = [...SCHEMA_COLS, "upload_timestamp", "source_file", "is_normalized", "normalized_at"];
    const allowedSet = new Set(allowedCols);

    const cleanRows = rows.map((row) => {
        const r: Row = {};
        for (const [key, val] of Object.entries(row)) {
            if (allowedSet.has(key)) r[key] = val;
        }
        // Add normalization metadata
        r["is_normalized"] = true;
        r["normalized_at"] = new Date().toISOString().replace("T", " ").replace("Z", "");
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
                if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
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
            console.error("[NORMALIZE-INSERT]", err instanceof Error ? err.message : err);
        }
    }
    return uploaded;
}
