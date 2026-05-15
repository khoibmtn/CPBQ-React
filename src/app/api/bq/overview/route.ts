import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { PROJECT_ID, DATASET_ID, VIEW_ID, FULL_TABLE_ID } from "@/lib/config";

/**
 * GET /api/bq/overview
 * Returns: { years: number[], summary: {...}[], total: number }
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
    try {
        // Single query that returns all needed data: summary + years + total
        const summaryQuery = `
            SELECT
                nam_qt,
                thang_qt,
                ma_cskcb,
                COUNT(*) AS so_dong,
                SUM(t_tongchi) AS tong_chi,
                MIN(upload_timestamp) AS upload_tu,
                MAX(upload_timestamp) AS upload_den,
                STRING_AGG(DISTINCT source_file, ', ') AS source_files
            FROM \`${FULL_TABLE_ID}\`
            GROUP BY nam_qt, thang_qt, ma_cskcb
            ORDER BY nam_qt DESC, thang_qt DESC, ma_cskcb
        `;
        const summary = await runQuery(summaryQuery);

        // Derive years + total from summary data — no extra queries
        const yearsSet = new Set<number>();
        let total = 0;
        for (const row of summary) {
            const r = row as Record<string, unknown>;
            yearsSet.add(Number(r.nam_qt));
            total += Number(r.so_dong) || 0;
        }
        const years = [...yearsSet].sort((a, b) => b - a);

        return NextResponse.json({ years, summary, total });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * POST /api/bq/overview
 * Body: { year: number, metric: "so_luot" | "tong_chi" }
 * Returns pivot data: month × CSKCB × nội/ngoại trú
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { year } = body as { year: number };

        const query = `
            SELECT
                thang_qt,
                ml2,
                v.ma_cskcb,
                cs.ten_cskcb,
                COUNT(*) AS so_luot,
                SUM(t_tongchi) AS tong_chi
            FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\` v
            LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.lookup_cskcb\` cs
                ON v.ma_cskcb = CAST(cs.ma_cskcb AS STRING)
                AND cs.valid_from <= (${year} * 10000 + v.thang_qt * 100 + 1)
                AND (cs.valid_to IS NULL OR cs.valid_to >= (${year} * 10000 + v.thang_qt * 100 + 1))
            WHERE nam_qt = ${year}
            GROUP BY thang_qt, ml2, v.ma_cskcb, cs.ten_cskcb
            ORDER BY thang_qt, ml2, v.ma_cskcb
        `;
        const rows = await runQuery(query);

        return NextResponse.json({ data: rows });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
