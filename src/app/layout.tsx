import type { Metadata } from "next";
import "./globals.css";
import { PaletteProvider } from "@/components/ThemeProvider";
import Sidebar from "@/components/layout/Sidebar";
import PageShell from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "CPBQ Dashboard",
  description: "Dashboard phân tích chi phí thanh toán BHYT – TTYT Thủy Nguyên",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="light" style={{ colorScheme: "light" }} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PaletteProvider>
          <Sidebar />
          <main className="main-content">
            {/* Hidden: keeps Next.js routing alive for URL updates */}
            <div style={{ display: "none" }}>{children}</div>
            {/* Visible: lazy-mount + keep-alive pages */}
            <PageShell />
          </main>
        </PaletteProvider>
      </body>
    </html>
  );
}
