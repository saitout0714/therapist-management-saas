'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type CustomTemplate = {
  id: string
  shop_id: string
  title: string
  content: string
  created_at?: string
}

const TAGS = [
  { tag: '[日付]', label: '日付 (例: 3/7)' },
  { tag: '[日付(漢字)]', label: '日付 (例: 3月7日)' },
  { tag: '[開始時刻]', label: '開始時刻 (例: 12:30)' },
  { tag: '[開始時刻(漢字)]', label: '開始時刻 (例: 12時30分)' },
  { tag: '[終了時刻]', label: '終了時刻 (例: 12:30)' },
  { tag: '[終了時刻(漢字)]', label: '終了時刻 (例: 12時30分)' },
  { tag: '[ルーム]', label: 'ルーム' },
  { tag: '[お客様区分]', label: 'お客様区分 (新規/会員)' },
  { tag: '[お客様名]', label: 'お客様名' },
  { tag: '[セラピスト名]', label: 'セラピスト名' },
  { tag: '[コース]', label: 'コース名' },
  { tag: '[コース時間]', label: 'コース時間' },
  { tag: '[コース料金]', label: 'コース料金' },
  { tag: '[指名区分]', label: '指名区分' },
  { tag: '[指名料金]', label: '指名料金' },
  { tag: '[オプション]', label: 'オプション一覧' },
  { tag: '[オプション金額]', label: 'オプション金額' },
  { tag: '[割引]', label: '割引一覧' },
  { tag: '[割引金額]', label: '割引金額' },
  { tag: '[支払方法]', label: '支払方法' },
  { tag: '[延長時間]', label: '延長時間 (例: 30分)' },
  { tag: '[延長料金]', label: '延長料金 (例: 3,000円)' },
  { tag: '[姫予約]', label: '姫予約 (姫予約の場合「姫予約」と出力、通常は非表示)' },
  { tag: '[合計料金]', label: '合計料金' },
  { tag: '[備考]', label: '備考/ご要望' },
  { tag: '[決済情報]', label: 'クレジットカード決済情報' },
  { tag: '[道案内]', label: '道案内 (ルームテンプレート)' },
]

export function CustomTemplatesTab() {
  const { selectedShop } = useShop()
  const [templates, setTemplates] = useState<CustomTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<CustomTemplate | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })

  const loadTemplates = async () => {
    if (!selectedShop) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('custom_templates')
        .select('*')
        .eq('shop_id', selectedShop.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setTemplates(data || [])
      if (data && data.length > 0) {
        setActiveTemplate(data[0])
      } else {
        setActiveTemplate(null)
      }
    } catch (err) {
      console.error('Error loading custom templates:', err)
      alert('テンプレートの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplates()
    setIsEditing(false)
  }, [selectedShop])

  useEffect(() => {
    if (activeTemplate) {
      setForm({ title: activeTemplate.title, content: activeTemplate.content })
    } else {
      setForm({ title: '', content: '' })
    }
  }, [activeTemplate])

  const handleStartNew = () => {
    setActiveTemplate(null)
    setIsEditing(true)
    setForm({ title: '', content: '' })
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    if (activeTemplate) {
      setForm({ title: activeTemplate.title, content: activeTemplate.content })
    } else if (templates.length > 0) {
      setActiveTemplate(templates[0])
    }
  }

  const insertTag = (tag: string) => {
    const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)
    const newText = before + tag + after
    setForm(prev => ({ ...prev, content: newText }))

    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + tag.length
    }, 0)
  }

  const handleSave = async () => {
    if (!selectedShop) return
    if (!form.title.trim()) {
      alert('タイトルを入力してください')
      return
    }
    if (!form.content.trim()) {
      alert('本文を入力してください')
      return
    }

    setSaving(true)
    try {
      if (activeTemplate) {
        // 更新
        const { error } = await supabase
          .from('custom_templates')
          .update({
            title: form.title.trim(),
            content: form.content,
            updated_at: new Date().toISOString()
          })
          .eq('id', activeTemplate.id)

        if (error) throw error
        alert('テンプレートを更新しました')
      } else {
        // 新規作成
        const { data, error } = await supabase
          .from('custom_templates')
          .insert([{
            shop_id: selectedShop.id,
            title: form.title.trim(),
            content: form.content
          }])
          .select()
          .single()

        if (error) throw error
        alert('テンプレートを追加しました')
        setActiveTemplate(data)
      }
      setIsEditing(false)
      await loadTemplates()
    } catch (err: any) {
      console.error('Error saving custom template:', err)
      alert('保存に失敗しました: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!activeTemplate) return
    const confirmDelete = window.confirm(`テンプレート「${activeTemplate.title}」を削除しますか？`)
    if (!confirmDelete) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('custom_templates')
        .delete()
        .eq('id', activeTemplate.id)

      if (error) throw error
      alert('テンプレートを削除しました')
      setIsEditing(false)
      await loadTemplates()
    } catch (err: any) {
      console.error('Error deleting custom template:', err)
      alert('削除に失敗しました: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500 text-sm">読み込み中...</div>
  }

  return (
    <div className="bg-slate-50/50 p-4 md:p-6 rounded-2xl border border-slate-100">
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-800">追加連絡用 案内テンプレート</h2>
        <p className="text-xs text-slate-400 mt-1">
          予約詳細画面から送信・コピーできるカスタムメッセージテンプレートを管理します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左側: テンプレートリスト */}
        <div className="lg:col-span-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">テンプレート一覧</span>
            {!isEditing && (
              <button
                onClick={handleStartNew}
                className="py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] sm:text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                新規作成
              </button>
            )}
          </div>
          <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden shadow-sm max-h-[300px] lg:max-h-[500px] overflow-y-auto">
            {templates.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">テンプレートがありません</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {templates.map(t => (
                  <button
                    key={t.id}
                    disabled={isEditing}
                    onClick={() => setActiveTemplate(t)}
                    className={`w-full text-left px-4 py-3 text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer ${
                      activeTemplate?.id === t.id
                        ? 'bg-indigo-50/70 text-indigo-700 font-bold border-l-4 border-indigo-600'
                        : 'text-slate-600 hover:bg-slate-50/80 hover:text-slate-900 border-l-4 border-transparent'
                    } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右側: 編集・詳細フォーム */}
        <div className="lg:col-span-3">
          {(!activeTemplate && !isEditing) ? (
            <div className="bg-white border border-slate-200/60 rounded-xl p-8 text-center text-sm text-slate-400 shadow-sm flex flex-col items-center justify-center h-full min-h-[300px]">
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>テンプレートを選択するか、新規作成してください</span>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/60 rounded-xl p-4 sm:p-6 shadow-sm space-y-4">
              {/* タイトル入力 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  テンプレート名
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="例：ご署名のお願い、釣銭なし案内など"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs sm:text-sm text-slate-800 disabled:opacity-75 disabled:cursor-not-allowed font-semibold"
                />
              </div>

              {/* 本文入力と差し込みタグ */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  本文テンプレート
                </label>
                {isEditing && (
                  <div className="mb-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <span className="block text-[10px] font-bold text-slate-400 mb-1.5">
                      クリックして差し込みタグを挿入:
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
                      {TAGS.map(t => (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() => insertTag(t.tag)}
                          title={t.label}
                          className="px-2 py-1 text-[9px] font-bold bg-white text-slate-600 border border-slate-200 rounded hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          {t.tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <textarea
                  id="template-textarea"
                  disabled={!isEditing}
                  value={form.content}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={10}
                  placeholder="テンプレートの本文を入力してください。[お客様名] などのタグが使えます。"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-y font-mono"
                />
              </div>

              {/* 操作ボタン */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div>
                  {activeTemplate && isEditing && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleDelete}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      削除する
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleCancel}
                        className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                      >
                        {saving ? '保存中...' : 'テンプレートを保存'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                    >
                      編集する
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
