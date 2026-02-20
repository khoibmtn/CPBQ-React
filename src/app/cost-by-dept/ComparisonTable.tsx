"use client";

import {
    ColumnDef,
    fmtNumber,
    calcBq,
    calcRatio,
    getColRawValue,
    sumRows,
} from "@/lib/metrics";
import { PeriodDef } from "./PeriodSelector";
import { getPeriodColor, formatPeriodLabel } from "@/lib/metrics";

type Row = Record<string, number>;

interface PeriodData {
    period: PeriodDef;
    data: Row[];
}

interface ComparisonTableProps {
    periodsData: PeriodData[];
    columns: ColumnDef[];
    khoaOrder: Record<string, number>;
    mergeRules: Record<string, string>;
    showDiff: boolean;
    showRatio: boolean;
}

export default function ComparisonTable({
    periodsData,
    columns,
    khoaOrder,
    mergeRules,
    showDiff,
    showRatio,
}: ComparisonTableProps) {
    const nPeriods = periodsData.length;
    const effectiveShowDiff = showDiff && nPeriods >= 2;
    const effectiveShowRatio = showRatio && nPeriods >= 2;
    const colSpan =
        nPeriods +
        (effectiveShowDiff ? 1 : 0) +
        (effectiveShowRatio ? 1 : 0);

    if (columns.length === 0) {
        return (
            <div className="data-table-empty">
                Profile này không có cột nào được hiển thị.
            </div>
        );
    }

    // ── Apply merge rules ──
    const applyMerge = (rows: Row[]): Row[] => {
        if (!mergeRules || Object.keys(mergeRules).length === 0)
            return rows;

        const grouped = new Map<string, Row>();
        for (const row of rows) {
            const origKhoa = row.khoa as unknown as string;
            const ml2 = row.ml2 as unknown as string;
            const mappedKhoa = mergeRules[origKhoa] || origKhoa;
            const key = `${ml2}|${mappedKhoa}`;

            if (grouped.has(key)) {
                const existing = grouped.get(key)!;
                for (const [k, v] of Object.entries(row)) {
                    if (k === "ml2" || k === "khoa") continue;
                    existing[k] = (existing[k] || 0) + (v || 0);
                }
            } else {
                grouped.set(key, {
                    ...row,
                    khoa: mappedKhoa as unknown as number,
                });
            }
        }
        return Array.from(grouped.values());
    };

    // ── Group data by ml2 → khoa → period values ──
    const groups: Record<
        string,
        Record<string, (Row | null)[]>
    > = { "Ngoại trú": {}, "Nội trú": {} };

    periodsData.forEach((pd, pi) => {
        const mergedData = applyMerge(pd.data);
        for (const row of mergedData) {
            const ml2 = row.ml2 as unknown as string;
            const khoa = row.khoa as unknown as string;
            if (!(ml2 in groups)) continue;
            if (!(khoa in groups[ml2])) {
                groups[ml2][khoa] = new Array(nPeriods).fill(null);
            }
            groups[ml2][khoa][pi] = row;
        }
    });

    // ── Sort departments ──
    const sortKey = (name: string): [number, number, string] => {
        const order = khoaOrder[name];
        if (order != null) return [0, order, name];
        return [1, 0, name];
    };

    for (const ml2 of Object.keys(groups)) {
        const entries = Object.entries(groups[ml2]);
        entries.sort((a, b) => {
            const ka = sortKey(a[0]);
            const kb = sortKey(b[0]);
            if (ka[0] !== kb[0]) return ka[0] - kb[0];
            if (ka[1] !== kb[1]) return ka[1] - kb[1];
            return ka[2].localeCompare(kb[2]);
        });
        groups[ml2] = Object.fromEntries(entries);
    }

    // ── Helper: cell value from Column + Row ──
    const getCellValue = (col: ColumnDef, row: Row | null): string => {
        if (!row) return "";
        if (col.type === "metric") {
            const key = col.isCount ? "so_luot" : (col.field || "");
            return fmtNumber(row[key], col.isCount);
        } else if (col.type === "bq") {
            return calcBq(row[col.field || ""], row["so_luot"]);
        } else if (col.type === "ratio") {
            return calcRatio(
                row[col.numField || ""],
                row[col.denField || ""],
                col.fmt
            );
        }
        return "";
    };

    const fmtDiff = (first: number, last: number): string => {
        const diff = last - first;
        if (diff === 0) return "-";
        const sign = diff > 0 ? "+" : "";
        const color =
            diff > 0
                ? "var(--tbl-diff-pos)"
                : "var(--tbl-diff-neg)";
        const txt =
            Math.abs(diff) < 100
                ? `${sign}${diff.toFixed(2)}`
                : `${sign}${Math.round(diff).toLocaleString("en-US")}`;
        return `<span style="color:${color};font-weight:600">${txt}</span>`;
    };

    const fmtPctChange = (first: number, last: number): string => {
        if (!first || first === 0) return "";
        if (!last) return "";
        const pct = (last / first - 1) * 100;
        const sign = pct > 0 ? "+" : "";
        const color =
            pct > 0
                ? "var(--tbl-diff-pos)"
                : pct < 0
                    ? "var(--tbl-diff-neg)"
                    : "var(--text-muted)";
        return `<span style="color:${color};font-weight:600">${sign}${pct.toFixed(1)}%</span>`;
    };

    // ── Build subtotals and grand totals ──
    const allSubtotals: Record<string, Row[]> = {};
    const sectionLabels: [string, string][] = [
        ["Ngoại trú", "I. Ngoại trú"],
        ["Nội trú", "II. Nội trú"],
    ];

    for (const [ml2Key] of sectionLabels) {
        const deptDict = groups[ml2Key] || {};
        const deptRows = Object.values(deptDict);
        allSubtotals[ml2Key] = sumRows(deptRows, nPeriods);
    }

    const ngoaiTotals = allSubtotals["Ngoại trú"] || Array(nPeriods).fill({});
    const noiTotals = allSubtotals["Nội trú"] || Array(nPeriods).fill({});

    // Render diff+ratio cells for a set of period rows
    const renderDiffRatio = (
        col: ColumnDef,
        periodDataList: (Row | null)[]
    ) => {
        const cells: string[] = [];
        if (effectiveShowDiff) {
            const first = getColRawValue(col, periodDataList[0] as Row | null);
            const last = getColRawValue(col, periodDataList[periodDataList.length - 1] as Row | null);
            cells.push(fmtDiff(first, last));
        }
        if (effectiveShowRatio) {
            const first = getColRawValue(col, periodDataList[0] as Row | null);
            const last = getColRawValue(col, periodDataList[periodDataList.length - 1] as Row | null);
            cells.push(fmtPctChange(first, last));
        }
        return cells;
    };

    // ── Render ──
    const totalDataCols = columns.length * colSpan;

    return (
        <div className="comparison-table-wrapper">
            <table className="comparison-table">
                <thead>
                    {/* Row 1: Metric group headers */}
                    <tr>
                        <th className="ct-th ct-fixed-col" rowSpan={2} style={{ width: 40 }}>
                            TT
                        </th>
                        <th className="ct-th ct-fixed-col ct-khoa-col" rowSpan={2}>
                            Khoa
                        </th>
                        {columns.map((col, ci) => (
                            <th
                                key={ci}
                                className="ct-th"
                                colSpan={colSpan}
                            >
                                {col.name}
                                {col.noiOnly && (
                                    <span className="ct-noi-badge"> (NT)</span>
                                )}
                            </th>
                        ))}
                    </tr>
                    {/* Row 2: Period sub-headers */}
                    <tr>
                        {columns.map((_, ci) => (
                            <SubHeaderCells
                                key={ci}
                                periodsData={periodsData}
                                showDiff={effectiveShowDiff}
                                showRatio={effectiveShowRatio}
                            />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sectionLabels.map(([ml2Key, sectionTitle]) => {
                        const deptDict = groups[ml2Key] || {};
                        if (Object.keys(deptDict).length === 0) return null;

                        return (
                            <SectionRows
                                key={ml2Key}
                                ml2Key={ml2Key}
                                sectionTitle={sectionTitle}
                                deptDict={deptDict}
                                columns={columns}
                                nPeriods={nPeriods}
                                colSpan={colSpan}
                                totalDataCols={totalDataCols}
                                getCellValue={getCellValue}
                                renderDiffRatio={renderDiffRatio}
                                effectiveShowDiff={effectiveShowDiff}
                                effectiveShowRatio={effectiveShowRatio}
                            />
                        );
                    })}

                    {/* III. TỔNG section */}
                    <tr className="ct-section-row">
                        <td className="ct-fixed-col"></td>
                        <td className="ct-fixed-col ct-khoa-col ct-section-label">
                            III. TỔNG
                        </td>
                        <td colSpan={totalDataCols}></td>
                    </tr>

                    {/* Subtotal: Ngoại trú */}
                    <SubtotalRow
                        label="Ngoại trú"
                        index={1}
                        totals={ngoaiTotals}
                        columns={columns}
                        nPeriods={nPeriods}
                        getCellValue={getCellValue}
                        renderDiffRatio={renderDiffRatio}
                        effectiveShowDiff={effectiveShowDiff}
                        effectiveShowRatio={effectiveShowRatio}
                    />

                    {/* Subtotal: Nội trú */}
                    <SubtotalRow
                        label="Nội trú"
                        index={2}
                        totals={noiTotals}
                        columns={columns}
                        nPeriods={nPeriods}
                        getCellValue={getCellValue}
                        renderDiffRatio={renderDiffRatio}
                        effectiveShowDiff={effectiveShowDiff}
                        effectiveShowRatio={effectiveShowRatio}
                    />

                    {/* Grand total */}
                    <GrandTotalRow
                        ngoaiTotals={ngoaiTotals}
                        noiTotals={noiTotals}
                        columns={columns}
                        nPeriods={nPeriods}
                        getCellValue={getCellValue}
                        renderDiffRatio={renderDiffRatio}
                        effectiveShowDiff={effectiveShowDiff}
                        effectiveShowRatio={effectiveShowRatio}
                    />
                </tbody>
            </table>
        </div>
    );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function SubHeaderCells({
    periodsData,
    showDiff,
    showRatio,
}: {
    periodsData: PeriodData[];
    showDiff: boolean;
    showRatio: boolean;
}) {
    return (
        <>
            {periodsData.map((pd, pi) => {
                const color = getPeriodColor(pi);
                const label = formatPeriodLabel(
                    pd.period.fromYear,
                    pd.period.fromMonth,
                    pd.period.toYear,
                    pd.period.toMonth
                );
                return (
                    <th
                        key={pi}
                        className="ct-sub-th"
                        style={{ backgroundColor: color.border }}
                    >
                        {label}
                    </th>
                );
            })}
            {showDiff && <th className="ct-sub-th ct-diff-th">Chênh lệch</th>}
            {showRatio && (
                <th className="ct-sub-th ct-ratio-th">Tỷ lệ%</th>
            )}
        </>
    );
}

function SectionRows({
    ml2Key,
    sectionTitle,
    deptDict,
    columns,
    nPeriods,
    totalDataCols,
    getCellValue,
    renderDiffRatio,
    effectiveShowDiff,
    effectiveShowRatio,
}: {
    ml2Key: string;
    sectionTitle: string;
    deptDict: Record<string, (Row | null)[]>;
    columns: ColumnDef[];
    nPeriods: number;
    colSpan: number;
    totalDataCols: number;
    getCellValue: (col: ColumnDef, row: Row | null) => string;
    renderDiffRatio: (col: ColumnDef, rows: (Row | null)[]) => string[];
    effectiveShowDiff: boolean;
    effectiveShowRatio: boolean;
}) {
    const entries = Object.entries(deptDict);

    return (
        <>
            {/* Section header */}
            <tr className="ct-section-row" data-section={ml2Key}>
                <td className="ct-fixed-col"></td>
                <td className="ct-fixed-col ct-khoa-col ct-section-label">
                    {sectionTitle}
                </td>
                <td colSpan={totalDataCols}></td>
            </tr>

            {/* Department rows */}
            {entries.map(([khoaName, periodDataList], idx) => (
                <tr key={khoaName} className={idx % 2 === 0 ? "ct-row-even" : "ct-row-odd"}>
                    <td className="ct-fixed-col ct-idx">{idx + 1}</td>
                    <td className="ct-fixed-col ct-khoa-col ct-khoa-name">
                        {khoaName}
                    </td>
                    {columns.map((col, ci) => (
                        <DataCells
                            key={ci}
                            col={col}
                            periodDataList={periodDataList}
                            nPeriods={nPeriods}
                            getCellValue={getCellValue}
                            renderDiffRatio={renderDiffRatio}
                            effectiveShowDiff={effectiveShowDiff}
                            effectiveShowRatio={effectiveShowRatio}
                        />
                    ))}
                </tr>
            ))}
        </>
    );
}

function DataCells({
    col,
    periodDataList,
    nPeriods,
    getCellValue,
    renderDiffRatio,
    effectiveShowDiff,
    effectiveShowRatio,
}: {
    col: ColumnDef;
    periodDataList: (Row | null)[];
    nPeriods: number;
    getCellValue: (col: ColumnDef, row: Row | null) => string;
    renderDiffRatio: (col: ColumnDef, rows: (Row | null)[]) => string[];
    effectiveShowDiff: boolean;
    effectiveShowRatio: boolean;
}) {
    const diffs = renderDiffRatio(col, periodDataList);

    return (
        <>
            {Array.from({ length: nPeriods }).map((_, pi) => (
                <td key={pi} className="ct-td-num">
                    {getCellValue(col, periodDataList[pi])}
                </td>
            ))}
            {effectiveShowDiff && (
                <td
                    className="ct-td-num"
                    dangerouslySetInnerHTML={{ __html: diffs[0] || "" }}
                />
            )}
            {effectiveShowRatio && (
                <td
                    className="ct-td-num"
                    dangerouslySetInnerHTML={{
                        __html: diffs[effectiveShowDiff ? 1 : 0] || "",
                    }}
                />
            )}
        </>
    );
}

function SubtotalRow({
    label,
    index,
    totals,
    columns,
    nPeriods,
    getCellValue,
    renderDiffRatio,
    effectiveShowDiff,
    effectiveShowRatio,
}: {
    label: string;
    index: number;
    totals: Row[];
    columns: ColumnDef[];
    nPeriods: number;
    getCellValue: (col: ColumnDef, row: Row | null) => string;
    renderDiffRatio: (col: ColumnDef, rows: (Row | null)[]) => string[];
    effectiveShowDiff: boolean;
    effectiveShowRatio: boolean;
}) {
    return (
        <tr className="ct-subtotal-row">
            <td className="ct-fixed-col ct-idx ct-bold">{index}</td>
            <td className="ct-fixed-col ct-khoa-col ct-subtotal-label">
                {label}
            </td>
            {columns.map((col, ci) => (
                <DataCells
                    key={ci}
                    col={col}
                    periodDataList={totals}
                    nPeriods={nPeriods}
                    getCellValue={getCellValue}
                    renderDiffRatio={renderDiffRatio}
                    effectiveShowDiff={effectiveShowDiff}
                    effectiveShowRatio={effectiveShowRatio}
                />
            ))}
        </tr>
    );
}

function GrandTotalRow({
    ngoaiTotals,
    noiTotals,
    columns,
    nPeriods,
    getCellValue,
    renderDiffRatio,
    effectiveShowDiff,
    effectiveShowRatio,
}: {
    ngoaiTotals: Row[];
    noiTotals: Row[];
    columns: ColumnDef[];
    nPeriods: number;
    getCellValue: (col: ColumnDef, row: Row | null) => string;
    renderDiffRatio: (col: ColumnDef, rows: (Row | null)[]) => string[];
    effectiveShowDiff: boolean;
    effectiveShowRatio: boolean;
}) {
    // Combine ngoại trú + nội trú totals
    const combined: Row[] = [];
    for (let pi = 0; pi < nPeriods; pi++) {
        const ct: Row = {};
        const ngoai = ngoaiTotals[pi] || {};
        const noi = noiTotals[pi] || {};
        const allKeys = new Set([...Object.keys(ngoai), ...Object.keys(noi)]);
        for (const k of allKeys) {
            ct[k] = (ngoai[k] || 0) + (noi[k] || 0);
        }
        combined.push(ct);
    }

    return (
        <tr className="ct-total-row">
            <td className="ct-fixed-col ct-idx ct-bold"></td>
            <td className="ct-fixed-col ct-khoa-col ct-total-label">
                Tổng cộng
            </td>
            {columns.map((col, ci) => (
                <DataCells
                    key={ci}
                    col={col}
                    periodDataList={combined}
                    nPeriods={nPeriods}
                    getCellValue={getCellValue}
                    renderDiffRatio={renderDiffRatio}
                    effectiveShowDiff={effectiveShowDiff}
                    effectiveShowRatio={effectiveShowRatio}
                />
            ))}
        </tr>
    );
}
