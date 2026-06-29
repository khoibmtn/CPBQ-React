"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, X, Check } from "lucide-react";

/* ── Types ────────────────────────────────────────────────────────────────── */

export type CostCategoryMode = "amount" | "average" | "ratio";

export interface CostCategorySelection {
    field: string;
    label: string;
    mode: CostCategoryMode;
}

interface CategoryDef {
    field: string;
    label: string;
    modes: { value: CostCategoryMode; label: string }[];
}

const CATEGORIES: CategoryDef[] = [
    {
        field: "t_thuoc", label: "Thuốc",
        modes: [
            { value: "amount", label: "Số tiền" },
            { value: "average", label: "Bình quân" },
            { value: "ratio", label: "TL thuốc/tổng chi" },
        ],
    },
    {
        field: "t_xn", label: "Xét nghiệm",
        modes: [
            { value: "amount", label: "Số tiền" },
            { value: "average", label: "Bình quân" },
        ],
    },
    {
        field: "t_cdha", label: "CĐHA",
        modes: [
            { value: "amount", label: "Số tiền" },
            { value: "average", label: "Bình quân" },
        ],
    },
    {
        field: "t_mau", label: "Máu",
        modes: [
            { value: "amount", label: "Số tiền" },
            { value: "average", label: "Bình quân" },
        ],
    },
    {
        field: "t_pttt", label: "PTTT",
        modes: [
            { value: "amount", label: "Số tiền" },
            { value: "average", label: "Bình quân" },
        ],
    },
    {
        field: "t_vtyt", label: "VTYT",
        modes: [
            { value: "amount", label: "Số tiền" },
            { value: "average", label: "Bình quân" },
        ],
    },
    {
        field: "t_giuong", label: "Tiền giường",
        modes: [
            { value: "amount", label: "Số tiền" },
            { value: "average", label: "Bình quân" },
        ],
    },
];

const MODE_SHORT: Record<CostCategoryMode, string> = {
    amount: "Σ",
    average: "BQ",
    ratio: "%",
};

/* ── Inline Style Objects ─────────────────────────────────────────────────── */

const S = {
    wrapper: {
        display: "flex",
        flexDirection: "column" as const,
        gap: "0.25rem",
        position: "relative" as const,
    },
    trigger: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        backgroundColor: "#f3f4f6",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        fontSize: "13px",
        padding: "5px 8px 5px 10px",
        minWidth: "180px",
        maxWidth: "420px",
        minHeight: "34px",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        outline: "none",
        fontFamily: "inherit",
    },
    triggerHover: {
        borderColor: "#c7d2fe",
        boxShadow: "0 0 0 2px rgba(99,102,241,0.15)",
    },
    placeholder: {
        color: "#9ca3af",
        fontSize: "13px",
        flex: 1,
    },
    chipsWrap: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "4px",
        flex: 1,
        minWidth: 0,
    },
    chip: {
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        background: "#eef2ff",
        border: "1px solid #c7d2fe",
        borderRadius: "6px",
        padding: "2px 6px",
        fontSize: "11px",
        color: "#4338ca",
        lineHeight: 1.3,
        whiteSpace: "nowrap" as const,
    },
    chipLabel: {
        fontWeight: 600 as const,
    },
    chipMode: {
        fontSize: "9px",
        fontWeight: 700 as const,
        background: "#c7d2fe",
        color: "#3730a3",
        borderRadius: "3px",
        padding: "0 3px",
        letterSpacing: "0.02em",
    },
    chipRemove: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "none",
        cursor: "pointer",
        color: "#818cf8",
        padding: "1px",
        borderRadius: "3px",
        marginLeft: "1px",
    },
    chevron: {
        width: 14,
        height: 14,
        color: "#9ca3af",
        flexShrink: 0,
        transition: "transform 0.2s ease",
    },
    panel: {
        position: "absolute" as const,
        top: "calc(100% + 6px)",
        left: 0,
        zIndex: 50,
        width: "300px",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.06)",
        overflow: "hidden",
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
    clearAll: {
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 600 as const,
        color: "#4f46e5",
        padding: "2px 6px",
        borderRadius: "4px",
    },
    list: {
        padding: "6px 0",
        maxHeight: "360px",
        overflowY: "auto" as const,
    },
    item: (active: boolean) => ({
        padding: "2px 10px",
        background: active ? "#eef2ff" : "transparent",
        transition: "background 0.1s",
    }),
    itemToggle: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        border: "none",
        background: "none",
        cursor: "pointer",
        padding: "8px 4px",
        fontSize: "13px",
        color: "#374151",
        textAlign: "left" as const,
        fontFamily: "inherit",
    },
    checkbox: (checked: boolean) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        border: checked ? "none" : "2px solid #d1d5db",
        borderRadius: "5px",
        flexShrink: 0,
        transition: "all 0.15s",
        background: checked ? "#4f46e5" : "#fff",
        color: checked ? "#fff" : "transparent",
    }),
    itemLabel: {
        fontWeight: 500 as const,
        flex: 1,
    },
    modeGroup: {
        display: "flex",
        gap: "1px",
        margin: "0 0 6px 36px",
        background: "#e5e7eb",
        borderRadius: "6px",
        overflow: "hidden",
    },
    modeBtn: (active: boolean) => ({
        flex: 1,
        border: "none",
        background: active ? "#4f46e5" : "#f9fafb",
        cursor: "pointer",
        padding: "6px 8px",
        fontSize: "11px",
        fontWeight: active ? 600 : 500,
        color: active ? "#fff" : "#6b7280",
        transition: "all 0.12s",
        whiteSpace: "nowrap" as const,
        fontFamily: "inherit",
    }),
    divider: {
        height: "1px",
        background: "#f3f4f6",
        margin: "2px 10px",
    },
};

/* ── Component ────────────────────────────────────────────────────────────── */

interface CostCategoryPickerProps {
    value: CostCategorySelection[];
    onChange: (selections: CostCategorySelection[]) => void;
}

export default function CostCategoryPicker({ value, onChange }: CostCategoryPickerProps) {
    const [open, setOpen] = useState(false);
    const [triggerHover, setTriggerHover] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Click outside
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Escape key
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open]);

    const isSelected = useCallback(
        (field: string) => value.some((s) => s.field === field),
        [value]
    );

    const getMode = useCallback(
        (field: string): CostCategoryMode => {
            const found = value.find((s) => s.field === field);
            return found?.mode ?? "amount";
        },
        [value]
    );

    const toggleCategory = useCallback(
        (cat: CategoryDef) => {
            if (isSelected(cat.field)) {
                onChange(value.filter((s) => s.field !== cat.field));
            } else {
                onChange([...value, { field: cat.field, label: cat.label, mode: "amount" }]);
            }
        },
        [value, onChange, isSelected]
    );

    const setMode = useCallback(
        (field: string, mode: CostCategoryMode) => {
            onChange(
                value.map((s) => (s.field === field ? { ...s, mode } : s))
            );
        },
        [value, onChange]
    );

    const removeCategory = useCallback(
        (field: string, e: React.MouseEvent) => {
            e.stopPropagation();
            onChange(value.filter((s) => s.field !== field));
        },
        [value, onChange]
    );

    const triggerStyle = {
        ...S.trigger,
        ...(triggerHover || open ? S.triggerHover : {}),
    };

    return (
        <div className="icd-filter-item" ref={containerRef} style={S.wrapper}>
            <label className="icd-filter-label">📋 Chi phí chi tiết</label>

            {/* ── Trigger ── */}
            <button
                type="button"
                style={triggerStyle}
                onClick={() => setOpen(!open)}
                onMouseEnter={() => setTriggerHover(true)}
                onMouseLeave={() => setTriggerHover(false)}
                aria-expanded={open}
                aria-haspopup="listbox"
            >
                {value.length === 0 ? (
                    <span style={S.placeholder}>Chọn danh mục...</span>
                ) : (
                    <span style={S.chipsWrap}>
                        {value.map((s) => (
                            <span key={s.field} style={S.chip}>
                                <span style={S.chipLabel}>{s.label}</span>
                                <span style={S.chipMode}>{MODE_SHORT[s.mode]}</span>
                                <button
                                    type="button"
                                    style={S.chipRemove}
                                    onClick={(e) => removeCategory(s.field, e)}
                                    aria-label={`Bỏ ${s.label}`}
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        ))}
                    </span>
                )}
                <ChevronDown
                    style={{
                        ...S.chevron,
                        transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                />
            </button>

            {/* ── Dropdown Panel ── */}
            {open && (
                <div style={S.panel} role="listbox" aria-multiselectable="true">
                    <div style={S.panelHeader}>
                        <span>Chọn danh mục chi phí</span>
                        {value.length > 0 && (
                            <button
                                type="button"
                                style={S.clearAll}
                                onClick={() => onChange([])}
                                onMouseEnter={(e) => {
                                    (e.target as HTMLElement).style.background = "#eef2ff";
                                }}
                                onMouseLeave={(e) => {
                                    (e.target as HTMLElement).style.background = "none";
                                }}
                            >
                                Bỏ tất cả
                            </button>
                        )}
                    </div>

                    <div style={S.list}>
                        {CATEGORIES.map((cat, idx) => {
                            const selected = isSelected(cat.field);
                            const currentMode = getMode(cat.field);

                            return (
                                <React.Fragment key={cat.field}>
                                    {idx > 0 && <div style={S.divider} />}
                                    <div style={S.item(selected)}>
                                        {/* Category toggle */}
                                        <button
                                            type="button"
                                            style={S.itemToggle}
                                            onClick={() => toggleCategory(cat)}
                                            role="option"
                                            aria-selected={selected}
                                            onMouseEnter={(e) => {
                                                if (!selected) (e.currentTarget.parentElement as HTMLElement).style.background = "#f9fafb";
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!selected) (e.currentTarget.parentElement as HTMLElement).style.background = "transparent";
                                            }}
                                        >
                                            <span style={S.checkbox(selected)}>
                                                {selected && <Check size={12} strokeWidth={3} />}
                                            </span>
                                            <span style={S.itemLabel}>{cat.label}</span>
                                        </button>

                                        {/* Mode selector — only when selected */}
                                        {selected && (
                                            <div style={S.modeGroup}>
                                                {cat.modes.map((m) => (
                                                    <button
                                                        key={m.value}
                                                        type="button"
                                                        style={S.modeBtn(currentMode === m.value)}
                                                        onClick={() => setMode(cat.field, m.value)}
                                                        onMouseEnter={(e) => {
                                                            if (currentMode !== m.value) {
                                                                (e.target as HTMLElement).style.background = "#f3f4f6";
                                                                (e.target as HTMLElement).style.color = "#374151";
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (currentMode !== m.value) {
                                                                (e.target as HTMLElement).style.background = "#f9fafb";
                                                                (e.target as HTMLElement).style.color = "#6b7280";
                                                            }
                                                        }}
                                                    >
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
