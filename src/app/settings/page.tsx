"use client";

import PageHeader from "@/components/ui/PageHeader";
import TabGroup from "@/components/ui/TabGroup";
import LookupEditor from "@/components/settings/LookupEditor";
import ProfileManager from "@/components/settings/ProfileManager";
import MergeManager from "@/components/settings/MergeManager";
import { Settings, ClipboardList, Building2, Building, BarChart3, GitMerge, Palette, Lock, LockOpen } from "lucide-react";
import { usePalette, PALETTES, type PaletteKey } from "@/components/ThemeProvider";
import { useState, useEffect, useMemo } from "react";

const STORAGE_KEY = "settings_unlocked";
const UNLOCK_CODE = "123456";

const TABS = [
    { id: "loaikcb", label: "Loại KCB", icon: ClipboardList },
    { id: "cskcb", label: "Cơ sở KCB", icon: Building2 },
    { id: "khoa", label: "Khoa", icon: Building },
    { id: "profiles", label: "Profiles", icon: BarChart3 },
    { id: "merge", label: "Gộp khoa", icon: GitMerge },
    { id: "palette", label: "Giao diện", icon: Palette },
];

const LOAIKCB_COLUMNS = [
    { key: "ma_loaikcb", label: "Mã loại", type: "number" as const, help: "Mã loại KCB (1-9)" },
    { key: "ml2", label: "ML2", type: "text" as const, help: "Phân loại cấp 2: Nội trú / Ngoại trú" },
    { key: "ml4", label: "ML4", type: "text" as const, help: "Phân loại cấp 4" },
    { key: "valid_from", label: "Hiệu lực từ", type: "number" as const, help: "YYYYMMDD" },
    { key: "valid_to", label: "Hiệu lực đến", type: "number" as const, help: "YYYYMMDD, để trống = không giới hạn" },
];

const CSKCB_COLUMNS = [
    { key: "ma_cskcb", label: "Mã CSKCB", type: "text" as const, help: "Mã cơ sở KCB" },
    { key: "ten_cskcb", label: "Tên CSKCB", type: "text" as const, help: "Tên cơ sở khám chữa bệnh" },
    { key: "valid_from", label: "Hiệu lực từ", type: "number" as const, help: "YYYYMMDD" },
    { key: "valid_to", label: "Hiệu lực đến", type: "number" as const, help: "YYYYMMDD" },
];

const KHOA_COLUMNS = [
    { key: "thu_tu", label: "Thứ tự", type: "number" as const, help: "Thứ tự hiển thị", width: "65px" },
    { key: "ma_cskcb", label: "Mã CSKCB", type: "text" as const, width: "80px" },
    { key: "makhoa_xml", label: "Mã khoa XML", type: "text" as const, width: "95px" },
    { key: "full_name", label: "Tên đầy đủ", type: "text" as const },
    { key: "short_name", label: "Tên rút gọn", type: "text" as const, width: "110px" },
    { key: "valid_from", label: "Hiệu lực từ", type: "number" as const, help: "YYYYMMDD", width: "95px" },
    { key: "valid_to", label: "Hiệu lực đến", type: "number" as const, help: "YYYYMMDD", width: "95px" },
];

function PalettePicker() {
    const { palette, setPalette } = usePalette();
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-heading font-bold text-lg text-gray-900 mb-1">Bảng màu</h3>
            <p className="text-sm text-gray-500 mb-4">Chọn bảng màu chủ đạo cho giao diện</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(Object.keys(PALETTES) as PaletteKey[]).map((key) => {
                    const p = PALETTES[key];
                    const isActive = palette === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setPalette(key)}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer
                                ${isActive
                                    ? "border-primary-500 bg-primary-50 shadow-sm"
                                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                                }
                            `}
                        >
                            <div className="flex gap-1">
                                {[400, 500, 600].map((shade) => (
                                    <div
                                        key={shade}
                                        className="w-5 h-5 rounded-full"
                                        style={{ backgroundColor: p.colors[shade as keyof typeof p.colors] }}
                                    />
                                ))}
                            </div>
                            <span className={`text-sm font-medium ${isActive ? "text-primary-700" : "text-gray-700"}`}>
                                {p.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const [unlocked, setUnlocked] = useState(false);
    const [showUnlockDialog, setShowUnlockDialog] = useState(false);
    const [unlockInput, setUnlockInput] = useState("");
    const [unlockError, setUnlockError] = useState(false);

    // Read localStorage on mount (client-only)
    useEffect(() => {
        setUnlocked(localStorage.getItem(STORAGE_KEY) === "true");
    }, []);

    const handleToggleLock = () => {
        if (unlocked) {
            localStorage.removeItem(STORAGE_KEY);
            setUnlocked(false);
            window.dispatchEvent(new Event("settings-unlock-change"));
        } else {
            setUnlockInput("");
            setUnlockError(false);
            setShowUnlockDialog(true);
        }
    };

    const handleUnlockSubmit = () => {
        if (unlockInput === UNLOCK_CODE) {
            localStorage.setItem(STORAGE_KEY, "true");
            setUnlocked(true);
            setShowUnlockDialog(false);
            setUnlockInput("");
            setUnlockError(false);
            window.dispatchEvent(new Event("settings-unlock-change"));
        } else {
            setUnlockError(true);
        }
    };

    const readOnly = !unlocked;

    // Stabilize panels so lock/unlock doesn't remount tab content
    const panels = useMemo(() => ({
        loaikcb: <LookupEditor tableName="lookup_loaikcb" columns={LOAIKCB_COLUMNS} readOnly={readOnly} />,
        cskcb: <LookupEditor tableName="lookup_cskcb" columns={CSKCB_COLUMNS} readOnly={readOnly} />,
        khoa: <LookupEditor tableName="lookup_khoa" columns={KHOA_COLUMNS} readOnly={readOnly} />,
        profiles: <ProfileManager readOnly={readOnly} />,
        merge: <MergeManager readOnly={readOnly} />,
        palette: <PalettePicker />,
    }), [readOnly]);

    return (
        <>
            <PageHeader
                title="Cấu hình"
                subtitle="Bảng mã lookup · Profiles hiển thị · Gộp khoa · Giao diện"
                icon={Settings}
                extra={
                    <button
                        onClick={handleToggleLock}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${unlocked
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                            }`}
                    >
                        {unlocked ? (
                            <><LockOpen className="w-4 h-4" /> Đã mở khóa</>
                        ) : (
                            <><Lock className="w-4 h-4" /> Mở khóa</>
                        )}
                    </button>
                }
            />

            <TabGroup tabs={TABS} defaultTab="loaikcb" storageKey="settings_tab" panels={panels} />

            {/* Unlock dialog */}
            {showUnlockDialog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
                    onClick={() => setShowUnlockDialog(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-amber-600" />
                            Mở khóa
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Nhập mã mở khóa để chỉnh sửa cấu hình
                        </p>
                        <input
                            type="password"
                            autoFocus
                            value={unlockInput}
                            onChange={(e) => { setUnlockInput(e.target.value); setUnlockError(false); }}
                            onKeyDown={(e) => { if (e.key === "Enter") handleUnlockSubmit(); }}
                            placeholder="Mã mở khóa..."
                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
                                unlockError
                                    ? "border-red-400 bg-red-50 focus:border-red-500"
                                    : "border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                            }`}
                        />
                        {unlockError && (
                            <p className="text-xs text-red-600 mt-1.5 font-medium">Sai mã mở khóa!</p>
                        )}
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setShowUnlockDialog(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleUnlockSubmit}
                                className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

