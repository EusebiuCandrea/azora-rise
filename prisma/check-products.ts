import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const count = await db.product.count()
  const products = await db.product.findMany({ take: 5, select: { title: true, price: true, status: true } })
  console.log('Total products:', count)
  products.forEach(p => console.log('-', p.title, '|', p.price, '|', p.status))
}
main().finally(() => db.$disconnect())
