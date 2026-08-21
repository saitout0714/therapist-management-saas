import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { useAuth } from '@/app/contexts/AuthContext'

type UserRow = {
  id: string
  login_id: string
  name: string | null
  role: string
  created_at: string
  shops?: string[]
  shop_ids?: string[]
}

type ShopItem = {
  id: string
  name: string
}

export function UserManagementTab() {
  const { selectedShop } = useShop()
  const [users, setUsers] = useState<UserRow[]>([])
  const [allShops, setAllShops] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const { user: currentUser } = useAuth()
  const [form, setForm] = useState({
    loginId: '',
    password: '',
    name: '',
    role: 'agency_staff' as 'developer' | 'system_admin' | 'agency_staff' | 'agency_client_owner' | 'simple_client_owner',
    shopIds: [] as string[],
  })

  async function fetchUsers() {
    setLoading(true)

    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setUsers(data.users || [])
      if (data.allShops) {
        setAllShops(data.allShops)
      }
    } catch (err: any) {
      console.error('Failed to fetch users:', err)
      alert('スタッフ一覧の取得に失敗しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const isGlobalRole = form.role === 'developer' || form.role === 'system_admin' || form.role === 'agency_staff'

  const toggleShop = (shopId: string) => {
    setForm(prev => {
      const exists = prev.shopIds.includes(shopId)
      return {
        ...prev,
        shopIds: exists
          ? prev.shopIds.filter(id => id !== shopId)
          : [...prev.shopIds, shopId]
      }
    })
  }

  const selectAllShops = () => {
    setForm(prev => ({
      ...prev,
      shopIds: allShops.map(s => s.id)
    }))
  }

  const clearAllShops = () => {
    setForm(prev => ({
      ...prev,
      shopIds: []
    }))
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isGlobalRole && form.shopIds.length === 0) {
      alert('所属店舗を1つ以上選択してください')
      return
    }

    if (!form.loginId || !form.password || !form.name) {
      alert('すべての項目を入力してください')
      return
    }

    try {
      setLoading(true)

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: form.loginId.trim(),
          password: form.password,
          name: form.name.trim(),
          role: form.role,
          shopIds: form.shopIds,
          currentUserRole: currentUser?.role,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      alert('アカウントを登録しました')
      resetForm()
      fetchUsers()
    } catch (err: any) {
      alert('登録に失敗しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    if (!isGlobalRole && form.shopIds.length === 0) {
      alert('所属店舗を1つ以上選択してください')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          loginId: form.loginId.trim(),
          name: form.name.trim(),
          role: form.role,
          password: form.password || undefined,
          shopIds: form.shopIds,
          currentUserRole: currentUser?.role,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      alert('アカウント情報を更新しました')
      resetForm()
      fetchUsers()
    } catch (err: any) {
      alert('更新に失敗しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (user: UserRow) => {
    setShowAddForm(false)
    setEditingUser(user)
    setForm({
      loginId: user.login_id,
      password: '', // パスワードは表示しない
      name: user.name || '',
      role: user.role as any,
      shopIds: user.shop_ids || [],
    })
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('このアカウントを削除してもよろしいですか？この操作は取り消せません。')) return

    try {
      setLoading(true)
      const res = await fetch(`/api/admin/users?userId=${userId}&currentUserRole=${currentUser?.role || ''}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      alert('削除しました')
      fetchUsers()
    } catch (err: any) {
      alert('削除に失敗しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditingUser(null)
    setShowAddForm(false)
    setForm({
      loginId: '',
      password: '',
      name: '',
      role: 'agency_staff',
      shopIds: selectedShop ? [selectedShop.id] : []
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5">
      {showAddForm || editingUser ? (
        <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-6">
          {/* Header Bar */}
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <button
              type="button"
              onClick={resetForm}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="一覧に戻る"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                editingUser ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {editingUser ? '編集選択中' : '新規登録'}
              </span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">
                {editingUser ? `「${editingUser.name || editingUser.login_id}」の編集` : '新規スタッフ・オーナー登録'}
              </h3>
            </div>
          </div>

          {/* Form Body */}
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">お名前（氏名 / オーナー名）</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="例: 山田 花子 / クリスタル・裏妻オーナー"
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">権限</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as any })}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none bg-white text-sm"
              >
                {currentUser?.role === 'developer' && <option value="developer">マスター（開発者）</option>}
                <option value="system_admin">システム管理者</option>
                <option value="agency_staff">受付スタッフ</option>
                <option value="agency_client_owner">店舗オーナー (代理店用)</option>
                <option value="simple_client_owner">店舗オーナー</option>
              </select>
            </div>

            {/* 所属店舗選択 */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                所属・管理店舗 {isGlobalRole ? '(全店舗共通)' : '(複数選択可)'}
              </label>

              {isGlobalRole ? (
                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 font-medium">
                  💡 この権限はすべての店舗を共通で管理できるため、個別店舗の選択は不要です。
                </div>
              ) : (
                <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">
                      選択中: <strong className="text-indigo-600 font-bold">{form.shopIds.length}</strong> 店舗
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllShops}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        全選択
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={clearAllShops}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        全解除
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {allShops.map(shop => {
                      const isChecked = form.shopIds.includes(shop.id)
                      return (
                        <label
                          key={shop.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleShop(shop.id)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="truncate">{shop.name}</span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    ※ 複数店舗にチェックを入れると、同一アカウントでログインした際にヘッダーの店舗切り替えバーで切り替えて利用できます。
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">ログインID</label>
              <input
                type="text"
                value={form.loginId}
                onChange={e => setForm({ ...form, loginId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none border transition-all bg-white border-slate-200 focus:ring-2 focus:ring-indigo-500/50"
                required
              />
              {editingUser && (
                <p className="text-[10px] text-rose-500 mt-1 font-medium">※ 変更すると次回からのログインIDが変わりますのでご注意ください。</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                {editingUser ? 'パスワード変更 (変更する場合のみ入力)' : 'パスワード'}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder={editingUser ? "変更する場合のみ入力してください" : "8文字以上推奨"}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none placeholder:text-slate-300 text-sm"
                required={!editingUser}
                autoComplete="new-password"
              />
              <p className="text-[10px] text-slate-400 mt-1 font-medium">※ パスワードは暗号化して保存されます。</p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-6 border-t border-slate-100 flex gap-3 max-w-2xl">
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
            >
              {loading ? '処理中...' : (editingUser ? '更新を保存する' : '登録する')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">利用者・スタッフ管理</h2>
              <p className="text-sm text-slate-500 mt-1">店舗の管理・操作を行うスタッフのアカウントを管理します。</p>
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowAddForm(true)
              }}
              className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              新規スタッフ追加
            </button>
          </div>

          <div className="space-y-6">
            {[
              { role: 'developer', label: 'マスター', badgeClass: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200/60' },
              { role: 'system_admin', label: '管理者', badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200/60' },
              { role: 'agency_staff', label: '受付スタッフ', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200/60' },
              { role: 'agency_client_owner', label: '店舗オーナー (代理店用)', badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200/60' },
              { role: 'simple_client_owner', label: '店舗オーナー', badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200/60' },
            ].filter(g => g.role !== 'developer' || currentUser?.role === 'developer').map(group => {
              const groupUsers = users.filter(u => u.role === group.role)
              
              return (
                <div key={group.role} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  {/* グループヘッダー */}
                  <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${group.badgeClass}`}>
                        {group.label}
                      </span>
                      <span className="text-xs text-slate-400 font-bold font-mono">
                        {groupUsers.length} 名
                      </span>
                    </div>
                  </div>

                  {/* グループ内ユーザーテーブル */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[650px]">
                      <thead>
                        <tr className="bg-slate-50/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-50">
                          <th className="px-6 py-3.5 whitespace-nowrap">利用者 / スタッフ</th>
                          <th className="px-6 py-3.5 whitespace-nowrap">ログインID</th>
                          <th className="px-6 py-3.5 whitespace-nowrap">所属店舗</th>
                          <th className="px-6 py-3.5 whitespace-nowrap">登録日</th>
                          <th className="px-6 py-3.5 text-center whitespace-nowrap">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {groupUsers.length > 0 ? (
                          groupUsers.map(u => (
                            <tr
                              key={u.id}
                              className="hover:bg-slate-50/30 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-bold text-slate-700 whitespace-nowrap">{u.name || '名前未設定'}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-mono whitespace-nowrap">{u.id.slice(0, 8)}</div>
                              </td>
                              <td className="px-6 py-4 text-sm font-mono text-slate-600 whitespace-nowrap">{u.login_id}</td>
                              <td className="px-6 py-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                                {u.role === 'developer' ? (
                                  <span className="text-fuchsia-600 font-bold bg-fuchsia-50 px-2 py-0.5 rounded-lg border border-fuchsia-200/50 whitespace-nowrap">全店舗共通（マスター）</span>
                                ) : u.role === 'system_admin' ? (
                                  <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/50 whitespace-nowrap">全店舗共通（システム管理者）</span>
                                ) : u.role === 'agency_staff' ? (
                                  <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/50 whitespace-nowrap">全店舗共通（受付担当）</span>
                                ) : u.shops && u.shops.length > 0 ? (
                                  <span className="text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/50 whitespace-nowrap">{u.shops.join(', ')}</span>
                                ) : (
                                  <span className="text-slate-400 italic whitespace-nowrap">店舗未割当</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-400 font-medium whitespace-nowrap">
                                {new Date(u.created_at).toLocaleDateString('ja-JP')}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  {u.role !== 'developer' || currentUser?.role === 'developer' ? (
                                    <>
                                      <button
                                        onClick={() => startEditing(u)}
                                        className="p-2 text-slate-300 hover:text-indigo-600 transition-colors align-middle"
                                        title="情報を編集"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M18.364 5.636l-3.536 3.536m0 0l-1.414 1.414M15.828 4.172a4 4 0 015.656 5.656L10 17.657l-4-4L15.828 4.172z" /></svg>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(u.id)}
                                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors align-middle"
                                        title="アカウントを削除"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-300">操作不可</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-400 italic">
                              この権限のユーザーは登録されていません。
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
