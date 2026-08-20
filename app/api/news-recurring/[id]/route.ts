import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: 'active' | 'paused' };

  if (status !== 'active' && status !== 'paused') {
    return NextResponse.json({ error: 'status は active か paused を指定してください' }, { status: 400 });
  }

  const { error } = await supabase
    .from('news_recurring_rules')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('News recurring rule update error:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await supabase
    .from('news_recurring_rules')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('News recurring rule delete error:', error);
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
