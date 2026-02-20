import PageHeader from "@/components/ui/PageHeader";
import InfoBanner from "@/components/ui/InfoBanner";

export default function IcdAnalysisPage() {
    return (
        <>
            <PageHeader
                title="Chi phí theo mã bệnh"
                subtitle="Thống kê theo mã ICD · Phân tích tích lũy %"
                icon="🔬"
                gradient="linear-gradient(135deg, rgba(139,92,246,0.9), rgba(236,72,153,0.85))"
            />
            <InfoBanner type="info">
                🚧 Trang này đang được phát triển. Vui lòng quay lại sau.
            </InfoBanner>
        </>
    );
}
