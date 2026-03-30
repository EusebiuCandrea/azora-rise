import { requireAuth } from '@/features/auth/helpers'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({ newPassword: z.string().min(8) })

export async function POST(req: Request) {
  const session = await requireAuth()
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Parolă invalidă' }, { status: 400 })

  const user = await db.user.findUnique({ where: { email: session.user!.email! } })
  if (!user) return NextResponse.json({ error: 'Utilizator negăsit' }, { status: 404 })

  const hash = await bcrypt.hash(parsed.data.newPassword, 12)
  await db.user.update({ where: { id: user.id }, data: { password: hash } })

  return NextResponse.json({ ok: true })
}
