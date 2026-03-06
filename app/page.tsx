import Link from "next/link";

export default function Home() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-8 text-slate-800 tracking-tight">ダッシュボード</h1>

      {/* ヒーローセクション（サマリ等を入れる想定のグラデーションカード） */}
      <div className="mb-8 p-8 rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 shadow-lg text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-10 transform translate-x-1/3 -translate-y-1/3 group-hover:scale-110 transition-transform duration-700">
          <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13.5h-13L12 6.5z" /></svg>
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-2">ようこそ、管理システムへ</h2>
          <p className="text-indigo-100 max-w-lg mb-6">
            本日の予約状況や、セラピストのシフト空き状況を素早く確認できます。
            下記のクイックアクセスから日常業務を開始してください。
          </p>
          <div className="flex gap-4">
            <Link href="/reservations/new" className="px-6 py-2.5 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm active:scale-95">
              予紁E��登録する
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* クイックリンクカード */}
        <Link href="/reservations" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2 tracking-tight">予約管理</h2>
          <p className="text-slate-500 text-sm">予約の確認、新規登録、編集を行います。</p>
        </Link>

        <Link href="/shifts" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
          <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-violet-600 group-hover:text-white transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2 tracking-tight">スケジュール</h2>
          <p className="text-slate-500 text-sm">セラピストのシフト空き状況を確認します。</p>
        </Link>

        <Link href="/customers" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2 tracking-tight">顧客管理</h2>
          <p className="text-slate-500 text-sm">顧客情報の管理、利用履歴の確認を行います。</p>
        </Link>

        <Link href="/therapists" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-rose-600 group-hover:text-white transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2 tracking-tight">セラピスト管理</h2>
          <p className="text-slate-500 text-sm">セラピストの登録、情報設定を行います。</p>
        </Link>
      </div>
    </div>
  );
}
