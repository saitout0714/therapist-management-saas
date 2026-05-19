'use client'

import { UserManagementTab } from '@/app/(admin)/system/components/UserManagementTab'
import { useShop } from '@/app/contexts/ShopContext'

export default function UsersPage() {
  const { selectedShop } = useShop()

  return (
    <div className="bg-gray-100 p-4 md:p-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">アカウント管理</h1>
          <p className="text-sm text-slate-500 mt-1">システムの利用規限やスタッフのアカウントを一括管理します。</p>
        </div>

        <UserManagementTab />
      </div>
    </div>
  )
}
