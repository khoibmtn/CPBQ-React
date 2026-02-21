"use client";
import { Loader2, Trash2, Plus, Save } from "lucide-react";

import { useState, useEffect, useCallback } from "react";

interface KhoaOption {
    short_name: string;
    makhoa: string;
    display: string;
    valid_from: number | null;
    valid_to: number | null;
    thu_tu: number | null;
}

interface MergeGroup {
    target_khoa: string;
    sources: string[]; // display strings in component state
}

export default function MergeManager() {
    const [groups, setGroups] = useState<MergeGroup[]>([]);
    const [khoaOptions, setKhoaOptions] = useState<KhoaOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const displayToName: Record<string, string> = {};
    const nameToDisplays: Record<string, string[]> = {};
    const displayToOption: Record<string, KhoaOption> = {};
    khoaOptions.forEach((o) => {
        displayToName[o.display] = o.short_name;
        displayToOption[o.display] = o;
        if (!nameToDisplays[o.short_name]) nameToDisplays[o.short_name] = [];
        nameToDisplays[o.short_name].push(o.display);
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/bq/merge");
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setKhoaOptions(data.khoaOptions || []);
            // sources are already display strings from API
            setGroups(data.groups || []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async () => {
        // Validate
        for (const g of groups) {
            if (g.sources.length === 0) {
                setError(`Nhóm "${g.target_khoa}" chưa có khoa nguồn nào!`);
                return;
            }
        }

        // Check no duplicate sources across groups
        const allSources: string[] = [];
        for (const g of groups) {
            for (const s of g.sources) {
                if (allSources.includes(s)) {
                    setError(`Khoa "${s}" xuất hiện trong nhiều nhóm gộp!`);
                    return;
                }
                allSources.push(s);
            }
        }

        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/bq/merge", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ groups }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSuccess(`✅ Đã lưu ${data.count} nhóm gộp khoa!`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi lưu dữ liệu");
        } finally {
            setSaving(false);
        }
    };

    const addGroup = () => {
        if (khoaOptions.length === 0) return;
        setGroups((prev) => [...prev, { target_khoa: khoaOptions[0].short_name, sources: [] }]);
    };

    const deleteGroup = (gi: number) => {
        setGroups((prev) => prev.filter((_, i) => i !== gi));
    };

    const setTarget = (gi: number, targetName: string) => {
        setGroups((prev) => {
            const updated = [...prev];
            updated[gi] = { ...updated[gi], target_khoa: targetName, sources: [] };
            return updated;
        });
    };

    // Add source by DISPLAY string
    const addSource = (gi: number, display: string) => {
        setGroups((prev) => {
            const updated = [...prev];
            if (!updated[gi].sources.includes(display)) {
                updated[gi] = { ...updated[gi], sources: [...updated[gi].sources, display] };
            }
            return updated;
        });
    };

    // Remove source by DISPLAY string
    const removeSource = (gi: number, display: string) => {
        setGroups((prev) => {
            const updated = [...prev];
            updated[gi] = { ...updated[gi], sources: updated[gi].sources.filter((s) => s !== display) };
            return updated;
        });
    };

    if (loading) {
        return <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải dữ liệu...</div>;
    }

    if (khoaOptions.length === 0) {
        return (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-amber-50 border-amber-200 text-amber-700 text-sm">
                Chưa có dữ liệu bảng Khoa. Vui lòng thêm dữ liệu trong tab Khoa trước.
            </div>
        );
    }

    const allDisplays = khoaOptions.map((o) => o.display);

    return (
        <div>
            {/* Alerts */}
            {error && (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderRadius: "10px",
                    border: "1px solid #fecaca", backgroundColor: "#fef2f2",
                    color: "#991b1b", fontSize: "0.85rem", marginBottom: "16px",
                }}>
                    <span>❌ {error}</span>
                    <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontSize: "1rem", padding: "0 4px" }}>✕</button>
                </div>
            )}
            {success && (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderRadius: "10px",
                    border: "1px solid #bcf0da", backgroundColor: "#f0fdf4",
                    color: "#166534", fontSize: "0.85rem", marginBottom: "16px",
                }}>
                    <span>{success}</span>
                    <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontSize: "1rem", padding: "0 4px" }}>✕</button>
                </div>
            )}

            {/* Header */}
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "16px" }}>
                Quản lý nhóm gộp khoa · <strong style={{ color: "#1e293b" }}>{groups.length}</strong> nhóm
            </div>

            {/* Group cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {groups.map((group, gi) => {
                    // Find target display + valid_from
                    const targetDisplays = nameToDisplays[group.target_khoa] || [];
                    const targetDisplay = targetDisplays[0] || group.target_khoa;
                    const targetOption = displayToOption[targetDisplay];
                    const targetValidFrom = targetOption?.valid_from ?? null;

                    // Collect displays already used in OTHER groups
                    const otherGroupDisplays = new Set<string>();
                    groups.forEach((g, i) => {
                        if (i !== gi) g.sources.forEach((d) => otherGroupDisplays.add(d));
                    });

                    // Step 1: eligibility — only check target + validity
                    const eligibleAll = khoaOptions.filter((o) => {
                        if (o.short_name === group.target_khoa) return false;

                        if (targetValidFrom) {
                            const vt = o.valid_to;
                            const vf = o.valid_from;
                            if (vt && vt < targetValidFrom) return true;
                            if (!vf && !vt && o.thu_tu) return true;
                            return false;
                        }
                        return true;
                    });

                    // Step 2: exclude displays already shown in THIS or OTHER groups
                    const shownDisplays = new Set<string>(otherGroupDisplays);
                    group.sources.forEach((d) => shownDisplays.add(d));
                    const remaining = eligibleAll.filter((o) => !shownDisplays.has(o.display));

                    const sortedEligible = [...remaining].sort((a, b) =>
                        a.makhoa.localeCompare(b.makhoa)
                    );

                    return (
                        <div key={gi} style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            backgroundColor: "#fff",
                            overflow: "hidden",
                        }}>
                            {/* Khoa đích section */}
                            <div style={{
                                display: "flex", gap: "12px", alignItems: "center",
                                padding: "16px 20px",
                                backgroundColor: "#fafbfc",
                            }}>
                                <label style={{
                                    fontSize: "0.82rem", fontWeight: 600,
                                    color: "#475569", whiteSpace: "nowrap",
                                }}>
                                    Khoa đích:
                                </label>
                                <select
                                    value={targetDisplay}
                                    onChange={(e) => {
                                        const opt = displayToOption[e.target.value];
                                        if (opt) setTarget(gi, opt.short_name);
                                    }}
                                    style={{
                                        flex: 1, padding: "8px 12px",
                                        fontSize: "0.85rem", borderRadius: "8px",
                                        border: "1px solid #d1d5db",
                                        backgroundColor: "#fff",
                                        color: "#1e293b",
                                        outline: "none",
                                    }}
                                >
                                    {allDisplays.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => deleteGroup(gi)}
                                    style={{
                                        display: "inline-flex", alignItems: "center", gap: "6px",
                                        padding: "7px 14px", fontSize: "0.78rem", fontWeight: 500,
                                        borderRadius: "8px", border: "1px solid #fecaca",
                                        backgroundColor: "#fff", color: "#ef4444",
                                        cursor: "pointer", whiteSpace: "nowrap",
                                        transition: "all 0.15s",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "#fef2f2";
                                        e.currentTarget.style.borderColor = "#f87171";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "#fff";
                                        e.currentTarget.style.borderColor = "#fecaca";
                                    }}
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Xóa nhóm
                                </button>
                            </div>

                            {/* Divider */}
                            <div style={{ height: "1px", backgroundColor: "#e2e8f0" }} />

                            {/* Sources section */}
                            <div style={{ padding: "16px 20px" }}>
                                <div style={{
                                    fontSize: "0.78rem", fontWeight: 600,
                                    color: "#64748b", marginBottom: "10px",
                                    textTransform: "uppercase", letterSpacing: "0.03em",
                                }}>
                                    Gộp từ các khoa:
                                </div>

                                {/* Source items */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {group.sources.map((srcDisplay) => (
                                        <div key={srcDisplay} style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "10px 14px",
                                            backgroundColor: "#f8fafc",
                                            borderRadius: "8px",
                                            border: "1px solid #f1f5f9",
                                            fontSize: "0.85rem",
                                            color: "#334155",
                                        }}>
                                            <span>{srcDisplay}</span>
                                            <button
                                                onClick={() => removeSource(gi, srcDisplay)}
                                                title="Xóa khoa nguồn"
                                                style={{
                                                    background: "none", border: "none", cursor: "pointer",
                                                    color: "#94a3b8", padding: "2px",
                                                    display: "inline-flex", alignItems: "center",
                                                    borderRadius: "4px", transition: "all 0.15s",
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.backgroundColor = "#fef2f2"; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add source dropdown — dashed border */}
                                <select
                                    value=""
                                    onChange={(e) => {
                                        if (e.target.value) addSource(gi, e.target.value);
                                    }}
                                    disabled={sortedEligible.length === 0}
                                    style={{
                                        marginTop: "10px", padding: "8px 12px",
                                        fontSize: "0.82rem", borderRadius: "8px",
                                        border: "2px dashed #cbd5e1",
                                        backgroundColor: sortedEligible.length === 0 ? "#f8fafc" : "#fff",
                                        color: sortedEligible.length === 0 ? "#94a3b8" : "#64748b",
                                        cursor: sortedEligible.length === 0 ? "not-allowed" : "pointer",
                                        outline: "none", width: "100%",
                                    }}
                                >
                                    <option value="">
                                        {sortedEligible.length === 0
                                            ? "-- Không còn khoa phù hợp --"
                                            : "-- Chọn khoa để thêm --"}
                                    </option>
                                    {sortedEligible.map((o) => (
                                        <option key={o.display} value={o.display}>{o.display}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add new group button */}
            <button
                onClick={addGroup}
                style={{
                    display: "inline-flex", alignItems: "center", gap: "8px",
                    padding: "10px 20px", marginTop: "16px",
                    fontSize: "0.85rem", fontWeight: 500,
                    borderRadius: "10px", border: "1px solid #d1d5db",
                    backgroundColor: "#fff", color: "#475569",
                    cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#94a3b8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#fff"; e.currentTarget.style.borderColor = "#d1d5db"; }}
            >
                <Plus className="w-4 h-4" /> Thêm nhóm gộp mới
            </button>

            {/* Save button — separated */}
            <div style={{
                borderTop: "1px solid #e2e8f0",
                marginTop: "20px", paddingTop: "16px",
                display: "flex", justifyContent: "flex-end",
            }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        display: "inline-flex", alignItems: "center", gap: "8px",
                        padding: "10px 24px",
                        fontSize: "0.85rem", fontWeight: 600,
                        borderRadius: "10px", border: "none",
                        backgroundColor: saving ? "#94a3b8" : "#4f46e5",
                        color: "#fff",
                        cursor: saving ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                        boxShadow: "0 1px 3px rgba(79,70,229,0.3)",
                    }}
                    onMouseEnter={(e) => { if (!saving) e.currentTarget.style.backgroundColor = "#4338ca"; }}
                    onMouseLeave={(e) => { if (!saving) e.currentTarget.style.backgroundColor = "#4f46e5"; }}
                >
                    <Save className="w-4 h-4" />
                    {saving ? "Đang lưu..." : "Lưu cấu hình gộp khoa"}
                </button>
            </div>
        </div>
    );
}
