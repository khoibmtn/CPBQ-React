import PageHeader from "@/components/ui/PageHeader";
import InfoBanner from "@/components/ui/InfoBanner";

export default function SettingsPage() {
    return (
        <>
            <PageHeader
                title="Cấu hình"
                subtitle="Bảng mã lookup · Profiles hiển thị · Gộp khoa"
                icon="⚙️"
                gradient="linear-gradient(135deg, rgba(100,116,139,0.9), rgba(71,85,105,0.85))"
            />
            <InfoBanner type="info">
                🚧 Trang này đang được phát triển. Vui lòng quay lại sau.
            </InfoBanner>
        </>
    );
}
