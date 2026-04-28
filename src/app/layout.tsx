import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LOGO_SISTEMA_2026_PATH } from "@/config/branding";
import { TenantProvider } from "@/contexts/TenantContext";
import { AppFrame } from "@/components/layout/AppFrame";
import { GoogleTagManager } from "@/components/analytics/GoogleTagManager";

export const metadata: Metadata = {
  title: "KarúBox - Plataforma POS",
  description: "KarúBox unifica ventas, caja e inventario en un solo panel multi-tenant.",
  icons: {
    icon: [{ url: LOGO_SISTEMA_2026_PATH, type: "image/png" }],
    apple: [{ url: LOGO_SISTEMA_2026_PATH, type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full min-h-[100dvh] scroll-smooth">
      <body className="h-full min-h-[100dvh] w-full min-w-0 antialiased">
        <GoogleTagManager />
        <TenantProvider>
          <AppFrame>{children}</AppFrame>
        </TenantProvider>
      </body>
    </html>
  );
}

