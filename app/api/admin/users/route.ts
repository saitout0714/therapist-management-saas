import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Supabase Admin クライアントを初期化 (管理者権限 Service Role を使用)
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET: 現在のショップに属するユーザー一覧の取得
 */
export async function GET(req: Request) {
  try {
    // 全ユーザーを所属店舗情報も含めて取得する
    const { data, error } = await serviceSupabase
      .from('users')
      .select(`
        id,
        login_id,
        name,
        role,
        created_at,
        shop_owners (
          shop_id,
          shops (
            name
          )
        )
      `)

    if (error) throw error

    const users = (data as any[])
      .map(u => {
        const shopNames = u.shop_owners
          ? u.shop_owners
              .map((so: any) => so.shops?.name)
              .filter(Boolean)
          : []

        return {
          id: u.id,
          login_id: u.login_id,
          name: u.name,
          role: u.role,
          created_at: u.created_at,
          shops: shopNames
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('ユーザー一覧取得エラー:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST: 新規スタッフ・オーナーの登録
 * (Supabase Auth のアカウントを作成し、自動トリガーで public.users に同期、さらに店舗に紐付けます)
 */
export async function POST(req: Request) {
  try {
    const { loginId, password, name, role, shopId } = await req.json()

    if (!loginId || !password || !name || !role || !shopId) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    const email = loginId.includes('@') ? loginId : `${loginId}@yoyakl.tokyo`

    // 1. ログインIDの重複チェック
    const { data: existingUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('login_id', loginId.trim())
      .limit(1)

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ error: 'このログインIDは既に登録されています' }, { status: 400 })
    }

    // 2. Supabase Auth (auth.users) にユーザーを作成
    // メタデータとして name と role を渡すことで、トリガーが自動的に同期します
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role },
    })

    if (authError) {
      throw authError
    }

    const newUser = authData.user
    if (!newUser) {
      throw new Error('ユーザーアカウントの作成に失敗しました')
    }

    // 3. shop_owners (店舗オーナー/スタッフの関連付けテーブル) に登録
    const { error: ownerError } = await serviceSupabase
      .from('shop_owners')
      .insert([{
        shop_id: shopId,
        user_id: newUser.id
      }])

    if (ownerError) {
      // 登録に失敗した場合は作成した認証ユーザーをロールバック（削除）
      await serviceSupabase.auth.admin.deleteUser(newUser.id)
      throw ownerError
    }

    return NextResponse.json({ success: true, user: { id: newUser.id, loginId, name, role } })
  } catch (error: any) {
    console.error('ユーザー登録エラー:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PUT: 既存スタッフ・オーナーの更新
 */
export async function PUT(req: Request) {
  try {
    const { userId, name, role, password } = await req.json()

    if (!userId || !name || !role) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
    }

    // 1. パスワードが入力されている場合は、Supabase Auth でパスワードを更新
    if (password) {
      const { error: passwordError } = await serviceSupabase.auth.admin.updateUserById(userId, {
        password: password,
      })
      if (passwordError) throw passwordError
    }

    // 2. メタデータの更新（Authテーブル側）
    const { error: authUpdateError } = await serviceSupabase.auth.admin.updateUserById(userId, {
      user_metadata: { name: name.trim(), role },
    })
    if (authUpdateError) throw authUpdateError

    // 3. データベース側の情報を直接更新 (トリガーは新規挿入時のみのため、更新は直接実行)
    const { error: dbUpdateError } = await serviceSupabase
      .from('users')
      .update({
        name: name.trim(),
        role: role,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (dbUpdateError) throw dbUpdateError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('ユーザー更新エラー:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE: ユーザーの削除
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }

    // 1. データベース (public.users) から削除
    // (shop_owners テーブルのレコードは ON DELETE CASCADE により自動削除されます)
    const { error: dbDeleteError } = await serviceSupabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (dbDeleteError) throw dbDeleteError

    // 2. Supabase Auth (auth.users) から削除
    const { error: authDeleteError } = await serviceSupabase.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      console.warn('Auth ユーザーの削除に失敗 (DB側は削除済):', authDeleteError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('ユーザー削除エラー:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
