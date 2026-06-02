import Link from "next/link";

export default function Home() {
  return (
    <div className="p-4 md:p-8 mx-auto max-w-7xl animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
          ホーム
        </h1>
      </div>

      {/* ヒーローセクション（サマリ等を入れる想定のグラデーションカード） */}
      <div className="mb-10 p-8 md:p-10 rounded-[2rem] bg-gradient-to-br from-primary-600 via-primary-500 to-accent-500 shadow-xl shadow-primary-900/10 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-10 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-700 ease-out">
          <svg className="w-72 h-72" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13.5h-13L12 6.5z" /></svg>
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 drop-shadow-sm">ようこそ、YOYAKLへ</h2>
          <p className="text-primary-50/90 max-w-xl mb-8 text-sm md:text-base leading-relaxed">
            本日の予約状況や、セラピストのシフト空き状況を素早く確認できます。
            下記のクイックアクセスから日常業務を開始してください。
          </p>
          <div className="flex gap-4">
            <Link href="/reservations/new" className="px-6 py-3 bg-white text-primary-600 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-lg shadow-white/20 active:scale-95 flex items-center gap-2 group-hover:shadow-white/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
              予約を登録する
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* クイックリンクカード */}
        <Link href="/reservations" className="premium-card p-6 group">
          <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300 shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2 tracking-tight group-hover:text-primary-600 transition-colors">予約管理</h2>
          <p className="text-slate-500 text-sm leading-relaxed">予約の確認、新規登録、編集を行います。</p>
        </Link>

        <Link href="/shifts" className="premium-card p-6 group">
          <div className="w-12 h-12 bg-accent-50 text-accent-600 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-accent-600 group-hover:text-white transition-all duration-300 shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2 tracking-tight group-hover:text-accent-600 transition-colors">スケジュール</h2>
          <p className="text-slate-500 text-sm leading-relaxed">セラピストのシフト空き状況を確認します。</p>
        </Link>

        <Link href="/customers" className="premium-card p-6 group">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2 tracking-tight group-hover:text-emerald-600 transition-colors">顧客管理</h2>
          <p className="text-slate-500 text-sm leading-relaxed">顧客情報の管理、利用履歴の確認を行います。</p>
        </Link>

        <Link href="/therapists" className="premium-card p-6 group">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300 shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2 tracking-tight group-hover:text-rose-600 transition-colors">セラピスト管理</h2>
          <p className="text-slate-500 text-sm leading-relaxed">セラピストの登録、情報設定を行います。</p>
        </Link>
      </div>
    </div>
  );
}
