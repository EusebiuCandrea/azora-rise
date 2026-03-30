import { requireAuth } from '@/features/auth/helpers'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAuth()
  const userEmail = session.user?.email ?? undefined

  return (
    <div className="flex min-h-screen bg-[#FAFAF9]">
      <Sidebar userEmail={userEmail} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userEmail={userEmail} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
