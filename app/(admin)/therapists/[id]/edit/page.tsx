"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useShop } from "@/app/contexts/ShopContext";
import { getTodayJST } from "@/lib/timeUtils";
import { getPricingShopId, getBackShopId } from "@/lib/shopUtils";
import Link from "next/link";
import Image from "next/image";

// オプションバック設定を表示する店舗リスト
const ALLOWED_OPTION_BACK_SHOPS = ['レジェンド', 'タイガーリリー', 'レジェンド目白'];

type ActiveTab = 'main' | 'integrations';

interface TherapistMemo {
  id: string;
  date: string;
  content: string;
  amount: number;
  is_resolved: boolean;
  resolved_at?: string | null;
  resolved_date?: string | null;
}

type RosterRow = {
  shop_id: string;
  shop_name: string;
  is_active: boolean;
  alias_name: string;
  existed: boolean;
  age: string;
  height: string;
  bust: string;
  bust_cup: string;
  waist: string;
  hip: string;
  comment: string;
  rank_id: string;
};

export default function EditTherapistPage() {
  const router = useRouter();
  const params = useParams();
  const therapistId = params.id as string;
  const { selectedShop } = useShop();

  const [activeTab, setActiveTab] = useState<ActiveTab>('main');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    name: "",
    age: "",
    height: "",
    bust: "",
    bust_cup: "",
    waist: "",
    hip: "",
    comment: "",
    staff_memo: "",
    rank_id: "",
    reservation_interval_minutes: "",
    is_active: true,
    is_rookie: false,
    ng_course_ids: [] as string[],
    x_url: "",
    bluesky_url: "",
    line_url: "",
    badge: "",
    tags: "",
  });

  const [photos, setPhotos] = useState<{ id: string; photo_url: string; display_order: number }[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [ranks, setRanks] = useState<{ id: string; name: string }[]>([]);
  const [nominationFees, setNominationFees] = useState<{ id: string; name: string }[]>([]);
  const [feeOverrides, setFeeOverrides] = useState<Record<string, string>>({});
  const [therapistShopId, setTherapistShopId] = useState<string>("");
  const [therapistShopName, setTherapistShopName] = useState<string>("");
  const [optionCategories, setOptionCategories] = useState<string[]>([]);
  const [designationTypes, setDesignationTypes] = useState<{ slug: string; display_name: string }[]>([]);
  const [optionBackMatrix, setOptionBackMatrix] = useState<Record<string, string>>({});
  const [courses, setCourses] = useState<{ id: string; name: string; duration: number }[]>([]);

  // 引き継ぎメモ
  const [memos, setMemos] = useState<TherapistMemo[]>([]);
  const [memoForm, setMemoForm] = useState({ content: '', amount: '' });
  const [memoLoading, setMemoLoading] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editMemoForm, setEditMemoForm] = useState({ content: '', amount: '' });

  // 在籍店舗設定用
  const [therapistScope, setTherapistScope] = useState<'all_shops' | 'per_shop'>('per_shop');
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [activeRosterShopId, setActiveRosterShopId] = useState<string>('');
  const [rosterRanks, setRosterRanks] = useState<Record<string, { id: string; name: string }[]>>({});
  const [rosterPhotos, setRosterPhotos] = useState<Record<string, { id: string; photo_url: string; display_order: number }[]>>({});
  const [rosterPhotoUploading, setRosterPhotoUploading] = useState(false);
  const rosterPhotoInputRef = useRef<HTMLInputElement>(null);

  // ポータルサイト同期用
  const [syncingPortals, setSyncingPortals] = useState(false);

  // オプションバック設定の表示判定
  const isOptionBackVisible =
    ALLOWED_OPTION_BACK_SHOPS.includes(selectedShop?.name || '') ||
    ALLOWED_OPTION_BACK_SHOPS.includes(therapistShopName || '');

  const fetchMemos = async () => {
    const { data } = await supabase
      .from('therapist_memos')
      .select('id, date, content, amount, is_resolved, resolved_at, resolved_date')
      .eq('therapist_id', therapistId)
      .order('date', { ascending: false });
    setMemos((data || []) as TherapistMemo[]);
  };

  const handleAddMemo = async () => {
    if (!memoForm.content.trim()) return;
    const targetShopId = therapistShopId || selectedShop?.id;
    if (!targetShopId) {
      alert('店舗情報が見つかりません。ページの読み込みを待つか、再読み込みしてください。');
      return;
    }
    setMemoLoading(true);
    const { error } = await supabase.from('therapist_memos').insert([{
      therapist_id: therapistId,
      shop_id: targetShopId,
      date: getTodayJST(),
      content: memoForm.content.trim(),
      amount: parseInt(memoForm.amount || '0', 10) || 0,
    }]);
    setMemoLoading(false);
    if (error) {
      alert('メモの追加に失敗しました: ' + error.message);
      return;
    }
    setMemoForm({ content: '', amount: '' });
    await fetchMemos();
  };

  const handleEditMemoStart = (memo: TherapistMemo) => {
    setEditingMemoId(memo.id);
    setEditMemoForm({
      content: memo.content ?? '',
      amount: memo.amount != null ? String(memo.amount) : ''
    });
  };

  const handleUpdateMemo = async (id: string) => {
    if (!editMemoForm.content.trim()) return;
    setMemoLoading(true);
    const { error } = await supabase
      .from('therapist_memos')
      .update({
        content: editMemoForm.content.trim(),
        amount: parseInt(editMemoForm.amount || '0', 10) || 0
      })
      .eq('id', id);
    setMemoLoading(false);
    if (error) {
      alert('メモの更新に失敗しました: ' + error.message);
    } else {
      setEditingMemoId(null);
      await fetchMemos();
    }
  };

  const handleResolveMemo = async (id: string) => {
    await supabase.from('therapist_memos').update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_date: null
    }).eq('id', id);
    await fetchMemos();
  };

  const handleUnresolveMemo = async (id: string) => {
    await supabase.from('therapist_memos').update({
      is_resolved: false,
      resolved_at: null,
      resolved_date: null
    }).eq('id', id);
    await fetchMemos();
  };

  const handleDeleteMemo = async (id: string) => {
    if (!confirm('このメモを削除しますか？')) return;
    await supabase.from('therapist_memos').delete().eq('id', id);
    await fetchMemos();
  };

  const handleSyncToPortals = async () => {
    if (!confirm('このセラピストの情報をエステ魂・メンズエステランキング・エステラブに送信（新規登録または上書き更新）しますか？\n※現在のyoyakl上の情報が送信されます。先に「更新する」ボタンで保存してから実行してください。')) return;
    setSyncingPortals(true);

    try {
      fetch('/api/sync/therapists/estama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: therapistShopId, therapistId })
      });
      fetch('/api/sync/therapists/esthe-ranking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: therapistShopId, therapistId })
      });
      fetch('/api/sync/therapists/eslove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: therapistShopId, therapistId })
      });
    } catch (e: any) {
      console.error('Failed to trigger background sync', e);
    }

    setTimeout(() => {
      setSyncingPortals(false);
      alert('バックグラウンドでポータルサイトへの同期を開始しました。\n完了状態は「サイト同期」画面の「同期履歴」から確認できます。');
    }, 500);
  };

  useEffect(() => {
    if (therapistId) void fetchMemos();
  }, [therapistId]);

  useEffect(() => {
    const fetchTherapistData = async () => {
      if (!therapistId) return;

      try {
        setInitializing(true);
        const { data: therapist, error: therapistError } = await supabase
          .from("therapists")
          .select("*")
          .eq("id", therapistId)
          .single();

        if (therapistError) throw therapistError;

        setTherapistShopId(therapist.shop_id);

        let scope: 'all_shops' | 'per_shop' = 'per_shop';
        if (selectedShop?.owner_id) {
          const [{ data: shopsData }, { data: ownerRow }, { data: tsData }] = await Promise.all([
            supabase.from('shops').select('id, name, pricing_source_shop_id, back_source_shop_id').eq('owner_id', selectedShop.owner_id).order('name'),
            supabase.from('owners').select('therapist_scope').eq('id', selectedShop.owner_id).maybeSingle(),
            supabase.from('therapist_shops').select('shop_id, is_active, alias_name, age, height, bust, bust_cup, waist, hip, comment, rank_id').eq('therapist_id', therapistId),
          ]);
          scope = ((ownerRow as { therapist_scope?: string } | null)?.therapist_scope as 'all_shops' | 'per_shop' | undefined) ?? 'per_shop';
          setTherapistScope(scope);
          const needsRoster = scope === 'per_shop' && (shopsData?.length ?? 0) > 1;

          if (shopsData && needsRoster) {
            const tsMap = new Map((tsData || []).map(ts => [ts.shop_id, ts]));
            const num = (v: number | null | undefined) => (v || v === 0) ? String(v) : '';
            const newRoster: RosterRow[] = shopsData.map(s => {
              const existing = tsMap.get(s.id) as {
                is_active?: boolean; alias_name?: string | null; age?: number | null; height?: number | null;
                bust?: number | null; bust_cup?: string | null; waist?: number | null; hip?: number | null;
                comment?: string | null; rank_id?: string | null;
              } | undefined;
              const isHomeShop = s.id === therapist.shop_id;
              const fallback = !existing && isHomeShop ? therapist : null;
              return {
                shop_id: s.id,
                shop_name: s.name,
                is_active: existing ? existing.is_active !== false : isHomeShop,
                alias_name: existing?.alias_name || '',
                age: num(existing?.age ?? fallback?.age),
                height: num(existing?.height ?? fallback?.height),
                bust: num(existing?.bust ?? fallback?.bust),
                bust_cup: existing?.bust_cup || fallback?.bust_cup || '',
                waist: num(existing?.waist ?? fallback?.waist),
                hip: num(existing?.hip ?? fallback?.hip),
                comment: existing?.comment || fallback?.comment || '',
                rank_id: existing?.rank_id || fallback?.rank_id || '',
                existed: !!existing,
              };
            });
            setRoster(newRoster);
            setActiveRosterShopId(prev => prev || newRoster.find(r => r.shop_id === therapist.shop_id)?.shop_id || newRoster[0]?.shop_id || '');

            const backShopIdOf = new Map(shopsData.map(s => [s.id, getBackShopId(s)]));
            const uniqueBackShopIds = [...new Set(backShopIdOf.values())];
            const { data: allRanksData } = await supabase
              .from('therapist_ranks')
              .select('id, name, shop_id')
              .in('shop_id', uniqueBackShopIds)
              .order('display_order');
            const ranksByBackShop = new Map<string, { id: string; name: string }[]>();
            (allRanksData || []).forEach((r: any) => {
              const arr = ranksByBackShop.get(r.shop_id) || [];
              arr.push({ id: r.id, name: r.name });
              ranksByBackShop.set(r.shop_id, arr);
            });
            const rosterRanksMap: Record<string, { id: string; name: string }[]> = {};
            shopsData.forEach(s => {
              rosterRanksMap[s.id] = ranksByBackShop.get(backShopIdOf.get(s.id)!) || [];
            });
            setRosterRanks(rosterRanksMap);

            const siblingShopIds = shopsData.map(s => s.id);
            const { data: rosterPhotoData } = await supabase
              .from('therapist_photos')
              .select('id, shop_id, photo_url, display_order')
              .eq('therapist_id', therapistId)
              .in('shop_id', siblingShopIds)
              .order('display_order', { ascending: true });
            const photosByShop: Record<string, { id: string; photo_url: string; display_order: number }[]> = {};
            (rosterPhotoData || []).forEach((p: any) => {
              const arr = photosByShop[p.shop_id] || [];
              arr.push({ id: p.id, photo_url: p.photo_url, display_order: p.display_order });
              photosByShop[p.shop_id] = arr;
            });
            setRosterPhotos(photosByShop);
          } else {
            setRoster([]);
          }
        }

        const { data: ownShopData } = await supabase
          .from("shops")
          .select("id, name, pricing_source_shop_id, back_source_shop_id")
          .eq("id", therapist.shop_id)
          .single();

        if (ownShopData?.name) {
          setTherapistShopName(ownShopData.name);
        }
        const pricingShopId = ownShopData ? getPricingShopId(ownShopData) : therapist.shop_id;
        const backShopId = ownShopData ? getBackShopId(ownShopData) : therapist.shop_id;

        const [ranksRes, feesRes, overridesRes, optCatRes, dtRes, optBacksRes, coursesRes] = await Promise.all([
          supabase.from("therapist_ranks").select("id, name").eq("shop_id", backShopId).order("display_order"),
          supabase.from("nomination_fees").select("id, name").eq("shop_id", therapist.shop_id),
          supabase.from("therapist_fee_overrides").select("fee_type_id, override_price").eq("therapist_id", therapistId),
          supabase.from("options").select("back_category").eq("shop_id", pricingShopId).eq("is_active", true),
          supabase.from("designation_types").select("slug, display_name").eq("shop_id", pricingShopId).eq("is_active", true).order("display_order"),
          supabase.from("therapist_option_backs").select("option_category, designation_type, back_rate").eq("therapist_id", therapistId),
          supabase.from("courses").select("id, name, duration").eq("shop_id", pricingShopId).eq("is_active", true).order("display_order")
        ]);

        setRanks(ranksRes.data || []);
        setNominationFees(feesRes.data || []);
        setCourses(coursesRes.data || []);

        const overridesObj: Record<string, string> = {};
        if (overridesRes.data) {
          overridesRes.data.forEach((o: { fee_type_id: string; override_price: number }) => {
            overridesObj[o.fee_type_id] = String(o.override_price);
          });
        }
        setFeeOverrides(overridesObj);

        const cats = [...new Set((optCatRes.data || []).map((o: { back_category: string }) => o.back_category).filter(Boolean))] as string[];
        cats.sort((a, b) => a === '衣装' ? -1 : b === '衣装' ? 1 : a.localeCompare(b));
        setOptionCategories(cats);
        setDesignationTypes((dtRes.data || []) as { slug: string; display_name: string }[]);

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
          staff_memo: therapist.staff_memo || "",
          hip: therapist.hip ? String(therapist.hip) : "",
          rank_id: therapist.rank_id || "",
          reservation_interval_minutes: therapist.reservation_interval_minutes != null
            ? String(therapist.reservation_interval_minutes)
            : "",
          is_active: therapist.is_active !== false,
          is_rookie: !!therapist.is_rookie,
          ng_course_ids: therapist.ng_course_ids || [],
          x_url: therapist.x_url || "",
          bluesky_url: therapist.bluesky_url || "",
          line_url: therapist.line_url || "",
          badge: therapist.badge || "",
          tags: Array.isArray(therapist.tags) ? therapist.tags.join(", ") : "",
        });

        let photoQuery = supabase
          .from("therapist_photos")
          .select("id, photo_url, display_order")
          .eq("therapist_id", therapistId)
          .order("display_order", { ascending: true });
        if (scope === 'per_shop' && selectedShop?.id) photoQuery = photoQuery.eq('shop_id', selectedShop.id);
        const { data: photoData } = await photoQuery;
        setPhotos((photoData || []) as { id: string; photo_url: string; display_order: number }[]);

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "不明なエラー";
        setError("データの取得に失敗しました: " + message);
      } finally {
        setInitializing(false);
      }
    };

    fetchTherapistData();
  }, [therapistId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} は5MB以下にしてください`);
        continue;
      }
      setPhotoUploading(true);
      setError(null);
      const photoId = crypto.randomUUID();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${therapistId}/${photoId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('therapist-photos')
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        setError("写真のアップロードに失敗しました: " + uploadError.message);
        setPhotoUploading(false);
        continue;
      }
      const { data: urlData } = supabase.storage.from('therapist-photos').getPublicUrl(path);
      const nextOrder = photos.length > 0 ? Math.max(...photos.map(p => p.display_order)) + 1 : 0;
      const { data: inserted, error: insertError } = await supabase
        .from("therapist_photos")
        .insert({ therapist_id: therapistId, shop_id: selectedShop?.id || therapistShopId || null, photo_url: urlData.publicUrl, display_order: nextOrder })
        .select("id, photo_url, display_order")
        .single();
      if (insertError) {
        setError("写真の登録に失敗しました: " + insertError.message);
        setPhotoUploading(false);
        continue;
      }
      if (inserted) {
        setPhotos(prev => [...prev, inserted as { id: string; photo_url: string; display_order: number }]);
      }
    }
    setPhotoUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!confirm("この写真を削除しますか？")) return;
    await supabase.from("therapist_photos").delete().eq("id", photoId);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handlePhotoMove = async (index: number, direction: -1 | 1) => {
    const newPhotos = [...photos];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newPhotos.length) return;
    [newPhotos[index], newPhotos[swapIndex]] = [newPhotos[swapIndex], newPhotos[index]];
    const updated = newPhotos.map((p, i) => ({ ...p, display_order: i }));
    setPhotos(updated);
    await Promise.all(
      updated.map(p => supabase.from("therapist_photos").update({ display_order: p.display_order }).eq("id", p.id))
    );
  };

  // 在籍店舗タブ用の写真操作
  const handleRosterPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !activeRosterShopId) return;
    const shopId = activeRosterShopId;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} は5MB以下にしてください`);
        continue;
      }
      setRosterPhotoUploading(true);
      setError(null);
      const photoId = crypto.randomUUID();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${therapistId}/${photoId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('therapist-photos')
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        setError("写真のアップロードに失敗しました: " + uploadError.message);
        setRosterPhotoUploading(false);
        continue;
      }
      const { data: urlData } = supabase.storage.from('therapist-photos').getPublicUrl(path);
      const currentPhotos = rosterPhotos[shopId] || [];
      const nextOrder = currentPhotos.length > 0 ? Math.max(...currentPhotos.map(p => p.display_order)) + 1 : 0;
      const { data: inserted, error: insertError } = await supabase
        .from("therapist_photos")
        .insert({ therapist_id: therapistId, shop_id: shopId, photo_url: urlData.publicUrl, display_order: nextOrder })
        .select("id, photo_url, display_order")
        .single();
      if (insertError) {
        setError("写真の登録に失敗しました: " + insertError.message);
        setRosterPhotoUploading(false);
        continue;
      }
      if (inserted) {
        setRosterPhotos(prev => ({ ...prev, [shopId]: [...(prev[shopId] || []), inserted as { id: string; photo_url: string; display_order: number }] }));
      }
    }
    setRosterPhotoUploading(false);
    if (rosterPhotoInputRef.current) rosterPhotoInputRef.current.value = '';
  };

  const handleRosterPhotoDelete = async (shopId: string, photoId: string) => {
    if (!confirm("この写真を削除しますか？")) return;
    await supabase.from("therapist_photos").delete().eq("id", photoId);
    setRosterPhotos(prev => ({ ...prev, [shopId]: (prev[shopId] || []).filter(p => p.id !== photoId) }));
  };

  const handleRosterPhotoMove = async (shopId: string, index: number, direction: -1 | 1) => {
    const list = [...(rosterPhotos[shopId] || [])];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= list.length) return;
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
    const updated = list.map((p, i) => ({ ...p, display_order: i }));
    setRosterPhotos(prev => ({ ...prev, [shopId]: updated }));
    await Promise.all(
      updated.map(p => supabase.from("therapist_photos").update({ display_order: p.display_order }).eq("id", p.id))
    );
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

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

    for (const r of roster) {
      for (const field of ["age", "height", "bust", "waist", "hip"] as const) {
        if (r[field] && isNaN(Number(r[field]))) {
          setError(`${r.shop_name}の${field}は数値で入力してください`);
          setLoading(false);
          return;
        }
      }
    }

    const overrideEntries = Object.entries(feeOverrides)
      .filter(([_, price]) => price !== "")
      .map(([feeId, price]) => ({
        therapist_id: therapistId,
        fee_type_id: feeId,
        override_price: Number(price),
      }));

    const hasOverrides = overrideEntries.length > 0;

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
        staff_memo: profile.staff_memo || null,
        hip: profile.hip ? Number(profile.hip) : null,
        rank_id: profile.rank_id || null,
        has_fee_override: hasOverrides,
        is_active: profile.is_active,
        is_rookie: profile.is_rookie || false,
        x_url: profile.x_url || null,
        bluesky_url: profile.bluesky_url || null,
        line_url: profile.line_url || null,
        badge: profile.badge || null,
        tags: profile.tags
          ? profile.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : null,
      })
      .eq("id", therapistId);

    if (updateError) {
      setError("保存に失敗しました: " + updateError.message);
      setLoading(false);
      return;
    }

    const { error: ngCourseError } = await supabase
      .from("therapists")
      .update({ ng_course_ids: profile.ng_course_ids })
      .eq("id", therapistId);
    if (ngCourseError) {
      console.warn("ng_course_idsの保存をスキップ:", ngCourseError.message);
    }

    if (profile.reservation_interval_minutes !== undefined) {
      const intervalValue = profile.reservation_interval_minutes !== ""
        ? Number(profile.reservation_interval_minutes)
        : null;
      const { error: intervalError } = await supabase
        .from("therapists")
        .update({ reservation_interval_minutes: intervalValue })
        .eq("id", therapistId);
      if (intervalError) {
        console.warn("インターバルの保存をスキップ:", intervalError.message);
      }
    }

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

    // オプションバック設定の保存（表示対象店舗の場合のみ更新）
    if (isOptionBackVisible) {
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
    }

    // 在籍店舗の保存
    const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
    const rosterPayload = roster
      .filter(r => r.existed || r.is_active)
      .map(r => ({
        shop_id: r.shop_id,
        is_active: profile.is_active ? r.is_active : false,
        alias_name: r.alias_name.trim() || null,
        age: numOrNull(r.age),
        height: numOrNull(r.height),
        bust: numOrNull(r.bust),
        bust_cup: r.bust_cup.trim() || null,
        waist: numOrNull(r.waist),
        hip: numOrNull(r.hip),
        comment: r.comment.trim() || null,
        rank_id: r.rank_id || null,
      }));

    if (rosterPayload.length > 0) {
      try {
        const res = await fetch('/api/admin/therapists', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ therapistId, shopId: therapistShopId, roster: rosterPayload }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || '在籍店舗の保存に失敗しました');
          setLoading(false);
          return;
        }
      } catch (e: unknown) {
        setError('在籍店舗の保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setSuccessMessage("プロフィールを保存しました。");
    setTimeout(() => {
      router.replace("/therapists");
    }, 400);
  };

  if (initializing) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">プロフィール情報を読み込み中...</p>
        </div>
      </div>
    );
  }

  // メイン写真の取得
  const primaryPhoto = (roster.length > 0 && activeRosterShopId && rosterPhotos[activeRosterShopId]?.[0]?.photo_url)
    ? rosterPhotos[activeRosterShopId][0].photo_url
    : photos[0]?.photo_url || null;

  const unresolvedMemoCount = memos.filter(m => !m.is_resolved).length;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28">
      {/* 画面トップ ヘッダーバー */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3.5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            {/* 左側：戻るリンク & セラピスト基本サマリー */}
            <div className="flex items-center gap-3.5 min-w-0">
              <Link
                href="/therapists"
                className="w-9 h-9 flex-shrink-0 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 transition-colors"
                title="セラピスト一覧へ戻る"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>

              <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                {primaryPhoto ? (
                  <Image
                    src={primaryPhoto}
                    alt={profile.name || "セラピスト"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate tracking-tight">
                    {profile.name || "名前未設定"}
                  </h1>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    profile.is_active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${profile.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {profile.is_active ? '在籍中' : '退店'}
                  </span>
                  {profile.is_rookie && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      新人 🔰
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  所属: {therapistShopName || selectedShop?.name || '店舗未定'}
                </p>
              </div>
            </div>

            {/* 右側：クイック保存・キャンセルボタン */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Link
                href="/therapists"
                className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </Link>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>更新する</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ビュー切り替えタブ（プロフィール設定画面 1ページ表示 / 外部連携） */}
          <div className="flex items-center gap-2 pt-3 mt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveTab('main')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'main'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>👤 プロフィール・設定（全項目）</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'integrations'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>🌐 外部サイト連携（ポータル送信）</span>
            </button>
          </div>
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-medium flex items-start gap-3 shadow-xs">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">{error}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-medium flex items-center gap-3 shadow-xs">
            <svg className="w-5 h-5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>{successMessage}</div>
          </div>
        )}

        <form onSubmit={handleSave}>

          {/* ========================================================= */}
          {/* 1ページ表示（プロフィール、スペック、写真、料金、メモなど全項目） */}
          {/* ========================================================= */}
          {activeTab === 'main' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* 左側カラム (2/3): 基本情報・写真・WEB公開・料金設定・NG・オプションバック */}
              <div className="lg:col-span-2 space-y-6">

                {/* 1. 基本情報 & スペック */}
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-xs space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        👤
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-800">基本情報 & スペック</h2>
                        <p className="text-xs text-slate-400">氏名、在籍状況、ランク、新人フラグ、身体スペックを設定します。</p>
                      </div>
                    </div>
                  </div>

                  {/* Row 1: 氏名・年齢 */}
                  <div className="flex flex-wrap sm:flex-nowrap items-end gap-3.5">
                    {/* 氏名 / 源氏名 */}
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center">
                        氏名 / 源氏名 <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600">必須</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={profile.name}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 placeholder-slate-400 text-sm font-medium"
                        placeholder="例: 山田 花子"
                        required
                      />
                    </div>

                    {/* 年齢 (単一店舗時) */}
                    {roster.length === 0 && (
                      <div className="w-28 sm:w-32 flex-shrink-0">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">年齢</label>
                        <div className="relative">
                          <input
                            type="number"
                            name="age"
                            value={profile.age}
                            onChange={handleChange}
                            className="w-full px-3 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 pr-8 text-sm font-bold text-center"
                            placeholder="25"
                            min="0"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">歳</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {therapistScope === 'all_shops' && (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      💡 このグループは全店共通管理のため、登録するとグループ内すべての店舗に同一プロフィールで在籍します。
                    </p>
                  )}

                  {/* Row 2: 身長・スリーサイズ (単一店舗時) */}
                  {roster.length === 0 && (
                    <div className="flex flex-wrap sm:flex-nowrap items-end gap-3.5 pt-2 border-t border-slate-100">
                      {/* 身長 */}
                      <div className="w-24 sm:w-28 flex-shrink-0">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">身長</label>
                        <div className="relative">
                          <input
                            type="number"
                            name="height"
                            value={profile.height}
                            onChange={handleChange}
                            className="w-full px-2.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 pr-8 text-sm font-bold text-center"
                            placeholder="160"
                            min="0"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">cm</span>
                        </div>
                      </div>

                      {/* スリーサイズ (B / Cup / W / H) - 大きく広々と表示 */}
                      <div className="flex-1 min-w-[280px]">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          スリーサイズ (B / W / H)
                        </label>
                        <div className="flex items-center bg-slate-50/70 rounded-xl border border-slate-200 overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all h-[42px]">
                          {/* B */}
                          <div className="flex-1 relative flex items-center h-full min-w-0">
                            <span className="absolute left-2.5 text-slate-400 text-xs font-bold select-none">B</span>
                            <input
                              type="number"
                              name="bust"
                              value={profile.bust}
                              onChange={handleChange}
                              className="w-full h-full pl-6 pr-1 text-center text-sm font-bold outline-none bg-transparent text-slate-800"
                              min="0"
                              placeholder="-"
                            />
                          </div>

                          <div className="w-px h-5 bg-slate-200" />

                          {/* Cup */}
                          <div className="relative flex items-center h-full px-1 w-24 flex-shrink-0">
                            <select
                              name="bust_cup"
                              value={profile.bust_cup}
                              onChange={handleChange}
                              className="w-full h-full px-2 text-center text-xs sm:text-sm font-bold text-indigo-700 bg-transparent outline-none cursor-pointer"
                            >
                              <option value="">カップ</option>
                              {['A','B','C','D','E','F','G','H','I','J','K'].map(c => (
                                <option key={c} value={c}>{c}カップ</option>
                              ))}
                            </select>
                          </div>

                          <div className="w-px h-5 bg-slate-200" />

                          {/* W */}
                          <div className="flex-1 relative flex items-center h-full min-w-0">
                            <span className="absolute left-2.5 text-slate-400 text-xs font-bold select-none">W</span>
                            <input
                              type="number"
                              name="waist"
                              value={profile.waist}
                              onChange={handleChange}
                              className="w-full h-full pl-6 pr-1 text-center text-sm font-bold outline-none bg-transparent text-slate-800"
                              min="0"
                              placeholder="-"
                            />
                          </div>

                          <div className="w-px h-5 bg-slate-200" />

                          {/* H */}
                          <div className="flex-1 relative flex items-center h-full min-w-0">
                            <span className="absolute left-2.5 text-slate-400 text-xs font-bold select-none">H</span>
                            <input
                              type="number"
                              name="hip"
                              value={profile.hip}
                              onChange={handleChange}
                              className="w-full h-full pl-6 pr-1 text-center text-sm font-bold outline-none bg-transparent text-slate-800"
                              min="0"
                              placeholder="-"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. 写真ギャラリー（単一店舗時） */}
                {roster.length === 0 && (
                  <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                          📷
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-slate-800">プロフィール写真</h2>
                          <p className="text-xs text-slate-400">1枚目の写真がサイトや一覧でのメイン画像になります。</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {photos.length} / 最大10枚
                      </span>
                    </div>

                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {photos.map((photo, index) => (
                        <div key={photo.id} className="relative group aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
                          <Image
                            src={photo.photo_url}
                            alt={`写真${index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          {index === 0 && (
                            <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                              メイン
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePhotoMove(index, -1)}
                              disabled={index === 0}
                              className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-slate-700 disabled:opacity-30 hover:bg-white shadow-xs cursor-pointer"
                              title="前へ"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePhotoMove(index, 1)}
                              disabled={index === photos.length - 1}
                              className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-slate-700 disabled:opacity-30 hover:bg-white shadow-xs cursor-pointer"
                              title="後へ"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePhotoDelete(photo.id)}
                              className="w-7 h-7 bg-rose-500 rounded-full flex items-center justify-center text-white hover:bg-rose-600 shadow-xs cursor-pointer"
                              title="削除"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}

                      {photos.length < 10 && (
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={photoUploading}
                          className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/30 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {photoUploading ? (
                            <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                          ) : (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                          <span className="text-xs font-bold">写真を追加</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">JPG・PNG・WebP / 1枚最大5MB / 複数選択可</p>
                  </div>
                )}

                {/* 3. 複数店舗在籍設定（2店舗以上グループ所属時のみ） */}
                {roster.length > 0 && (() => {
                  const active = roster.find(r => r.shop_id === activeRosterShopId) || roster[0];
                  const updateActive = (patch: Partial<RosterRow>) => {
                    setRoster(prev => prev.map(item => item.shop_id === active.shop_id ? { ...item, ...patch } : item));
                  };
                  const activePhotos = rosterPhotos[active.shop_id] || [];
                  const activeRanks = rosterRanks[active.shop_id] || [];

                  return (
                    <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-xs space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                            🏬
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-slate-800">所属店舗別の在籍・プロフィール設定</h2>
                            <p className="text-xs text-slate-400">店舗ごとに異なる源氏名・写真・スペック・ランクを管理します。</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                          {roster.length} 店舗所属
                        </span>
                      </div>

                      {/* 店舗タブ切り替え */}
                      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200/70">
                        {roster.map(r => (
                          <button
                            key={r.shop_id}
                            type="button"
                            onClick={() => setActiveRosterShopId(r.shop_id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                              r.shop_id === active.shop_id
                                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                                : r.is_active
                                ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                : 'text-slate-400 bg-slate-200/50'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${r.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span>{r.shop_name}</span>
                            {!r.is_active && <span className="text-[10px] text-rose-500 font-medium">（退店）</span>}
                          </button>
                        ))}
                      </div>

                      {/* アクティブ店舗の設定フォーム */}
                      <div className="p-4 md:p-5 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-5">
                        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200/60">
                          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                            <span>{active.shop_name} の設定</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => updateActive({ is_active: true })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                active.is_active
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              在籍中
                            </button>
                            <button
                              type="button"
                              onClick={() => updateActive({ is_active: false })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                !active.is_active
                                  ? 'bg-rose-500 text-white shadow-xs'
                                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              退店
                            </button>
                          </div>
                        </div>

                        {!active.is_active && (
                          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
                            ※ {active.shop_name} のHP・一覧・シフトから除外されます（本人のマスターデータや他店の在籍には影響しません）。
                          </p>
                        )}

                        {/* Row 1: 源氏名・年齢・ランク */}
                        <div className="flex flex-wrap sm:flex-nowrap items-end gap-3.5">
                          <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">{active.shop_name} での源氏名</label>
                            <input
                              type="text"
                              value={active.alias_name}
                              onChange={(e) => updateActive({ alias_name: e.target.value })}
                              disabled={!active.is_active}
                              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                              placeholder={profile.name || "店舗での源氏名"}
                            />
                          </div>

                          <div className="w-24 sm:w-28 flex-shrink-0">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">年齢</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={active.age}
                                onChange={(e) => updateActive({ age: e.target.value })}
                                disabled={!active.is_active}
                                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 pr-7 disabled:bg-slate-100"
                                placeholder="25"
                                min="0"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">歳</span>
                            </div>
                          </div>

                          <div className="w-44 sm:w-52 flex-shrink-0">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">{active.shop_name} 所属ランク</label>
                            <select
                              value={active.rank_id}
                              onChange={(e) => updateActive({ rank_id: e.target.value })}
                              disabled={!active.is_active}
                              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 disabled:bg-slate-100 cursor-pointer"
                            >
                              <option value="">ランクなし</option>
                              {activeRanks.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Row 2: 身長・スリーサイズ */}
                        <div className="flex flex-wrap sm:flex-nowrap items-end gap-3.5 pt-1">
                          {/* 身長 */}
                          <div className="w-24 sm:w-28 flex-shrink-0">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">身長</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={active.height}
                                onChange={(e) => updateActive({ height: e.target.value })}
                                disabled={!active.is_active}
                                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 pr-8 disabled:bg-slate-100"
                                placeholder="160"
                                min="0"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">cm</span>
                            </div>
                          </div>

                          {/* スリーサイズ */}
                          <div className="flex-1 min-w-[280px]">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">スリーサイズ (B / W / H)</label>
                            <div className="flex items-center bg-white rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all h-[38px]">
                              {/* B */}
                              <div className="flex-1 relative flex items-center h-full min-w-0">
                                <span className="absolute left-2.5 text-slate-400 text-xs font-bold select-none">B</span>
                                <input
                                  type="number"
                                  value={active.bust}
                                  onChange={(e) => updateActive({ bust: e.target.value })}
                                  disabled={!active.is_active}
                                  className="w-full h-full pl-6 pr-1 text-center text-sm font-bold outline-none bg-transparent disabled:bg-slate-100"
                                  placeholder="-"
                                  min="0"
                                />
                              </div>

                              <div className="w-px h-5 bg-slate-200" />

                              {/* Cup */}
                              <div className="relative flex items-center h-full px-1 w-24 flex-shrink-0">
                                <select
                                  value={active.bust_cup}
                                  onChange={(e) => updateActive({ bust_cup: e.target.value })}
                                  disabled={!active.is_active}
                                  className="w-full h-full px-2 text-center text-xs sm:text-sm font-bold text-indigo-700 bg-transparent outline-none cursor-pointer disabled:bg-slate-100"
                                >
                                  <option value="">カップ</option>
                                  {['A','B','C','D','E','F','G','H','I','J','K'].map(c => (
                                    <option key={c} value={c}>{c}カップ</option>
                                  ))}
                                </select>
                              </div>

                              <div className="w-px h-5 bg-slate-200" />

                              {/* W */}
                              <div className="flex-1 relative flex items-center h-full min-w-0">
                                <span className="absolute left-2.5 text-slate-400 text-xs font-bold select-none">W</span>
                                <input
                                  type="number"
                                  value={active.waist}
                                  onChange={(e) => updateActive({ waist: e.target.value })}
                                  disabled={!active.is_active}
                                  className="w-full h-full pl-6 pr-1 text-center text-sm font-bold outline-none bg-transparent disabled:bg-slate-100"
                                  placeholder="-"
                                  min="0"
                                />
                              </div>

                              <div className="w-px h-5 bg-slate-200" />

                              {/* H */}
                              <div className="flex-1 relative flex items-center h-full min-w-0">
                                <span className="absolute left-2.5 text-slate-400 text-xs font-bold select-none">H</span>
                                <input
                                  type="number"
                                  value={active.hip}
                                  onChange={(e) => updateActive({ hip: e.target.value })}
                                  disabled={!active.is_active}
                                  className="w-full h-full pl-6 pr-1 text-center text-sm font-bold outline-none bg-transparent disabled:bg-slate-100"
                                  placeholder="-"
                                  min="0"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">HPアピールコメント ({active.shop_name})</label>
                          <textarea
                            value={active.comment}
                            onChange={(e) => updateActive({ comment: e.target.value })}
                            disabled={!active.is_active}
                            rows={6}
                            className="w-full min-h-[140px] px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 placeholder-slate-400 resize-y disabled:bg-slate-100 leading-relaxed"
                            placeholder={`${active.shop_name} のWeb予約・ホームページに掲載されるアピール文章`}
                          />
                        </div>

                        {/* 店舗別写真 */}
                        <div className="space-y-2 pt-2 border-t border-slate-200/60">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700">写真ギャラリー ({active.shop_name})</label>
                            <span className="text-[11px] text-slate-400 font-medium">{activePhotos.length} / 最大10枚</span>
                          </div>
                          <input
                            ref={rosterPhotoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            className="hidden"
                            onChange={handleRosterPhotoUpload}
                          />
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                            {activePhotos.map((photo, index) => (
                              <div key={photo.id} className="relative group aspect-[3/4] rounded-xl overflow-hidden bg-slate-200 border border-slate-300">
                                <Image src={photo.photo_url} alt={`写真${index + 1}`} fill className="object-cover" unoptimized />
                                {index === 0 && (
                                  <div className="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                    メイン
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleRosterPhotoMove(active.shop_id, index, -1)}
                                    disabled={index === 0}
                                    className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-slate-700 disabled:opacity-30 cursor-pointer"
                                    title="前へ"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRosterPhotoMove(active.shop_id, index, 1)}
                                    disabled={index === activePhotos.length - 1}
                                    className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-slate-700 disabled:opacity-30 cursor-pointer"
                                    title="後へ"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRosterPhotoDelete(active.shop_id, photo.id)}
                                    className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white cursor-pointer"
                                    title="削除"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                            {activePhotos.length < 10 && (
                              <button
                                type="button"
                                onClick={() => rosterPhotoInputRef.current?.click()}
                                disabled={rosterPhotoUploading || !active.is_active}
                                className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-white flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40 cursor-pointer"
                              >
                                {rosterPhotoUploading ? (
                                  <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                )}
                                <span className="text-[10px] font-bold">写真追加</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. WEB公開・予約用情報 (コメント・バッジ・タグ・SNS) */}
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-xs space-y-5">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      🌐
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">WEB公開・SNSリンク</h2>
                      <p className="text-xs text-slate-400">ホームページやWeb予約ページに掲載される文言およびSNSを設定します。</p>
                    </div>
                  </div>

                  {roster.length === 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        HP用アピールコメント（自己紹介）
                      </label>
                      <textarea
                        name="comment"
                        value={profile.comment}
                        onChange={handleChange}
                        rows={7}
                        className="w-full min-h-[160px] px-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 placeholder-slate-400 resize-y text-sm leading-relaxed"
                        placeholder="お客様へ向けた自己紹介やアピールポイントを入力してください。"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">新人フラグ</label>
                      <label className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                        profile.is_rookie
                          ? 'bg-amber-50/80 border-amber-300 text-amber-900 font-bold'
                          : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}>
                        <input
                          type="checkbox"
                          checked={profile.is_rookie}
                          onChange={(e) => setProfile({ ...profile, is_rookie: e.target.checked })}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                        />
                        <span className="text-xs">新人として表示する 🔰</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        バッジ文言 <span className="text-[11px] text-slate-400 font-normal">（例: 看板猫 / 人気 No.1）</span>
                      </label>
                      <input
                        type="text"
                        name="badge"
                        value={profile.badge}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 placeholder-slate-400 text-sm font-medium"
                        placeholder="空欄時は新人設定時のみ「新人」と表示"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      特徴タグ <span className="text-[11px] text-slate-400 font-normal">（カンマ区切りで複数指定・HP絞り込み検索対象）</span>
                    </label>
                    <input
                      type="text"
                      name="tags"
                      value={profile.tags}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 placeholder-slate-400 text-sm font-medium"
                      placeholder="例: 癒し系, 小悪魔系, モチモチ肌, マッサージ得意, 美脚"
                    />
                  </div>

                  {/* SNSリンク */}
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">SNSリンク</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-slate-800 text-white flex items-center justify-center text-[10px] font-black">X</span>
                          <span>X (Twitter) URL</span>
                        </label>
                        <input
                          type="url"
                          name="x_url"
                          value={profile.x_url}
                          onChange={handleChange}
                          className="w-full px-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 placeholder-slate-400 text-xs font-medium"
                          placeholder="https://x.com/..."
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-sky-500 text-white flex items-center justify-center text-[10px] font-black">🦋</span>
                          <span>Bluesky URL</span>
                        </label>
                        <input
                          type="url"
                          name="bluesky_url"
                          value={profile.bluesky_url}
                          onChange={handleChange}
                          className="w-full px-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 placeholder-slate-400 text-xs font-medium"
                          placeholder="https://bsky.app/..."
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black">L</span>
                          <span>LINE URL</span>
                        </label>
                        <input
                          type="url"
                          name="line_url"
                          value={profile.line_url}
                          onChange={handleChange}
                          className="w-full px-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-800 placeholder-slate-400 text-xs font-medium"
                          placeholder="https://line.me/..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. 料金・予約・NG設定 */}
                <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-xs space-y-6">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      ⚙️
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">ランク・予約インターバル & NGコース設定</h2>
                      <p className="text-xs text-slate-400">所属ランク、予約準備時間、NGコースを設定します。</p>
                    </div>
                  </div>

                  {/* ランク & 予約インターバル */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 所属ランク */}
                    {roster.length === 0 ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">所属ランク</label>
                        <select
                          name="rank_id"
                          value={profile.rank_id}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 text-sm font-medium"
                        >
                          <option value="">ランクなし</option>
                          {ranks.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                        💡 ランクは店舗ごとに異なるため、上の「所属店舗別設定」で店舗ごとに設定します。
                      </div>
                    )}

                    {/* 予約インターバル */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        予約インターバル（準備時間）
                      </label>
                      <select
                        name="reservation_interval_minutes"
                        value={profile.reservation_interval_minutes}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 text-sm font-medium"
                      >
                        <option value="">店舗デフォルトを使用</option>
                        {[0, 5, 10, 15, 20, 25, 30, 45, 60].map(m => (
                          <option key={m} value={String(m)}>{m}分</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* NGコース設定 */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">NGコース設定</h3>
                      {profile.ng_course_ids.length > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                          {profile.ng_course_ids.length}件のNG設定中
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">チェックを入れたコースはこのセラピストで予約できなくなります。</p>

                    {courses.length === 0 ? (
                      <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">有効なコースが登録されていません。</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {courses.map((course) => {
                          const isNg = profile.ng_course_ids.includes(course.id);
                          return (
                            <label
                              key={course.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                                isNg
                                  ? 'bg-red-50/60 border-red-300 shadow-2xs'
                                  : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isNg}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setProfile({ ...profile, ng_course_ids: [...profile.ng_course_ids, course.id] });
                                    } else {
                                      setProfile({ ...profile, ng_course_ids: profile.ng_course_ids.filter(id => id !== course.id) });
                                    }
                                  }}
                                  className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                                />
                                <div className="truncate">
                                  <p className={`text-xs font-bold truncate ${isNg ? 'text-red-700' : 'text-slate-800'}`}>
                                    {course.name}
                                  </p>
                                  <span className="text-[10px] text-slate-400 font-medium">{course.duration}分</span>
                                </div>
                              </div>

                              {isNg && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-700 flex-shrink-0">
                                  NG
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. オプションバック設定 (※レジェンド、タイガーリリー、レジェンド目白のみ表示) */}
                {isOptionBackVisible && (
                  <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                          🎯
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-slate-800">オプションバック設定</h2>
                          <p className="text-xs text-slate-400">オプションカテゴリ × 指名種別ごとのバック率を設定します。（未設定時は店舗デフォルト適用）</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        対象店舗限定機能
                      </span>
                    </div>

                    {optionCategories.length === 0 ? (
                      <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl">有効なオプションが登録されていません。</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full border-collapse text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-3.5 py-2.5 text-xs font-bold text-slate-700 min-w-[90px]">カテゴリ</th>
                              <th className="px-3.5 py-2.5 text-xs font-bold text-slate-700 min-w-[120px]">全種別共通</th>
                              {designationTypes.map(dt => (
                                <th key={dt.slug} className="px-3.5 py-2.5 text-xs font-bold text-slate-700 min-w-[120px]">
                                  {dt.display_name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {optionCategories.map(cat => (
                              <tr key={cat} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-3.5 py-2.5">
                                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${
                                    cat === '衣装' ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {cat}
                                  </span>
                                </td>
                                {['__all__', ...designationTypes.map(dt => dt.slug)].map(desig => {
                                  const key = `${cat}||${desig}`;
                                  return (
                                    <td key={desig} className="px-3.5 py-2">
                                      <select
                                        value={optionBackMatrix[key] || ''}
                                        onChange={(e) => setOptionBackMatrix(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg px-2 py-1 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
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
                    <p className="text-[11px] text-slate-400">
                      ※ 解決優先順位：カテゴリ × 指名種別 → カテゴリ × 全種別共通 → 店舗デフォルト
                    </p>
                  </div>
                )}

              </div>

              {/* 右側サイドバー (1/3): スタッフメモ・引き継ぎメモ・ポータルクイックカード */}
              <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-20">

                {/* スタッフメモ（社内専用） */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="text-base">📌</span>
                    <h3 className="font-bold text-slate-800 text-sm">スタッフメモ（社内専用）</h3>
                  </div>

                  <p className="text-[11px] text-amber-700 bg-amber-50/70 border border-amber-200/70 rounded-lg p-2 leading-relaxed">
                    ※ シフト管理画面で名前マウスオーバー時に表示されます（遅刻注意、NG等）。
                  </p>

                  <textarea
                    name="staff_memo"
                    value={profile.staff_memo}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-400/20 outline-none text-slate-800 placeholder-slate-400 text-xs font-medium resize-none"
                    placeholder="例: 遅刻しやすい、オイルアレルギーあり"
                  />
                </div>

                {/* 引き継ぎメモ管理 */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">📋</span>
                      <h3 className="font-bold text-slate-800 text-sm">引き継ぎメモ</h3>
                      {unresolvedMemoCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                          {unresolvedMemoCount}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowResolved(v => !v)}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResolved ? '解決済み隠す' : '解決済み表示'}
                    </button>
                  </div>

                  {/* 新規追加 */}
                  <div className="space-y-2">
                    <textarea
                      value={memoForm.content}
                      onChange={e => setMemoForm(f => ({ ...f, content: e.target.value }))}
                      rows={2}
                      placeholder="内容（例: 精算店落ち -1,000円）"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-400/20 outline-none resize-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={memoForm.amount}
                          onChange={e => setMemoForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="金額"
                          className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                        />
                        <span className="text-[10px] text-slate-400">円</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddMemo}
                        disabled={memoLoading || !memoForm.content.trim()}
                        className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-40 cursor-pointer shadow-2xs"
                      >
                        追加
                      </button>
                    </div>
                  </div>

                  {/* メモ一覧 */}
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                    {memos
                      .filter(m => showResolved || !m.is_resolved)
                      .map(memo => {
                        const isEditing = editingMemoId === memo.id;
                        if (isEditing) {
                          return (
                            <div key={memo.id} className="py-2.5 space-y-2 bg-amber-50/40 p-2 rounded-lg">
                              <textarea
                                value={editMemoForm.content}
                                onChange={e => setEditMemoForm(f => ({ ...f, content: e.target.value }))}
                                rows={2}
                                className="w-full px-2 py-1 bg-white border border-amber-200 rounded text-xs outline-none"
                              />
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  type="number"
                                  value={editMemoForm.amount}
                                  onChange={e => setEditMemoForm(f => ({ ...f, amount: e.target.value }))}
                                  className="w-20 px-2 py-1 bg-white border border-amber-200 rounded text-xs font-bold"
                                />
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMemoId(null)}
                                    className="px-2 py-0.5 text-[11px] text-slate-500 rounded hover:bg-slate-100 cursor-pointer"
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateMemo(memo.id)}
                                    className="px-2 py-0.5 text-[11px] font-bold text-white bg-amber-500 rounded hover:bg-amber-600 cursor-pointer"
                                  >
                                    保存
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={memo.id} className={`py-2.5 space-y-1 ${memo.is_resolved ? 'opacity-50' : ''}`}>
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[11px] font-bold text-amber-800">{memo.date}</span>
                              {memo.amount !== 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                  memo.amount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {memo.amount > 0 ? `+${memo.amount.toLocaleString()}` : memo.amount.toLocaleString()}円
                                </span>
                              )}
                              {memo.is_resolved && (
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded-full">
                                  精算済
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-700 leading-snug break-words">{memo.content}</p>
                            <div className="flex items-center gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => handleEditMemoStart(memo)}
                                className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer"
                              >
                                編集
                              </button>
                              <span className="text-slate-300">|</span>
                              {memo.is_resolved ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnresolveMemo(memo.id)}
                                  className="text-[10px] font-bold text-amber-600 hover:text-amber-800 cursor-pointer"
                                >
                                  未精算に戻す
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleResolveMemo(memo.id)}
                                  className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 cursor-pointer"
                                >
                                  解決済みにする
                                </button>
                              )}
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteMemo(memo.id)}
                                className="text-[10px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {memos.filter(m => showResolved || !m.is_resolved).length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">メモはありません</div>
                    )}
                  </div>
                </div>

                {/* 3. 在籍状況カード */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="text-base">🏷️</span>
                    <h3 className="font-bold text-slate-800 text-sm">在籍状況</h3>
                  </div>
                  <p className="text-xs text-slate-400">セラピストの在籍・退店状態を切り替えます。</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, is_active: true })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 font-bold text-xs transition-all cursor-pointer ${
                        profile.is_active
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${profile.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      在籍中
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, is_active: false })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 font-bold text-xs transition-all cursor-pointer ${
                        !profile.is_active
                          ? 'border-rose-400 bg-rose-50 text-rose-700'
                          : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${!profile.is_active ? 'bg-rose-400' : 'bg-slate-300'}`}></span>
                      退店
                    </button>
                  </div>

                  {!profile.is_active && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs flex items-start gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="leading-snug">退店に設定すると、全店舗で非表示となり、HP・一覧・シフトから除外されます。</span>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* 外部連携専用タブ */}
          {/* ========================================================= */}
          {activeTab === 'integrations' && (
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                  🌐
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">外部ポータルサイトへのプロフィール送信</h2>
                  <p className="text-xs text-slate-400">エステ魂・メンズエステランキング・エステラブへ最新情報を送信します。</p>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2.5">
                <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>ポータルサイト連携について</span>
                </h3>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  現在yoyaklに保存されているこのセラピストのプロフィール（写真・名前・スペック・コメント等）を外部ポータルサイトに送信します。
                  未登録の場合は新規登録され、登録済みの場合は情報が最新の内容で上書き更新されます。
                </p>
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl font-bold border border-amber-200">
                  ⚠️ 内容を変更した場合は、送信する前に必ず「更新する」ボタンで保存してから送信してください。
                </p>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={handleSyncToPortals}
                  disabled={syncingPortals || loading}
                  className="flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all font-bold text-sm disabled:opacity-50 cursor-pointer"
                >
                  {syncingPortals ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>ポータルサイトへ送信中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>外部サイトへプロフィールを送信する</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>

      {/* 画面下部 フローティング保存アクションバー */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-bold text-slate-700">{profile.name || "セラピスト"}</span>
            <span>のプロフィール編集中</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/therapists"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </Link>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-6 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>更新する</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
