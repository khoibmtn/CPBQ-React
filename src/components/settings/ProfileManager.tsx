"use client";

import { useState, useEffect, useCallback } from "react";

/* ── All metric keys (same as settings.py) ─────────────────────────────── */
const ALL_METRIC_KEYS: [string, string][] = [
    ["so_luot", "Số lượt KCB"],
    ["so_ngay_dtri", "Số ngày điều trị (NT)"],
    ["t_tongchi", "Tổng chi"],
    ["t_xn", "Xét nghiệm"],
    ["t_cdha", "CĐHA"],
    ["t_thuoc", "Thuốc"],
    ["t_mau", "Máu"],
    ["t_pttt", "PTTT"],
    ["t_vtyt", "VTYT"],
    ["t_kham", "Tiền khám"],
    ["t_giuong", "Tiền giường"],
    ["t_bhtt", "Tiền BHTT"],
    ["t_bntt", "Tiền BNTT"],
    ["bq_t_tongchi", "BQ Tổng chi"],
    ["bq_t_xn", "BQ Xét nghiệm"],
    ["bq_t_cdha", "BQ CĐHA"],
    ["bq_t_thuoc", "BQ Thuốc"],
    ["bq_t_mau", "BQ Máu"],
    ["bq_t_pttt", "BQ PTTT"],
    ["bq_t_vtyt", "BQ VTYT"],
    ["bq_t_kham", "BQ Tiền khám"],
    ["bq_t_giuong", "BQ Tiền giường"],
    ["bq_t_bhtt", "BQ BHTT"],
    ["bq_t_bntt", "BQ BNTT"],
    ["tl_thuoc_tongchi", "Tỷ lệ thuốc/tổng chi"],
    ["ngay_dttb", "Ngày ĐTTB"],
];

const METRIC_DISPLAY: Record<string, string> = Object.fromEntries(ALL_METRIC_KEYS);
const DEFAULT_ORDER: Record<string, number> = Object.fromEntries(
    ALL_METRIC_KEYS.map(([k], i) => [k, i])
);

interface MetricItem {
    metric_key: string;
    thu_tu: number;
    visible: boolean;
}

function buildDefaultItems(): MetricItem[] {
    return ALL_METRIC_KEYS.map(([key], i) => ({
        metric_key: key,
        thu_tu: i + 1,
        visible: true,
    }));
}

export default function ProfileManager() {
    const [profileNames, setProfileNames] = useState<string[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [items, setItems] = useState<MetricItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newName, setNewName] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    /* ── Load profile names ── */
    const loadNames = useCallback(async () => {
        try {
            const res = await fetch("/api/bq/profiles");
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setProfileNames(data.names || []);
            return data.names || [];
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi tải profiles");
            return [];
        }
    }, []);

    /* ── Load profile data ── */
    const loadProfile = useCallback(async (name: string) => {
        try {
            const res = await fetch(`/api/bq/profiles?name=${encodeURIComponent(name)}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            let loaded: MetricItem[] = data.items || [];

            // Ensure all metrics present
            const existing = new Set(loaded.map((it) => it.metric_key));
            let maxThuTu = Math.max(0, ...loaded.map((it) => it.thu_tu || 0));
            for (const [key] of ALL_METRIC_KEYS) {
                if (!existing.has(key)) {
                    maxThuTu++;
                    loaded.push({ metric_key: key, thu_tu: maxThuTu, visible: false });
                }
            }

            // Deduplicate
            const seen = new Set<string>();
            loaded = loaded.filter((it) => {
                if (seen.has(it.metric_key)) return false;
                seen.add(it.metric_key);
                return true;
            });

            setItems(loaded);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi tải profile");
            setItems(buildDefaultItems());
        }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const names = await loadNames();
            if (names.length > 0) {
                setSelected(names[0]);
                await loadProfile(names[0]);
            }
            setLoading(false);
        })();
    }, [loadNames, loadProfile]);

    /* ── Handlers ── */
    const handleSelectProfile = async (name: string) => {
        setSelected(name);
        setConfirmDelete(null);
        await loadProfile(name);
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        const name = newName.trim();
        if (profileNames.includes(name)) {
            setError(`Profile "${name}" đã tồn tại!`);
            return;
        }
        setSaving(true);
        try {
            const defaultItems = buildDefaultItems();
            const res = await fetch("/api/bq/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, items: defaultItems }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setShowCreateDialog(false);
            setNewName("");
            await loadNames();
            setSelected(name);
            setItems(defaultItems);
            setSuccess(`✅ Đã tạo profile "${name}"!`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi tạo profile");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/bq/profiles?name=${encodeURIComponent(confirmDelete)}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setConfirmDelete(null);
            const names = await loadNames();
            if (names.length > 0) {
                setSelected(names[0]);
                await loadProfile(names[0]);
            } else {
                setSelected(null);
                setItems([]);
            }
            setSuccess("✅ Đã xóa profile!");
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi xóa profile");
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        try {
            // Sort: checked by thu_tu, unchecked by default order
            const checked = items.filter((it) => it.visible).sort((a, b) => a.thu_tu - b.thu_tu);
            const unchecked = items
                .filter((it) => !it.visible)
                .sort((a, b) => (DEFAULT_ORDER[a.metric_key] ?? 999) - (DEFAULT_ORDER[b.metric_key] ?? 999));
            const ordered = [...checked, ...unchecked].map((it, i) => ({ ...it, thu_tu: i + 1 }));

            const res = await fetch("/api/bq/profiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: selected, items: ordered }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setItems(ordered);
            setSuccess(`✅ Đã lưu profile "${selected}"!`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Lỗi lưu profile");
        } finally {
            setSaving(false);
        }
    };

    const toggleItem = (key: string) => {
        setItems((prev) =>
            prev.map((it) => {
                if (it.metric_key !== key) return it;
                const newVisible = !it.visible;
                if (newVisible) {
                    const maxTt = Math.max(0, ...prev.filter((x) => x.visible).map((x) => x.thu_tu));
                    return { ...it, visible: true, thu_tu: maxTt + 1 };
                }
                return { ...it, visible: false };
            })
        );
    };

    const toggleAll = () => {
        const allChecked = items.every((it) => it.visible);
        setItems((prev) =>
            prev.map((it, i) => ({ ...it, visible: !allChecked, thu_tu: i + 1 }))
        );
    };

    const moveUp = (key: string) => {
        const checked = items.filter((it) => it.visible).sort((a, b) => a.thu_tu - b.thu_tu);
        const idx = checked.findIndex((it) => it.metric_key === key);
        if (idx <= 0) return;
        // Swap thu_tu
        const curTt = checked[idx].thu_tu;
        const prevTt = checked[idx - 1].thu_tu;
        setItems((prev) =>
            prev.map((it) => {
                if (it.metric_key === key) return { ...it, thu_tu: prevTt };
                if (it.metric_key === checked[idx - 1].metric_key) return { ...it, thu_tu: curTt };
                return it;
            })
        );
    };

    const moveDown = (key: string) => {
        const checked = items.filter((it) => it.visible).sort((a, b) => a.thu_tu - b.thu_tu);
        const idx = checked.findIndex((it) => it.metric_key === key);
        if (idx >= checked.length - 1) return;
        const curTt = checked[idx].thu_tu;
        const nextTt = checked[idx + 1].thu_tu;
        setItems((prev) =>
            prev.map((it) => {
                if (it.metric_key === key) return { ...it, thu_tu: nextTt };
                if (it.metric_key === checked[idx + 1].metric_key) return { ...it, thu_tu: curTt };
                return it;
            })
        );
    };

    if (loading) {
        return <div className="loading-overlay"><div className="spinner" /> Đang tải profiles...</div>;
    }

    // Build display list: checked first (by thu_tu), then unchecked (by default order)
    const checked = items.filter((it) => it.visible).sort((a, b) => a.thu_tu - b.thu_tu);
    const unchecked = items
        .filter((it) => !it.visible)
        .sort((a, b) => (DEFAULT_ORDER[a.metric_key] ?? 999) - (DEFAULT_ORDER[b.metric_key] ?? 999));
    const displayItems = [...checked, ...unchecked];
    const visibleCount = checked.length;
    const allChecked = items.length > 0 && items.every((it) => it.visible);

    return (
        <div>
            {error && <div className="info-banner error" style={{ marginBottom: "0.75rem" }}>❌ {error}</div>}
            {success && <div className="info-banner success" style={{ marginBottom: "0.75rem" }}>{success}</div>}

            {/* Top row: selector + create + delete */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
                <select
                    className="form-select"
                    value={selected || ""}
                    onChange={(e) => handleSelectProfile(e.target.value)}
                    style={{ flex: 1 }}
                >
                    {profileNames.length === 0 && <option value="">Chưa có profile</option>}
                    {profileNames.map((n) => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreateDialog(true)}>
                    ➕ Tạo mới
                </button>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => selected && setConfirmDelete(selected)}
                    disabled={!selected}
                >
                    🗑️ Xóa
                </button>
            </div>

            {/* Create dialog */}
            {showCreateDialog && (
                <div className="settings-card" style={{ marginBottom: "1rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input
                            className="form-input"
                            placeholder="Tên profile mới..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={saving}>
                            ✅ Tạo
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreateDialog(false); setNewName(""); }}>
                            ❌ Hủy
                        </button>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {confirmDelete && (
                <div className="info-banner warning" style={{ marginBottom: "1rem" }}>
                    ⚠️ Bạn có chắc muốn xóa profile &quot;<strong>{confirmDelete}</strong>&quot;?
                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                        <button className="btn btn-primary btn-sm" onClick={handleDelete} disabled={saving}>
                            🗑️ Xác nhận xóa
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(null)}>
                            Hủy
                        </button>
                    </div>
                </div>
            )}

            {selected && !confirmDelete && (
                <>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <div>
                            <div style={{ fontSize: "1rem", fontWeight: 700 }}>Profile: {selected}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                Đã chọn <strong style={{ color: "var(--text-body)" }}>{visibleCount}</strong> / {items.length} chỉ tiêu
                            </div>
                        </div>
                        <label className="checkbox-label" style={{ fontSize: "0.85rem" }}>
                            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                            Chọn tất cả
                        </label>
                    </div>

                    {/* Table header */}
                    <div className="profile-list-header">
                        <span style={{ width: 40, textAlign: "center" }}>STT</span>
                        <span style={{ flex: 1, paddingLeft: 8 }}>Tên chỉ tiêu</span>
                        <span style={{ width: 60, textAlign: "center" }}>Thao tác</span>
                    </div>

                    {/* Scrollable list */}
                    <div className="profile-list" style={{ maxHeight: 420, overflow: "auto" }}>
                        {(() => {
                            let ckStt = 0;
                            let ucStt = 0;
                            return displayItems.map((item) => {
                                const key = item.metric_key;
                                const name = METRIC_DISPLAY[key] || key;
                                const isChecked = item.visible;
                                const stt = isChecked ? ++ckStt : ++ucStt;
                                const ckIdx = isChecked ? ckStt - 1 : -1;

                                return (
                                    <div key={key} className={`profile-row ${isChecked ? "checked" : "unchecked"}`}>
                                        <span className="profile-stt" style={isChecked ? { color: "var(--accent)", fontWeight: 700 } : { color: "var(--text-muted)" }}>
                                            {stt}
                                        </span>
                                        <label className="profile-name" style={{ flex: 1 }}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleItem(key)}
                                            />
                                            <span style={isChecked ? { fontWeight: 600, color: "var(--text-primary)" } : { color: "var(--text-muted)" }}>
                                                {name}
                                            </span>
                                        </label>
                                        {isChecked && (
                                            <span className="profile-actions">
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => moveUp(key)}
                                                    disabled={ckIdx === 0}
                                                    style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                                                >↑</button>
                                                <button
                                                    className="btn btn-sm"
                                                    onClick={() => moveDown(key)}
                                                    disabled={ckIdx >= checked.length - 1}
                                                    style={{ padding: "2px 6px", fontSize: "0.75rem" }}
                                                >↓</button>
                                            </span>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* Footer: Save/Cancel */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
                        <button className="btn btn-secondary" onClick={() => selected && loadProfile(selected)}>
                            Hủy bỏ
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? "⏳ Đang lưu..." : "💾 Lưu profile"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
