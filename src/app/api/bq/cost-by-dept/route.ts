import { NextResponse } from "next/server";
import { runQuery, getBqClient } from "@/lib/bigquery";
import {
    PROJECT_ID,
    DATASET_ID,
    VIEW_ID,
    getFullTableId,
    LOOKUP_KHOA_TABLE,
    LOOKUP_PROFILES_TABLE,
    LOOKUP_KHOA_MERGE_TABLE,
} from "@/lib/config";

/**
 * GET /api/bq/cost-by-dept
 * Returns: availableYearMonths, profileNames, khoaOrder, mergeRules
 */
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Available year-months
        const ymQuery = `
            SELECT DISTINCT nam_qt, thang_qt
            FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
            ORDER BY nam_qt, thang_qt
        `;
        const ymRows = await runQuery<{ nam_qt: number; thang_qt: number }>(ymQuery);

        // Khoa ordering
        let khoaOrder: Record<string, number> = {};
        try {
            const khoaTable = getFullTableId(LOOKUP_KHOA_TABLE);
            const orderQuery = `
                SELECT short_name AS khoa_name, MIN(thu_tu) AS thu_tu
                FROM \`${khoaTable}\`
                WHERE thu_tu IS NOT NULL
                GROUP BY short_name
            `;
            const orderRows = await runQuery<{ khoa_name: string; thu_tu: number }>(orderQuery);
            khoaOrder = Object.fromEntries(
                orderRows.map((r) => [r.khoa_name, r.thu_tu])
            );
        } catch {
            // Lookup table may not exist yet
        }

        // Profile names
        let profileNames: string[] = [];
        try {
            const profileTable = getFullTableId(LOOKUP_PROFILES_TABLE);
            const profileQuery = `SELECT DISTINCT profile_name FROM \`${profileTable}\` ORDER BY profile_name`;
            const profileRows = await runQuery<{ profile_name: string }>(profileQuery);
            profileNames = profileRows.map((r) => r.profile_name);
        } catch {
            // Lookup table may not exist yet
        }

        // Merge rules
        let mergeRules: Record<string, string> = {};
        let targetEstablished: Record<string, string> = {};
        try {
            const mergeTable = getFullTableId(LOOKUP_KHOA_MERGE_TABLE);
            const mergeQuery = `SELECT source_khoa, target_khoa FROM \`${mergeTable}\``;
            const mergeRows = await runQuery<{ source_khoa: string; target_khoa: string }>(mergeQuery);

            // Resolve source_khoa (may be display string or short_name) → short_name
            const khoaTable = getFullTableId(LOOKUP_KHOA_TABLE);
            const khoaQ = `SELECT DISTINCT short_name FROM \`${khoaTable}\``;
            const khoaNames = await runQuery<{ short_name: string }>(khoaQ);
            const shortNameSet = new Set(khoaNames.map((r) => r.short_name));

            for (const row of mergeRows) {
                let srcName = row.source_khoa;
                // If not a known short_name, extract from display format "MAKHOA SHORT_NAME (...)"
                if (!shortNameSet.has(srcName)) {
                    const match = srcName.match(/^\S+\s+(.+?)\s+\(/);
                    if (match) srcName = match[1];
                }
                mergeRules[srcName] = row.target_khoa;
            }

            // Get establishment dates for merge targets
            if (mergeRows.length > 0) {
                const targetNames = [...new Set(mergeRows.map((r) => r.target_khoa))];
                const namesCsv = targetNames.map((n: string) => `'${n.replace(/'/g, "\\'")}'`).join(", ");
                const vfQuery = `
                    SELECT short_name, MIN(valid_from) AS vf
                    FROM \`${khoaTable}\`
                    WHERE short_name IN (${namesCsv})
                    GROUP BY short_name
                `;
                const vfRows = await runQuery<{ short_name: string; vf: number | null }>(vfQuery);
                for (const row of vfRows) {
                    if (row.vf) {
                        const vf = Number(row.vf);
                        let year: number, month: number, day: number;
                        if (vf > 999999) {
                            year = Math.floor(vf / 10000);
                            month = Math.floor((vf % 10000) / 100);
                            day = vf % 100;
                        } else {
                            year = Math.floor(vf / 100);
                            month = vf % 100;
                            day = 1;
                        }
                        targetEstablished[row.short_name] = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
                    }
                }
            }
        } catch {
            // Lookup table may not exist yet
        }

        return NextResponse.json({
            yearMonths: ymRows,
            khoaOrder,
            profileNames,
            mergeRules,
            targetEstablished,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

interface PeriodRequest {
    fromYear: number;
    fromMonth: number;
    toYear: number;
    toMonth: number;
}

/**
 * POST /api/bq/cost-by-dept
 * Body: { periods: PeriodRequest[], profileName?: string }
 * Returns: { periodsData: [...], profileConfig?: [...] }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { periods, profileName } = body as {
            periods: PeriodRequest[];
            profileName?: string;
        };

        if (!periods || periods.length === 0) {
            return NextResponse.json({ error: "No periods specified" }, { status: 400 });
        }

        // Fetch data for each period in parallel
        const periodsData = await Promise.all(
            periods.map(async (p) => {
                const fromYm = p.fromYear * 100 + p.fromMonth;
                const toYm = p.toYear * 100 + p.toMonth;

                const query = `
                    SELECT
                        ml2,
                        khoa,
                        COUNT(*) AS so_luot,
                        SUM(IFNULL(so_ngay_dtri, 0)) AS so_ngay_dtri,
                        SUM(IFNULL(t_tongchi, 0)) AS t_tongchi,
                        SUM(IFNULL(t_xn, 0)) AS t_xn,
                        SUM(IFNULL(t_cdha, 0)) AS t_cdha,
                        SUM(IFNULL(t_thuoc, 0)) AS t_thuoc,
                        SUM(IFNULL(t_mau, 0)) AS t_mau,
                        SUM(IFNULL(t_pttt, 0)) AS t_pttt,
                        SUM(IFNULL(t_vtyt, 0)) AS t_vtyt,
                        SUM(IFNULL(t_kham, 0)) AS t_kham,
                        SUM(IFNULL(t_giuong, 0)) AS t_giuong,
                        SUM(IFNULL(t_bhtt, 0)) AS t_bhtt,
                        SUM(IFNULL(t_bntt, 0)) AS t_bntt
                    FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
                    WHERE (nam_qt * 100 + thang_qt) BETWEEN ${fromYm} AND ${toYm}
                    GROUP BY ml2, khoa
                    ORDER BY ml2, khoa
                `;
                const rows = await runQuery(query);
                return rows;
            })
        );

        // Optionally load profile config
        let profileConfig = null;
        if (profileName) {
            try {
                const profileTable = getFullTableId(LOOKUP_PROFILES_TABLE);
                const client = getBqClient();
                const query = `
                    SELECT metric_key, thu_tu, visible
                    FROM \`${profileTable}\`
                    WHERE profile_name = '${profileName.replace(/'/g, "\\'")}'
                    ORDER BY thu_tu
                `;
                const [job] = await client.createQueryJob({ query });
                const [rows] = await job.getQueryResults();
                profileConfig = rows.map((r: Record<string, unknown>) => ({
                    metric_key: r.metric_key as string,
                    thu_tu: Number(r.thu_tu),
                    visible: r.visible as boolean,
                }));
            } catch {
                // Profile table may not exist
            }
        }

        return NextResponse.json({ periodsData, profileConfig });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
