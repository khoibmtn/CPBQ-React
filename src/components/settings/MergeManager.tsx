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
    sources: string[];
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
    khoaOptions.forEach((o) => {
        displayToName[o.display] = o.short_name;
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
            setGroups(data.groups || []);
            setKhoaOptions(data.khoaOptions || []);
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

    const addSource = (gi: number, sourceName: string) => {
        setGroups((prev) => {
            const updated = [...prev];
            if (!updated[gi].sources.includes(sourceName)) {
                updated[gi] = { ...updated[gi], sources: [...updated[gi].sources, sourceName] };
            }
            return updated;
        });
    };

    const removeSource = (gi: number, sourceName: string) => {
        setGroups((prev) => {
            const updated = [...prev];
            updated[gi] = { ...updated[gi], sources: updated[gi].sources.filter((s) => s !== sourceName) };
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

    // Build unique short_name list for targets
    const uniqueNames = [...new Set(khoaOptions.map((o) => o.short_name))];

    return (
        <div>
            {error && <div className="info-banner error" style={{ marginBottom: "0.75rem" }}>❌ {error}</div>}
            {success && <div className="info-banner success" style={{ marginBottom: "0.75rem" }}>{success}</div>}

            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                Quản lý nhóm gộp khoa · <strong>{groups.length}</strong> nhóm
            </div>

            {groups.map((group, gi) => {
                // Sources used in other groups
                const otherSources = new Set<string>();
                groups.forEach((g, i) => {
                    if (i !== gi) g.sources.forEach((s) => otherSources.add(s));
                });

                // Available sources: not target, not in other groups
                const availableSources = uniqueNames.filter(
                    (n) => n !== group.target_khoa && !otherSources.has(n) && !group.sources.includes(n)
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
                                value={group.target_khoa}
                                onChange={(e) => setTarget(gi, e.target.value)}
                                style={{ flex: 1 }}
                            >
                                {uniqueNames.map((n) => (
                                    <option key={n} value={n}>{n}</option>
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

                        {/* Source list */}
                        <div style={{ paddingLeft: "0.5rem" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                                Gộp từ các khoa:
                            </div>
                            {group.sources.map((src) => {
                                const displays = nameToDisplays[src] || [src];
                                return (
                                    <div key={src} className="merge-source-chip">
                                        <span>{displays[0]}</span>
                                        <button onClick={() => removeSource(gi, src)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                            ✕
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Add source dropdown */}
                            {availableSources.length > 0 && (
                                <select
                                    className="form-select"
                                    value=""
                                    onChange={(e) => {
                                        if (e.target.value) addSource(gi, e.target.value);
                                    }}
                                    style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}
                                >
                                    <option value="">-- Chọn khoa để thêm --</option>
                                    {availableSources.map((n) => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            )}
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
