import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import bcrypt from 'bcryptjs'

type UserRow = {
  id: string
  login_id: string
  name: string | null
  role: string
  created_at: string
}

export function UserManagementTab() {
  const { selectedShop } = useShop()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm] = useState({
    loginId: '',
    password: '',
    name: '',
    role: 'staff' as 'owner' | 'staff' | 'admin',
  })

  async function fetchUsers() {
    if (!selectedShop) return
    setLoading(true)
    
    try {
      const { data, error } = await supabase
        .from('shop_owners')
        .select(`
          users (
            id,
            login_id,
            name,
            role,
            created_at
          )
        `)
        .eq('shop_id', selectedShop.id)
      
      if (error) throw error
      
      const rows = (data as any[])
        .map(d => d.users)
        .filter(u => u !== null)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setUsers(rows)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [selectedShop])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) {
      alert('店舗を選択してください')
      return
    }

    if (!form.loginId || !form.password || !form.name) {
      alert('すべての項目を入力してください')
      return
    }

    try {
      setLoading(true)
      
      // 1. パスワードハッシュ化
      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash(form.password, salt)

      // 2. ユーザーテーブルに作成
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          login_id: form.loginId.trim(),
          password_hash: passwordHash,
          role: form.role,
          name: form.name.trim()
        }])
        .select()
        .single()

      if (userError) {
        if (userError.code === '23505') throw new Error('このログインIDは既に登録されています')
        throw userError
      }

      // 3. shop_owners に紐付け (スタッフもこのテーブルで管理)
      const { error: ownerError } = await supabase
        .from('shop_owners')
        .insert([{
          shop_id: selectedShop.id,
          user_id: newUser.id
        }])

      if (ownerError) throw ownerError

      alert('スタッフを登録しました')
      setForm({ loginId: '', password: '', name: '', role: 'staff' })
      setShowAddForm(false)
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

    try {
      setLoading(true)
      const updates: any = {
        name: form.name.trim(),
        role: form.role,
      }

      // パスワードが入力されている場合のみ更新
      if (form.password) {
        const salt = await bcrypt.genSalt(10)
        updates.password_hash = await bcrypt.hash(form.password, salt)
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', editingUser.id)

      if (error) throw error

      alert('アカウント情報を更新しました')
      setEditingUser(null)
      setForm({ loginId: '', password: '', name: '', role: 'staff' })
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
    })
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('このアカウントを削除してもよろしいですか？この操作は取り消せません。')) return
    
    try {
      setLoading(true)
      // 削除（カスケード設定があれば shop_owners も消えるが、念のため users を消す）
      const { error } = await supabase.from('users').delete().eq('id', userId)
      if (error) throw error
      
      alert('削除しました')
      fetchUsers()
    } catch (err: any) {
      alert('削除に失敗しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800">利用者・スタッフ管理</h2>
          <p className="text-sm text-slate-500">店舗の管理・操作を行うスタッフのアカウントを管理します。</p>
        </div>
        {!editingUser && (
          <button 
            onClick={() => {
              setEditingUser(null)
              setShowAddForm(!showAddForm)
              setForm({ loginId: '', password: '', name: '', role: 'staff' })
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
              showAddForm ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {showAddForm ? '閉じる' : '新規スタッフ追加'}
          </button>
        )}
      </div>

      {(showAddForm || editingUser) && (
        <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
          <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">
              {editingUser ? '✎' : '＋'}
            </span>
            {editingUser ? 'スタッフ情報の編集' : '新規スタッフの登録'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase tracking-wider">表示名（お名前など）</label>
              <input 
                type="text" 
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="例: 山田 花子"
                className="w-full bg-white border border-indigo-200 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase tracking-wider">権限</label>
              <select 
                value={form.role}
                onChange={e => setForm({...form, role: e.target.value as any})}
                className="w-full bg-white border border-indigo-200 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="staff">スタッフ（一般）</option>
                <option value="owner">共同オーナー（全権限）</option>
                {editingUser?.role === 'admin' && <option value="admin">システム管理者</option>}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase tracking-wider">ログインID</label>
              <input 
                type="text" 
                value={form.loginId}
                disabled // ログインIDは変更不可とするか、慎重に扱う
                className="w-full bg-slate-100 border border-indigo-100 px-4 py-2.5 rounded-xl text-sm outline-none text-slate-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-indigo-700 mb-1 uppercase tracking-wider">
                {editingUser ? 'パスワード変更 (変更する場合のみ入力)' : 'パスワード'}
              </label>
              <input 
                type="password" 
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                placeholder={editingUser ? "変更する場合のみ入力してください" : "8文字以上推奨"}
                className="w-full bg-white border border-indigo-200 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
                required={!editingUser}
              />
              <p className="text-[10px] text-indigo-400 mt-1 font-medium">※ パスワードは暗号化して保存されます。</p>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? '処理中...' : (editingUser ? '更新を保存する' : 'この内容で登録する')}
            </button>
            <button 
              type="button" 
              onClick={() => {
                setEditingUser(null)
                setShowAddForm(false)
              }}
              className="px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <th className="px-6 py-4">利用者 / スタッフ</th>
              <th className="px-6 py-4">ログインID</th>
              <th className="px-6 py-4">権限</th>
              <th className="px-6 py-4">登録日</th>
              <th className="px-6 py-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.length > 0 ? (
              users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{u.name || '名前未設定'}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-mono">{u.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-600">{u.login_id}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      u.role === 'owner' ? 'bg-indigo-100 text-indigo-600' : 
                      u.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role === 'owner' ? 'オーナー' : u.role === 'admin' ? '管理者' : 'スタッフ'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                    {new Date(u.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        onClick={() => startEditing(u)}
                        className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                        title="情報を編集"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M18.364 5.636l-3.536 3.536m0 0l-1.414 1.414M15.828 4.172a4 4 0 015.656 5.656L10 17.657l-4-4L15.828 4.172z" /></svg>
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                        title="アカウントを削除"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  登録されている利用者がいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
