"use client";

import React, { useState, useMemo } from "react";
import { Plus, X } from "lucide-react";

/* ── Types ── */

interface InsightStat {
    id: string;
    field: string;
    mode: "count" | "sum"; // count = unique+count, sum = aggregate SUM
}

interface DataInsightProps {
    data: Record<string, unknown>[];
    totalRows: number;
    columns: string[];
    columnLabels: Record<string, string>;
}

/* ── Helpers ── */

const NUMERIC_COLS = new Set([
    "stt", "gioi_tinh", "so_ngay_dtri", "ket_qua_dtri", "tinh_trang_rv",
    "t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau", "t_pttt", "t_vtyt",
    "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle", "t_kham", "t_giuong",
    "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids", "t_xuattoan", "t_nguonkhac",
    "t_datuyen", "t_vuottran", "nam_qt", "thang_qt", "ma_loaikcb",
    "ma_lydo_vvien", "noi_ttoan",
]);

const EXCLUDE_INSIGHT = new Set([
    "upload_timestamp", "source_file", "normalized_at", "is_normalized",
]);

function unwrapVal(val: unknown): unknown {
    if (val != null && typeof val === "object" && "value" in (val as Record<string, unknown>)) {
        return (val as Record<string, unknown>).value;
    }
    return val;
}

function isNumericField(field: string): boolean {
    return NUMERIC_COLS.has(field);
}

/* format number with Vietnamese locale */
function fmt(n: number): string {
    return n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

let _idCounter = 0;
function nextId(): string {
    return `ins_${Date.now()}_${++_idCounter}`;
}

/* ── Component ── */

export default function DataInsight({ data, totalRows, columns, columnLabels }: DataInsightProps) {
    const [stats, setStats] = useState<InsightStat[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Derive available columns from actual data keys — ensures all fields
    // that appear in the table (including JOINed ones like khoa, ml2, ml4, ten_cskcb)
    // are available in the dropdown
    const availableCols = useMemo(() => {
        if (data.length > 0) {
            return Object.keys(data[0]).filter((c) => !EXCLUDE_INSIGHT.has(c));
        }
        return columns.filter((c) => !EXCLUDE_INSIGHT.has(c));
    }, [data, columns]);

    // 1. Load from BigQuery on mount
    React.useEffect(() => {
        fetch("/api/bq/settings?key=data_insight_stats")
            .then((r) => r.json())
            .then((res) => {
                if (res.value && Array.isArray(res.value)) {
                    setStats(res.value);
                }
                setIsLoaded(true);
            })
            .catch(() => setIsLoaded(true));
    }, []);

    // 2. Save to BigQuery when stats change (debounced)
    React.useEffect(() => {
        if (!isLoaded) return;
        const timer = setTimeout(() => {
            fetch("/api/bq/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "data_insight_stats", value: stats }),
            }).catch(console.error);
        }, 1000);
        return () => clearTimeout(timer);
    }, [stats, isLoaded]);

    const addStat = () => {
        // Pick first col not already used
        const used = new Set(stats.map((s) => s.field));
        const field = availableCols.find((c) => !used.has(c)) || availableCols[0] || "";
        setStats([...stats, { id: nextId(), field, mode: "count" }]);
    };

    const removeStat = (id: string) => {
        setStats(stats.filter((s) => s.id !== id));
    };

    const updateField = (id: string, field: string) => {
        setStats(stats.map((s) => (s.id === id ? { ...s, field, mode: "count" } : s)));
    };

    const updateMode = (id: string, mode: "count" | "sum") => {
        setStats(stats.map((s) => (s.id === id ? { ...s, mode } : s)));
    };

    /* ── Compute insights ── */
    const computeInsight = (stat: InsightStat): { entries: [string, number][]; total: number } => {
        if (!data || data.length === 0 || !stat.field) return { entries: [], total: 0 };

        const map = new Map<string, number>();

        if (stat.mode === "sum" && isNumericField(stat.field)) {
            // Sum mode: group by value, sum
            for (const row of data) {
                const raw = unwrapVal(row[stat.field]);
                const num = Number(raw) || 0;
                // For sum mode, we just aggregate total
                map.set("__total__", (map.get("__total__") || 0) + num);
            }
            const total = map.get("__total__") || 0;
            return { entries: [["Tổng cộng", total]], total };
        }

        // Count mode: unique values + count
        for (const row of data) {
            const raw = unwrapVal(row[stat.field]);
            const key = raw == null || raw === "" ? "(trống)" : String(raw);
            map.set(key, (map.get(key) || 0) + 1);
        }

        // Sort by count desc
        const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        return { entries, total: entries.length };
    };

    /* ── Inline styles (Tailwind purge safe) ── */
    const S = {
        container: {
            display: "flex",
            flexWrap: "wrap" as const,
            gap: "0.75rem",
            alignItems: "flex-start",
        },
        card: {
            flex: "1 1 220px",
            maxWidth: "320px",
            minWidth: "200px",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            overflow: "hidden",
            fontSize: "0.75rem",
        },
        cardHeader: {
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 0.625rem",
            borderBottom: "1px solid #f3f4f6",
            background: "#f9fafb",
        },
        select: {
            flex: 1,
            fontSize: "0.6875rem",
            fontWeight: 600,
            border: "1px solid #e5e7eb",
            borderRadius: "0.375rem",
            padding: "0.25rem 1.5rem 0.25rem 0.375rem",
            background: "#fff",
            cursor: "pointer",
            color: "#1e293b",
            appearance: "auto" as const,
        },
        modeBtn: (active: boolean) => ({
            fontSize: "0.625rem",
            fontWeight: active ? 700 : 500,
            padding: "0.125rem 0.375rem",
            borderRadius: "0.25rem",
            border: "none",
            cursor: "pointer",
            background: active ? "#4f46e5" : "#f3f4f6",
            color: active ? "#fff" : "#64748b",
            transition: "all 0.15s",
        }),
        removeBtn: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.25rem",
            height: "1.25rem",
            borderRadius: "0.25rem",
            border: "none",
            cursor: "pointer",
            background: "transparent",
            color: "#94a3b8",
            transition: "all 0.15s",
            flexShrink: 0,
        },
        list: {
            maxHeight: "140px",
            overflowY: "auto" as const,
            padding: "0",
            margin: "0",
        },
        listItem: (isEven: boolean) => ({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.25rem 0.625rem",
            background: isEven ? "#fff" : "#fafbfc",
            borderBottom: "1px solid #f8f9fa",
            gap: "0.5rem",
        }),
        listLabel: {
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
            color: "#374151",
            fontSize: "0.6875rem",
        },
        listCount: {
            fontWeight: 700,
            color: "#4f46e5",
            fontSize: "0.6875rem",
            fontVariantNumeric: "tabular-nums" as const,
            whiteSpace: "nowrap" as const,
        },
        addBtn: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
            padding: "0.625rem",
            border: "2px dashed #d1d5db",
            borderRadius: "0.75rem",
            background: "transparent",
            cursor: "pointer",
            color: "#9ca3af",
            fontSize: "0.6875rem",
            fontWeight: 600,
            minWidth: "120px",
            flex: "0 0 auto",
            transition: "all 0.15s",
        },
        summary: {
            padding: "0.25rem 0.625rem 0.375rem",
            background: "#f9fafb",
            borderTop: "1px solid #f3f4f6",
            fontSize: "0.625rem",
            color: "#9ca3af",
            textAlign: "right" as const,
        },
    };

    // Compute normalized count from data
    const normalizedCount = useMemo(() => {
        if (!data || data.length === 0) return 0;
        return data.filter((r) => {
            const v = r.is_normalized;
            return v === true || v === "true" || v === 1 || v === "1";
        }).length;
    }, [data]);

    const normalizedPct = totalRows > 0 ? Math.round((normalizedCount / totalRows) * 100) : 0;

    return (
        <section style={S.container}>
            {/* Total rows - always visible */}
            <div style={{ ...S.card, flex: "0 0 auto", minWidth: "140px", maxWidth: "160px" }}>
                <div style={{ padding: "0.75rem 0.625rem", textAlign: "center" }}>
                    <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                        Số dòng
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                        {fmt(totalRows)}
                    </div>
                    <div style={{ fontSize: "0.625rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                        {data.length !== totalRows && data.length > 0 ? `(hiển thị ${fmt(data.length)})` : "hồ sơ"}
                    </div>
                </div>
            </div>

            {/* Normalized count - always visible */}
            <div style={{ ...S.card, flex: "0 0 auto", minWidth: "140px", maxWidth: "160px", borderColor: "#a7f3d0" }}>
                <div style={{ padding: "0.75rem 0.625rem", textAlign: "center" }}>
                    <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                        SL Chuẩn hóa
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
                        {fmt(normalizedCount)}
                    </div>
                    <div style={{ fontSize: "0.625rem", color: "#6ee7b7", marginTop: "0.25rem", fontWeight: 600 }}>
                        {normalizedPct}% tổng số
                    </div>
                </div>
            </div>

            {/* Dynamic stat cards */}
            {stats.map((stat) => {
                const isNum = isNumericField(stat.field);
                const insight = computeInsight(stat);

                return (
                    <div key={stat.id} style={S.card}>
                        {/* Header: field select + mode toggle + remove */}
                        <div style={S.cardHeader}>
                            <select
                                style={S.select}
                                value={stat.field}
                                onChange={(e) => updateField(stat.id, e.target.value)}
                            >
                                {availableCols.map((col) => (
                                    <option key={col} value={col}>
                                        {columnLabels[col] || col}
                                    </option>
                                ))}
                            </select>
                            {isNum && (
                                <>
                                    <button
                                        style={S.modeBtn(stat.mode === "count")}
                                        onClick={() => updateMode(stat.id, "count")}
                                        title="Đếm giá trị duy nhất"
                                    >
                                        Đếm
                                    </button>
                                    <button
                                        style={S.modeBtn(stat.mode === "sum")}
                                        onClick={() => updateMode(stat.id, "sum")}
                                        title="Tính tổng"
                                    >
                                        Tổng
                                    </button>
                                </>
                            )}
                            <button
                                style={S.removeBtn}
                                onClick={() => removeStat(stat.id)}
                                title="Xóa thống kê này"
                                onMouseEnter={(e) => {
                                    (e.target as HTMLElement).style.background = "#fee2e2";
                                    (e.target as HTMLElement).style.color = "#dc2626";
                                }}
                                onMouseLeave={(e) => {
                                    (e.target as HTMLElement).style.background = "transparent";
                                    (e.target as HTMLElement).style.color = "#94a3b8";
                                }}
                            >
                                <X size={12} />
                            </button>
                        </div>

                        {/* Value list */}
                        <div style={S.list}>
                            {insight.entries.slice(0, 50).map(([label, count], idx) => (
                                <div key={label} style={S.listItem(idx % 2 === 0)}>
                                    <span style={S.listLabel} title={label}>
                                        {label}
                                    </span>
                                    <span style={S.listCount}>{fmt(count)}</span>
                                </div>
                            ))}
                            {insight.entries.length === 0 && (
                                <div style={{ padding: "1rem", textAlign: "center", color: "#9ca3af", fontSize: "0.6875rem" }}>
                                    Không có dữ liệu
                                </div>
                            )}
                        </div>

                        {/* Footer summary */}
                        {insight.entries.length > 0 && stat.mode === "count" && (
                            <div style={S.summary}>
                                {insight.total} giá trị duy nhất
                                {insight.entries.length > 50 && ` (hiển thị 50)`}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Add button */}
            <button
                style={S.addBtn}
                onClick={addStat}
                onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.borderColor = "#4f46e5";
                    (e.target as HTMLElement).style.color = "#4f46e5";
                }}
                onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.borderColor = "#d1d5db";
                    (e.target as HTMLElement).style.color = "#9ca3af";
                }}
                title="Thêm thống kê"
            >
                <Plus size={14} /> Thêm
            </button>
        </section>
    );
}
