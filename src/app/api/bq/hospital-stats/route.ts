import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import { PROJECT_ID, DATASET_ID, VIEW_ID } from "@/lib/config";

/** Cost fields used in Số tiền & Bình quân blocks */
const COST_FIELDS = [
    "t_thuoc", "t_xn", "t_cdha", "t_mau", "t_pttt",
    "t_vtyt", "t_kham", "t_giuong", "t_tongchi", "t_bhtt", "t_bntt",
];

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const query = `
      SELECT DISTINCT nam_qt, thang_qt
      FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
      ORDER BY nam_qt, thang_qt
    `;
        const rows = await runQuery<{ nam_qt: number; thang_qt: number }>(query);
        return NextResponse.json({ yearMonths: rows });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { periods } = body as {
            periods: Array<{
                fromYear: number;
                fromMonth: number;
                toYear: number;
                toMonth: number;
            }>;
        };

        const sumParts = COST_FIELDS.map(
            (f) => `SUM(IFNULL(${f}, 0)) AS ${f}`
        ).join(", ");

        const results = await Promise.all(
            periods.map(async (p) => {
                const fromYm = p.fromYear * 100 + p.fromMonth;
                const toYm = p.toYear * 100 + p.toMonth;
                const query = `
          SELECT
            ml2,
            COUNT(*) AS so_luot,
            SUM(IFNULL(so_ngay_dtri, 0)) AS so_ngay_dtri,
            ${sumParts}
          FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
          WHERE (nam_qt * 100 + thang_qt) BETWEEN ${fromYm} AND ${toYm}
          GROUP BY ml2
        `;
                return runQuery(query);
            })
        );

        return NextResponse.json({ results });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
