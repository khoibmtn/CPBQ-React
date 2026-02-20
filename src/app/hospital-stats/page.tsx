"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import InfoBanner from "@/components/ui/InfoBanner";
import { fmt, fmtDec, pctChange, diffValue, bq } from "@/lib/formatters";
import { exportHospitalStats, ExportRow } from "@/lib/exportExcel";

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

const PERIOD_COLORS = [
    { bg: "rgba(59,130,246,0.10)", border: "#3b82f6", label: "#93c5fd" },
    { bg: "rgba(99,102,241,0.10)", border: "#6366f1", label: "#a5b4fc" },
    { bg: "rgba(14,165,233,0.10)", border: "#0ea5e9", label: "#7dd3fc" },
    { bg: "rgba(139,92,246,0.10)", border: "#8b5cf6", label: "#c4b5fd" },
    { bg: "rgba(6,182,212,0.10)", border: "#06b6d4", label: "#67e8f9" },
    { bg: "rgba(79,70,229,0.10)", border: "#4f46e5", label: "#a5b4fc" },
];

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
    const [yearMonths, setYearMonths] = useState<YearMonth[]>([]);
    const [periods, setPeriods] = useState<PeriodConfig[]>([
        { id: 1, fromYear: 0, fromMonth: 0, toYear: 0, toMonth: 0 },
        { id: 2, fromYear: 0, fromMonth: 0, toYear: 0, toMonth: 0 },
    ]);
    const [nextId, setNextId] = useState(3);
    const [data, setData] = useState<Record<string, PeriodData>[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRatio, setShowRatio] = useState(false);
    const [showDiff, setShowDiff] = useState(false);
    const [ymLoading, setYmLoading] = useState(true);

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
                    const years = [...new Set(ym.map((x) => x.nam_qt))].sort((a, b) => b - a);
                    const latestYear = years[0];
                    const monthsForLatest = ym
                        .filter((x) => x.nam_qt === latestYear)
                        .map((x) => x.thang_qt)
                        .sort((a, b) => a - b);
                    const latestMonth = monthsForLatest[monthsForLatest.length - 1];

                    setPeriods([
                        { id: 1, fromYear: latestYear, fromMonth: 1, toYear: latestYear, toMonth: latestMonth },
                        { id: 2, fromYear: latestYear, fromMonth: latestMonth, toYear: latestYear, toMonth: latestMonth },
                    ]);
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
                <div className="loading-overlay">
                    <div className="spinner" /> Đang tải danh sách thời gian...
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

            {/* ── Period Selectors ── */}
            <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-body)" }}>
                    KHOẢNG THỜI GIAN SO SÁNH
                </div>
                <button className="btn btn-primary btn-sm" onClick={addPeriod}>
                    ➕ Thêm khoảng so sánh
                </button>
            </div>

            {periods.map((p, idx) => {
                const color = PERIOD_COLORS[idx % PERIOD_COLORS.length];
                const fromMonths = getMonthsForYear(p.fromYear);
                const toMonths = getMonthsForYear(p.toYear);

                return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        {/* Badge */}
                        <span className="period-badge" style={{ backgroundColor: color.border }}>
                            {idx + 1}
                        </span>

                        {/* From Year */}
                        <select
                            className="form-select"
                            value={p.fromYear}
                            onChange={(e) => updatePeriod(p.id, "fromYear", +e.target.value)}
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>

                        {/* From Month */}
                        <select
                            className="form-select"
                            value={p.fromMonth}
                            onChange={(e) => updatePeriod(p.id, "fromMonth", +e.target.value)}
                        >
                            {fromMonths.map((m) => (
                                <option key={m} value={m}>Tháng {String(m).padStart(2, "0")}</option>
                            ))}
                        </select>

                        <span style={{ color: "var(--text-muted)" }}>→</span>

                        {/* To Year */}
                        <select
                            className="form-select"
                            value={p.toYear}
                            onChange={(e) => updatePeriod(p.id, "toYear", +e.target.value)}
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>

                        {/* To Month */}
                        <select
                            className="form-select"
                            value={p.toMonth}
                            onChange={(e) => updatePeriod(p.id, "toMonth", +e.target.value)}
                        >
                            {toMonths.map((m) => (
                                <option key={m} value={m}>Tháng {String(m).padStart(2, "0")}</option>
                            ))}
                        </select>

                        {/* Remove button */}
                        {periods.length > 1 && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => removePeriod(p.id)}
                                title="Xóa khoảng thời gian này"
                            >
                                🗑️
                            </button>
                        )}
                    </div>
                );
            })}

            <hr className="divider" />

            {/* ── Controls row ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                <button
                    className="btn btn-primary"
                    onClick={fetchData}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <div className="spinner" /> Đang truy vấn...
                        </>
                    ) : (
                        "📊 Xem báo cáo"
                    )}
                </button>

                <button
                    className="btn btn-secondary"
                    onClick={() => exportHospitalStats(allRows, periodLabels, { showRatio, showDiff })}
                    disabled={!data || data.length === 0}
                    title="Tải file Excel"
                >
                    📥 Tải Excel
                </button>

                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={showRatio}
                        onChange={(e) => setShowRatio(e.target.checked)}
                        disabled={!canCompare}
                    />
                    Tỷ lệ %
                </label>

                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={showDiff}
                        onChange={(e) => setShowDiff(e.target.checked)}
                        disabled={!canCompare}
                    />
                    Chênh lệch
                </label>
            </div>

            {/* ── Data Table ── */}
            {data && data.length > 0 && (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            {/* Header row 1 */}
                            <tr>
                                <th rowSpan={2} style={{ minWidth: 160 }}>Toàn BV</th>
                                {GROUPS.map((g) => (
                                    <th key={g} colSpan={colSpan}>{g}</th>
                                ))}
                            </tr>
                            {/* Header row 2 */}
                            <tr>
                                {GROUPS.map((g) => (
                                    <>
                                        {periods.map((p, pi) => (
                                            <th
                                                key={`${g}-${p.id}`}
                                                style={{ backgroundColor: PERIOD_COLORS[pi % PERIOD_COLORS.length].border }}
                                            >
                                                {periodLabels[pi]}
                                            </th>
                                        ))}
                                        {showDiff && (
                                            <th key={`${g}-diff`} style={{ backgroundColor: "var(--tbl-border)" }}>
                                                Chênh lệch
                                            </th>
                                        )}
                                        {showRatio && (
                                            <th key={`${g}-ratio`} style={{ backgroundColor: "var(--tbl-sub-header-bg)" }}>
                                                Tỷ lệ %
                                            </th>
                                        )}
                                    </>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                let rowIdx = 0;
                                return allRows.map((r, ri) => {
                                    if (r.section) {
                                        rowIdx = 0;
                                        const nDataCols = colSpan * GROUPS.length;
                                        return (
                                            <tr key={ri} className="section-row">
                                                <td className="label-col" style={{
                                                    color: "var(--tbl-section-color)",
                                                    background: "var(--tbl-section-bg)",
                                                    fontWeight: 700,
                                                    fontSize: 13,
                                                }}>
                                                    {r.label}
                                                </td>
                                                <td
                                                    colSpan={nDataCols}
                                                    style={{ background: "var(--tbl-section-bg)" }}
                                                />
                                            </tr>
                                        );
                                    }

                                    const isDecimal = r.label === "Ngày ĐT TB";
                                    const isCount = r.label === "Số lượt";
                                    const curIdx = rowIdx++;

                                    const rowClass = r.totalStyle
                                        ? "row-total"
                                        : curIdx % 2 === 0
                                            ? "row-even"
                                            : "row-odd";

                                    return (
                                        <tr key={ri} className={rowClass}>
                                            <td className="label-col" style={r.totalStyle ? { fontWeight: 700 } : {}}>
                                                {r.label}
                                            </td>
                                            {GROUPS.map((g) => {
                                                const vals = r.values?.[g] || [];
                                                return (
                                                    <>
                                                        {vals.map((v, pi) => (
                                                            <td
                                                                key={`${g}-${pi}`}
                                                                className="right"
                                                                style={r.totalStyle ? { fontWeight: 700 } : {}}
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
                                                                <td key={`${g}-diff`} className="right">
                                                                    {d ? (
                                                                        <span style={{ color: d.color, fontWeight: 600 }}>
                                                                            {d.text}
                                                                        </span>
                                                                    ) : (
                                                                        "-"
                                                                    )}
                                                                </td>
                                                            );
                                                        })()}
                                                        {showRatio && (() => {
                                                            const p = pctChange(vals[0], vals[vals.length - 1]);
                                                            return (
                                                                <td key={`${g}-ratio`} className="right">
                                                                    {p ? (
                                                                        <span style={{ color: p.color, fontWeight: 600 }}>
                                                                            {p.text}
                                                                        </span>
                                                                    ) : (
                                                                        "-"
                                                                    )}
                                                                </td>
                                                            );
                                                        })()}
                                                    </>
                                                );
                                            })}
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
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
