"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";

import { useShop } from "@/app/contexts/ShopContext";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/** メニュー項目を出す条件。すべて満たしたときだけ表示する */
type Capability = "hp" | "adminArea" | "systemAdmin" | "developer";

type NavItem = {
  href: string;
  /** 現在地の判定に使うパス。href にクエリが付く場合はこちらで指定する */
  match?: string;
  label: string;
  icon: keyof typeof ICONS;
  requires?: Capability[];
};

type NavGroup = {
  id: string;
  /** 見出し。省略すると区切りなしで先頭に並ぶ */
  title?: string;
  tone?: "default" | "admin" | "therapist";
  items: NavItem[];
};

/**
 * メニュー定義。
 * 「誰に何が見えるか」はこの1か所だけを見れば分かる状態に保つこと。
 * 表示条件を増やすときは Capability を足して requires に書く。
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "daily",
    title: "業務",
    items: [
      { href: "/", label: "ホーム", icon: "home" },
      { href: "/shifts", label: "スケジュール", icon: "grid" },
      { href: "/reservations", label: "予約管理", icon: "calendar" },
      { href: "/customers", label: "顧客管理", icon: "users" },
      { href: "/therapists", label: "セラピスト", icon: "user" },
      { href: "/shifts/register", label: "シフト登録", icon: "plus" },
    ],
  },
  {
    id: "payroll",
    title: "報酬",
    items: [
      { href: "/payroll", label: "報酬・バック計算", icon: "coin" },
      { href: "/memos", label: "報酬引継ぎメモ", icon: "note" },
    ],
  },
  {
    id: "insight",
    title: "分析",
    items: [{ href: "/aggregation", label: "集計レポート", icon: "chart" }],
  },
  {
    id: "web",
    title: "ホームページ",
    items: [
      {
        href: "/admin/store-setting?mode=hp",
        match: "/admin/store-setting",
        label: "HPコンテンツ管理",
        icon: "photo",
        requires: ["hp"],
      },
    ],
  },
  {
    id: "settings",
    title: "設定",
    items: [
      { href: "/system", label: "店舗 ＆ システム設定", icon: "settings" },
      { href: "/rooms", label: "ルーム ＆ 送信テンプレ", icon: "door" },
      { href: "/sync", label: "サイト同期", icon: "refresh" },
    ],
  },
  {
    id: "admin",
    title: "運営者メニュー",
    tone: "admin",
    items: [
      {
        // マスターは全店舗、管理者・受付スタッフは代行プランの店舗のみが集計表に出る。
        // 中身を役割で絞るので、メニュー自体はこの3役割に出す。
        href: "/admin/agency-aggregation",
        label: "代行プラン集計",
        icon: "pie",
        requires: ["adminArea"],
      },
      { href: "/admin", label: "店舗管理", icon: "store", requires: ["adminArea"] },
      { href: "/users", label: "アカウント管理", icon: "shield", requires: ["systemAdmin"] },
      { href: "/shifts/sync", label: "外部シフト同期", icon: "refresh", requires: ["systemAdmin"] },
    ],
  },
  {
    id: "therapist",
    title: "セラピスト画面（確認用）",
    tone: "therapist",
    items: [
      { href: "/therapist/blog", label: "写メ日記・ブログ管理", icon: "book", requires: ["developer"] },
      { href: "/therapist/schedule", label: "出勤希望提出", icon: "clipboard", requires: ["developer"] },
    ],
  },
];

const HP_PLANS = ["hp_web_reserve_plan", "hp_web_agency_plan"];
const HP_USER_PLANS = ["agency_plan", "hp_web_reserve_plan", "hp_web_agency_plan"];

const SCROLL_KEY = "sidebarScrollTop";

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { selectedShop } = useShop();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
    }
  }, [pathname]);

  // 他アプリとの往復でリロードが起きても、スクロール位置を失わないようにする
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) el.scrollTop = Number(saved) || 0;
    } catch {}

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        try {
          sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
        } catch {}
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const userObj = user as any;
  const role = user?.role || "";
  const isDeveloper = role === "developer";
  const userPlan = userObj?.plan || "";

  // 選択中店舗の値を最優先し、無ければプラン名から推測する（従来の挙動を維持）
  const shopPlan = selectedShop?.plan || "";
  const shopHasHp = selectedShop?.has_hp ?? HP_PLANS.includes(shopPlan);

  const caps: Record<Capability, boolean> = {
    hp: selectedShop
      ? shopHasHp
      : userObj?.has_hp ?? (isDeveloper || HP_USER_PLANS.includes(userPlan)),
    adminArea: ["developer", "system_admin", "agency_staff"].includes(role),
    systemAdmin: ["developer", "system_admin"].includes(role),
    developer: isDeveloper,
  };

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => (item.requires ?? []).every((c) => caps[c])),
  })).filter((group) => group.items.length > 0);

  // 現在地は「最も長く一致する項目」ひとつだけ。
  // 単純な startsWith だと /shifts と /shifts/register が同時に光ってしまう。
  const activeHref = groups
    .flatMap((g) => g.items)
    .map((item) => ({ item, m: item.match ?? item.href }))
    .filter(({ m }) => pathname === m || (m !== "/" && pathname.startsWith(m + "/")))
    .sort((a, b) => b.m.length - a.m.length)[0]?.item.href;

  const collapsed = !isOpen;

  return (
    <>
      <div
        className={`fixed inset-y-0 left-0 z-50 glass-panel border-r border-slate-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out flex flex-col ${
          isOpen
            ? "w-64 translate-x-0 md:translate-x-0 md:static md:inset-auto md:w-56"
            : "w-64 -translate-x-full md:translate-x-0 md:static md:inset-auto md:w-16"
        }`}
      >
        <div className="flex items-center justify-center h-20 border-b border-slate-100/50 shrink-0 px-2">
          <Link href="/" className="flex items-center justify-center w-full" title="ホーム">
            <img
              src="/logo.png"
              alt="YOYAKL"
              className={`w-auto object-contain max-w-full transition-all duration-300 ${
                collapsed ? "h-9" : "h-14"
              }`}
            />
          </Link>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide py-4">
          <nav className={collapsed ? "px-2 space-y-1" : "px-3 space-y-1"}>
            {groups.map((group, index) => (
              <div key={group.id} className={index === 0 ? "" : "pt-4"}>
                {collapsed ? (
                  index === 0 ? null : (
                    <div className="mx-2 mb-2 border-t border-slate-100/70" />
                  )
                ) : (
                  group.title && (
                    <div
                      className={`px-4 mb-1.5 text-[10px] font-bold uppercase tracking-wider ${
                        group.tone === "admin"
                          ? "text-indigo-400"
                          : group.tone === "therapist"
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {group.title}
                    </div>
                  )
                )}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = activeHref === item.href;
                    const activeClass =
                      group.tone === "admin"
                        ? "bg-indigo-50 text-indigo-700"
                        : group.tone === "therapist"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-primary-50 text-primary-700";
                    const hoverClass =
                      group.tone === "admin"
                        ? "hover:text-indigo-600"
                        : group.tone === "therapist"
                        ? "hover:text-rose-600"
                        : "hover:text-primary-600";

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center rounded-xl transition-all duration-200 ${
                          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-4 py-2.5"
                        } text-sm ${
                          isActive
                            ? `${activeClass} font-semibold shadow-sm`
                            : `text-slate-600 font-medium hover:bg-slate-50 ${hoverClass}`
                        }`}
                      >
                        <span className="shrink-0">{ICONS[item.icon]}</span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
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

function icon(path: React.ReactNode) {
  return (
    <svg
      className="w-[18px] h-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

const ICONS = {
  home: icon(<path d="m3 10.5 9-7.5 9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />),
  calendar: icon(
    <>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </>
  ),
  grid: icon(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  plus: icon(
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18M12 13v6M9 16h6" />
    </>
  ),
  users: icon(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: icon(
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  coin: icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 8 12 12.5 15.5 8M9 13h6M9 16h6M12 12.5V17" />
    </>
  ),
  note: icon(
    <>
      <path d="M15 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8z" />
      <path d="M15 3v5h5M8 13h8M8 17h5" />
    </>
  ),
  chart: icon(<path d="M4 20V10M10 20V4M16 20v-6M2 20h20" />),
  pie: icon(
    <>
      <path d="M21.2 15.9A10 10 0 1 1 8.1 2.8" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </>
  ),
  photo: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
    </>
  ),
  settings: icon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  door: icon(
    <>
      <path d="M3 21h18M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" />
      <path d="M14 12h.01" />
    </>
  ),
  refresh: icon(
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </>
  ),
  store: icon(
    <>
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  shield: icon(
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  book: icon(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  clipboard: icon(
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
};
