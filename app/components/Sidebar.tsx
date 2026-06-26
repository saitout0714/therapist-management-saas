"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
    }
  }, [pathname]);

  const navItems = [
    { href: "/", label: "ホーム" },
    { href: "/shifts", label: "スケジュール" },
    { href: "/reservations", label: "予約管理" },
    { href: "/customers", label: "顧客管理" },
    { href: "/therapists", label: "セラピスト" },
    { href: "/shifts/register", label: "シフト登録" },
    { href: "/payroll", label: "報酬・バック計算" },
    { href: "/memos", label: "給与引継ぎメモ" },
    { href: "/aggregation", label: "店舗集計" },
    { href: "/system", label: "システム管理" },
    { href: "/rooms", label: "ルーム ＆ 送信テンプレ" },
  ];

  const adminItems = [
    ...(user?.role === "system_admin" ? [
      { href: "/users", label: "アカウント管理" },
      { href: "/shifts/sync", label: "外部シフト同期" },
    ] : []),
    ...(["system_admin", "agency_staff"].includes(user?.role || "") ? [{ href: "/admin", label: "店舗管理" }] : []),
  ];

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 glass-panel border-r border-slate-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out flex flex-col ${
          isOpen
            ? "translate-x-0 md:translate-x-0 md:static md:inset-auto md:w-56"
            : "-translate-x-full md:translate-x-0 md:static md:inset-auto md:w-0 md:overflow-hidden md:border-r-0 md:shadow-none"
        }`}
      >
        <div className="flex items-center justify-center h-20 border-b border-slate-100/50 shrink-0 px-4">
          <Link href="/" className="flex items-center justify-center w-full">
            <img 
              src="/logo.png" 
              alt="YOYAKL" 
              className="h-14 w-auto object-contain max-w-full" 
            />
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
          <nav className="px-3 space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-2.5 text-sm rounded-xl transition-all duration-200 group ${
                    isActive
                      ? "bg-primary-50 text-primary-700 font-semibold shadow-sm"
                      : "text-slate-600 font-medium hover:bg-slate-50 hover:text-primary-600"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}

            {adminItems.length > 0 && (
              <div className="pt-4 border-t border-slate-100/60 mt-4">
                <div className="px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  管理者メニュー
                </div>
                <div className="space-y-1.5">
                  {adminItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center px-4 py-2.5 text-sm rounded-xl transition-all duration-200 group ${
                          isActive
                            ? "bg-indigo-50 text-indigo-700 font-semibold shadow-sm"
                            : "text-slate-600 font-medium hover:bg-slate-50 hover:text-indigo-600"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm md:hidden transition-opacity"
          onClick={onClose}
        ></div>
      )}
    </>
  );
}