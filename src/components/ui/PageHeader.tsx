import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon | string;
    gradient?: string; // ignored, kept for backward compat
}

export default function PageHeader({
    title,
    subtitle,
    icon,
}: PageHeaderProps) {
    const renderIcon = () => {
        if (!icon) return null;
        if (typeof icon === "string") return <span className="text-2xl">{icon}</span>;
        const Icon = icon;
        return <Icon className="w-7 h-7 text-primary-600" />;
    };

    return (
        <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
                {renderIcon()}
                <h1 className="font-heading text-2xl font-bold text-gray-900">
                    {title}
                </h1>
            </div>
            {subtitle && (
                <p className="text-sm text-gray-500 ml-10">{subtitle}</p>
            )}
        </div>
    );
}
