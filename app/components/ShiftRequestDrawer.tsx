'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';

interface ShiftRequestItem {
  id: string;
  therapist_id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
  therapists: { name: string } | null;
}

export default function ShiftRequestDrawer({ onRefresh }: { onRefresh?: () => void }) {
  const { selectedShop } = useShop();
  const [requests, setRequests] = useState<ShiftRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedShop) return;
    fetchData();
  }, [selectedShop]);

  const fetchData = async () => {
    if (!selectedShop) return;
    setLoading(true);
    try {
      const { data: reqData } = await supabase
        .from('shifts')
        .select('*, therapists(name)')
        .eq('shop_id', selectedShop.id)
        .is('room_id', null)
        .order('date', { ascending: true });

      setRequests(reqData || []);
    } catch (err) {
      console.error('Error fetching shift requests:', err);
    } finally {
      setLoading(false);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="mb-4 bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-amber-500/10 border border-amber-400/40 rounded-xl px-4 py-2.5 shadow-sm text-slate-800 font-sans flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5 flex-wrap">
          <span>📩 セラピスト出勤希望:</span>
          <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300 font-extrabold">
            {requests.length} 件
          </span>
          <span className="text-amber-800 font-normal hidden sm:inline">
            (下部カレンダーの「⚠️部屋割り未確定」セルをクリックして部屋割り・承認を行ってください)
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={fetchData}
        className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline flex-shrink-0"
      >
        🔄 更新
      </button>
    </div>
  );
}
