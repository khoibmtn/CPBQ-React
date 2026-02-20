interface InfoBannerProps {
    children: React.ReactNode;
    type?: "info" | "warning" | "success" | "error";
    style?: React.CSSProperties;
}

export default function InfoBanner({
    children,
    type = "info",
    style,
}: InfoBannerProps) {
    return <div className={`info-banner ${type}`} style={style}>{children}</div>;
}
