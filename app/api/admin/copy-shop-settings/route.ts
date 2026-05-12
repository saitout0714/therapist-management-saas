import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

type IdMap = Map<string, string>

export async function POST(req: Request) {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { sourceShopId, targetShopId } = await req.json() as { sourceShopId: string; targetShopId: string }

    if (!sourceShopId || !targetShopId) {
      return NextResponse.json({ error: 'sourceShopId と targetShopId が必要です' }, { status: 400 })
    }
    if (sourceShopId === targetShopId) {
      return NextResponse.json({ error: 'コピー元とコピー先が同じです' }, { status: 400 })
    }

    const results: string[] = []

    // 1. system_settings
    {
      const { data } = await serviceSupabase
        .from('system_settings')
        .select('*')
        .eq('shop_id', sourceShopId)
        .limit(1)

      if (data?.[0]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, shop_id, created_at, updated_at, ...fields } = data[0] as Record<string, unknown>
        const { data: existing } = await serviceSupabase
          .from('system_settings')
          .select('id')
          .eq('shop_id', targetShopId)
          .limit(1)

        if (existing?.[0]) {
          await serviceSupabase.from('system_settings')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', (existing[0] as { id: string }).id)
        } else {
          await serviceSupabase.from('system_settings')
            .insert([{ ...fields, shop_id: targetShopId }])
        }
        results.push('✅ 基本設定: コピー完了')
      } else {
        results.push('⚠️ 基本設定: ソースにデータなし')
      }
    }

    // 2. therapist_ranks — 名前マッチでupsert（セラピストのrank_id参照を壊さないため）
    const rankIdMap: IdMap = new Map()
    {
      const { data: srcRanks } = await serviceSupabase
        .from('therapist_ranks')
        .select('*')
        .eq('shop_id', sourceShopId)
        .order('display_order')

      const { data: tgtRanks } = await serviceSupabase
        .from('therapist_ranks')
        .select('*')
        .eq('shop_id', targetShopId)

      const tgtByName = new Map((tgtRanks || []).map((r: Record<string, string>) => [r.name, r]))

      for (const src of (srcRanks || [])) {
        const { id, shop_id, created_at, updated_at, ...fields } = src as Record<string, unknown>
        const existing = tgtByName.get(src.name)

        if (existing) {
          await serviceSupabase.from('therapist_ranks')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', (existing as { id: string }).id)
          rankIdMap.set(id as string, (existing as { id: string }).id)
        } else {
          const { data: newRow } = await serviceSupabase
            .from('therapist_ranks')
            .insert([{ ...fields, shop_id: targetShopId }])
            .select('id')
            .single()
          if (newRow) rankIdMap.set(id as string, (newRow as { id: string }).id)
        }
      }
      results.push(`✅ ランク設定: ${srcRanks?.length ?? 0}件コピー完了`)
    }

    // 3. courses — 名前+時間マッチでupsert（予約のcourse_id参照を壊さないため）
    const courseIdMap: IdMap = new Map()
    {
      const { data: srcCourses } = await serviceSupabase
        .from('courses')
        .select('*')
        .eq('shop_id', sourceShopId)
        .order('display_order')

      const { data: tgtCourses } = await serviceSupabase
        .from('courses')
        .select('*')
        .eq('shop_id', targetShopId)

      const tgtByKey = new Map((tgtCourses || []).map((c: Record<string, unknown>) => [`${c.name}_${c.duration}`, c]))

      for (const src of (srcCourses || [])) {
        const { id, shop_id, created_at, updated_at, ...fields } = src as Record<string, unknown>
        const key = `${src.name}_${src.duration}`
        const existing = tgtByKey.get(key)

        if (existing) {
          await serviceSupabase.from('courses')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', (existing as { id: string }).id)
          courseIdMap.set(id as string, (existing as { id: string }).id)
        } else {
          const { data: newRow } = await serviceSupabase
            .from('courses')
            .insert([{ ...fields, shop_id: targetShopId }])
            .select('id')
            .single()
          if (newRow) courseIdMap.set(id as string, (newRow as { id: string }).id)
        }
      }
      results.push(`✅ コース管理: ${srcCourses?.length ?? 0}件コピー完了`)
    }

    // 4. designation_types — slugマッチでupsert
    {
      const { data: srcDTs } = await serviceSupabase
        .from('designation_types')
        .select('*')
        .eq('shop_id', sourceShopId)
        .order('display_order')

      const { data: tgtDTs } = await serviceSupabase
        .from('designation_types')
        .select('*')
        .eq('shop_id', targetShopId)

      const tgtBySlug = new Map((tgtDTs || []).map((d: Record<string, unknown>) => [d.slug, d]))

      for (const src of (srcDTs || [])) {
        const { id, shop_id, created_at, updated_at, ...fields } = src as Record<string, unknown>
        const existing = tgtBySlug.get(src.slug)

        if (existing) {
          await serviceSupabase.from('designation_types')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', (existing as { id: string }).id)
        } else {
          await serviceSupabase.from('designation_types')
            .insert([{ ...fields, shop_id: targetShopId }])
        }
      }
      results.push(`✅ 指名種別: ${srcDTs?.length ?? 0}件コピー完了`)
    }

    // 5. options — 名前マッチでupsert
    {
      const { data: srcOptions } = await serviceSupabase
        .from('options')
        .select('*')
        .eq('shop_id', sourceShopId)
        .order('display_order')

      const { data: tgtOptions } = await serviceSupabase
        .from('options')
        .select('*')
        .eq('shop_id', targetShopId)

      const tgtByName = new Map((tgtOptions || []).map((o: Record<string, unknown>) => [o.name, o]))

      for (const src of (srcOptions || [])) {
        const { id, shop_id, created_at, updated_at, ...fields } = src as Record<string, unknown>
        const existing = tgtByName.get(src.name)

        if (existing) {
          await serviceSupabase.from('options')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', (existing as { id: string }).id)
        } else {
          await serviceSupabase.from('options')
            .insert([{ ...fields, shop_id: targetShopId }])
        }
      }
      results.push(`✅ オプション管理: ${srcOptions?.length ?? 0}件コピー完了`)
    }

    // 6. discount_policies — 名前マッチでupsert
    const discountIdMap: IdMap = new Map()
    {
      const { data: srcPolicies } = await serviceSupabase
        .from('discount_policies')
        .select('*')
        .eq('shop_id', sourceShopId)

      const { data: tgtPolicies } = await serviceSupabase
        .from('discount_policies')
        .select('*')
        .eq('shop_id', targetShopId)

      const tgtByName = new Map((tgtPolicies || []).map((p: Record<string, unknown>) => [p.name, p]))

      for (const src of (srcPolicies || [])) {
        const { id, shop_id, created_at, updated_at, ...fields } = src as Record<string, unknown>
        const existing = tgtByName.get(src.name)

        if (existing) {
          await serviceSupabase.from('discount_policies')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', (existing as { id: string }).id)
          discountIdMap.set(id as string, (existing as { id: string }).id)
        } else {
          const { data: newRow } = await serviceSupabase
            .from('discount_policies')
            .insert([{ ...fields, shop_id: targetShopId }])
            .select('id')
            .single()
          if (newRow) discountIdMap.set(id as string, (newRow as { id: string }).id)
        }
      }
      results.push(`✅ 割引ルール: ${srcPolicies?.length ?? 0}件コピー完了`)
    }

    // 7. deduction_rules — 名前マッチでupsert
    {
      const { data: srcRules } = await serviceSupabase
        .from('deduction_rules')
        .select('*')
        .eq('shop_id', sourceShopId)

      const { data: tgtRules } = await serviceSupabase
        .from('deduction_rules')
        .select('*')
        .eq('shop_id', targetShopId)

      const tgtByName = new Map((tgtRules || []).map((r: Record<string, unknown>) => [r.name, r]))

      for (const src of (srcRules || [])) {
        const { id, shop_id, created_at, updated_at, ...fields } = src as Record<string, unknown>
        const existing = tgtByName.get(src.name)

        if (existing) {
          await serviceSupabase.from('deduction_rules')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', (existing as { id: string }).id)
        } else {
          await serviceSupabase.from('deduction_rules')
            .insert([{ ...fields, shop_id: targetShopId }])
        }
      }
      results.push(`✅ 控除・手当: ${srcRules?.length ?? 0}件コピー完了`)
    }

    // 8. course_back_amounts — 全削除して再作成（純粋な設定データ）
    {
      await serviceSupabase.from('course_back_amounts').delete().eq('shop_id', targetShopId)

      const { data: srcAmounts } = await serviceSupabase
        .from('course_back_amounts')
        .select('*')
        .eq('shop_id', sourceShopId)

      let copied = 0
      const inserts = []
      for (const src of (srcAmounts || [])) {
        const { id, shop_id, created_at, updated_at, course_id, rank_id, ...fields } = src as Record<string, unknown>
        const newCourseId = course_id ? courseIdMap.get(course_id as string) : null
        const newRankId = rank_id ? rankIdMap.get(rank_id as string) : null

        if (newCourseId) {
          inserts.push({ ...fields, shop_id: targetShopId, course_id: newCourseId, rank_id: newRankId ?? null })
          copied++
        }
      }
      if (inserts.length > 0) {
        await serviceSupabase.from('course_back_amounts').insert(inserts)
      }
      results.push(`✅ ランク別料金バック: ${copied}件コピー完了`)
    }

    // 9. extension_rank_prices — 全削除して再作成
    {
      await serviceSupabase.from('extension_rank_prices').delete().eq('shop_id', targetShopId)

      const { data: srcExtPrices } = await serviceSupabase
        .from('extension_rank_prices')
        .select('*')
        .eq('shop_id', sourceShopId)

      let copied = 0
      const inserts = []
      for (const src of (srcExtPrices || [])) {
        const { id, shop_id, created_at, updated_at, rank_id, ...fields } = src as Record<string, unknown>
        const newRankId = rankIdMap.get(rank_id as string)
        if (newRankId) {
          inserts.push({ ...fields, shop_id: targetShopId, rank_id: newRankId })
          copied++
        }
      }
      if (inserts.length > 0) {
        await serviceSupabase.from('extension_rank_prices').insert(inserts)
      }
      results.push(`✅ 延長ランク料金: ${copied}件コピー完了`)
    }

    // 10. discount_rank_overrides — 全削除して再作成
    {
      await serviceSupabase.from('discount_rank_overrides').delete().eq('shop_id', targetShopId)

      const { data: srcOverrides } = await serviceSupabase
        .from('discount_rank_overrides')
        .select('*')
        .eq('shop_id', sourceShopId)

      let copied = 0
      const inserts = []
      for (const src of (srcOverrides || [])) {
        const { id, shop_id, created_at, updated_at, discount_policy_id, rank_id, ...fields } = src as Record<string, unknown>
        const newPolicyId = discountIdMap.get(discount_policy_id as string)
        const newRankId = rankIdMap.get(rank_id as string)
        if (newPolicyId && newRankId) {
          inserts.push({ ...fields, shop_id: targetShopId, discount_policy_id: newPolicyId, rank_id: newRankId })
          copied++
        }
      }
      if (inserts.length > 0) {
        await serviceSupabase.from('discount_rank_overrides').insert(inserts)
      }
      results.push(`✅ 割引ランク負担額: ${copied}件コピー完了`)
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('コピーエラー:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
