import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('Azora2026Rise!', 12)
  const u = await db.user.update({
    where: { email: 'eusebiu@azora.ro' },
    data: { password: hash },
  })
  console.log('Password reset for:', u.email)
}

main().finally(() => db.$disconnect())
