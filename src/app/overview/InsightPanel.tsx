"use client";

import React, { useState, useMemo, useEffect } from "react";
import { BarChart3, Table2 } from "lucide-react";
import DataInsight from "./DataInsight";
import CrossTab from "./CrossTab";

/* ── Types ── */

interface InsightPanelProps {
    data: Record<string, unknown>[];
    totalRows: number;
    columns: string[];
    columnLabels: Record<string, string>;
}

/* ── Helpers ── */

function fmt(n: number): string {
    return n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

type TabKey = "stats" | "crosstab";

/* ── Component ── */

export default function InsightPanel({ data, totalRows, columns, columnLabels }: InsightPanelProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("stats");
    const [isLoaded, setIsLoaded] = useState(false);

    // Load persisted tab from settings
    useEffect(() => {
        fetch("/api/bq/settings?key=insight_panel_tab")
            .then((r) => r.json())
            .then((res) => {
                if (res.value && (res.value === "stats" || res.value === "crosstab")) {
                    setActiveTab(res.value);
                }
                setIsLoaded(true);
            })
            .catch(() => setIsLoaded(true));
    }, []);

    // Save active tab on change
    useEffect(() => {
        if (!isLoaded) return;
        const timer = setTimeout(() => {
            fetch("/api/bq/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "insight_panel_tab", value: activeTab }),
            }).catch(console.error);
        }, 500);
        return () => clearTimeout(timer);
    }, [activeTab, isLoaded]);

    // Compute normalized count
    const normalizedCount = useMemo(() => {
        if (!data || data.length === 0) return 0;
        return data.filter((r) => {
            const v = r.is_normalized;
            return v === true || v === "true" || v === 1 || v === "1";
        }).length;
    }, [data]);

    const normalizedPct = totalRows > 0 ? Math.round((normalizedCount / totalRows) * 100) : 0;

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: "stats", label: "Thống kê", icon: <BarChart3 size={13} /> },
        { key: "crosstab", label: "Bảng chéo", icon: <Table2 size={13} /> },
    ];

    /* ── Styles ── */
    const S = {
        wrapper: {
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            overflow: "hidden",
        },
        topBar: {
            display: "flex",
            alignItems: "stretch",
            borderBottom: "1px solid #e5e7eb",
            background: "#f8fafc",
        },
        summaryCards: {
            display: "flex",
            alignItems: "center",
            gap: "0",
            flexShrink: 0,
        },
        summaryCard: {
            padding: "0.625rem 1rem",
            textAlign: "center" as const,
            borderRight: "1px solid #e5e7eb",
            minWidth: "120px",
        },
        summaryLabel: {
            fontSize: "0.5625rem",
            fontWeight: 700,
            textTransform: "uppercase" as const,
            letterSpacing: "0.06em",
            marginBottom: "0.125rem",
        },
        summaryValue: {
            fontSize: "1.25rem",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums" as const,
            lineHeight: 1.1,
        },
        summarySub: {
            fontSize: "0.5625rem",
            marginTop: "0.125rem",
            fontWeight: 500,
        },
        tabsArea: {
            display: "flex",
            alignItems: "flex-end",
            gap: "0",
            marginLeft: "auto",
            paddingRight: "0.25rem",
        },
        tab: (active: boolean) => ({
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 0.875rem",
            fontSize: "0.6875rem",
            fontWeight: active ? 700 : 500,
            color: active ? "#4f46e5" : "#64748b",
            background: active ? "#fff" : "transparent",
            border: "none",
            borderBottom: active ? "2px solid #4f46e5" : "2px solid transparent",
            cursor: "pointer",
            transition: "all 0.15s",
            whiteSpace: "nowrap" as const,
        }),
        body: {
            padding: "0",
        },
    };

    return (
        <div style={S.wrapper}>
            {/* Top bar: summary cards + tabs */}
            <div style={S.topBar}>
                {/* Summary cards */}
                <div style={S.summaryCards}>
                    <div style={S.summaryCard}>
                        <div style={{ ...S.summaryLabel, color: "#94a3b8" }}>Số dòng</div>
                        <div style={{ ...S.summaryValue, color: "#1e293b" }}>
                            {fmt(totalRows)}
                        </div>
                        <div style={{ ...S.summarySub, color: "#94a3b8" }}>
                            {data.length !== totalRows && data.length > 0 ? `hiển thị ${fmt(data.length)}` : "hồ sơ"}
                        </div>
                    </div>
                    <div style={S.summaryCard}>
                        <div style={{ ...S.summaryLabel, color: "#059669" }}>Chuẩn hóa</div>
                        <div style={{ ...S.summaryValue, color: "#059669" }}>
                            {fmt(normalizedCount)}
                        </div>
                        <div style={{ ...S.summarySub, color: "#6ee7b7", fontWeight: 600 }}>
                            {normalizedPct}% tổng số
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={S.tabsArea}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            style={S.tab(activeTab === tab.key)}
                            onClick={() => setActiveTab(tab.key)}
                            onMouseEnter={(e) => {
                                if (activeTab !== tab.key) {
                                    (e.currentTarget).style.color = "#4f46e5";
                                    (e.currentTarget).style.background = "#f1f5f9";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeTab !== tab.key) {
                                    (e.currentTarget).style.color = "#64748b";
                                    (e.currentTarget).style.background = "transparent";
                                }
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div style={S.body}>
                {activeTab === "stats" && (
                    <DataInsight
                        data={data}
                        totalRows={totalRows}
                        columns={columns}
                        columnLabels={columnLabels}
                        embedded
                    />
                )}
                {activeTab === "crosstab" && (
                    <CrossTab
                        data={data}
                        columns={columns}
                        columnLabels={columnLabels}
                        embedded
                    />
                )}
            </div>
        </div>
    );
}
