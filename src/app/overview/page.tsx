import PageHeader from "@/components/ui/PageHeader";
import InfoBanner from "@/components/ui/InfoBanner";

export default function OverviewPage() {
    return (
        <>
            <PageHeader
                title="Quản lý số liệu"
                subtitle="Số liệu tổng hợp · Quản lý dữ liệu · Import Excel"
                icon="📊"
            />
            <InfoBanner type="info">
                🚧 Trang này đang được phát triển. Vui lòng quay lại sau.
            </InfoBanner>
        </>
    );
}
