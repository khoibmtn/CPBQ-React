interface SectionTitleProps {
    text: string;
    icon?: string;
}

export default function SectionTitle({ text, icon = "📋" }: SectionTitleProps) {
    return (
        <div className="section-title">
            <span>{icon}</span>
            <span>{text}</span>
        </div>
    );
}
