import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import type { Session } from "next-auth"

export async function getCurrentUser() {
  const session = await auth()
  return session?.user ?? null
}

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  return session as Session
}

export async function getCurrentOrgId(session?: Session | null) {
  const s = session ?? (await auth() as Session | null)
  const orgId = (s as any)?.organizationId as string | undefined
  if (!orgId) return null

  const userId = s?.user?.id
  if (!userId) return null

  // Validate user is still a member of the org
  const membership = await db.organizationMember.findFirst({
    where: { organizationId: orgId, userId },
  })

  return membership ? orgId : null
}
