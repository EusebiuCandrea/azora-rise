import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const seedPassword = process.env.SEED_PASSWORD
  if (!seedPassword) {
    throw new Error('SEED_PASSWORD env var is required')
  }
  if (seedPassword.length < 12) {
    throw new Error(`SEED_PASSWORD must be at least 12 characters (got ${seedPassword.length})`)
  }

  const hashedPassword = await bcrypt.hash(seedPassword, 12)

  const user = await db.user.upsert({
    where: { email: 'eusebiu@azora.ro' },
    update: {},
    create: {
      email: 'eusebiu@azora.ro',
      name: 'Eusebiu',
      password: hashedPassword,
    },
  })

  const org = await db.organization.upsert({
    where: { slug: 'azora' },
    update: {},
    create: {
      name: 'Azora',
      slug: 'azora',
      incomeTaxType: 'MICRO_1',
      shopifyFeeRate: 0.02,
    },
  })

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: {},
    create: {
      organizationId: org.id,
      userId: user.id,
      role: 'OWNER',
    },
  })

  console.log(`✅ Seeded: user ${user.email} + org ${org.name}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
