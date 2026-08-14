import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat, Noto_Sans_JP, Great_Vibes } from "next/font/google";
import "./globals.css";
import { TherapistAuthProvider } from "@/contexts/TherapistAuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 * 店舗公開ページ（サイバーネオンテーマ）用のフォント。
 * 変数として配るだけなので、管理画面側の見た目は変わらない。
 */
const montserrat = Montserrat({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const greatVibes = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // ライト固定。OS/ブラウザのダークモードで文字色だけ反転して見えなくなるのを防ぐ。
  colorScheme: 'only light',
};

export const metadata: Metadata = {
  title: "YOYAKL",
  description: "YOYAKL - セラピストシフト・予約管理システム (yoyakl.tokyo)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${notoSansJP.variable} ${greatVibes.variable} antialiased bg-gray-100`}
      >
        <TherapistAuthProvider>
          {children}
        </TherapistAuthProvider>
      </body>
    </html>
  );
}
