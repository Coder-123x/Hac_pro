import type { Metadata } from "next";
import { Inter, Noto_Sans_Telugu, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/components/i18n/language-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], weight: ["400", "500", "600", "700"], variable: "--font-telugu", display: "swap" });

export const metadata: Metadata = {
  title: "Engineering Education Planner",
  description: "Family decision support for engineering education in Andhra Pradesh.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${telugu.variable}`}><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
