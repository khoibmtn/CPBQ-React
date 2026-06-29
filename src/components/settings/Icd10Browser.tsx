"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Loader2, Search, Columns3, X, Check, ChevronDown } from "lucide-react";
import DataTable, { Column } from "@/components/ui/DataTable";

/* ── Column definitions ────────────────────────────────────────────────────── */

interface ColDef {
    key: string;
    label: string;
    defaultVisible: boolean;
    width?: number;
}

const ALL_COLUMNS: ColDef[] = [
    { key: "stt", label: "STT", defaultVisible: false, width: 60 },
    { key: "ma_benh", label: "Mã bệnh", defaultVisible: true, width: 100 },
    { key: "ma_benh_ko_dau", label: "Mã không dấu", defaultVisible: false, width: 110 },
    { key: "ten_benh", label: "Tên bệnh", defaultVisible: true, width: 250 },
    { key: "ten_benh_en", label: "Disease name (EN)", defaultVisible: true, width: 250 },
    { key: "stt_chuong", label: "Chương", defaultVisible: true, width: 80 },
    { key: "ten_chuong", label: "Tên chương", defaultVisible: true },
    { key: "ma_khoi", label: "Mã khối", defaultVisible: true, width: 100 },
    { key: "ten_khoi", label: "Tên khối", defaultVisible: false },
    { key: "ma_nhom_3kt", label: "Mã nhóm 3KT", defaultVisible: true, width: 110 },
    { key: "ten_nhom_3kt", label: "Tên nhóm 3KT", defaultVisible: false },
    { key: "pham_vi_ma", label: "Phạm vi mã", defaultVisible: false, width: 110 },
    { key: "chapter_name", label: "Chapter name", defaultVisible: false },
    { key: "block_name", label: "Block name", defaultVisible: false },
    { key: "ten_nhom_3kt_en", label: "Nhóm 3KT (EN)", defaultVisible: false },
    { key: "ma_tieu_khoi_1", label: "Mã tiểu khối 1", defaultVisible: false, width: 120 },
    { key: "ten_tieu_khoi_1", label: "Tên tiểu khối 1", defaultVisible: false },
    { key: "ten_tieu_khoi_1_en", label: "Tiểu khối 1 (EN)", defaultVisible: false },
    { key: "ma_tieu_khoi_2", label: "Mã tiểu khối 2", defaultVisible: false, width: 120 },
    { key: "ten_tieu_khoi_2", label: "Tên tiểu khối 2", defaultVisible: false },
    { key: "ten_tieu_khoi_2_en", label: "Tiểu khối 2 (EN)", defaultVisible: false },
    { key: "huong_dan_en", label: "Hướng dẫn (EN)", defaultVisible: false },
    { key: "huong_dan_vn", label: "Hướng dẫn (VN)", defaultVisible: false },
    { key: "khong_benh_chinh", label: "Không dùng bệnh chính", defaultVisible: false, width: 80 },
    { key: "khong_khuyen_khich", label: "Không khuyến khích", defaultVisible: false, width: 80 },
    { key: "co_ma_cu_the_hon", label: "Có mã cụ thể hơn", defaultVisible: false, width: 80 },
    { key: "chi_tu_vong", label: "Chỉ tử vong", defaultVisible: false, width: 80 },
    { key: "ma_nu", label: "Mã nữ", defaultVisible: false, width: 70 },
    { key: "ma_nam", label: "Mã nam", defaultVisible: false, width: 70 },
];

const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));

const CONFIG_TABLE = "lookup_icd10_config";

/* ── Inline styles ─────────────────────────────────────────────────────────── */

const S = {
    toolbar: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px",
        flexWrap: "wrap" as const,
    },
    searchWrap: {
        position: "relative" as const,
        flex: "1 1 300px",
        minWidth: "200px",
        maxWidth: "500px",
    },
    searchIcon: {
        position: "absolute" as const,
        left: "10px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "#9ca3af",
        pointerEvents: "none" as const,
    },
    searchInput: {
        width: "100%",
        padding: "8px 12px 8px 36px",
        fontSize: "13px",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        outline: "none",
        backgroundColor: "#f9fafb",
        transition: "border-color 0.15s, box-shadow 0.15s",
        fontFamily: "inherit",
    },
    colBtn: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 12px",
        fontSize: "13px",
        fontWeight: 500 as const,
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        background: "#fff",
        cursor: "pointer",
        color: "#374151",
        transition: "all 0.15s",
        fontFamily: "inherit",
        whiteSpace: "nowrap" as const,
    },
    badge: {
        fontSize: "10px",
        fontWeight: 700 as const,
        background: "#4f46e5",
        color: "#fff",
        borderRadius: "9999px",
        padding: "1px 6px",
        lineHeight: "1.4",
    },
    panel: {
        position: "absolute" as const,
        top: "calc(100% + 6px)",
        right: 0,
        zIndex: 50,
        width: "320px",
        maxHeight: "420px",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.06)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column" as const,
    },
    panelHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px 8px",
        borderBottom: "1px solid #f3f4f6",
        fontSize: "11px",
        fontWeight: 700 as const,
        color: "#6b7280",
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
    },
    panelList: {
        flex: 1,
        overflowY: "auto" as const,
        padding: "4px 0",
    },
    colItem: (active: boolean) => ({
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        border: "none",
        background: active ? "#eef2ff" : "transparent",
        cursor: "pointer",
        padding: "7px 14px",
        fontSize: "13px",
        color: "#374151",
        textAlign: "left" as const,
        fontFamily: "inherit",
        transition: "background 0.1s",
    }),
    checkbox: (checked: boolean) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "16px",
        height: "16px",
        border: checked ? "none" : "2px solid #d1d5db",
        borderRadius: "4px",
        flexShrink: 0,
        background: checked ? "#4f46e5" : "#fff",
        color: checked ? "#fff" : "transparent",
        transition: "all 0.15s",
    }),
    stats: {
        fontSize: "12px",
        color: "#9ca3af",
        whiteSpace: "nowrap" as const,
    },
    savingIndicator: {
        fontSize: "11px",
        color: "#6b7280",
        display: "flex",
        alignItems: "center",
        gap: "4px",
    },
};

/* ── Fuzzy search helpers ──────────────────────────────────────────────────── */

// Fields to search against (in priority order)
const SEARCH_FIELDS = ["ma_benh", "ma_benh_ko_dau", "ten_benh", "ten_benh_en", "ma_nhom_3kt", "ten_chuong", "ma_khoi", "ten_khoi"];

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Fuzzy match: split query into tokens by whitespace.
 * A row matches if EVERY token appears in at least one searchable field.
 * Returns a relevance score (higher = better match).
 */
function fuzzyScore(row: Record<string, unknown>, tokens: string[]): number {
    if (tokens.length === 0) return 0;

    let totalScore = 0;
    for (const token of tokens) {
        let tokenMatched = false;
        for (let fi = 0; fi < SEARCH_FIELDS.length; fi++) {
            const fieldVal = String(row[SEARCH_FIELDS[fi]] ?? "").toLowerCase();
            if (!fieldVal) continue;

            const idx = fieldVal.indexOf(token);
            if (idx >= 0) {
                tokenMatched = true;
                // Scoring: higher for earlier fields, prefix match bonus, exact match bonus
                let score = (SEARCH_FIELDS.length - fi) * 10; // field priority
                if (idx === 0) score += 50; // prefix match
                if (fieldVal === token) score += 100; // exact match
                if (fieldVal.length < 20) score += 5; // short field bonus (code vs long name)
                totalScore += score;
                break; // Only count best field per token
            }
        }
        if (!tokenMatched) return -1; // ALL tokens must match
    }
    return totalScore;
}

/**
 * Highlight all token occurrences in text with <mark> tags.
 */
function highlightText(text: string, tokens: string[]): React.ReactNode {
    if (!text || tokens.length === 0) return text;

    // Build a single regex that matches any token (case-insensitive)
    const pattern = tokens.map(escapeRegex).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");

    const parts = text.split(regex);
    if (parts.length <= 1) return text;

    return (
        <>
            {parts.map((part, i) => {
                if (regex.test(part)) {
                    // Reset lastIndex since we reuse the regex
                    regex.lastIndex = 0;
                    return (
                        <mark
                            key={i}
                            style={{
                                background: "linear-gradient(120deg, #fde68a 0%, #fbbf24 100%)",
                                color: "#92400e",
                                padding: "0 2px",
                                borderRadius: "3px",
                                fontWeight: 600,
                                boxDecorationBreak: "clone" as const,
                            }}
                        >
                            {part}
                        </mark>
                    );
                }
                regex.lastIndex = 0;
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function Icd10Browser() {
    const [allRows, setAllRows] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
    const [colPanelOpen, setColPanelOpen] = useState(false);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const colBtnRef = useRef<HTMLDivElement>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load config from BigQuery
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/bq/lookup?table=${CONFIG_TABLE}`);
                const data = await res.json();
                if (data.rows && data.rows.length > 0) {
                    const cfg = data.rows[0];
                    if (cfg.visible_columns) {
                        try {
                            const cols = JSON.parse(cfg.visible_columns);
                            if (Array.isArray(cols) && cols.length > 0) {
                                setVisibleCols(new Set(cols));
                            }
                        } catch { /* use default */ }
                    }
                }
            } catch { /* use default */ }
            setConfigLoaded(true);
        })();
    }, []);

    // Load ICD-10 data
    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/bq/lookup?table=lookup_icd10");
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setAllRows(data.rows || []);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu ICD-10");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Save config to BigQuery (debounced)
    const saveConfig = useCallback((cols: Set<string>) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            setSaving(true);
            try {
                await fetch("/api/bq/lookup", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        table: CONFIG_TABLE,
                        rows: [{ visible_columns: JSON.stringify(Array.from(cols)) }],
                    }),
                });
            } catch { /* silently fail */ }
            setSaving(false);
        }, 1500);
    }, []);

    // Click outside column panel
    useEffect(() => {
        if (!colPanelOpen) return;
        const handler = (e: MouseEvent) => {
            if (colBtnRef.current && !colBtnRef.current.contains(e.target as Node)) {
                setColPanelOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [colPanelOpen]);

    const toggleCol = useCallback((key: string) => {
        setVisibleCols((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                if (next.size > 1) next.delete(key); // Don't allow 0 cols
            } else {
                next.add(key);
            }
            saveConfig(next);
            return next;
        });
    }, [saveConfig]);

    const resetCols = useCallback(() => {
        setVisibleCols(new Set(DEFAULT_VISIBLE));
        saveConfig(new Set(DEFAULT_VISIBLE));
    }, [saveConfig]);

    // Parse search tokens for fuzzy matching
    const searchTokens = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        return q.split(/\s+/).filter(Boolean);
    }, [searchQuery]);

    // Fuzzy search + sort by relevance
    const filteredRows = useMemo(() => {
        if (searchTokens.length === 0) return allRows;
        const scored: { row: Record<string, unknown>; score: number }[] = [];
        for (const row of allRows) {
            const score = fuzzyScore(row, searchTokens);
            if (score >= 0) scored.push({ row, score });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.map((s) => s.row);
    }, [allRows, searchTokens]);

    // Build DataTable columns (with highlight render when searching)
    const tableColumns: Column[] = useMemo(() =>
        ALL_COLUMNS
            .filter((c) => visibleCols.has(c.key))
            .map((c) => ({
                key: c.key,
                label: c.label,
                align: c.key === "stt" ? "center" as const : "left" as const,
                width: c.width,
                ...(searchTokens.length > 0 ? {
                    render: (val: unknown) => {
                        const text = val != null ? String(val) : "";
                        return highlightText(text, searchTokens);
                    },
                } : {}),
            })),
        [visibleCols, searchTokens]
    );

    if (loading || !configLoaded) {
        return (
            <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải bảng ICD-10...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-700 text-sm">
                ❌ {error}
            </div>
        );
    }

    return (
        <div>
            {/* Toolbar */}
            <div style={S.toolbar}>
                {/* Search */}
                <div style={S.searchWrap}>
                    <Search size={16} style={S.searchIcon} />
                    <input
                        type="text"
                        placeholder="Tìm mã bệnh, tên bệnh..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={S.searchInput}
                        onFocus={(e) => {
                            (e.target as HTMLInputElement).style.borderColor = "#818cf8";
                            (e.target as HTMLInputElement).style.boxShadow = "0 0 0 2px rgba(99,102,241,0.15)";
                        }}
                        onBlur={(e) => {
                            (e.target as HTMLInputElement).style.borderColor = "#e5e7eb";
                            (e.target as HTMLInputElement).style.boxShadow = "none";
                        }}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            style={{
                                position: "absolute", right: "8px", top: "50%",
                                transform: "translateY(-50%)", border: "none",
                                background: "none", cursor: "pointer", color: "#9ca3af",
                                padding: "2px", borderRadius: "4px",
                            }}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Column toggle */}
                <div ref={colBtnRef} style={{ position: "relative" }}>
                    <button
                        type="button"
                        style={S.colBtn}
                        onClick={() => setColPanelOpen(!colPanelOpen)}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "#c7d2fe";
                            (e.currentTarget as HTMLElement).style.background = "#f9fafb";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
                            (e.currentTarget as HTMLElement).style.background = "#fff";
                        }}
                    >
                        <Columns3 size={15} />
                        Cột
                        <span style={S.badge}>{visibleCols.size}/{ALL_COLUMNS.length}</span>
                        <ChevronDown size={14} style={{
                            transition: "transform 0.2s",
                            transform: colPanelOpen ? "rotate(180deg)" : "rotate(0deg)",
                            color: "#9ca3af",
                        }} />
                    </button>

                    {colPanelOpen && (
                        <div style={S.panel}>
                            <div style={S.panelHeader}>
                                <span>Hiển thị cột</span>
                                <button
                                    type="button"
                                    onClick={resetCols}
                                    style={{
                                        background: "none", border: "none", cursor: "pointer",
                                        fontSize: "11px", fontWeight: 600, color: "#4f46e5",
                                        padding: "2px 6px", borderRadius: "4px",
                                    }}
                                >
                                    Mặc định
                                </button>
                            </div>
                            <div style={S.panelList}>
                                {ALL_COLUMNS.map((col) => {
                                    const active = visibleCols.has(col.key);
                                    return (
                                        <button
                                            key={col.key}
                                            type="button"
                                            style={S.colItem(active)}
                                            onClick={() => toggleCol(col.key)}
                                            onMouseEnter={(e) => {
                                                if (!active) (e.currentTarget as HTMLElement).style.background = "#f9fafb";
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                                            }}
                                        >
                                            <span style={S.checkbox(active)}>
                                                {active && <Check size={11} strokeWidth={3} />}
                                            </span>
                                            <span style={{ flex: 1 }}>{col.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <span style={S.stats}>
                    {searchQuery
                        ? `${filteredRows.length.toLocaleString()} / ${allRows.length.toLocaleString()} mã bệnh`
                        : `${allRows.length.toLocaleString()} mã bệnh`
                    }
                </span>

                {saving && (
                    <span style={S.savingIndicator}>
                        <Loader2 size={12} className="animate-spin" /> Đang lưu...
                    </span>
                )}
            </div>

            {/* Table */}
            <DataTable
                columns={tableColumns}
                data={filteredRows}
                pageSize={50}
                pageSizeOptions={[20, 50, 100, 200]}
                stickyHeader
                emptyMessage={searchQuery ? "Không tìm thấy mã bệnh phù hợp" : "Chưa có dữ liệu ICD-10"}
            />
        </div>
    );
}
