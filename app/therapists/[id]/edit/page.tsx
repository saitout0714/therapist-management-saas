"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useShop } from "@/app/contexts/ShopContext";
import Link from "next/link";

export default function EditTherapistPage() {
  const router = useRouter();
  const params = useParams();
  const therapistId = params.id as string;
  useShop();

  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    name: "",
    age: "",
    height: "",
    bust: "",
    bust_cup: "",
    waist: "",
    hip: "",
    comment: "",
    rank_id: "",
    reservation_interval_minutes: "",
    is_active: true,
  });

  const [ranks, setRanks] = useState<{ id: string, name: string }[]>([]);
  const [nominationFees, setNominationFees] = useState<{ id: string, name: string }[]>([]);
  const [feeOverrides, setFeeOverrides] = useState<Record<string, string>>({});
  const [therapistShopId, setTherapistShopId] = useState<string | null>(null);
  const [optionCategories, setOptionCategories] = useState<string[]>([]);
  const [designationTypes, setDesignationTypes] = useState<{ slug: string; display_name: string }[]>([]);
  // Matrix key: `${category}||${desig_slug}` where desig_slug = '__all__' for 全種別共通
  const [optionBackMatrix, setOptionBackMatrix] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchTherapistData = async () => {
      if (!therapistId) return;

      try {
        setInitializing(true);
        // Fetch therapist details
        const { data: therapist, error: therapistError } = await supabase
          .from("therapists")
          .select("*")
          .eq("id", therapistId)
          .single();

        if (therapistError) throw therapistError;

        setTherapistShopId(therapist.shop_id);

        // Fetch ranks, fees, option data in parallel
        const [ranksRes, feesRes, overridesRes, optCatRes, dtRes, optBacksRes] = await Promise.all([
          supabase.from("therapist_ranks").select("id, name").eq("shop_id", therapist.shop_id).order("display_order"),
          supabase.from("nomination_fees").select("id, name").eq("shop_id", therapist.shop_id),
          supabase.from("therapist_fee_overrides").select("fee_type_id, override_price").eq("therapist_id", therapistId),
          supabase.from("options").select("back_category").eq("shop_id", therapist.shop_id).eq("is_active", true),
          supabase.from("designation_types").select("slug, display_name").eq("shop_id", therapist.shop_id).eq("is_active", true).order("display_order"),
          supabase.from("therapist_option_backs").select("option_category, designation_type, back_rate").eq("therapist_id", therapistId),
        ]);

        setRanks(ranksRes.data || []);
        setNominationFees(feesRes.data || []);

        const overridesObj: Record<string, string> = {};
        if (overridesRes.data) {
          overridesRes.data.forEach((o: { fee_type_id: string; override_price: number }) => {
            overridesObj[o.fee_type_id] = String(o.override_price);
          });
        }
        setFeeOverrides(overridesObj);

        // オプションカテゴリ（重複除去）
        const cats = [...new Set((optCatRes.data || []).map((o: { back_category: string }) => o.back_category).filter(Boolean))] as string[];
        // 衣装を先頭に、その他を末尾に固定ソート
        cats.sort((a, b) => a === '衣装' ? -1 : b === '衣装' ? 1 : a.localeCompare(b));
        setOptionCategories(cats);
        setDesignationTypes((dtRes.data || []) as { slug: string; display_name: string }[]);

        // オプションバックマトリクスを構築
        const matrix: Record<string, string> = {};
        for (const back of (optBacksRes.data || []) as { option_category: string | null; designation_type: string | null; back_rate: number }[]) {
          const catKey = back.option_category ?? '__all__';
          const desigKey = back.designation_type ?? '__all__';
          matrix[`${catKey}||${desigKey}`] = String(back.back_rate);
        }
        setOptionBackMatrix(matrix);

        setProfile({
          name: therapist.name || "",
          age: therapist.age ? String(therapist.age) : "",
          height: therapist.height ? String(therapist.height) : "",
          bust: therapist.bust ? String(therapist.bust) : "",
          bust_cup: therapist.bust_cup || "",
          waist: therapist.waist ? String(therapist.waist) : "",
          comment: therapist.comment || "",
          hip: therapist.hip ? String(therapist.hip) : "",
          rank_id: therapist.rank_id || "",
          reservation_interval_minutes: therapist.reservation_interval_minutes != null
            ? String(therapist.reservation_interval_minutes)
            : "",
          is_active: therapist.is_active !== false,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "不明なエラー";
        setError("データの取得に失敗しました: " + message);
      } finally {
        setInitializing(false);
      }
    };

    fetchTherapistData();
  }, [therapistId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!profile.name.trim()) {
      setError("名前は必須です");
      setLoading(false);
      return;
    }

    const numFields = ["age", "height", "bust", "waist", "hip"];
    for (const field of numFields) {
      const val = profile[field as keyof typeof profile];
      if (val && isNaN(Number(val))) {
        setError(`${field}は数値で入力してください`);
        setLoading(false);
        return;
      }
    }

    for (const feeId in feeOverrides) {
      if (feeOverrides[feeId] && isNaN(Number(feeOverrides[feeId]))) {
        setError(`個別料金は数値で入力してください`);
        setLoading(false);
        return;
      }
    }
    setError(null);

    const overrideEntries = Object.entries(feeOverrides)
      .filter(([_, price]) => price !== "")
      .map(([feeId, price]) => ({
        therapist_id: therapistId,
        fee_type_id: feeId,
        override_price: Number(price),
      }));

    const hasOverrides = overrideEntries.length > 0;

    // 基本フィールドを保存（インターバル列なし）
    const { error: updateError } = await supabase
      .from("therapists")
      .update({
        name: profile.name,
        age: profile.age ? Number(profile.age) : null,
        height: profile.height ? Number(profile.height) : null,
        bust: profile.bust ? Number(profile.bust) : null,
        bust_cup: profile.bust_cup || null,
        waist: profile.waist ? Number(profile.waist) : null,
        comment: profile.comment || null,
        hip: profile.hip ? Number(profile.hip) : null,
        rank_id: profile.rank_id || null,
        has_fee_override: hasOverrides,
        is_active: profile.is_active,
      })
      .eq("id", therapistId);

    if (updateError) {
      setError("保存に失敗しました: " + updateError.message);
      setLoading(false);
      return;
    }

    // インターバル列を別途保存（DB未マイグレーションでも他フィールドは守る）
    if (profile.reservation_interval_minutes !== undefined) {
      const intervalValue = profile.reservation_interval_minutes !== ""
        ? Number(profile.reservation_interval_minutes)
        : null;
      const { error: intervalError } = await supabase
        .from("therapists")
        .update({ reservation_interval_minutes: intervalValue })
        .eq("id", therapistId);
      if (intervalError) {
        // 列が未追加の場合は警告のみ（他の保存は完了済み）
        console.warn("インターバルの保存をスキップ（DBマイグレーション未適用の可能性）:", intervalError.message);
      }
    }

    // Update overrides
    await supabase.from("therapist_fee_overrides").delete().eq("therapist_id", therapistId);

    if (hasOverrides) {
      const { error: overrideError } = await supabase
        .from("therapist_fee_overrides")
        .insert(overrideEntries);

      if (overrideError) {
        setError("例外料金設定の保存に失敗しました: " + overrideError.message);
        setLoading(false);
        return;
      }
    }

    // オプションバック設定を保存
    await supabase.from("therapist_option_backs").delete().eq("therapist_id", therapistId);

    const optionBackRows = Object.entries(optionBackMatrix)
      .filter(([, val]) => val !== '')
      .map(([key, val]) => {
        const [catKey, desigKey] = key.split('||');
        return {
          shop_id: therapistShopId,
          therapist_id: therapistId,
          option_category: catKey === '__all__' ? null : catKey,
          designation_type: desigKey === '__all__' ? null : desigKey,
          back_rate: parseFloat(val),
        };
      });

    if (optionBackRows.length > 0) {
      const { error: optBackError } = await supabase.from("therapist_option_backs").insert(optionBackRows);
      if (optBackError) {
        setError("オプションバック設定の保存に失敗しました: " + optBackError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.push("/therapists");
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 md:p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/therapists" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">プロフィールの編集</h1>
            <p className="text-sm text-slate-500 mt-1">セラピストの基本情報と料金設定を編集します。</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8">
            {error && (
              <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-8">
              {/* 基本プロフィール */}
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">基本情報</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                    名前 <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600">必須</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={profile.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                    placeholder="山田 花子"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">年齢</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="age"
                        value={profile.age}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 placeholder-slate-400"
                        placeholder="25"
                        min="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">歳</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">身長</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="height"
                        value={profile.height}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 placeholder-slate-400"
                        placeholder="160"
                        min="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">cm</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">スリーサイズ</label>
                  <div className="flex bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
                    <div className="flex-1 relative flex items-center">
                      <span className="absolute left-3 text-slate-400 text-sm font-bold">B</span>
                      <input
                        type="number" name="bust" value={profile.bust} onChange={handleChange}
                        className="w-full py-3 pl-8 pr-2 bg-transparent outline-none text-slate-800 text-center" min="0" placeholder="-"
                      />
                    </div>
                    <div className="w-px bg-slate-200"></div>
                    <div className="relative flex items-center" style={{ width: '72px' }}>
                      <select
                        name="bust_cup"
                        value={profile.bust_cup}
                        onChange={handleChange}
                        className="w-full py-3 px-2 bg-transparent outline-none text-slate-800 text-center appearance-none cursor-pointer"
                      >
                        <option value="">C</option>
                        {['A','B','C','D','E','F','G','H','I','J','K'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-px bg-slate-200"></div>
                    <div className="flex-1 relative flex items-center">
                      <span className="absolute left-3 text-slate-400 text-sm font-bold">W</span>
                      <input
                        type="number" name="waist" value={profile.waist} onChange={handleChange}
                        className="w-full py-3 pl-8 pr-2 bg-transparent outline-none text-slate-800 text-center" min="0" placeholder="-"
                      />
                    </div>
                    <div className="w-px bg-slate-200"></div>
                    <div className="flex-1 relative flex items-center">
                      <span className="absolute left-3 text-slate-400 text-sm font-bold">H</span>
                      <input
                        type="number" name="hip" value={profile.hip} onChange={handleChange}
                        className="w-full py-3 pl-8 pr-2 bg-transparent outline-none text-slate-800 text-center" min="0" placeholder="-"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">バスト数値の隣のドロップダウンでカップを選択</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">コメント</label>
                  <textarea
                    name="comment"
                    value={profile.comment}
                    onChange={(e) => setProfile({ ...profile, comment: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400 resize-none"
                    placeholder="店長おすすめポイント、セラピストからのメッセージなど"
                  />
                </div>
              </div>

              {/* 在籍状況 */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">在籍状況</h3>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setProfile({ ...profile, is_active: true })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                      profile.is_active
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${profile.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    在籍中
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfile({ ...profile, is_active: false })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                      !profile.is_active
                        ? 'border-rose-400 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${!profile.is_active ? 'bg-rose-400' : 'bg-slate-300'}`}></span>
                    退店
                  </button>
                </div>
                {!profile.is_active && (
                  <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    退店に設定すると、シフト登録画面に表示されなくなります。
                  </p>
                )}
              </div>

              {/* インターバル設定 */}
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  予約インターバル設定
                </h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">予約インターバル（准備時間）</label>
                  <p className="text-xs text-slate-400 mb-2">空欄の場合は店舗デフォルトのインターバルが適用されます。</p>
                  <select
                    name="reservation_interval_minutes"
                    value={profile.reservation_interval_minutes}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800"
                  >
                    <option value="">店舗デフォルトを使用</option>
                    {[0, 5, 10, 15, 20, 25, 30, 45, 60].map(m => (
                      <option key={m} value={String(m)}>{m}分</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 料金設定 */}
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  ランク設定
                </h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">所属ランク</label>
                  <select
                    name="rank_id"
                    value={profile.rank_id}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800"
                  >
                    <option value="">ランクなし</option>
                    {ranks.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex flex-col gap-1 mt-8">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>個別料金設定（例外料金）</span>
                  </div>
                  <span className="text-xs text-slate-400 font-normal">空欄の場合は店舗デフォルトの料金が適用されます。</span>
                </h3>

                <div className="space-y-4">
                  {nominationFees.map(fee => (
                    <div key={fee.id}>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{fee.name}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={feeOverrides[fee.id] || ""}
                          onChange={(e) => setFeeOverrides({ ...feeOverrides, [fee.id]: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 font-medium"
                          min="0" step="100" placeholder="デフォルト料金を適用"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">円</span>
                      </div>
                    </div>
                  ))}
                  {nominationFees.length === 0 && (
                    <div className="text-sm text-slate-500 py-2">システム設定から指名料マスタを登録してください。</div>
                  )}
                </div>
              </div>

              {/* オプションバック設定 */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
                  オプションバック設定
                </h3>
                <p className="text-xs text-slate-400">
                  オプションカテゴリ × 指名種別ごとのバック率を設定します。未設定の場合は店舗のデフォルトが適用されます。
                </p>
                {optionCategories.length === 0 ? (
                  <p className="text-sm text-slate-500 py-2">有効なオプションが登録されていません。</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-xs font-semibold text-slate-600 min-w-[80px]">カテゴリ</th>
                          <th className="px-4 py-3 text-xs font-semibold text-slate-600 min-w-[130px]">全種別共通</th>
                          {designationTypes.map(dt => (
                            <th key={dt.slug} className="px-4 py-3 text-xs font-semibold text-slate-600 min-w-[130px]">{dt.display_name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {optionCategories.map(cat => (
                          <tr key={cat} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${cat === '衣装' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                                {cat}
                              </span>
                            </td>
                            {['__all__', ...designationTypes.map(dt => dt.slug)].map(desig => {
                              const key = `${cat}||${desig}`;
                              return (
                                <td key={desig} className="px-4 py-3">
                                  <select
                                    value={optionBackMatrix[key] || ''}
                                    onChange={(e) => setOptionBackMatrix(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                  >
                                    <option value="">未設定</option>
                                    <option value="1">フルバック（100%）</option>
                                    <option value="0.5">折半（50%）</option>
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-slate-400">
                  解決優先順位：カテゴリ×指名種別 → カテゴリ×全種別共通 → 店舗デフォルト
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-3 justify-end">
                <Link
                  href="/therapists"
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                >
                  {loading ? '更新中...' : '更新する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
