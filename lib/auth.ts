import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12), // min 12 chars (NIST SP 800-63B)
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      async authorize(credentials) {
        const result = loginSchema.safeParse(credentials)
        if (!result.success) return null // safeParse, nu parse — nu aruncă ZodError
        const { email, password } = result.data
        const user = await db.user.findUnique({ where: { email } })
        if (!user) return null
        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return null
        // Resolve organizationId la login — stocăm în JWT
        const membership = await db.organizationMember.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' }, // deterministic ordering
        })
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: membership?.organizationId ?? null,
        }
      }
    })
  ],
  pages: { signIn: "/login", error: "/error" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.organizationId = (user as any).organizationId
      }
      return token
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      if (token.organizationId) (session as any).organizationId = token.organizationId as string
      return session
    }
  }
})
