"use client";

import { useState } from "react";

interface Tab {
    id: string;
    label: string;
    icon?: string;
}

interface TabGroupProps {
    tabs: Tab[];
    defaultTab?: string;
    children: (activeTab: string) => React.ReactNode;
}

export default function TabGroup({ tabs, defaultTab, children }: TabGroupProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

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
