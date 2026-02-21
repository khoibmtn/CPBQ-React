import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface InfoBannerProps {
    children: React.ReactNode;
    type?: "info" | "warning" | "success" | "error";
    style?: React.CSSProperties;
}

const variants = {
    info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", Icon: Info },
    warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", Icon: AlertTriangle },
    success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", Icon: CheckCircle },
    error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", Icon: XCircle },
};

export default function InfoBanner({
    children,
    type = "info",
    style,
}: InfoBannerProps) {
    const v = variants[type];
    return (
        <div
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${v.bg} ${v.border} ${v.text} text-sm`}
            style={style}
        >
            <v.Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{children}</div>
        </div>
    );
}
