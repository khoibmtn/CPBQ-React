"use client";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
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

    const loadProfile = useCallback(async (name: string) => {
        try {
            const res = await fetch(`/api/bq/profiles?name=${encodeURIComponent(name)}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            let loaded: MetricItem[] = data.items || [];
            const existing = new Set(loaded.map((it) => it.metric_key));
            let maxThuTu = Math.max(0, ...loaded.map((it) => it.thu_tu || 0));
            for (const [key] of ALL_METRIC_KEYS) {
                if (!existing.has(key)) {
                    maxThuTu++;
                    loaded.push({ metric_key: key, thu_tu: maxThuTu, visible: false });
                }
            }
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
            setSuccess(`Đã tạo profile "${name}"!`);
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
            setSuccess("Đã xóa profile!");
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
            setSuccess(`Đã lưu profile "${selected}"!`);
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
        return (
            <div className="flex items-center gap-2 justify-center py-12 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải profiles...
            </div>
        );
    }

    const checked = items.filter((it) => it.visible).sort((a, b) => a.thu_tu - b.thu_tu);
    const unchecked = items
        .filter((it) => !it.visible)
        .sort((a, b) => (DEFAULT_ORDER[a.metric_key] ?? 999) - (DEFAULT_ORDER[b.metric_key] ?? 999));
    const visibleCount = checked.length;
    const allChecked = items.length > 0 && items.every((it) => it.visible);

    return (
        <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            {/* Status banners */}
            {error && (
                <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-700 text-sm">
                    ❌ {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 cursor-pointer">✕</button>
                </div>
            )}
            {success && (
                <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-700 text-sm">
                    ✅ {success}
                </div>
            )}

            {/* Top row: selector + create + delete */}
            <div className="p-6 flex items-center gap-4 border-b border-slate-100">
                <div className="w-[60%]">
                    <select
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm font-medium focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                        value={selected || ""}
                        onChange={(e) => handleSelectProfile(e.target.value)}
                    >
                        {profileNames.length === 0 && <option value="">Chưa có profile</option>}
                        {profileNames.map((n) => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-1 items-center justify-end gap-3">
                    <button
                        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all cursor-pointer"
                        onClick={() => setShowCreateDialog(true)}
                    >
                        <Plus className="w-[18px] h-[18px]" /> Tạo mới
                    </button>
                    <button
                        className="flex items-center gap-2 border border-red-200 text-red-600 px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
                        onClick={() => selected && setConfirmDelete(selected)}
                        disabled={!selected}
                    >
                        <Trash2 className="w-[18px] h-[18px]" /> Xóa
                    </button>
                </div>
            </div>

            {/* Create dialog */}
            {showCreateDialog && (
                <div className="mx-6 mt-4 flex items-center gap-3 p-4 rounded-lg border border-indigo-200 bg-indigo-50">
                    <input
                        className="flex-1 rounded-lg border-slate-300 text-sm py-2 px-3 focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="Tên profile mới..."
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        autoFocus
                    />
                    <button
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                        onClick={handleCreate}
                        disabled={saving}
                    >
                        Tạo
                    </button>
                    <button
                        className="px-4 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                        onClick={() => { setShowCreateDialog(false); setNewName(""); }}
                    >
                        Hủy
                    </button>
                </div>
            )}

            {/* Delete confirmation */}
            {confirmDelete && (
                <div className="mx-6 mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50">
                    <p className="text-sm text-amber-800 mb-3">
                        ⚠️ Bạn có chắc muốn xóa profile &quot;<strong>{confirmDelete}</strong>&quot;?
                    </p>
                    <div className="flex gap-2">
                        <button
                            className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all cursor-pointer disabled:opacity-50"
                            onClick={handleDelete}
                            disabled={saving}
                        >
                            Xác nhận xóa
                        </button>
                        <button
                            className="px-4 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                            onClick={() => setConfirmDelete(null)}
                        >
                            Hủy
                        </button>
                    </div>
                </div>
            )}

            {selected && !confirmDelete && !showCreateDialog && (
                <>
                    {/* Profile info bar */}
                    <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-b border-slate-100">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Profile: {selected}</h3>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">
                                Đã chọn <strong className="text-slate-800">{visibleCount}</strong> / {items.length} chỉ tiêu
                            </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none group">
                            <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">CHỌN TẤT CẢ</span>
                            <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={toggleAll}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </label>
                    </div>

                    {/* Scrollable metric list */}
                    <div className="max-h-[420px] overflow-y-auto">
                        {/* ĐÃ CHỌN section */}
                        {checked.length > 0 && (
                            <div className="bg-indigo-50/30">
                                <div className="px-6 py-2 sticky top-0 bg-indigo-100/90 backdrop-blur-sm z-10 flex items-center justify-between border-b border-indigo-200/50">
                                    <span className="text-[10px] font-bold text-indigo-600 tracking-wider">ĐÃ CHỌN</span>
                                    <span className="text-[10px] font-medium text-indigo-500 italic">Kéo thả hoặc dùng nút để sắp xếp</span>
                                </div>
                                <div className="flex flex-col">
                                    {checked.map((item, idx) => {
                                        const name = METRIC_DISPLAY[item.metric_key] || item.metric_key;
                                        const stt = String(idx + 1).padStart(2, "0");
                                        return (
                                            <div
                                                key={item.metric_key}
                                                className="bg-indigo-50/50 flex items-center px-6 py-3 border-b border-indigo-100/50 group hover:bg-indigo-100/40 transition-colors"
                                            >
                                                <span className="text-xs font-mono text-indigo-400 w-10 shrink-0">{stt}</span>
                                                <input
                                                    type="checkbox"
                                                    checked
                                                    onChange={() => toggleItem(item.metric_key)}
                                                    className="w-5 h-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mr-4"
                                                />
                                                <span className="text-sm font-bold text-indigo-900 flex-1">{name}</span>
                                                <div className="flex gap-1 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="p-1 hover:text-indigo-600 hover:bg-white rounded transition-all cursor-pointer disabled:opacity-30"
                                                        onClick={() => moveUp(item.metric_key)}
                                                        disabled={idx === 0}
                                                    >
                                                        <ArrowUp className="w-[18px] h-[18px]" />
                                                    </button>
                                                    <button
                                                        className="p-1 hover:text-indigo-600 hover:bg-white rounded transition-all cursor-pointer disabled:opacity-30"
                                                        onClick={() => moveDown(item.metric_key)}
                                                        disabled={idx >= checked.length - 1}
                                                    >
                                                        <ArrowDown className="w-[18px] h-[18px]" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* CHƯA CHỌN section */}
                        {unchecked.length > 0 && (
                            <div className="bg-slate-100/30">
                                <div className="px-6 py-2 sticky top-0 bg-slate-200/90 backdrop-blur-sm z-10 border-b border-slate-300/50">
                                    <span className="text-[10px] font-bold text-slate-500 tracking-wider">CHƯA CHỌN</span>
                                </div>
                                <div className="flex flex-col">
                                    {unchecked.map((item, idx) => {
                                        const name = METRIC_DISPLAY[item.metric_key] || item.metric_key;
                                        const stt = String(checked.length + idx + 1).padStart(2, "0");
                                        return (
                                            <div
                                                key={item.metric_key}
                                                className="bg-white flex items-center px-6 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                                            >
                                                <span className="text-xs font-mono text-slate-300 w-10 shrink-0">{stt}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={false}
                                                    onChange={() => toggleItem(item.metric_key)}
                                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mr-4"
                                                />
                                                <span className="text-sm font-medium text-slate-400 flex-1">{name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer: Save/Cancel */}
                    <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-end gap-3 mt-auto">
                        <button
                            className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer"
                            onClick={() => selected && loadProfile(selected)}
                        >
                            Hủy bỏ
                        </button>
                        <button
                            className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 cursor-pointer"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Đang lưu...</>
                            ) : (
                                <><Save className="w-5 h-5" /> Lưu profile</>
                            )}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
