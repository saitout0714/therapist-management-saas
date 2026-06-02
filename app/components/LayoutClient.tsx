"use client";

import { useState, useEffect } from "react";
import { ShopProvider } from "@/app/contexts/ShopContext";
import { AuthProvider } from "@/app/contexts/AuthContext";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import ShopSwitcher from "./ShopSwitcher";
import ShopTabBar from "./ShopTabBar";
import WebReservationNotifier from "./WebReservationNotifier";

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 768);
  }, []);

  if (pathname === "/login") {
    return (
      <AuthProvider>
        <ShopProvider>
          <div className="h-screen w-screen bg-slate-50 overflow-hidden">
            {children}
          </div>
        </ShopProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <ShopProvider>
        <div className="flex h-screen bg-transparent">

          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <header className="glass-panel sticky top-0 z-40 h-20 flex items-center justify-between px-4 sm:px-6 border-b-0 border-slate-200/50">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <img 
                  src="/logo.png" 
                  alt="YOYAKL" 
                  className="ml-3 h-12 w-auto object-contain md:hidden" 
                />
              </div>
              <ShopSwitcher />
            </header>
            <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24">
              {children}
            </main>
            <ShopTabBar />
            <WebReservationNotifier />
          </div>
        </div>
      </ShopProvider>
    </AuthProvider>
  );
}
