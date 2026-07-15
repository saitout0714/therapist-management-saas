'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

const DEFAULT_TEMPLATE = `【[日付] ご予約詳細】

■ 時間
[開始時刻]-[終了時刻]

■ ルーム
[ルーム]

■ お客様
[お客様区分] [お客様名] 様

■ コース
[コース時間] [コース料金]

■ 指名
[指名区分] [指名料金]

[オプション]
[割引]
------------------------
■ お支払い：[支払方法]
------------------------
合計：[合計料金]

■ 備考
[備考]`;

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
]

export function TherapistTemplateTab() {
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [template, setTemplate] = useState('')

  useEffect(() => {
    async function loadTemplate() {
      if (!selectedShop) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('id, therapist_template')
          .eq('shop_id', selectedShop.id)
          .maybeSingle()

        if (error) {
          console.error('Error loading settings:', error)
          alert('設定の読み込みに失敗しました')
          return
        }

        if (data) {
          setSettingsId(data.id)
          setTemplate(data.therapist_template || DEFAULT_TEMPLATE)
        } else {
          // If no system_settings row exists, we start with DEFAULT_TEMPLATE
          setSettingsId(null)
          setTemplate(DEFAULT_TEMPLATE)
        }
      } catch (err) {
        console.error('Unexpected error loading settings:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadTemplate()
  }, [selectedShop])

  const insertTag = (tag: string) => {
    const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)
    const newText = before + tag + after
    setTemplate(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + tag.length
    }, 0)
  }

  const handleSave = async () => {
    if (!selectedShop) return
    setSaving(true)
    try {
      if (settingsId) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            therapist_template: template,
            updated_at: new Date().toISOString()
          })
          .eq('id', settingsId)

        if (error) throw error
      } else {
        // Insert new system settings
        const { data, error } = await supabase
          .from('system_settings')
          .insert([{
            shop_id: selectedShop.id,
            therapist_template: template
          }])
          .select('id')
          .single()

        if (error) throw error
        if (data) setSettingsId(data.id)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save template:', err)
      alert('テンプレートの保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (confirm('テンプレートを初期設定（デフォルト）に戻しますか？')) {
      setTemplate(DEFAULT_TEMPLATE)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-indigo-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        <span className="ml-3 font-medium">読み込み中...</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-800 mb-1">セラピスト連絡テンプレート設定</h2>
        <p className="text-sm text-slate-500">
          予約詳細からセラピストへの連絡文面（LINE/SMS等へのコピー用）を生成する際のテンプレートをカスタマイズできます。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label htmlFor="template-textarea" className="block text-sm font-semibold text-slate-700">
            テンプレート文面
          </label>
          <textarea
            id="template-textarea"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={15}
            className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500/50 outline-none resize-y"
            placeholder="ここに連絡テンプレートを入力してください"
          />

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              デフォルトに戻す
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? '保存中...' : saved ? '✓ 保存しました' : 'テンプレートを保存'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700">挿入可能なタグ</h3>
            <p className="text-xs text-slate-400 mt-1">
              クリックするとテンプレートのカーソル位置にタグが挿入され、予約詳細のデータに自動置換されます。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
            {TAGS.map((t) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => insertTag(t.tag)}
                className="flex items-center justify-between text-left px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs transition-all duration-150 group"
              >
                <code className="font-mono font-semibold bg-white border border-slate-200 px-1 py-0.5 rounded text-indigo-600 group-hover:bg-indigo-100 group-hover:border-indigo-300 text-[10px]">
                  {t.tag}
                </code>
                <span className="text-slate-500 text-[10px] ml-1.5 text-right whitespace-nowrap overflow-hidden text-ellipsis">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
