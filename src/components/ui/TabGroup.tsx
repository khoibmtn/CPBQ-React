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
    children: (activeTab: string) => ReactNode;
}

export default function TabGroup({ tabs, defaultTab, storageKey, children }: TabGroupProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            if (storageKey) {
                try {
                    const stored = sessionStorage.getItem(storageKey);
                    if (stored && tabs.some((t) => t.id === stored)) {
                        setActiveTab(stored);
                    }
                } catch { /* ignore */ }
            }
            return;
        }
        if (storageKey) {
            try { sessionStorage.setItem(storageKey, activeTab); } catch { /* ignore */ }
        }
    }, [storageKey, activeTab, tabs]);

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
            <div>{children(activeTab)}</div>
        </div>
    );
}
