"use client";

import Link from "next/link";
import { useState } from "react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 md:w-48 bg-white/80 backdrop-blur-xl border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transform ${isOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0`}
      >
        <div className="flex items-center justify-center h-16 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white">
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight">管理システム</h1>
        </div>
        <nav className="mt-4 px-3 space-y-1">
          <Link
            href="/"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">ダッシュボード</span>
          </Link>
          <Link
            href="/shifts"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">スケジュール</span>
          </Link>
          <Link
            href="/reservations"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">予約管理</span>
          </Link>
          <Link
            href="/payroll"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">報酬・バック計算</span>
          </Link>
          <Link
            href="/shifts/register"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">シフト登録</span>
          </Link>
          <Link
            href="/therapists"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">セラピスト</span>
          </Link>
          <Link
            href="/customers"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">顧客管理</span>
          </Link>
          <Link
            href="/rooms"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">ルーム一覧</span>
          </Link>
          <Link
            href="/system"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">システム管理</span>
          </Link>
          <Link
            href="/aggregation"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">店舗集計</span>
          </Link>
          <Link
            href="/admin"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">店舗管理</span>
          </Link>
          <Link
            href="/users"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">アカウント管理</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 rounded-xl hover:bg-slate-100 hover:text-indigo-600 transition-all duration-200 group"
            onClick={onClose}
          >
            <span className="truncate">設定</span>
          </Link>
        </nav>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black opacity-50 md:hidden"
          onClick={onClose}
        ></div>
      )}
    </>
  );
}