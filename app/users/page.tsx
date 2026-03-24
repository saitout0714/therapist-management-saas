'use client'

import { UserManagementTab } from '../system/components/UserManagementTab'
import { useShop } from '@/app/contexts/ShopContext'

export default function UsersPage() {
  const { selectedShop } = useShop()

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">アカウント管理</h1>
          <p className="text-sm text-slate-500 mt-1">システムの利用規限やスタッフのアカウントを一括管理します。</p>
        </div>

        <UserManagementTab />
      </div>
    </div>
  )
}
