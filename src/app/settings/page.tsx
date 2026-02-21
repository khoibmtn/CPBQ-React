"use client";

import PageHeader from "@/components/ui/PageHeader";
import TabGroup from "@/components/ui/TabGroup";
import LookupEditor from "@/components/settings/LookupEditor";
import ProfileManager from "@/components/settings/ProfileManager";
import MergeManager from "@/components/settings/MergeManager";
import { Settings, ClipboardList, Building2, Building, BarChart3, GitMerge, Palette } from "lucide-react";
import { usePalette, PALETTES, type PaletteKey } from "@/components/ThemeProvider";

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
    return (
        <>
            <PageHeader
                title="Cấu hình"
                subtitle="Bảng mã lookup · Profiles hiển thị · Gộp khoa · Giao diện"
                icon={Settings}
            />

            <TabGroup tabs={TABS} defaultTab="loaikcb" storageKey="settings_tab">
                {(activeTab) => (
                    <>
                        {activeTab === "loaikcb" && (
                            <LookupEditor tableName="lookup_loaikcb" columns={LOAIKCB_COLUMNS} />
                        )}
                        {activeTab === "cskcb" && (
                            <LookupEditor tableName="lookup_cskcb" columns={CSKCB_COLUMNS} />
                        )}
                        {activeTab === "khoa" && (
                            <LookupEditor tableName="lookup_khoa" columns={KHOA_COLUMNS} />
                        )}
                        {activeTab === "profiles" && <ProfileManager />}
                        {activeTab === "merge" && <MergeManager />}
                        {activeTab === "palette" && <PalettePicker />}
                    </>
                )}
            </TabGroup>
        </>
    );
}
