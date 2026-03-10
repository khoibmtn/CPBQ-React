"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, type ComponentType } from "react";

import OverviewPage from "@/app/overview/page";
import HospitalStatsPage from "@/app/hospital-stats/page";
import CostByDeptPage from "@/app/cost-by-dept/page";
import IcdAnalysisPage from "@/app/icd-analysis/page";
import SettingsPage from "@/app/settings/page";

const PAGES: { key: string; component: ComponentType }[] = [
    { key: "/overview", component: OverviewPage },
    { key: "/hospital-stats", component: HospitalStatsPage },
    { key: "/cost-by-dept", component: CostByDeptPage },
    { key: "/icd-analysis", component: IcdAnalysisPage },
    { key: "/settings", component: SettingsPage },
];

/**
 * Lazy-mount + keep-alive shell.
 * - Pages mount only on first visit.
 * - Once mounted, they stay in the React tree (hidden via CSS).
 * - Revisiting a page shows it instantly without re-render/re-fetch.
 */
export default function PageShell() {
    const pathname = usePathname();
    const [visited, setVisited] = useState<Set<string>>(new Set());

    useEffect(() => {
        const resolved = pathname === "/" ? "/hospital-stats" : pathname;
        setVisited((prev) => {
            if (prev.has(resolved)) return prev;
            return new Set(prev).add(resolved);
        });
    }, [pathname]);

    const activePath = pathname === "/" ? "/hospital-stats" : pathname;

    return (
        <>
            {PAGES.map((p) => {
                if (!visited.has(p.key)) return null;
                const Page = p.component;
                return (
                    <div
                        key={p.key}
                        style={{ display: activePath === p.key ? "block" : "none" }}
                    >
                        <Page />
                    </div>
                );
            })}
        </>
    );
}
