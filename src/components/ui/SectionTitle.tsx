import { type LucideIcon } from "lucide-react";

interface SectionTitleProps {
    text?: string;
    icon?: LucideIcon | string;
    children?: React.ReactNode;
}

export default function SectionTitle({ text, icon, children }: SectionTitleProps) {
    const renderIcon = () => {
        if (!icon) return null;
        if (typeof icon === "string") return <span className="text-lg">{icon}</span>;
        const Icon = icon;
        return <Icon className="w-5 h-5 text-primary-600" />;
    };

    return (
        <div className="flex items-center gap-2 mb-3">
            {renderIcon()}
            <h3 className="font-heading font-bold text-base text-gray-800 tracking-tight">
                {children || text}
            </h3>
        </div>
    );
}
