"use client";

import PageHeader from "@/components/ui/PageHeader";
import TabGroup from "@/components/ui/TabGroup";
import LookupEditor from "@/components/settings/LookupEditor";
import ProfileManager from "@/components/settings/ProfileManager";
import MergeManager from "@/components/settings/MergeManager";

const TABS = [
    { id: "loaikcb", label: "Loại KCB", icon: "📋" },
    { id: "cskcb", label: "Cơ sở KCB", icon: "🏥" },
    { id: "khoa", label: "Khoa", icon: "🏛️" },
    { id: "profiles", label: "Profiles", icon: "📊" },
    { id: "merge", label: "Gộp khoa", icon: "🔀" },
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
    { key: "thu_tu", label: "Thứ tự", type: "number" as const, help: "Thứ tự hiển thị" },
    { key: "ma_cskcb", label: "Mã CSKCB", type: "text" as const },
    { key: "makhoa_xml", label: "Mã khoa XML", type: "text" as const },
    { key: "full_name", label: "Tên đầy đủ", type: "text" as const },
    { key: "short_name", label: "Tên rút gọn", type: "text" as const },
    { key: "valid_from", label: "Hiệu lực từ", type: "number" as const, help: "YYYYMMDD" },
    { key: "valid_to", label: "Hiệu lực đến", type: "number" as const, help: "YYYYMMDD" },
];

export default function SettingsPage() {
    return (
        <>
            <PageHeader
                title="Cấu hình"
                subtitle="Bảng mã lookup · Profiles hiển thị · Gộp khoa"
                icon="⚙️"
                gradient="linear-gradient(135deg, rgba(100,116,139,0.9), rgba(71,85,105,0.85))"
            />

            <TabGroup tabs={TABS} defaultTab="loaikcb">
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
                    </>
                )}
            </TabGroup>
        </>
    );
}
