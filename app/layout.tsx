import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Naprapatiska Institutet | AI Journalassistent",
  description: "Effektivisera din journalföring med AI - Naprapatiska Institutet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
