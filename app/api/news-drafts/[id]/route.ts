import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: draft, error: fetchError } = await supabase
    .from('news_drafts')
    .select('id, status')
    .eq('id', id)
    .single();

  if (fetchError || !draft) {
    return NextResponse.json({ error: '予約投稿が見つかりません' }, { status: 404 });
  }
  if (draft.status !== 'pending') {
    return NextResponse.json({ error: 'すでに送信済み、または取り消し済みのため変更できません' }, { status: 400 });
  }

  const { error } = await supabase
    .from('news_drafts')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    console.error('News draft cancel error:', error);
    return NextResponse.json({ error: '取り消しに失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
