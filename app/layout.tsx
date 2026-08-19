import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat, Great_Vibes, Playfair_Display } from "next/font/google";
import "./globals.css";
import { TherapistAuthProvider } from "@/contexts/TherapistAuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // 等幅は一部の画面でしか使わないので、preload（先読み）はしない。
  // CSSから参照された時点で読み込まれるため、見た目は変わらない。
  preload: false,
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
  // おニャンこスパ専用フォント（.font-cyber-display）。他店舗のページでは1文字も
  // 使わないので、Playfair Display（SpecialGrade専用）と同様に先読みさせない。
  preload: false,
});

/*
 * 日本語のWebフォント(Noto Sans JP)は読み込んでいない。
 * unicode-range で124分割されるため @font-face だけで183KB（CSS全体の47%）、
 * フォント本体も416KBあり、モバイルの初回描画を大きく遅らせていた。
 * 端末標準の日本語フォント（globals.css の --font-jp-system）を使う。
 */
const greatVibes = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  // おニャンこスパ専用フォント（.neon-script）。他店舗では使わないため先読みしない。
  preload: false,
});

/*
 * SpecialGrade（ラグジュアリーテーマ）の見出し用セリフ体。
 * 変数として配るだけなので、他店舗の見た目は変わらない。
 */
const playfairDisplay = Playfair_Display({
  variable: "--font-luxury-serif",
  subsets: ["latin"],
  // 実際に使っているのは italic(400) と font-semibold(600) の2種だけ。
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  // SpecialGrade専用フォント。他店舗のページでは1文字も使わないので
  // 先読みさせない（従来は未使用のまま75KB落ちていた）。
  preload: false,
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
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${greatVibes.variable} ${playfairDisplay.variable} antialiased bg-gray-100`}
      >
        <TherapistAuthProvider>
          {children}
        </TherapistAuthProvider>
      </body>
    </html>
  );
}
