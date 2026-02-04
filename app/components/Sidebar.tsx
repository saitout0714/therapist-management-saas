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
        className={`fixed inset-y-0 left-0 z-50 w-36 bg-white shadow-lg transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-0`}
      >
        <div className="flex items-center justify-center h-16 bg-blue-600 text-white">
          <h1 className="text-base font-bold">管理システム</h1>
        </div>
        <nav className="mt-4">
          <Link
            href="/"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            ダッシュボード
          </Link>
          <Link
            href="/shifts"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            スケジュール
          </Link>
          <Link
            href="/reservations"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            予約管理
          </Link>
          <Link
            href="/shifts/register"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            シフト登録
          </Link>
          <Link
            href="/therapists"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            セラピスト
          </Link>
          <Link
            href="/customers"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            顧客管理
          </Link>
          <Link
            href="/system"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            システム管理
          </Link>
          <Link
            href="/rooms"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            ルーム一覧
          </Link>
          <Link
            href="/admin"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            店舗管理
          </Link>
          <Link
            href="/settings"
            className="block px-3 py-2 text-gray-700 hover:bg-gray-200 text-sm"
            onClick={onClose}
          >
            設定
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