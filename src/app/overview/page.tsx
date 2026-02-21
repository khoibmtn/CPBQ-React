"use client";

import PageHeader from "@/components/ui/PageHeader";
import TabGroup from "@/components/ui/TabGroup";
import TabPivot from "./TabPivot";
import TabManage from "./TabManage";
import TabImport from "./TabImport";
import { BarChart3, ClipboardList, Download } from "lucide-react";

const TABS = [
    { id: "pivot", label: "Số liệu tổng hợp", icon: BarChart3 },
    { id: "manage", label: "Quản lý số liệu", icon: ClipboardList },
    { id: "import", label: "Import", icon: Download },
];

export default function OverviewPage() {
    return (
        <>
            <PageHeader
                title="Quản lý số liệu"
                subtitle="Tổng hợp · Quản lý · Import dữ liệu thanh toán BHYT"
                icon={BarChart3}
            />
            <TabGroup tabs={TABS} defaultTab="pivot" storageKey="overview_tab">
                {(activeTab) => (
                    <>
                        {activeTab === "pivot" && <TabPivot />}
                        {activeTab === "manage" && <TabManage />}
                        {activeTab === "import" && <TabImport />}
                    </>
                )}
            </TabGroup>
        </>
    );
}
