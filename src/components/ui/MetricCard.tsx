interface MetricCardProps {
    label: string;
    value: string;
    icon?: string;
    color?: "blue" | "orange" | "green" | "purple" | "cyan" | "red";
}

const colorMap: Record<string, string> = {
    blue: "#3b82f6",
    orange: "#f97316",
    green: "#10b981",
    purple: "#8b5cf6",
    cyan: "#06b6d4",
    red: "#ef4444",
};

export default function MetricCard({
    label,
    value,
    icon = "📊",
    color = "blue",
}: MetricCardProps) {
    return (
        <div
            className="metric-card"
            style={{ borderLeftColor: colorMap[color] || colorMap.blue, borderLeftWidth: 3 }}
        >
            <div className="icon">{icon}</div>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
        </div>
    );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
    return <div className="metric-grid">{children}</div>;
}
