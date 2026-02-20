"use client";

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
        return <div className="loading-overlay"><div className="spinner" /> Đang tải dữ liệu...</div>;
    }

    if (khoaOptions.length === 0) {
        return (
            <div className="info-banner warning">
                Chưa có dữ liệu bảng Khoa. Vui lòng thêm dữ liệu trong tab Khoa trước.
            </div>
        );
    }

    const allDisplays = khoaOptions.map((o) => o.display);

    return (
        <div>
            {error && <div className="info-banner error" style={{ marginBottom: "0.75rem" }}>❌ {error}</div>}
            {success && <div className="info-banner success" style={{ marginBottom: "0.75rem" }}>{success}</div>}

            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                Quản lý nhóm gộp khoa · <strong>{groups.length}</strong> nhóm
            </div>

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
                    <div key={gi} className="settings-card" style={{ marginBottom: "0.75rem" }}>
                        {/* Target row */}
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                                Khoa đích:
                            </label>
                            <select
                                className="form-select"
                                value={targetDisplay}
                                onChange={(e) => {
                                    const opt = displayToOption[e.target.value];
                                    if (opt) setTarget(gi, opt.short_name);
                                }}
                                style={{ flex: 1 }}
                            >
                                {allDisplays.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            <button
                                className="btn btn-sm"
                                onClick={() => deleteGroup(gi)}
                                style={{ color: "var(--error)", background: "transparent", border: "none", fontSize: "0.85rem" }}
                            >
                                🗑️ Xóa nhóm
                            </button>
                        </div>

                        {/* Source list — chips show display strings directly */}
                        <div style={{ paddingLeft: "0.5rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                                Gộp từ các khoa:
                            </div>
                            {group.sources.map((srcDisplay) => (
                                <div key={srcDisplay} className="merge-source-chip">
                                    <span>{srcDisplay}</span>
                                    <button onClick={() => removeSource(gi, srcDisplay)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                        ✕
                                    </button>
                                </div>
                            ))}

                            {/* Add source dropdown */}
                            <select
                                className="form-select"
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) addSource(gi, e.target.value);
                                }}
                                disabled={sortedEligible.length === 0}
                                style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}
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

            {/* Add new group */}
            <button className="btn btn-secondary" onClick={addGroup} style={{ marginBottom: "1rem" }}>
                ➕ Thêm nhóm gộp mới
            </button>

            {/* Save */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? "⏳ Đang lưu..." : "💾 Lưu cấu hình gộp khoa"}
                </button>
            </div>
        </div>
    );
}
