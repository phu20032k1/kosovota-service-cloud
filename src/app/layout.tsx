import type { Viewport } from "next";
import "./globals.css";
import "./admin-scroll.css";
import "./ux-fixes.css";
import KosovotaAiChat from "@/components/KosovotaAiChat";
import GlobalDeleteGuard from "@/components/GlobalDeleteGuard";
import WebAlertHost from "@/components/ui/WebAlertHost";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#047857",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>

      <body className="min-h-full">
        {children}
        <GlobalDeleteGuard />
        <WebAlertHost />
        <KosovotaAiChat />
      </body>
    </html>
  );
}
