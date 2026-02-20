import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { PROJECT_ID, DATASET_ID, VIEW_ID } from "@/lib/config";

/**
 * GET /api/bq/icd-analysis
 * Returns: availableYearMonths
 */
export async function GET() {
    try {
        const ymQuery = `
            SELECT DISTINCT nam_qt, thang_qt
            FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
            ORDER BY nam_qt, thang_qt
        `;
        const ymRows = await runQuery<{ nam_qt: number; thang_qt: number }>(ymQuery);

        return NextResponse.json({ yearMonths: ymRows });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}

interface PeriodRequest {
    fromYear: number;
    fromMonth: number;
    toYear: number;
    toMonth: number;
}

/**
 * POST /api/bq/icd-analysis
 * Body: { periods: PeriodRequest[], ml2Filter: string, khoaFilter: string }
 * Returns: { periodsData: [...], availableKhoa: string[] }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const periods: PeriodRequest[] = body.periods || [];
        const ml2Filter: string = body.ml2Filter || "all";
        const khoaFilter: string = body.khoaFilter || "all";

        if (periods.length === 0) {
            return NextResponse.json(
                { error: "At least one period is required" },
                { status: 400 }
            );
        }

        // Build ml2/khoa clauses
        const ml2Clause = ml2Filter !== "all" ? `AND ml2 = '${ml2Filter}'` : "";
        const khoaClause = khoaFilter !== "all"
            ? `AND khoa = '${khoaFilter.replace(/'/g, "\\'")}'`
            : "";

        // Query ICD data for each period
        const periodsData = await Promise.all(
            periods.map(async (p) => {
                const fromYm = p.fromYear * 100 + p.fromMonth;
                const toYm = p.toYear * 100 + p.toMonth;

                const query = `
                    SELECT
                        ma_benh_chinh,
                        COUNT(*) AS so_luot,
                        SUM(IFNULL(so_ngay_dtri, 0)) AS so_ngay_dtri,
                        SUM(IFNULL(t_tongchi, 0)) AS t_tongchi,
                        SUM(IFNULL(t_bhtt, 0)) AS t_bhtt
                    FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
                    WHERE (nam_qt * 100 + thang_qt) BETWEEN ${fromYm} AND ${toYm}
                      AND ma_benh_chinh IS NOT NULL
                      ${ml2Clause}
                      ${khoaClause}
                    GROUP BY ma_benh_chinh
                    ORDER BY t_tongchi DESC
                `;
                return runQuery(query);
            })
        );

        // Get available khoa for the combined periods
        const orClauses = periods.map((p) => {
            const fromYm = p.fromYear * 100 + p.fromMonth;
            const toYm = p.toYear * 100 + p.toMonth;
            return `(nam_qt * 100 + thang_qt) BETWEEN ${fromYm} AND ${toYm}`;
        });
        const whereRanges = orClauses.join(" OR ");
        const khoaQuery = `
            SELECT DISTINCT khoa
            FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
            WHERE (${whereRanges})
              ${ml2Clause}
            ORDER BY khoa
        `;
        const khoaRows = await runQuery<{ khoa: string }>(khoaQuery);
        const availableKhoa = khoaRows.map((r) => r.khoa).sort();

        return NextResponse.json({ periodsData, availableKhoa });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}
