import type { Metadata } from "next";
import "./globals.css";
import { TenantProvider } from "@/features/auth/TenantContext";
import { AppFrame } from "@/shared/components/layout/AppFrame";

export const metadata: Metadata = {
  title: "Ka'u Manager - Plataforma POS para lomiterías",
  description: "Ka'u Manager unifica ventas, caja e inventario en un solo panel multi-tenant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <TenantProvider>
          <AppFrame>{children}</AppFrame>
        </TenantProvider>
      </body>
    </html>
  );
}

