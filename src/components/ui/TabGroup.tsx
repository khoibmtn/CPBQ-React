"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

interface Tab {
    id: string;
    label: string;
    icon?: LucideIcon | string;
}

interface TabGroupProps {
    tabs: Tab[];
    defaultTab?: string;
    storageKey?: string;
    /** OLD: render-prop (conditional rendering, causes remount) */
    children?: (activeTab: string) => ReactNode;
    /** NEW: lazy-mount + keep-alive — tab content stays in React tree */
    panels?: Record<string, ReactNode>;
}

export default function TabGroup({ tabs, defaultTab, storageKey, children, panels }: TabGroupProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

    // Track which tabs have been visited (for lazy-mount)
    const [visited, setVisited] = useState<Set<string>>(() => new Set([activeTab]));

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            if (storageKey) {
                try {
                    const stored = sessionStorage.getItem(storageKey);
                    if (stored && tabs.some((t) => t.id === stored)) {
                        setActiveTab(stored);
                        setVisited((prev) => {
                            if (prev.has(stored)) return prev;
                            return new Set(prev).add(stored);
                        });
                    }
                } catch { /* ignore */ }
            }
            return;
        }
        if (storageKey) {
            try { sessionStorage.setItem(storageKey, activeTab); } catch { /* ignore */ }
        }
    }, [storageKey, activeTab, tabs]);

    // Add to visited set when tab changes
    useEffect(() => {
        setVisited((prev) => {
            if (prev.has(activeTab)) return prev;
            return new Set(prev).add(activeTab);
        });
    }, [activeTab]);

    const renderIcon = (icon?: LucideIcon | string) => {
        if (!icon) return null;
        if (typeof icon === "string") return <span className="text-base">{icon}</span>;
        const Icon = icon;
        return <Icon className="w-4 h-4" />;
    };

    return (
        <div className="mb-6">
            <div className="flex gap-0 border-b border-gray-200 mb-5">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            className={`
                                inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold
                                border-b-2 -mb-px transition-colors cursor-pointer
                                ${isActive
                                    ? "text-primary-600 border-primary-600"
                                    : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
                                }
                            `}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {renderIcon(tab.icon)}
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            <div>
                {panels
                    ? tabs.map((tab) => {
                        if (!visited.has(tab.id)) return null;
                        return (
                            <div
                                key={tab.id}
                                style={{ display: activeTab === tab.id ? "block" : "none" }}
                            >
                                {panels[tab.id]}
                            </div>
                        );
                    })
                    : children?.(activeTab)
                }
            </div>
        </div>
    );
}

