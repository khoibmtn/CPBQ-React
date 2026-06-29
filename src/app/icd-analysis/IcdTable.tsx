"use client";

import React from "react";
import { getPeriodColor, formatPeriodLabel } from "@/lib/metrics";
import { PeriodDef } from "@/components/ui/PeriodSelector";
import type { CostCategorySelection, CostCategoryMode } from "./CostCategoryPicker";

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface IcdRow {
    ma_benh_chinh: string;
    so_luot: number;
    so_ngay_dtri: number;
    t_tongchi: number;
    t_bhtt: number;
    t_thuoc: number;
    t_xn: number;
    t_cdha: number;
    t_mau: number;
    t_pttt: number;
    t_vtyt: number;
    t_giuong: number;
}

export interface IcdPeriodData {
    period: PeriodDef;
    data: IcdRow[];
}

export type CostType = "soluot" | "tongcp" | "cpbhyt";
export type DiffMetric = "so_luot" | "ngay_dttb" | "bq_dt" | "pct_val";

interface IcdTableProps {
    periodsData: IcdPeriodData[];
    icdList: string[];
    costType: CostType;
    pctColLabel: string;
    diffMetric: DiffMetric | null;
    diffReverse: boolean;
    costCategories: CostCategorySelection[];
    icdNameMap?: Record<string, string>;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function fmtNumber(val: number | null | undefined, decimals = 0): string {
    if (val == null || isNaN(val)) return "-";
    if (decimals > 0) return val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return Math.round(val).toLocaleString("en-US");
}

function fmtPct(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return "-";
    return `${val.toFixed(2)}%`;
}

interface ComputedRow {
    so_luot: number;
    ngay_dttb: number;
    bq_dt: number;
    pct_val: number;
}

function computeRowValues(
    row: IcdRow,
    costType: CostType,
    periodTotal: { so_luot: number; t_tongchi: number; t_bhtt: number }
): ComputedRow {
    const so_luot = row.so_luot || 0;
    const so_ngay = row.so_ngay_dtri || 0;
    const tongchi = row.t_tongchi || 0;
    const bhtt = row.t_bhtt || 0;

    const ngay_dttb = so_luot ? so_ngay / so_luot : 0;
    const bq_dt = costType === "cpbhyt"
        ? (so_luot ? bhtt / so_luot : 0)
        : (so_luot ? tongchi / so_luot : 0);

    let pct_val = 0;
    if (costType === "soluot") {
        pct_val = periodTotal.so_luot ? (so_luot / periodTotal.so_luot) * 100 : 0;
    } else if (costType === "tongcp") {
        pct_val = periodTotal.t_tongchi ? (tongchi / periodTotal.t_tongchi) * 100 : 0;
    } else {
        pct_val = periodTotal.t_bhtt ? (bhtt / periodTotal.t_bhtt) * 100 : 0;
    }

    return { so_luot, ngay_dttb, bq_dt, pct_val };
}

function diffColor(val: number): string {
    if (val > 0) return "var(--tbl-diff-pos)";
    if (val < 0) return "var(--tbl-diff-neg)";
    return "var(--tbl-td-color)";
}

function computeCategoryValue(
    row: IcdRow,
    field: string,
    mode: CostCategoryMode
): number {
    const rawVal = (row as unknown as Record<string, number>)[field] || 0;
    if (mode === "amount") return rawVal;
    if (mode === "average") return row.so_luot ? rawVal / row.so_luot : 0;
    // ratio: field / t_tongchi (only for t_thuoc)
    return row.t_tongchi ? (rawVal / row.t_tongchi) * 100 : 0;
}

function catColLabel(cat: CostCategorySelection): string {
    const modeLabel: Record<CostCategoryMode, string> = {
        amount: "",
        average: " (BQ)",
        ratio: " (%)",
    };
    return cat.label + modeLabel[cat.mode];
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function IcdTable({
    periodsData,
    icdList,
    costType,
    pctColLabel,
    diffMetric,
    diffReverse,
    costCategories,
    icdNameMap,
}: IcdTableProps) {
    const n = periodsData.length;
    const showDiff = diffMetric !== null && n >= 2;
    const showName = icdNameMap && Object.keys(icdNameMap).length > 0;

    // Precompute totals per period
    const periodTotals = periodsData.map((pd) => {
        if (!pd.data || pd.data.length === 0) {
            return { so_luot: 0, t_tongchi: 0, t_bhtt: 0 };
        }
        return {
            so_luot: pd.data.reduce((s, r) => s + (r.so_luot || 0), 0),
            t_tongchi: pd.data.reduce((s, r) => s + (r.t_tongchi || 0), 0),
            t_bhtt: pd.data.reduce((s, r) => s + (r.t_bhtt || 0), 0),
        };
    });

    // Build lookups: period_idx → { icd_code → IcdRow }
    const periodLookups = periodsData.map((pd) => {
        const lookup: Record<string, IcdRow> = {};
        if (pd.data) {
            for (const row of pd.data) {
                lookup[row.ma_benh_chinh] = row;
            }
        }
        return lookup;
    });

    // Column labels
    const bqLabel = costType === "cpbhyt" ? "BQĐT BHYT" : "BQĐT Tổng chi";
    const catLabels = costCategories.map(catColLabel);
    // Columns: Số lượt, Ngày ĐTTB, [category cols...], BQĐT, %Tổng CP
    const colLabels = ["Số lượt", "Ngày ĐTTB", ...catLabels, bqLabel, pctColLabel];
    const colsPerPeriod = colLabels.length;

    // Diff labels
    let diffValueLabel = "";
    if (showDiff && diffMetric) {
        if (diffMetric === "so_luot") diffValueLabel = "Lượt";
        else if (diffMetric === "ngay_dttb") diffValueLabel = "Ngày";
        else diffValueLabel = "Chi phí";
    }

    return (
        <div className="comparison-table-wrapper">
            <table className="comparison-table icd-table">
                <thead>
                    {/* HEADER ROW 1 */}
                    <tr>
                        <th className="ct-th" rowSpan={2} style={{ width: 40, textAlign: "center" }}>
                            STT
                        </th>
                        <th className="ct-th" rowSpan={2} style={{ textAlign: "center", minWidth: 55 }}>
                            Mã bệnh
                        </th>
                        {showName && (
                            <th className="ct-th" rowSpan={2} style={{
                                textAlign: "left",
                                minWidth: 220,
                                maxWidth: 320,
                            }}>
                                Tên bệnh
                            </th>
                        )}
                        {periodsData.map((pd, idx) => {
                            const color = getPeriodColor(idx);
                            const label = formatPeriodLabel(
                                pd.period.fromYear, pd.period.fromMonth,
                                pd.period.toYear, pd.period.toMonth
                            );
                            return (
                                <th
                                    key={`phead-${idx}`}
                                    className="ct-th ct-period-header"
                                    colSpan={colsPerPeriod}
                                    style={{ backgroundColor: color.border, textAlign: "center" }}
                                >
                                    {label}
                                </th>
                            );
                        })}
                        {showDiff && (
                            <th
                                className="ct-th"
                                colSpan={2}
                                style={{ textAlign: "center", backgroundColor: "#d97706", color: "#fff" }}
                            >
                                Chênh lệch ({diffReverse ? "T-P" : "P-T"})
                            </th>
                        )}
                    </tr>

                    {/* HEADER ROW 2 */}
                    <tr>
                        {periodsData.map((_, idx) => {
                            const color = getPeriodColor(idx);
                            return colLabels.map((cl, ci) => (
                                <th
                                    key={`sub-${idx}-${ci}`}
                                    className="ct-th ct-sub-header"
                                    style={{ textAlign: "center", backgroundColor: color.bg }}
                                >
                                    {cl}
                                </th>
                            ));
                        })}
                        {showDiff && (
                            <>
                                <th className="ct-th ct-sub-header" style={{ textAlign: "center", backgroundColor: "#fef3c7", color: "#78350f" }}>
                                    {diffValueLabel}
                                </th>
                                <th className="ct-th ct-sub-header" style={{ textAlign: "center", backgroundColor: "#fef3c7", color: "#78350f" }}>
                                    %
                                </th>
                            </>
                        )}
                    </tr>
                </thead>

                <tbody>
                    {/* DATA ROWS */}
                    {icdList.map((icdCode, sttIdx) => {
                        const stt = sttIdx + 1;
                        const rowClass = stt % 2 === 0 ? "ct-row-even" : "ct-row-odd";

                        const computedValues: (ComputedRow | null)[] = [];

                        return (
                            <tr key={icdCode} className={rowClass}>
                                <td className="ct-td" style={{ textAlign: "center", color: "var(--tbl-col-fixed-muted)" }}>
                                    {stt}
                                </td>
                                <td className="ct-td icd-code-cell" style={{ textAlign: "left", fontWeight: 600, whiteSpace: "nowrap" }}>
                                    {icdCode}
                                </td>
                                {showName && (
                                    <td className="ct-td" style={{
                                        textAlign: "left",
                                        fontSize: "11px",
                                        color: "#475569",
                                        lineHeight: 1.4,
                                        wordBreak: "break-word" as const,
                                        overflowWrap: "break-word" as const,
                                        whiteSpace: "normal" as const,
                                        minWidth: 220,
                                        maxWidth: 320,
                                    }}>
                                        {icdNameMap[icdCode] || icdNameMap[icdCode.replace(/\./g, "")] || ""}
                                    </td>
                                )}

                                {periodsData.map((_, pi) => {
                                    const row = periodLookups[pi][icdCode];
                                    if (row) {
                                        const vals = computeRowValues(row, costType, periodTotals[pi]);
                                        computedValues[pi] = vals;
                                        return (
                                            <DataCells key={`data-${pi}`} vals={vals} row={row} costCategories={costCategories} />
                                        );
                                    } else {
                                        computedValues[pi] = null;
                                        return <EmptyCells key={`empty-${pi}`} count={colsPerPeriod} />;
                                    }
                                })}

                                {showDiff && diffMetric && (
                                    <DiffCells
                                        computedValues={computedValues}
                                        diffMetric={diffMetric}
                                        diffReverse={diffReverse}
                                    />
                                )}
                            </tr>
                        );
                    })}

                    {/* TOTAL ROW */}
                    <TotalRow
                        periodsData={periodsData}
                        periodTotals={periodTotals}
                        costType={costType}
                        colsPerPeriod={colsPerPeriod}
                        showDiff={showDiff}
                        diffMetric={diffMetric}
                        diffReverse={diffReverse}
                        costCategories={costCategories}
                        icdNameMap={icdNameMap}
                    />
                </tbody>
            </table>
        </div>
    );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function DataCells({ vals, row, costCategories }: { vals: ComputedRow; row: IcdRow; costCategories: CostCategorySelection[] }) {
    return (
        <>
            <td className="ct-td" style={{ textAlign: "right" }}>{fmtNumber(vals.so_luot)}</td>
            <td className="ct-td" style={{ textAlign: "right" }}>{fmtNumber(vals.ngay_dttb, 2)}</td>
            {costCategories.map((cat) => {
                const v = computeCategoryValue(row, cat.field, cat.mode);
                return (
                    <td key={cat.field} className="ct-td" style={{ textAlign: "right" }}>
                        {cat.mode === "ratio" ? fmtPct(v) : fmtNumber(v)}
                    </td>
                );
            })}
            <td className="ct-td" style={{ textAlign: "right" }}>{fmtNumber(vals.bq_dt)}</td>
            <td className="ct-td" style={{ textAlign: "right" }}>{fmtPct(vals.pct_val)}</td>
        </>
    );
}

function EmptyCells({ count }: { count: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <td key={i} className="ct-td" style={{ textAlign: "right" }}>-</td>
            ))}
        </>
    );
}

function DiffCells({
    computedValues,
    diffMetric,
    diffReverse,
}: {
    computedValues: (ComputedRow | null)[];
    diffMetric: DiffMetric;
    diffReverse: boolean;
}) {
    const first = computedValues[0];
    const last = computedValues[computedValues.length - 1];

    if (!first || !last) {
        return (
            <>
                <td className="ct-td" style={{ textAlign: "right" }}>-</td>
                <td className="ct-td" style={{ textAlign: "right" }}>-</td>
            </>
        );
    }

    const valA = diffReverse ? first[diffMetric] : last[diffMetric];
    const valB = diffReverse ? last[diffMetric] : first[diffMetric];
    const diffAbs = valA - valB;
    const diffPct = valB ? (diffAbs / valB) * 100 : 0;

    let fmtAbs: string;
    if (diffMetric === "so_luot") fmtAbs = fmtNumber(diffAbs);
    else if (diffMetric === "ngay_dttb") fmtAbs = fmtNumber(diffAbs, 2);
    else if (diffMetric === "pct_val") fmtAbs = fmtPct(diffAbs);
    else fmtAbs = fmtNumber(diffAbs);

    return (
        <>
            <td className="ct-td" style={{ textAlign: "right", color: diffColor(diffAbs) }}>{fmtAbs}</td>
            <td className="ct-td" style={{ textAlign: "right", color: diffColor(diffPct) }}>{fmtPct(diffPct)}</td>
        </>
    );
}

function TotalRow({
    periodsData,
    periodTotals,
    costType,
    colsPerPeriod,
    showDiff,
    diffMetric,
    diffReverse,
    costCategories,
    icdNameMap,
}: {
    periodsData: IcdPeriodData[];
    periodTotals: { so_luot: number; t_tongchi: number; t_bhtt: number }[];
    costType: CostType;
    colsPerPeriod: number;
    showDiff: boolean;
    diffMetric: DiffMetric | null;
    diffReverse: boolean;
    costCategories: CostCategorySelection[];
    icdNameMap?: Record<string, string>;
}) {
    const totalComputed: (ComputedRow | null)[] = [];

    return (
        <tr className="ct-total-row">
            <td className="ct-td ct-fixed-col" style={{ textAlign: "center", fontWeight: 700 }}></td>
            <td className="ct-td ct-fixed-col" style={{ textAlign: "left", fontWeight: 700 }}>TỔNG TOÀN BỘ</td>
            {icdNameMap && Object.keys(icdNameMap).length > 0 && (
                <td className="ct-td" style={{ fontWeight: 700 }}></td>
            )}

            {periodsData.map((pd, pi) => {
                if (!pd.data || pd.data.length === 0) {
                    totalComputed[pi] = null;
                    return <EmptyCells key={`tempty-${pi}`} count={colsPerPeriod} />;
                }

                const t = periodTotals[pi];
                const tSoNgay = pd.data.reduce((s, r) => s + (r.so_ngay_dtri || 0), 0);
                const tNgayDttb = t.so_luot ? tSoNgay / t.so_luot : 0;
                const tBqDt = costType === "cpbhyt"
                    ? (t.so_luot ? t.t_bhtt / t.so_luot : 0)
                    : (t.so_luot ? t.t_tongchi / t.so_luot : 0);

                const vals: ComputedRow = {
                    so_luot: t.so_luot,
                    ngay_dttb: tNgayDttb,
                    bq_dt: tBqDt,
                    pct_val: 100.0,
                };
                totalComputed[pi] = vals;

                // Compute category totals for this period
                const catTotals: Record<string, number> = {};
                for (const cat of costCategories) {
                    const rawSum = pd.data.reduce((s, r) => s + ((r as unknown as Record<string, number>)[cat.field] || 0), 0);
                    if (cat.mode === "amount") catTotals[cat.field] = rawSum;
                    else if (cat.mode === "average") catTotals[cat.field] = t.so_luot ? rawSum / t.so_luot : 0;
                    else catTotals[cat.field] = t.t_tongchi ? (rawSum / t.t_tongchi) * 100 : 0;
                }

                return (
                    <React.Fragment key={`ttotal-${pi}`}>
                        <td className="ct-td" style={{ textAlign: "right", fontWeight: 700 }}>{fmtNumber(vals.so_luot)}</td>
                        <td className="ct-td" style={{ textAlign: "right", fontWeight: 700 }}>{fmtNumber(vals.ngay_dttb, 2)}</td>
                        {costCategories.map((cat) => (
                            <td key={cat.field} className="ct-td" style={{ textAlign: "right", fontWeight: 700 }}>
                                {cat.mode === "ratio" ? fmtPct(catTotals[cat.field]) : fmtNumber(catTotals[cat.field])}
                            </td>
                        ))}
                        <td className="ct-td" style={{ textAlign: "right", fontWeight: 700 }}>{fmtNumber(vals.bq_dt)}</td>
                        <td className="ct-td" style={{ textAlign: "right", fontWeight: 700 }}>{fmtPct(100.0)}</td>
                    </React.Fragment>
                );
            })}

            {showDiff && diffMetric && (
                <DiffCells
                    computedValues={totalComputed}
                    diffMetric={diffMetric}
                    diffReverse={diffReverse}
                />
            )}
        </tr>
    );
}
