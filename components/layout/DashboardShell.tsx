'use client'

import { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface Props {
  userEmail?: string
  children: React.ReactNode
}

export function DashboardShell({ userEmail, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const close = useCallback(() => setMobileOpen(false), [])
  const toggle = useCallback(() => setMobileOpen((v) => !v), [])

  return (
    <div className="flex min-h-screen bg-[#FAFAF9]">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}

      <Sidebar userEmail={userEmail} mobileOpen={mobileOpen} onClose={close} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userEmail={userEmail} onMenuToggle={toggle} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
