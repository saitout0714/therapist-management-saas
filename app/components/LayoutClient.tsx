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
            <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4">
              <div className="flex items-center md:hidden">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-gray-500 focus:outline-none focus:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className="ml-4 text-xl font-bold text-gray-800">管理システム</h1>
              </div>
              <div className="hidden md:block ml-4 text-xl font-bold text-gray-800">管理システム</div>
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