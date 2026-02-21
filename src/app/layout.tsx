import type { Metadata } from "next";
import "./globals.css";
import { PaletteProvider } from "@/components/ThemeProvider";
import Sidebar from "@/components/layout/Sidebar";

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
          <main className="main-content">{children}</main>
        </PaletteProvider>
      </body>
    </html>
  );
}
