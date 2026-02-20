"use client";

import { useState, useEffect, useRef } from "react";

interface Tab {
    id: string;
    label: string;
    icon?: string;
}

interface TabGroupProps {
    tabs: Tab[];
    defaultTab?: string;
    /** If provided, persist active tab to sessionStorage under this key */
    storageKey?: string;
    children: (activeTab: string) => React.ReactNode;
}

export default function TabGroup({ tabs, defaultTab, storageKey, children }: TabGroupProps) {
    // Always initialize with defaultTab to avoid SSR/client hydration mismatch
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

    // Restore from sessionStorage on client mount (after hydration)
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

    return (
        <div className="tab-group">
            <div className="tab-nav">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon && <span className="tab-icon">{tab.icon}</span>}
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="tab-content">{children(activeTab)}</div>
        </div>
    );
}
