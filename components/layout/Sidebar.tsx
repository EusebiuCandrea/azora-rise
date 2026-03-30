'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Package,
  Sparkles,
  Library,
  Video,
  BarChart2,
  Settings,
  LogOut,
  Plus,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'PRINCIPAL',
    items: [{ href: '/dashboard', label: 'Panou de control', icon: LayoutDashboard }],
  },
  {
    label: 'COMENZI',
    items: [{ href: '/orders', label: 'Comenzi', icon: ShoppingBag }],
  },
  {
    label: 'PRODUSE',
    items: [
      { href: '/products', label: 'Produse', icon: Package },
      { href: '/listing', label: 'Listing AI', icon: Sparkles },
    ],
  },
  {
    label: 'VIDEO',
    items: [
      { href: '/videos/library', label: 'Biblioteca', icon: Library },
      { href: '/videos/new', label: 'Creare video', icon: Video },
    ],
  },
  {
    label: 'CAMPANII',
    items: [{ href: '/campaigns', label: 'Campanii', icon: BarChart2 }],
  },
  {
    label: 'ANALIZĂ',
    items: [{ href: '/profitability', label: 'Profitabilitate', icon: TrendingUp }],
  },
  {
    label: 'CONT',
    items: [{ href: '/settings', label: 'Setări', icon: Settings }],
  },
]

interface SidebarProps {
  userEmail?: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : 'AZ'

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-[#E7E5E4] flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#E7E5E4]">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-[#1C1917] tracking-tight">Rise</span>
          <span className="text-xs text-[#78716C]">· Azora</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#78716C]/70">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative',
                      active
                        ? 'bg-[#F5F5F4] text-[#1C1917] font-semibold'
                        : 'text-[#78716C] hover:bg-[#FAFAF9] hover:text-[#1C1917]'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#D4AF37] rounded-r-full" />
                    )}
                    <Icon
                      className={cn(
                        'w-4 h-4 flex-shrink-0',
                        active ? 'text-[#1C1917]' : 'text-[#78716C]'
                      )}
                      strokeWidth={1.5}
                    />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Add Product CTA */}
      <div className="px-3 pb-3">
        <Link
          href="/listing"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Adaugă Produs
        </Link>
      </div>

      {/* User section */}
      <div className="px-3 pb-4 pt-2 border-t border-[#E7E5E4]">
        <div className="flex items-center gap-2.5 px-2 py-2">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-[#D4AF37] flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-[#1C1917]">{initials}</span>
          </div>
          {/* Email */}
          <span className="text-xs text-[#78716C] truncate flex-1 min-w-0">
            {userEmail ?? 'eusebiu@azora.ro'}
          </span>
          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1 rounded text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5F5F4] transition-colors flex-shrink-0"
            title="Deconectare"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  )
}
