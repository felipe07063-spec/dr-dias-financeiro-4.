import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DR DIAS | Financeiro IA",
  description: "Gestão financeira familiar inteligente",
  manifest: "/manifest.webmanifest",
  themeColor: "#101827"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
