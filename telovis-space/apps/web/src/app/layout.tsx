import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeloVis Space",
  description: "Escritório virtual 2D da TeloVis Tech",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
