import type { Metadata } from "next";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import "./globals.css";

/** Videodaki fontun aynısı; Türkçe karakterlerin hepsini içerir. Lisans: public/fontlar/Inter-OFL.txt */
const inter = localFont({ src: "../../public/fontlar/Inter-Variable.ttf", variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Kliplan",
  description: "Emlak ilanından kısa tanıtım videosu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={cn("font-sans", inter.variable)}>
      <body>{children}</body>
    </html>
  );
}
