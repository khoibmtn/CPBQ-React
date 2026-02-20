interface SectionTitleProps {
    text?: string;
    icon?: string;
    children?: React.ReactNode;
}

export default function SectionTitle({ text, icon = "📋", children }: SectionTitleProps) {
    return (
        <div className="section-title">
            <span>{icon}</span>
            <span>{children || text}</span>
        </div>
    );
}
