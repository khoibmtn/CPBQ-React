interface InfoBannerProps {
    children: React.ReactNode;
    type?: "info" | "warning" | "success" | "error";
}

export default function InfoBanner({
    children,
    type = "info",
}: InfoBannerProps) {
    return <div className={`info-banner ${type}`}>{children}</div>;
}
