interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: string;
    gradient?: string;
}

export default function PageHeader({
    title,
    subtitle,
    icon = "📊",
    gradient = "linear-gradient(135deg, rgba(37,99,235,0.9), rgba(79,70,229,0.85))",
}: PageHeaderProps) {
    return (
        <div className="page-header" style={{ background: gradient }}>
            <h1>
                {icon} {title}
            </h1>
            {subtitle && <p>{subtitle}</p>}
        </div>
    );
}
