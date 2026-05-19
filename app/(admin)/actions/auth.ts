'use server'

import bcrypt from 'bcryptjs'

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}
