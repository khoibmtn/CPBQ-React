import { NextResponse } from "next/server";
import { runQuery } from "@/lib/bigquery";
import {
    PROJECT_ID,
    DATASET_ID,
    VIEW_ID,
    getFullTableId,
    LOOKUP_KHOA_TABLE,
    LOOKUP_KHOA_MERGE_TABLE,
} from "@/lib/config";

/**
 * GET /api/bq/icd-analysis
 * Returns: availableYearMonths, mergeRules
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Load merge rules: source_khoa → target_khoa */
async function loadMergeRules(): Promise<Record<string, string>> {
    try {
        const mergeTable = getFullTableId(LOOKUP_KHOA_MERGE_TABLE);
        const mergeQuery = `SELECT source_khoa, target_khoa FROM \`${mergeTable}\``;
        const mergeRows = await runQuery<{ source_khoa: string; target_khoa: string }>(mergeQuery);

        const khoaTable = getFullTableId(LOOKUP_KHOA_TABLE);
        const khoaQ = `SELECT DISTINCT short_name FROM \`${khoaTable}\``;
        const khoaNames = await runQuery<{ short_name: string }>(khoaQ);
        const shortNameSet = new Set(khoaNames.map((r) => r.short_name));

        const rules: Record<string, string> = {};
        for (const row of mergeRows) {
            let srcName = row.source_khoa;
            if (!shortNameSet.has(srcName)) {
                const match = srcName.match(/^\S+\s+(.+?)\s+\(/);
                if (match) srcName = match[1];
            }
            rules[srcName] = row.target_khoa;
        }
        return rules;
    } catch {
        return {};
    }
}

/** Build reverse map: target_khoa → [source_khoa1, source_khoa2, ...] */
function buildReverseRules(mergeRules: Record<string, string>): Record<string, string[]> {
    const reverse: Record<string, string[]> = {};
    for (const [src, tgt] of Object.entries(mergeRules)) {
        if (!reverse[tgt]) reverse[tgt] = [];
        reverse[tgt].push(src);
    }
    return reverse;
}

export async function GET() {
    try {
        const ymQuery = `
            SELECT DISTINCT nam_qt, thang_qt
            FROM \`${PROJECT_ID}.${DATASET_ID}.${VIEW_ID}\`
            ORDER BY nam_qt, thang_qt
        `;
        const ymRows = await runQuery<{ nam_qt: number; thang_qt: number }>(ymQuery);

        const mergeRules = await loadMergeRules();

        return NextResponse.json({ yearMonths: ymRows, mergeRules });
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

        // Load merge rules
        const mergeRules = await loadMergeRules();
        const reverseRules = buildReverseRules(mergeRules);

        // Build ml2 clause
        const ml2Clause = ml2Filter !== "all" ? `AND ml2 = '${ml2Filter}'` : "";

        // Build khoa clause — expand to include source departments that merge into selected target
        let khoaClause = "";
        if (khoaFilter !== "all") {
            const khoaNames = [khoaFilter];
            // If selected khoa is a merge target, include its source departments
            if (reverseRules[khoaFilter]) {
                khoaNames.push(...reverseRules[khoaFilter]);
            }
            const escaped = khoaNames.map((k) => `'${k.replace(/'/g, "\\'")}'`);
            khoaClause = `AND khoa IN (${escaped.join(", ")})`;
        }

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
                        SUM(IFNULL(t_bhtt, 0)) AS t_bhtt,
                        SUM(IFNULL(t_thuoc, 0)) AS t_thuoc,
                        SUM(IFNULL(t_xn, 0)) AS t_xn,
                        SUM(IFNULL(t_cdha, 0)) AS t_cdha,
                        SUM(IFNULL(t_mau, 0)) AS t_mau,
                        SUM(IFNULL(t_pttt, 0)) AS t_pttt,
                        SUM(IFNULL(t_vtyt, 0)) AS t_vtyt,
                        SUM(IFNULL(t_giuong, 0)) AS t_giuong
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

        // Get available khoa for the combined periods, then apply merge rules
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

        // Apply merge rules to available khoa list:
        // - Remap source khoa names to their target
        // - Deduplicate
        const khoaSet = new Set<string>();
        for (const r of khoaRows) {
            const mapped = mergeRules[r.khoa] || r.khoa;
            khoaSet.add(mapped);
        }
        const availableKhoa = [...khoaSet].sort();

        return NextResponse.json({ periodsData, availableKhoa });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        );
    }
}
