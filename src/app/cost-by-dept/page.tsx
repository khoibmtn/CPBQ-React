import PageHeader from "@/components/ui/PageHeader";
import InfoBanner from "@/components/ui/InfoBanner";

export default function CostByDeptPage() {
    return (
        <>
            <PageHeader
                title="Chi phí theo khoa"
                subtitle="So sánh chi phí giữa các khoa · Nhiều khoảng thời gian"
                icon="🏥"
                gradient="linear-gradient(135deg, rgba(16,185,129,0.9), rgba(6,182,212,0.85))"
            />
            <InfoBanner type="info">
                🚧 Trang này đang được phát triển. Vui lòng quay lại sau.
            </InfoBanner>
        </>
    );
}
