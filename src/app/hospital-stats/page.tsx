"use client";
import { Loader2, Trash2 } from "lucide-react";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useSessionState } from "@/hooks/useSessionState";
import PageHeader from "@/components/ui/PageHeader";
import InfoBanner from "@/components/ui/InfoBanner";
import { fmt, fmtDec, pctChange, diffValue, bq } from "@/lib/formatters";
import { exportHospitalStats, ExportRow } from "@/lib/exportExcel";
import { PERIOD_COLORS } from "@/lib/metrics";

/* ── Types ──────────────────────────────────────────────────────────────── */

interface YearMonth {
    nam_qt: number;
    thang_qt: number;
}

interface PeriodConfig {
    id: number;
    fromYear: number;
    fromMonth: number;
    toYear: number;
    toMonth: number;
}

interface PeriodData {
    ml2: string;
    so_luot: number;
    so_ngay_dtri: number;
    t_thuoc: number;
    t_xn: number;
    t_cdha: number;
    t_mau: number;
    t_pttt: number;
    t_vtyt: number;
    t_kham: number;
    t_giuong: number;
    t_tongchi: number;
    t_bhtt: number;
    t_bntt: number;
}

const COST_FIELDS: [string, string][] = [
    ["Thuốc", "t_thuoc"],
    ["Xét nghiệm", "t_xn"],
    ["CĐHA", "t_cdha"],
    ["Máu", "t_mau"],
    ["PTTT", "t_pttt"],
    ["VTYT", "t_vtyt"],
    ["Tiền khám", "t_kham"],
    ["Tiền giường", "t_giuong"],
    ["Tổng chi", "t_tongchi"],
    ["BHTT", "t_bhtt"],
    ["BNTT", "t_bntt"],
];

const GROUPS = ["Nội trú", "Ngoại trú", "Tổng"] as const;



/* ── Helpers ────────────────────────────────────────────────────────────── */

function formatPeriodLabel(fy: number, fm: number, ty: number, tm: number) {
    if (fy === ty && fm === tm) return `Tháng ${String(fm).padStart(2, "0")}.${String(fy % 100).padStart(2, "0")}`;
    return `${String(fm).padStart(2, "0")}.${String(fy % 100).padStart(2, "0")}-${String(tm).padStart(2, "0")}.${String(ty % 100).padStart(2, "0")}`;
}

function getVal(data: Record<string, PeriodData>, ml2: string, field: string): number {
    const row = data[ml2];
    if (!row) return 0;
    const v = (row as unknown as Record<string, number>)[field];
    return typeof v === "number" && !isNaN(v) ? v : 0;
}

function getTotal(data: Record<string, PeriodData>, field: string): number {
    return getVal(data, "Nội trú", field) + getVal(data, "Ngoại trú", field);
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function HospitalStatsPage() {
    const [yearMonths, setYearMonths] = useSessionState<YearMonth[]>("hs_yearMonths", []);
    const [periods, setPeriods] = useSessionState<PeriodConfig[]>("hs_periods", [
        { id: 1, fromYear: 0, fromMonth: 0, toYear: 0, toMonth: 0 },
        { id: 2, fromYear: 0, fromMonth: 0, toYear: 0, toMonth: 0 },
    ]);
    const [nextId, setNextId] = useSessionState("hs_nextId", 3);
    const [data, setData] = useSessionState<Record<string, PeriodData>[] | null>("hs_data", null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRatio, setShowRatio] = useSessionState("hs_showRatio", false);
    const [showDiff, setShowDiff] = useSessionState("hs_showDiff", false);
    const [ymLoading, setYmLoading] = useState(yearMonths.length === 0);

    // Fetch available year-months
    useEffect(() => {
        fetch("/api/bq/hospital-stats")
            .then((r) => r.json())
            .then((d) => {
                if (d.error) {
                    setError(d.error);
                    setYmLoading(false);
                    return;
                }
                const ym: YearMonth[] = d.yearMonths || [];
                setYearMonths(ym);
                if (ym.length > 0) {
                    // Only set default periods if none persisted
                    setPeriods((prev) => {
                        if (prev[0]?.fromYear > 0) return prev; // already have persisted
                        const years = [...new Set(ym.map((x) => x.nam_qt))].sort((a, b) => b - a);
                        const latestYear = years[0];
                        const monthsForLatest = ym
                            .filter((x) => x.nam_qt === latestYear)
                            .map((x) => x.thang_qt)
                            .sort((a, b) => a - b);
                        const latestMonth = monthsForLatest[monthsForLatest.length - 1];
                        return [
                            { id: 1, fromYear: latestYear, fromMonth: 1, toYear: latestYear, toMonth: latestMonth },
                            { id: 2, fromYear: latestYear, fromMonth: latestMonth, toYear: latestYear, toMonth: latestMonth },
                        ];
                    });
                }
                setYmLoading(false);
            })
            .catch((e) => {
                setError(e.message);
                setYmLoading(false);
            });
    }, []);

    const years = [...new Set(yearMonths.map((x) => x.nam_qt))].sort((a, b) => b - a);

    const getMonthsForYear = useCallback(
        (year: number) =>
            yearMonths
                .filter((x) => x.nam_qt === year)
                .map((x) => x.thang_qt)
                .sort((a, b) => a - b),
        [yearMonths]
    );

    // Fetch data
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/bq/hospital-stats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periods }),
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);

            // Parse results into Record<string, PeriodData>[]
            const parsed: Record<string, PeriodData>[] = (d.results || []).map(
                (rows: PeriodData[]) => {
                    const map: Record<string, PeriodData> = {};
                    rows.forEach((row) => {
                        map[row.ml2] = row;
                    });
                    return map;
                }
            );
            setData(parsed);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const updatePeriod = (id: number, field: keyof PeriodConfig, value: number) => {
        setPeriods((prev) =>
            prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
        );
    };

    const addPeriod = () => {
        const defaultYear = years[0] || 2026;
        const defaultMonth = getMonthsForYear(defaultYear)[0] || 1;
        setPeriods((prev) => [
            ...prev,
            { id: nextId, fromYear: defaultYear, fromMonth: defaultMonth, toYear: defaultYear, toMonth: defaultMonth },
        ]);
        setNextId((n) => n + 1);
    };

    const removePeriod = (id: number) => {
        setPeriods((prev) => prev.filter((p) => p.id !== id));
    };

    /* ── Build row data ──────────────────────────────────────────────── */

    type RowDef = ExportRow & {
        totalStyle?: boolean;
    };

    const buildRows = (): RowDef[] => {
        if (!data) return [];
        const n = data.length;
        const rows: RowDef[] = [];

        const addSection = (title: string) =>
            rows.push({ label: title, section: true });

        const addRow = (
            label: string,
            valFn: (pi: number, g: string) => number,
            totalStyle = false
        ) => {
            const values: Record<string, number[]> = {};
            for (const g of GROUPS) {
                values[g] = [];
                for (let pi = 0; pi < n; pi++) {
                    values[g].push(valFn(pi, g));
                }
            }
            rows.push({ label, values, totalStyle });
        };

        // Block 1: Chung
        addSection("Chung");
        addRow("Số lượt", (pi, g) =>
            g === "Tổng" ? getTotal(data[pi], "so_luot") : getVal(data[pi], g, "so_luot")
        );
        addRow("Số ngày ĐT", (pi, g) =>
            g === "Ngoại trú" ? 0 : getVal(data[pi], "Nội trú", "so_ngay_dtri")
        );
        addRow("Ngày ĐT TB", (pi, g) => {
            if (g === "Ngoại trú") return 0;
            const luot = getVal(data[pi], "Nội trú", "so_luot");
            const ngay = getVal(data[pi], "Nội trú", "so_ngay_dtri");
            return luot ? ngay / luot : 0;
        });

        // Block 2: Số tiền
        addSection("Số tiền");
        for (const [label, field] of COST_FIELDS) {
            addRow(
                label,
                (pi, g) =>
                    g === "Tổng" ? getTotal(data[pi], field) : getVal(data[pi], g, field),
                label === "Tổng chi"
            );
        }

        // Block 3: Bình quân
        addSection("Bình quân");
        for (const [label, field] of COST_FIELDS) {
            addRow(
                label,
                (pi, g) => {
                    if (g === "Tổng") return bq(getTotal(data[pi], field), getTotal(data[pi], "so_luot"));
                    return bq(getVal(data[pi], g, field), getVal(data[pi], g, "so_luot"));
                },
                label === "Tổng chi"
            );
        }

        return rows;
    };

    /* ── Render ──────────────────────────────────────────────────────── */

    if (ymLoading) {
        return (
            <>
                <PageHeader
                    title="Số liệu toàn viện"
                    subtitle="Báo cáo hoạt động toàn bệnh viện · So sánh nhiều khoảng thời gian"
                    icon="🏛️"
                />
                <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách thời gian...
                </div>
            </>
        );
    }

    if (yearMonths.length === 0 && !error) {
        return (
            <>
                <PageHeader
                    title="Số liệu toàn viện"
                    subtitle="Báo cáo hoạt động toàn bệnh viện"
                    icon="🏛️"
                />
                <InfoBanner type="warning">⚠️ Chưa có dữ liệu trong database.</InfoBanner>
            </>
        );
    }

    const periodLabels = periods.map((p) =>
        formatPeriodLabel(p.fromYear, p.fromMonth, p.toYear, p.toMonth)
    );
    const canCompare = periods.length >= 2;
    const n = periods.length;
    const colSpan = n + (showRatio ? 1 : 0) + (showDiff ? 1 : 0);
    const allRows = buildRows();

    return (
        <>
            <PageHeader
                title="Số liệu toàn viện"
                subtitle="Báo cáo hoạt động toàn bệnh viện · So sánh nhiều khoảng thời gian"
                icon="🏛️"
            />

            {error && <InfoBanner type="error">❌ {error}</InfoBanner>}

            {/* ── Period Selectors + Controls — White Card ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-4">
                    Khoảng thời gian so sánh
                </p>

                <div className="space-y-4">
                    {periods.map((p, idx) => {
                        const color = PERIOD_COLORS[idx % PERIOD_COLORS.length];
                        const fromMonths = getMonthsForYear(p.fromYear);
                        const toMonths = getMonthsForYear(p.toYear);

                        return (
                            <div key={p.id} className="flex flex-wrap items-center gap-4">
                                {/* Badge */}
                                <span
                                    className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold"
                                    style={{ backgroundColor: color.border }}
                                >
                                    {idx + 1}
                                </span>

                                {/* From Year + Month */}
                                <div className="flex items-center gap-2">
                                    <select
                                        className="text-sm rounded-lg border-slate-200 py-1.5 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                                        value={p.fromYear}
                                        onChange={(e) => updatePeriod(p.id, "fromYear", +e.target.value)}
                                    >
                                        {years.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="text-sm rounded-lg border-slate-200 py-1.5 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                                        value={p.fromMonth}
                                        onChange={(e) => updatePeriod(p.id, "fromMonth", +e.target.value)}
                                    >
                                        {fromMonths.map((m) => (
                                            <option key={m} value={m}>Tháng {String(m).padStart(2, "0")}</option>
                                        ))}
                                    </select>
                                </div>

                                <span className="text-slate-300">→</span>

                                {/* To Year + Month */}
                                <div className="flex items-center gap-2">
                                    <select
                                        className="text-sm rounded-lg border-slate-200 py-1.5 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                                        value={p.toYear}
                                        onChange={(e) => updatePeriod(p.id, "toYear", +e.target.value)}
                                    >
                                        {years.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="text-sm rounded-lg border-slate-200 py-1.5 pl-3 pr-8 focus:ring-primary-500 focus:border-primary-500"
                                        value={p.toMonth}
                                        onChange={(e) => updatePeriod(p.id, "toMonth", +e.target.value)}
                                    >
                                        {toMonths.map((m) => (
                                            <option key={m} value={m}>Tháng {String(m).padStart(2, "0")}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Remove button */}
                                {periods.length > 1 && (
                                    <button
                                        className="text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                                        onClick={() => removePeriod(p.id)}
                                        title="Xóa khoảng thời gian này"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Add period button — right below period rows */}
                <button
                    className="mt-3 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
                    onClick={addPeriod}
                >
                    ➕ Thêm khoảng so sánh
                </button>

                {/* ── Controls — border-t separator ── */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            className="bg-primary-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-primary-700 transition-all shadow-sm shadow-indigo-200 cursor-pointer disabled:opacity-50"
                            onClick={fetchData}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Đang truy vấn...
                                </>
                            ) : (
                                "📊 Xem báo cáo"
                            )}
                        </button>
                        <button
                            className="border border-slate-200 hover:bg-slate-50 px-6 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                            onClick={() => exportHospitalStats(allRows, periodLabels, { showRatio, showDiff })}
                            disabled={!data || data.length === 0}
                            title="Tải file Excel"
                        >
                            📥 Tải Excel
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                                checked={showDiff}
                                onChange={(e) => setShowDiff(e.target.checked)}
                                disabled={!canCompare}
                            />
                            <span className="text-sm font-medium text-slate-600 group-hover:text-primary-600 transition-colors">
                                Chênh lệch
                            </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                                checked={showRatio}
                                onChange={(e) => setShowRatio(e.target.checked)}
                                disabled={!canCompare}
                            />
                            <span className="text-sm font-medium text-slate-600 group-hover:text-primary-600 transition-colors">
                                Tỷ lệ %
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            {/* ── Data Table — White Card ── */}
            {data && data.length > 0 && (
                <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="text-[13px] border-collapse">
                            <thead>
                                {/* Header row 1: Group names */}
                                <tr className="bg-slate-50">
                                    <th
                                        rowSpan={2}
                                        className="py-2 px-3 text-left border-b border-r border-slate-200 font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap sticky left-0 bg-slate-50 z-20"
                                    >
                                        Toàn BV
                                    </th>
                                    {GROUPS.map((g, gi) => (
                                        <th
                                            key={g}
                                            colSpan={colSpan}
                                            className={`py-1.5 px-2 text-center border-b border-slate-200 font-bold uppercase text-slate-600 ${gi < GROUPS.length - 1 ? 'border-r' : ''}`}
                                        >
                                            {g}
                                        </th>
                                    ))}
                                </tr>
                                {/* Header row 2: Period labels */}
                                <tr>
                                    {GROUPS.map((g, gi) => (
                                        <Fragment key={g}>
                                            {periods.map((p, pi) => (
                                                <th
                                                    key={`${g}-${p.id}`}
                                                    className={`py-1.5 px-2 border-b border-slate-200 text-white whitespace-nowrap text-center text-[11px] font-semibold ${pi < periods.length - 1 || showDiff || showRatio ? 'border-r' : (gi < GROUPS.length - 1 ? 'border-r' : '')}`}
                                                    style={{ backgroundColor: PERIOD_COLORS[pi % PERIOD_COLORS.length].border }}
                                                >
                                                    {periodLabels[pi]}
                                                </th>
                                            ))}
                                            {showDiff && (
                                                <th
                                                    key={`${g}-diff`}
                                                    className={`py-1.5 px-2 border-b border-slate-200 bg-slate-200 text-slate-600 whitespace-nowrap text-center text-[11px] font-semibold ${showRatio || gi < GROUPS.length - 1 ? 'border-r' : ''}`}
                                                >
                                                    Chênh lệch
                                                </th>
                                            )}
                                            {showRatio && (
                                                <th
                                                    key={`${g}-ratio`}
                                                    className={`py-1.5 px-2 border-b border-slate-200 bg-slate-100 text-slate-600 whitespace-nowrap text-center text-[11px] font-semibold ${gi < GROUPS.length - 1 ? 'border-r' : ''}`}
                                                >
                                                    Tỷ lệ %
                                                </th>
                                            )}
                                        </Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(() => {
                                    let rowIdx = 0;
                                    const nDataCols = colSpan * GROUPS.length + 1;
                                    return allRows.map((r, ri) => {
                                        if (r.section) {
                                            rowIdx = 0;
                                            return (
                                                <tr key={ri} className="bg-slate-50">
                                                    <td
                                                        className="py-1.5 px-2.5 font-bold text-slate-700 uppercase tracking-tight sticky left-0 bg-slate-50 z-10 whitespace-nowrap"
                                                    >
                                                        {r.label}
                                                    </td>
                                                    <td
                                                        colSpan={nDataCols - 1}
                                                        className="bg-slate-50"
                                                    />
                                                </tr>
                                            );
                                        }

                                        const isDecimal = r.label === "Ngày ĐT TB";
                                        const isCount = r.label === "Số lượt";
                                        const isTotalRow = r.totalStyle;
                                        rowIdx++;

                                        return (
                                            <tr
                                                key={ri}
                                                className={
                                                    isTotalRow
                                                        ? "bg-indigo-50 font-bold"
                                                        : "hover:bg-slate-50 transition-colors"
                                                }
                                            >
                                                <td
                                                    className={`py-1.5 px-2.5 pl-4 border-r border-slate-100 sticky left-0 z-10 whitespace-nowrap ${isTotalRow
                                                        ? "bg-indigo-50 font-bold"
                                                        : "bg-white"
                                                        }`}
                                                >
                                                    {r.label}
                                                </td>
                                                {GROUPS.map((g, gi) => {
                                                    const vals = r.values?.[g] || [];
                                                    return (
                                                        <Fragment key={g}>
                                                            {vals.map((v, pi) => (
                                                                <td
                                                                    key={`${g}-${pi}`}
                                                                    className={`py-1.5 px-2.5 text-right border-r border-slate-100 whitespace-nowrap ${isTotalRow ? "text-primary-600 font-bold" : ""
                                                                        }`}
                                                                >
                                                                    {isDecimal
                                                                        ? fmtDec(v)
                                                                        : isCount
                                                                            ? fmt(v, true)
                                                                            : fmt(v)}
                                                                </td>
                                                            ))}
                                                            {showDiff && (() => {
                                                                const d = diffValue(vals[0], vals[vals.length - 1]);
                                                                return (
                                                                    <td key={`${g}-diff`} className="py-1.5 px-2.5 text-right border-r border-slate-100 whitespace-nowrap">
                                                                        {d ? (
                                                                            <span style={{ color: d.color }} className="font-semibold">
                                                                                {d.text}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-slate-300">-</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })()}
                                                            {showRatio && (() => {
                                                                const p = pctChange(vals[0], vals[vals.length - 1]);
                                                                return (
                                                                    <td key={`${g}-ratio`} className={`py-1.5 px-2.5 text-right whitespace-nowrap ${gi < GROUPS.length - 1 ? 'border-r border-slate-100' : ''}`}>
                                                                        {p ? (
                                                                            <span style={{ color: p.color }} className="font-semibold">
                                                                                {p.text}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-slate-300">-</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })()}
                                                        </Fragment>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!data && !loading && !error && (
                <InfoBanner type="info">
                    Chọn khoảng thời gian và nhấn <strong>Xem báo cáo</strong> để hiển thị dữ liệu.
                </InfoBanner>
            )}
        </>
    );
}
