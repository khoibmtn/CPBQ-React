import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
    label: string;
    value: string;
    icon?: LucideIcon | string;
    color?: "blue" | "orange" | "green" | "purple" | "cyan" | "red";
}

const colorMap: Record<string, { border: string; bg: string; text: string }> = {
    blue: { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-600" },
    orange: { border: "border-orange-500", bg: "bg-orange-50", text: "text-orange-600" },
    green: { border: "border-emerald-500", bg: "bg-emerald-50", text: "text-emerald-600" },
    purple: { border: "border-violet-500", bg: "bg-violet-50", text: "text-violet-600" },
    cyan: { border: "border-cyan-500", bg: "bg-cyan-50", text: "text-cyan-600" },
    red: { border: "border-red-500", bg: "bg-red-50", text: "text-red-600" },
};

export default function MetricCard({
    label,
    value,
    icon,
    color = "blue",
}: MetricCardProps) {
    const c = colorMap[color] || colorMap.blue;

    const renderIcon = () => {
        if (!icon) return null;
        if (typeof icon === "string") {
            return (
                <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3 text-lg`}>
                    {icon}
                </div>
            );
        }
        const Icon = icon;
        return (
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${c.text}`} />
            </div>
        );
    };

    return (
        <div className={`bg-white rounded-xl border border-gray-200 ${c.border} border-l-[3px] p-5`}>
            {renderIcon()}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                {label}
            </p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
    );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {children}
        </div>
    );
}
