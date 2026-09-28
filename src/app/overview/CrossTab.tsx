"use client";

import React, { useState, useMemo, useCallback } from "react";
import { X, Table2, ChevronDown, ChevronUp } from "lucide-react";

/* ── Types ── */

interface CrossTabConfig {
    rowField: string;
    colField: string;
    valueField: string;
    mode: "count" | "sum";
}

interface CrossTabProps {
    data: Record<string, unknown>[];
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

const SUM_FIELDS = [
    "t_tongchi", "t_xn", "t_cdha", "t_thuoc", "t_mau", "t_pttt", "t_vtyt",
    "t_dvkt_tyle", "t_thuoc_tyle", "t_vtyt_tyle", "t_kham", "t_giuong",
    "t_vchuyen", "t_bntt", "t_bhtt", "t_ngoaids", "t_xuattoan", "t_nguonkhac",
    "t_datuyen", "t_vuottran",
];

const EXCLUDE_INSIGHT = new Set([
    "upload_timestamp", "source_file", "normalized_at", "is_normalized",
]);

/** Preferred fields for default row/col selection */
const PREFERRED_ROW = ["thang_qt", "ma_cskcb", "khoa", "ml2"];
const PREFERRED_COL = ["ml2", "ml4", "ma_cskcb", "khoa"];

function unwrapVal(val: unknown): unknown {
    if (val != null && typeof val === "object" && "value" in (val as Record<string, unknown>)) {
        return (val as Record<string, unknown>).value;
    }
    return val;
}

function fmt(n: number): string {
    return n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function fmtCompact(n: number): string {
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "T";
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "Tr";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return fmt(n);
}

/* ── Component ── */

export default function CrossTab({ data, columns, columnLabels }: CrossTabProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [config, setConfig] = useState<CrossTabConfig | null>(null);

    // Available columns
    const availableCols = useMemo(() => {
        if (data.length > 0) {
            return Object.keys(data[0]).filter((c) => !EXCLUDE_INSIGHT.has(c));
        }
        return columns.filter((c) => !EXCLUDE_INSIGHT.has(c));
    }, [data, columns]);

    // Categorical columns (good for row/col dimensions)
    const categoricalCols = useMemo(() => {
        return availableCols.filter((c) => {
            // Prefer non-numeric or low-cardinality numeric fields
            if (NUMERIC_COLS.has(c) && !["thang_qt", "nam_qt", "ma_loaikcb", "gioi_tinh", "ket_qua_dtri", "tinh_trang_rv", "ma_lydo_vvien", "noi_ttoan"].includes(c)) {
                return false;
            }
            return true;
        });
    }, [availableCols]);

    // Load from BigQuery on mount
    React.useEffect(() => {
        fetch("/api/bq/settings?key=cross_tab_config")
            .then((r) => r.json())
            .then((res) => {
                if (res.value && typeof res.value === "object" && res.value.rowField) {
                    setConfig(res.value);
                    setExpanded(true);
                }
                setIsLoaded(true);
            })
            .catch(() => setIsLoaded(true));
    }, []);

    // Save to BigQuery when config changes (debounced)
    React.useEffect(() => {
        if (!isLoaded) return;
        const timer = setTimeout(() => {
            fetch("/api/bq/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: "cross_tab_config",
                    value: config || { rowField: "", colField: "", valueField: "", mode: "count" },
                }),
            }).catch(console.error);
        }, 1500);
        return () => clearTimeout(timer);
    }, [config, isLoaded]);

    const pickDefault = useCallback((): CrossTabConfig => {
        const pickField = (preferred: string[], exclude: string) => {
            for (const f of preferred) {
                if (categoricalCols.includes(f) && f !== exclude) return f;
            }
            return categoricalCols.find((c) => c !== exclude) || categoricalCols[0] || "";
        };
        const rowField = pickField(PREFERRED_ROW, "");
        const colField = pickField(PREFERRED_COL, rowField);
        return { rowField, colField, valueField: "", mode: "count" };
    }, [categoricalCols]);

    const handleToggle = () => {
        if (!expanded && !config) {
            setConfig(pickDefault());
        }
        setExpanded((v) => !v);
    };

    const handleRemove = () => {
        setConfig(null);
        setExpanded(false);
    };

    const updateConfig = (patch: Partial<CrossTabConfig>) => {
        setConfig((prev) => {
            if (!prev) return { ...pickDefault(), ...patch };
            return { ...prev, ...patch };
        });
    };

    /* ── Compute cross-tab data ── */
    const crossTabData = useMemo(() => {
        if (!config || !data || data.length === 0 || !config.rowField || !config.colField) {
            return null;
        }

        const { rowField, colField, valueField, mode } = config;

        // Build aggregation map
        const rowKeys = new Map<string, number>();
        const colKeys = new Map<string, number>();
        const cells = new Map<string, number>();
        const rowTotals = new Map<string, number>();
        const colTotals = new Map<string, number>();
        let grandTotal = 0;

        for (const row of data) {
            const rVal = unwrapVal(row[rowField]);
            const cVal = unwrapVal(row[colField]);
            const rKey = rVal == null || rVal === "" ? "(trống)" : String(rVal);
            const cKey = cVal == null || cVal === "" ? "(trống)" : String(cVal);

            let value: number;
            if (mode === "sum" && valueField) {
                value = Number(unwrapVal(row[valueField])) || 0;
            } else {
                value = 1;
            }

            const cellKey = `${rKey}|||${cKey}`;
            cells.set(cellKey, (cells.get(cellKey) || 0) + value);
            rowTotals.set(rKey, (rowTotals.get(rKey) || 0) + value);
            colTotals.set(cKey, (colTotals.get(cKey) || 0) + value);
            grandTotal += value;

            if (!rowKeys.has(rKey)) rowKeys.set(rKey, 0);
            rowKeys.set(rKey, (rowKeys.get(rKey) || 0) + value);
            if (!colKeys.has(cKey)) colKeys.set(cKey, 0);
            colKeys.set(cKey, (colKeys.get(cKey) || 0) + value);
        }

        // Sort rows and cols by total desc
        const sortedRows = Array.from(rowKeys.entries()).sort((a, b) => b[1] - a[1]);
        const sortedCols = Array.from(colKeys.entries()).sort((a, b) => b[1] - a[1]);

        return {
            rows: sortedRows.map(([k]) => k),
            cols: sortedCols.map(([k]) => k),
            cells,
            rowTotals,
            colTotals,
            grandTotal,
        };
    }, [config, data]);

    /* ── Styles ── */
    const S = {
        wrapper: {
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            overflow: "hidden",
            marginTop: "0.75rem",
        },
        header: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.625rem 0.875rem",
            background: expanded ? "#fafbfe" : "#fff",
            cursor: "pointer",
            transition: "background 0.15s",
            borderBottom: expanded ? "1px solid #e5e7eb" : "none",
            userSelect: "none" as const,
        },
        headerLeft: {
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
        },
        headerIcon: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.75rem",
            height: "1.75rem",
            borderRadius: "0.375rem",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#fff",
            flexShrink: 0,
        },
        headerTitle: {
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "#1e293b",
        },
        headerBadge: {
            fontSize: "0.625rem",
            fontWeight: 600,
            padding: "0.125rem 0.375rem",
            borderRadius: "9999px",
            background: "#ede9fe",
            color: "#7c3aed",
        },
        toolbar: {
            display: "flex",
            flexWrap: "wrap" as const,
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 0.875rem",
            background: "#f8fafc",
            borderBottom: "1px solid #f1f5f9",
        },
        fieldGroup: {
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
        },
        fieldLabel: {
            fontSize: "0.625rem",
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase" as const,
            letterSpacing: "0.05em",
            whiteSpace: "nowrap" as const,
        },
        fieldSelect: {
            fontSize: "0.6875rem",
            fontWeight: 600,
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            padding: "0.25rem 1.5rem 0.25rem 0.375rem",
            background: "#fff",
            cursor: "pointer",
            color: "#334155",
            appearance: "auto" as const,
            maxWidth: "140px",
        },
        modeBtn: (active: boolean) => ({
            fontSize: "0.625rem",
            fontWeight: active ? 700 : 500,
            padding: "0.1875rem 0.5rem",
            borderRadius: "0.25rem",
            border: "none",
            cursor: "pointer",
            background: active ? "#4f46e5" : "#f1f5f9",
            color: active ? "#fff" : "#64748b",
            transition: "all 0.15s",
        }),
        tableWrap: {
            overflowX: "auto" as const,
            maxHeight: "360px",
            overflowY: "auto" as const,
        },
        table: {
            width: "100%",
            borderCollapse: "collapse" as const,
            fontSize: "0.6875rem",
            fontVariantNumeric: "tabular-nums" as const,
        },
        th: {
            padding: "0.375rem 0.5rem",
            fontWeight: 700,
            textAlign: "center" as const,
            background: "#f1f5f9",
            borderBottom: "2px solid #e2e8f0",
            borderRight: "1px solid #e2e8f0",
            color: "#475569",
            whiteSpace: "nowrap" as const,
            position: "sticky" as const,
            top: 0,
            zIndex: 2,
        },
        thCorner: {
            padding: "0.375rem 0.5rem",
            fontWeight: 700,
            textAlign: "left" as const,
            background: "#eef2ff",
            borderBottom: "2px solid #e2e8f0",
            borderRight: "2px solid #c7d2fe",
            color: "#4338ca",
            position: "sticky" as const,
            top: 0,
            left: 0,
            zIndex: 3,
            minWidth: "100px",
        },
        thRow: {
            padding: "0.375rem 0.5rem",
            fontWeight: 600,
            textAlign: "left" as const,
            background: "#f8fafc",
            borderRight: "2px solid #c7d2fe",
            borderBottom: "1px solid #f1f5f9",
            color: "#334155",
            whiteSpace: "nowrap" as const,
            position: "sticky" as const,
            left: 0,
            zIndex: 1,
            maxWidth: "160px",
            overflow: "hidden",
            textOverflow: "ellipsis",
        },
        td: (isEven: boolean) => ({
            padding: "0.3125rem 0.5rem",
            textAlign: "right" as const,
            borderRight: "1px solid #f1f5f9",
            borderBottom: "1px solid #f1f5f9",
            color: "#374151",
            background: isEven ? "#fff" : "#fafbfc",
        }),
        tdZero: (isEven: boolean) => ({
            padding: "0.3125rem 0.5rem",
            textAlign: "right" as const,
            borderRight: "1px solid #f1f5f9",
            borderBottom: "1px solid #f1f5f9",
            color: "#d1d5db",
            background: isEven ? "#fff" : "#fafbfc",
        }),
        tdTotal: (isEven: boolean) => ({
            padding: "0.3125rem 0.5rem",
            textAlign: "right" as const,
            borderBottom: "1px solid #f1f5f9",
            color: "#1e40af",
            fontWeight: 700,
            background: isEven ? "#eff6ff" : "#eef2ff",
            borderLeft: "2px solid #bfdbfe",
        }),
        trTotal: {
            borderTop: "2px solid #c7d2fe",
        },
        thTotal: {
            padding: "0.375rem 0.5rem",
            fontWeight: 700,
            textAlign: "left" as const,
            background: "#eef2ff",
            borderRight: "2px solid #c7d2fe",
            color: "#4338ca",
            position: "sticky" as const,
            left: 0,
            zIndex: 1,
        },
        thColTotal: {
            padding: "0.375rem 0.5rem",
            fontWeight: 700,
            textAlign: "center" as const,
            background: "#eef2ff",
            borderBottom: "2px solid #e2e8f0",
            color: "#4338ca",
            position: "sticky" as const,
            top: 0,
            zIndex: 2,
            borderLeft: "2px solid #bfdbfe",
        },
        tdColTotal: {
            padding: "0.3125rem 0.5rem",
            textAlign: "right" as const,
            color: "#4338ca",
            fontWeight: 700,
            background: "#eef2ff",
            borderBottom: "1px solid #ddd6fe",
        },
        tdGrand: {
            padding: "0.375rem 0.5rem",
            textAlign: "right" as const,
            color: "#fff",
            fontWeight: 800,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            fontSize: "0.75rem",
            borderLeft: "2px solid #bfdbfe",
        },
        removeBtn: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.5rem",
            height: "1.5rem",
            borderRadius: "0.25rem",
            border: "none",
            cursor: "pointer",
            background: "transparent",
            color: "#94a3b8",
            transition: "all 0.15s",
            flexShrink: 0,
        },
        emptyState: {
            padding: "2rem",
            textAlign: "center" as const,
            color: "#94a3b8",
            fontSize: "0.75rem",
        },
        footer: {
            padding: "0.375rem 0.875rem",
            background: "#f8fafc",
            borderTop: "1px solid #f1f5f9",
            fontSize: "0.625rem",
            color: "#94a3b8",
            display: "flex",
            justifyContent: "space-between",
        },
    };

    const label = (col: string) => columnLabels[col] || col;
    const isSumMode = config?.mode === "sum";
    const formatValue = isSumMode ? fmtCompact : fmt;

    if (!data || data.length === 0) return null;

    return (
        <div style={S.wrapper}>
            {/* Header — always visible */}
            <div
                style={S.header}
                onClick={handleToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleToggle(); }}
            >
                <div style={S.headerLeft}>
                    <div style={S.headerIcon}>
                        <Table2 size={14} />
                    </div>
                    <span style={S.headerTitle}>Bảng chéo 2 chiều</span>
                    {config && crossTabData && (
                        <span style={S.headerBadge}>
                            {crossTabData.rows.length}×{crossTabData.cols.length}
                        </span>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {expanded && config && (
                        <button
                            style={S.removeBtn}
                            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                            title="Đóng bảng chéo"
                            onMouseEnter={(e) => {
                                (e.currentTarget).style.background = "#fee2e2";
                                (e.currentTarget).style.color = "#dc2626";
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget).style.background = "transparent";
                                (e.currentTarget).style.color = "#94a3b8";
                            }}
                        >
                            <X size={14} />
                        </button>
                    )}
                    {expanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </div>
            </div>

            {/* Expanded content */}
            {expanded && config && (
                <>
                    {/* Toolbar */}
                    <div style={S.toolbar}>
                        <div style={S.fieldGroup}>
                            <span style={S.fieldLabel}>Hàng:</span>
                            <select
                                style={S.fieldSelect}
                                value={config.rowField}
                                onChange={(e) => updateConfig({ rowField: e.target.value })}
                            >
                                {categoricalCols.map((col) => (
                                    <option key={col} value={col}>{label(col)}</option>
                                ))}
                            </select>
                        </div>

                        <span style={{ color: "#d1d5db", fontSize: "0.75rem" }}>×</span>

                        <div style={S.fieldGroup}>
                            <span style={S.fieldLabel}>Cột:</span>
                            <select
                                style={S.fieldSelect}
                                value={config.colField}
                                onChange={(e) => updateConfig({ colField: e.target.value })}
                            >
                                {categoricalCols.map((col) => (
                                    <option key={col} value={col}>{label(col)}</option>
                                ))}
                            </select>
                        </div>

                        <span style={{ color: "#e2e8f0", fontSize: "1rem" }}>|</span>

                        <div style={S.fieldGroup}>
                            <button
                                style={S.modeBtn(config.mode === "count")}
                                onClick={() => updateConfig({ mode: "count", valueField: "" })}
                            >
                                Đếm
                            </button>
                            <button
                                style={S.modeBtn(config.mode === "sum")}
                                onClick={() => {
                                    const vf = config.valueField || SUM_FIELDS[0] || "";
                                    updateConfig({ mode: "sum", valueField: vf });
                                }}
                            >
                                Tổng
                            </button>
                        </div>

                        {config.mode === "sum" && (
                            <div style={S.fieldGroup}>
                                <span style={S.fieldLabel}>Giá trị:</span>
                                <select
                                    style={S.fieldSelect}
                                    value={config.valueField}
                                    onChange={(e) => updateConfig({ valueField: e.target.value })}
                                >
                                    {SUM_FIELDS.filter((f) => availableCols.includes(f)).map((col) => (
                                        <option key={col} value={col}>{label(col)}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    {crossTabData && crossTabData.rows.length > 0 ? (
                        <>
                            <div style={S.tableWrap}>
                                <table style={S.table}>
                                    <thead>
                                        <tr>
                                            <th style={S.thCorner}>
                                                {label(config.rowField)} ↓ / {label(config.colField)} →
                                            </th>
                                            {crossTabData.cols.map((col) => (
                                                <th key={col} style={S.th} title={col}>
                                                    {col.length > 12 ? col.slice(0, 12) + "…" : col}
                                                </th>
                                            ))}
                                            <th style={S.thColTotal}>Tổng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {crossTabData.rows.map((rowKey, rIdx) => (
                                            <tr key={rowKey}>
                                                <td style={S.thRow} title={rowKey}>
                                                    {rowKey.length > 18 ? rowKey.slice(0, 18) + "…" : rowKey}
                                                </td>
                                                {crossTabData.cols.map((colKey) => {
                                                    const val = crossTabData.cells.get(`${rowKey}|||${colKey}`) || 0;
                                                    const isEven = rIdx % 2 === 0;
                                                    return (
                                                        <td
                                                            key={colKey}
                                                            style={val === 0 ? S.tdZero(isEven) : S.td(isEven)}
                                                            title={val > 0 ? fmt(val) : ""}
                                                        >
                                                            {val === 0 ? "–" : formatValue(val)}
                                                        </td>
                                                    );
                                                })}
                                                <td style={S.tdTotal(rIdx % 2 === 0)}>
                                                    {formatValue(crossTabData.rowTotals.get(rowKey) || 0)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={S.trTotal}>
                                            <td style={S.thTotal}>Tổng</td>
                                            {crossTabData.cols.map((colKey) => (
                                                <td key={colKey} style={S.tdColTotal}>
                                                    {formatValue(crossTabData.colTotals.get(colKey) || 0)}
                                                </td>
                                            ))}
                                            <td style={S.tdGrand}>
                                                {formatValue(crossTabData.grandTotal)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <div style={S.footer}>
                                <span>
                                    {crossTabData.rows.length} hàng × {crossTabData.cols.length} cột
                                </span>
                                <span>
                                    {config.mode === "count" ? "Số lượng" : `Tổng ${label(config.valueField)}`}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div style={S.emptyState}>
                            Chọn trường cho hàng và cột để tạo bảng chéo
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
