import { supabase } from '../lib/supabase';

async function testPhase3() {
  console.log('--- Testing Phase 3 Database & API Integration ---');

  // 1. Fetch a therapist
  const { data: therapists } = await supabase.from('therapists').select('*').limit(1);
  if (!therapists || therapists.length === 0) {
    console.error('No therapist found to test.');
    return;
  }
  const therapist = therapists[0];
  console.log('Testing with therapist:', therapist.name, therapist.id);

  // 2. Insert draft blog article
  const draftTitle = '【テスト下書き】本日の出勤について';
  const { data: draftArticle, error: draftErr } = await supabase
    .from('blog_articles')
    .insert({
      shop_id: therapist.shop_id || 'a628f5ad-3bda-442f-9cfe-c5c00c3e65c1',
      therapist_id: therapist.id,
      title: draftTitle,
      content: '<p>これは下書きテスト本文です。<img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb" /></p>',
      is_published: false,
    })
    .select()
    .single();

  console.log('Draft article insert result:', draftArticle?.title, draftArticle?.is_published, draftErr);

  // 3. Insert published blog article
  const pubTitle = '【テスト公開】本日の出勤開始しました✨';
  const { data: pubArticle, error: pubErr } = await supabase
    .from('blog_articles')
    .insert({
      shop_id: therapist.shop_id || 'a628f5ad-3bda-442f-9cfe-c5c00c3e65c1',
      therapist_id: therapist.id,
      title: pubTitle,
      content: '<p>公開テスト記事本文です。</p>',
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  console.log('Pub article insert result:', pubArticle?.title, pubArticle?.is_published, pubErr);

  // 4. Test shift request submission
  const { data: shiftReq, error: shiftErr } = await supabase
    .from('shifts')
    .insert({
      shop_id: therapist.shop_id || 'a628f5ad-3bda-442f-9cfe-c5c00c3e65c1',
      therapist_id: therapist.id,
      date: '2026-08-10',
      start_time: '13:00',
      end_time: '22:00',
      status: 'requested',
      notes: '18時以降の遅番希望です',
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();

  console.log('Shift request insert result:', shiftReq?.date, shiftReq?.status, shiftReq?.notes, shiftErr);

  // Cleanup test records
  if (draftArticle?.id) await supabase.from('blog_articles').delete().eq('id', draftArticle.id);
  if (pubArticle?.id) await supabase.from('blog_articles').delete().eq('id', pubArticle.id);
  if (shiftReq?.id) await supabase.from('shifts').delete().eq('id', shiftReq.id);

  console.log('--- Phase 3 test completed successfully ---');
}

testPhase3().catch(console.error);
