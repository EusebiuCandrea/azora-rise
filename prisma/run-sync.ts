import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '@prisma/client'
import { syncProducts } from '../features/shopify/sync'

const db = new PrismaClient()

async function main() {
  const org = await db.organization.findFirst({ where: { slug: 'azora' } })
  if (!org) throw new Error('Organization not found')
  console.log('Starting sync for org:', org.id)
  await syncProducts(org.id)
  console.log('✅ Sync complete')
}

main().catch(console.error).finally(() => db.$disconnect())
