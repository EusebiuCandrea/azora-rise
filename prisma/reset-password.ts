import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('Usage: npx ts-node prisma/reset-password.ts <email> <password>')
    process.exit(1)
  }

  const hash = await bcrypt.hash(password, 12)
  const u = await db.user.update({
    where: { email },
    data: { password: hash },
  })
  console.log('Password reset for:', u.email)
}

main().finally(() => db.$disconnect())
