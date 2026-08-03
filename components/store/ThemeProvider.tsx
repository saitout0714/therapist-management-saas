'use client';

import React from 'react';
import { StoreConfig } from '../../types/store';

interface ThemeProviderProps {
  store: StoreConfig;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ store, children }) => {
  const primary = store.themeColor?.primary || '#d1b464';
  const accent = store.themeColor?.accent || '#a39573';
  const lightBg = store.themeColor?.lightBg || '#faf7f0';

  const themeStyles = {
    '--theme-primary': primary,
    '--theme-accent': accent,
    '--theme-light-bg': lightBg,
  } as React.CSSProperties;

  return (
    <div style={themeStyles} className="theme-container w-full min-h-screen">
      {children}
    </div>
  );
};
