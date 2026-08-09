"use client";

import { useState, useEffect } from "react";
import { ShopProvider } from "@/app/contexts/ShopContext";
import { AuthProvider, useAuth } from "@/app/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import ShopSwitcher from "./ShopSwitcher";
import WebReservationNotifier from "./WebReservationNotifier";

/**
 * Supabase のセッションが切れている間に出す警告。
 * この状態でも予約・セラピストは anon 向けポリシーで読めてしまうため、
 * 画面は普通に見えるのにお客様名だけ "unknown" になる。黙って使い続けると
 * 誤ったお客様に連絡しかねないので、はっきり知らせて再ログインを促す。
 */
function SessionWarningBanner() {
  const { sessionValid, logout } = useAuth();
  const router = useRouter();

  if (sessionValid) return null;

  const handleRelogin = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p className="text-xs sm:text-sm font-bold text-amber-800 truncate">
          ログインの有効期限が切れています。お客様情報が表示されません。
        </p>
      </div>
      <button
        onClick={handleRelogin}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs sm:text-sm font-bold hover:bg-amber-600 transition-colors"
      >
        再ログイン
      </button>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/")}`);
    }
  }, [loading, isAuthenticated, pathname, router]);

  // ログイン情報が無い間は保護ページを描画しない（ログイン画面へのリダイレクト待ち）
  if (loading || !isAuthenticated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return <>{children}</>;
}

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
      <AuthGuard>
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
              <SessionWarningBanner />
              <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24">
                {children}
              </main>
              <WebReservationNotifier />
            </div>
          </div>
        </ShopProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
