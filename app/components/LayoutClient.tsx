"use client";

import { useState } from "react";
import { ShopProvider } from "@/app/contexts/ShopContext";
import { AuthProvider } from "@/app/contexts/AuthContext";
import Sidebar from "./Sidebar";
import ShopSwitcher from "./ShopSwitcher";

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <ShopProvider>
        <div className="flex h-screen">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40 h-16 flex items-center justify-between px-4 sm:px-6">
              <div className="flex items-center md:hidden">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className="ml-3 text-lg font-bold text-slate-800 tracking-tight">管理システム</h1>
              </div>
              <div className="hidden md:block ml-2 text-lg font-bold text-slate-800 tracking-tight">ダッシュボード</div>
              <ShopSwitcher />
            </header>
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4">
              {children}
            </main>
          </div>
        </div>
      </ShopProvider>
    </AuthProvider>
  );
}