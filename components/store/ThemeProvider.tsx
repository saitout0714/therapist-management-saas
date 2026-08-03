'use client';

import React, { useEffect } from 'react';
import { StoreConfig } from '../../types/store';

interface ThemeProviderProps {
  store: StoreConfig;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ store, children }) => {
  const primary = store.themeColor?.primary || '#d1b464';
  const accent = store.themeColor?.accent || '#a39573';
  const lightBg = store.themeColor?.lightBg || '#faf7f0';
  const templateId = store.templateId || 'luxury';

  useEffect(() => {
    // ドキュメント全体 (root) にテーマのプライマリ・アクセント色を動的適用
    document.documentElement.style.setProperty('--primary-color', primary);
    document.documentElement.style.setProperty('--accent-color', accent);
    document.documentElement.style.setProperty('--light-bg', lightBg);
  }, [primary, accent, lightBg]);

  const themeStyles = {
    '--theme-primary': primary,
    '--theme-accent': accent,
    '--theme-light-bg': lightBg,
  } as React.CSSProperties;

  return (
    <div
      style={themeStyles}
      data-template={templateId}
      className={`theme-container w-full min-h-screen template-${templateId}`}
    >
      {/* テンプレートおよびテーマカラーに応じた動的インジェクションスタイル */}
      <style jsx global>{`
        :root {
          --theme-primary: ${primary};
          --theme-accent: ${accent};
        }
        
        .theme-primary-bg {
          background-color: ${primary} !important;
        }

        .theme-primary-text {
          color: ${primary} !important;
        }

        .theme-primary-border {
          border-color: ${primary} !important;
        }

        /* テンプレートごとのグローバルスタイル調整 */
        .template-cute {
          font-family: 'Hiragino Sans', 'ヒラギノ角ゴ Pro W3', sans-serif;
        }

        .template-cute button,
        .template-cute a {
          border-radius: 9999px !important;
        }

        .template-modern {
          background-color: #18181b !important;
          color: #f4f4f5 !important;
        }

        .template-minimal {
          letter-spacing: 0.08em;
        }
      `}</style>

      {children}
    </div>
  );
};
