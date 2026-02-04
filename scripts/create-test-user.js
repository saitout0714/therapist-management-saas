import bcrypt from 'bcryptjs'

// テスト用管理者ユーザーをコンソールに出力

async function createTestUser() {
  const password = 'admin123'
  const hashedPassword = await bcrypt.hash(password, 10)

  console.log('=== テスト用ユーザー ===')
  console.log('メールアドレス: admin@example.com')
  console.log('パスワード:', password)
  console.log('ハッシュ化済みパスワード:')
  console.log(hashedPassword)
  console.log('\n以下のSQLをSupabaseで実行してください:')
  console.log(`
INSERT INTO users (email, password_hash, role) 
VALUES ('admin@example.com', '${hashedPassword}', 'admin');
  `)
}

createTestUser()
