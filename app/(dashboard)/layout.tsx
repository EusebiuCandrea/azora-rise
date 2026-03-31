import { requireAuth } from '@/features/auth/helpers'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  const userEmail = session.user?.email ?? undefined

  return (
    <DashboardShell userEmail={userEmail}>
      {children}
    </DashboardShell>
  )
}
