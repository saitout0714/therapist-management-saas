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
    waist: "",
    hip: "",
    rank_id: "",
  });

  const [ranks, setRanks] = useState<{ id: string, name: string }[]>([]);
  const [nominationFees, setNominationFees] = useState<{ id: string, name: string }[]>([]);
  const [feeOverrides, setFeeOverrides] = useState<Record<string, string>>({});

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

        // Fetch ranks & fees for shop
        const { data: ranksData } = await supabase
          .from("therapist_ranks")
          .select("id, name")
          .eq("shop_id", therapist.shop_id)
          .order("display_order");

        const { data: feesData } = await supabase
          .from("nomination_fees")
          .select("id, name")
          .eq("shop_id", therapist.shop_id);

        // Fetch overrides
        const { data: overridesData } = await supabase
          .from("therapist_fee_overrides")
          .select("fee_type_id, override_price")
          .eq("therapist_id", therapistId);

        setRanks(ranksData || []);
        setNominationFees(feesData || []);

        const overridesObj: Record<string, string> = {};
        if (overridesData) {
          overridesData.forEach(o => {
            overridesObj[o.fee_type_id] = String(o.override_price);
          });
        }
        setFeeOverrides(overridesObj);

        setProfile({
          name: therapist.name || "",
          age: therapist.age ? String(therapist.age) : "",
          height: therapist.height ? String(therapist.height) : "",
          bust: therapist.bust ? String(therapist.bust) : "",
          waist: therapist.waist ? String(therapist.waist) : "",
          hip: therapist.hip ? String(therapist.hip) : "",
          rank_id: therapist.rank_id || "",
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

    // Update Supabase
    const { error: updateError } = await supabase
      .from("therapists")
      .update({
        name: profile.name,
        age: profile.age ? Number(profile.age) : null,
        height: profile.height ? Number(profile.height) : null,
        bust: profile.bust ? Number(profile.bust) : null,
        waist: profile.waist ? Number(profile.waist) : null,
        hip: profile.hip ? Number(profile.hip) : null,
        rank_id: profile.rank_id || null,
        has_fee_override: hasOverrides,
      })
      .eq("id", therapistId);

    if (updateError) {
      setError("保存に失敗しました: " + updateError.message);
      setLoading(false);
      return;
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

    setLoading(false);
    router.push("/therapists");
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 md:p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-8">
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
