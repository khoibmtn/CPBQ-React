"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

const PAGES = [
    { key: "/overview", label: "📊  Quản lý số liệu", icon: "📊" },
    { key: "/hospital-stats", label: "🏛️  Số liệu tổng hợp", icon: "🏛️" },
    { key: "/cost-by-dept", label: "🏥  Chi phí theo khoa", icon: "🏥" },
    { key: "/icd-analysis", label: "🔬  Chi phí theo mã bệnh", icon: "🔬" },
    { key: "/settings", label: "⚙️  Cấu hình", icon: "⚙️" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { theme, toggle } = useTheme();

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">🏥 CPBQ Dashboard</div>

            {/* Theme toggle */}
            <div style={{ padding: "0 0.5rem", marginBottom: "0.25rem" }}>
                <button className="theme-toggle" onClick={toggle}>
                    {theme === "dark" ? "🌙 Tối" : "☀️ Sáng"}
                </button>
            </div>

            <hr className="divider" style={{ margin: "0.5rem 0.75rem" }} />

            <nav className="sidebar-nav">
                {PAGES.map((p) => {
                    const isActive =
                        pathname === p.key || (pathname === "/" && p.key === "/overview");
                    return (
                        <Link
                            key={p.key}
                            href={p.key}
                            className={`nav-item ${isActive ? "active" : ""}`}
                        >
                            {p.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-footer">TTYT Thủy Nguyên · v3.0-react</div>
        </aside>
    );
}
