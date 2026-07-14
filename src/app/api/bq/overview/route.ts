import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { PROJECT_ID, DATASET_ID, VIEW_ID, FULL_TABLE_ID } from "@/lib/config";

/**
 * GET /api/bq/overview
 * Returns only available years — lightweight, fast query for initial page load
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
    try {
        const yearsQuery = `
            SELECT DISTINCT nam_qt
            FROM \`${FULL_TABLE_ID}\`
            ORDER BY nam_qt DESC
        `;
        const yearsRows = await runQuery<{ nam_qt: number }>(yearsQuery);
        const years = yearsRows.map((r) => r.nam_qt);

        return NextResponse.json({ years });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * POST /api/bq/overview
 * Body: { action: "summary" } → returns summary by year/month/CSKCB
 * Body: { action: "pivot", year: number } → returns pivot data for a year
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body as { action: string };

        if (action === "summary") {
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

            let total = 0;
            for (const row of summary) {
                const r = row as Record<string, unknown>;
                total += Number(r.so_dong) || 0;
            }

            return NextResponse.json({ summary, total });
        }

        if (action === "pivot") {
            const { year } = body as { year: number };
            const query = `
                SELECT
                    t.thang_qt,
                    lk.ml2,
                    t.ma_cskcb,
                    cs.ten_cskcb,
                    COUNT(*) AS so_luot,
                    SUM(t.t_tongchi) AS tong_chi,
                    COUNTIF(t.is_normalized = TRUE) AS so_luot_chuan_hoa,
                    SUM(IF(t.is_normalized = TRUE, t.t_tongchi, 0)) AS tong_chi_chuan_hoa
                FROM \`${FULL_TABLE_ID}\` t
                LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.lookup_loaikcb\` lk
                    ON CAST(t.ma_loaikcb AS STRING) = CAST(lk.ma_loaikcb AS STRING)
                LEFT JOIN \`${PROJECT_ID}.${DATASET_ID}.lookup_cskcb\` cs
                    ON t.ma_cskcb = CAST(cs.ma_cskcb AS STRING)
                    AND cs.valid_from <= (${year} * 10000 + t.thang_qt * 100 + 1)
                    AND (cs.valid_to IS NULL OR cs.valid_to >= (${year} * 10000 + t.thang_qt * 100 + 1))
                WHERE t.nam_qt = ${year}
                GROUP BY t.thang_qt, lk.ml2, t.ma_cskcb, cs.ten_cskcb
                ORDER BY t.thang_qt, lk.ml2, t.ma_cskcb
            `;
            const rows = await runQuery(query);
            return NextResponse.json({ data: rows });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
