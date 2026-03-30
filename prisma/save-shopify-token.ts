import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { PrismaClient } from '@prisma/client'
import { createCipheriv, randomBytes } from 'crypto'

const db = new PrismaClient()

function encrypt(plaintext: string): string {
  const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'base64')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

async function main() {
  const org = await db.organization.findFirst({ where: { slug: 'azora' } })
  if (!org) throw new Error('Organization not found')

  const accessToken = process.argv[2]
  const shopDomain = process.argv[3] ?? 'your-store.myshopify.com'
  if (!accessToken) {
    throw new Error('Usage: tsx prisma/save-shopify-token.ts <shopify_access_token> [shop_domain]')
  }
  const webhookSecret = randomBytes(32).toString('hex')

  await db.shopifyConnection.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      shopDomain,
      accessTokenEncrypted: encrypt(accessToken),
      webhookSecret,
    },
    update: {
      shopDomain,
      accessTokenEncrypted: encrypt(accessToken),
      webhookSecret,
    },
  })

  console.log('✅ Shopify connection saved for', shopDomain)
}

main().catch(console.error).finally(() => db.$disconnect())
