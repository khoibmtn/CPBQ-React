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
    const [activeTab, setActiveTab] = useState(() => {
        if (storageKey && typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem(storageKey);
                if (stored && tabs.some((t) => t.id === stored)) return stored;
            } catch { /* ignore */ }
        }
        return defaultTab || tabs[0]?.id || "";
    });

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (!storageKey) return;
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        try { sessionStorage.setItem(storageKey, activeTab); } catch { /* ignore */ }
    }, [storageKey, activeTab]);

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
