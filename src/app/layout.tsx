import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sunrooof BOM Builder",
  description: "Configurator + Bill of Materials builder for Sunrooof units",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
