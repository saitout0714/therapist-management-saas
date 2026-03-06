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
    nomination_fee: "",
    confirmed_nomination_fee: "",
    princess_reservation_fee: "",
  });

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

        // Fetch pricing
        const { data: pricing } = await supabase
          .from("therapist_pricing")
          .select("nomination_fee, confirmed_nomination_fee, princess_reservation_fee")
          .eq("therapist_id", therapistId)
          .maybeSingle();

        setProfile({
          name: therapist.name || "",
          age: therapist.age ? String(therapist.age) : "",
          height: therapist.height ? String(therapist.height) : "",
          bust: therapist.bust ? String(therapist.bust) : "",
          waist: therapist.waist ? String(therapist.waist) : "",
          hip: therapist.hip ? String(therapist.hip) : "",
          nomination_fee: pricing?.nomination_fee ? String(pricing.nomination_fee) : "",
          confirmed_nomination_fee: pricing?.confirmed_nomination_fee ? String(pricing.confirmed_nomination_fee) : "",
          princess_reservation_fee: pricing?.princess_reservation_fee ? String(pricing.princess_reservation_fee) : "",
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const numFields = ["age", "height", "bust", "waist", "hip", "nomination_fee", "confirmed_nomination_fee", "princess_reservation_fee"];
    for (const field of numFields) {
      const val = profile[field as keyof typeof profile];
      if (val && isNaN(Number(val))) {
        setError(`${field}は数値で入力してください`);
        setLoading(false);
        return;
      }
    }
    setError(null);

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
      })
      .eq("id", therapistId);

    if (updateError) {
      setError("保存に失敗しました: " + updateError.message);
      setLoading(false);
      return;
    }

    const pricingPayload = {
      therapist_id: therapistId,
      nomination_fee: profile.nomination_fee ? Number(profile.nomination_fee) : 0,
      confirmed_nomination_fee: profile.confirmed_nomination_fee ? Number(profile.confirmed_nomination_fee) : 0,
      princess_reservation_fee: profile.princess_reservation_fee ? Number(profile.princess_reservation_fee) : 0,
    };

    const { error: pricingError } = await supabase
      .from("therapist_pricing")
      .upsert([pricingPayload], { onConflict: "therapist_id" });

    if (pricingError) {
      setError("料金設定の保存に失敗しました: " + pricingError.message);
      setLoading(false);
      return;
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  個別料金設定
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between">
                      <span>指名料</span>
                      <span className="text-xs text-slate-400 font-normal">空欄=店舗デフォルト</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number" name="nomination_fee" value={profile.nomination_fee} onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 font-medium"
                        min="0" step="100" placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">円</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between">
                      <span>本指名料</span>
                      <span className="text-xs text-slate-400 font-normal">空欄=店舗デフォルト</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number" name="confirmed_nomination_fee" value={profile.confirmed_nomination_fee} onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 font-medium"
                        min="0" step="100" placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">円</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between">
                      <span>姫予約料</span>
                      <span className="text-xs text-slate-400 font-normal">空欄=店舗デフォルト</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number" name="princess_reservation_fee" value={profile.princess_reservation_fee} onChange={handleChange}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all pr-12 text-slate-800 font-medium text-indigo-700"
                        min="0" step="100" placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm font-bold">円</span>
                    </div>
                  </div>
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
