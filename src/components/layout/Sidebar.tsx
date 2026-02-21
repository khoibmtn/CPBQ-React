"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3, Building2, Stethoscope, Microscope, Settings,
} from "lucide-react";

const PAGES = [
    { key: "/overview", label: "Quản lý số liệu", icon: BarChart3 },
    { key: "/hospital-stats", label: "Số liệu tổng hợp", icon: Building2 },
    { key: "/cost-by-dept", label: "Chi phí theo khoa", icon: Stethoscope },
    { key: "/icd-analysis", label: "Chi phí theo mã bệnh", icon: Microscope },
    { key: "/settings", label: "Cấu hình", icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="flex items-center gap-2 h-16 px-6 border-b border-gray-100">
                <Building2 className="w-6 h-6 text-primary-600" />
                <h1 className="font-heading font-bold text-lg text-gray-900">
                    CPBQ Dashboard
                </h1>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
                {PAGES.map((p) => {
                    const isActive =
                        pathname === p.key || (pathname === "/" && p.key === "/overview");
                    const Icon = p.icon;
                    return (
                        <Link
                            key={p.key}
                            href={p.key}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                transition-colors duration-150
                                ${isActive
                                    ? "bg-primary-50 text-primary-700"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                }
                            `}
                        >
                            <Icon className="w-5 h-5" />
                            {p.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-3 border-t border-gray-100">
                <p className="px-3 py-2 text-xs text-gray-400">
                    TTYT Thủy Nguyên · v3.0-react
                </p>
            </div>
        </aside>
    );
}
