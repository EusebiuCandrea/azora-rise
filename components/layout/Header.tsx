import { Bell, HelpCircle, RefreshCw, Search } from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
  userEmail?: string
}

export function Header({ userEmail }: HeaderProps) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'AZ'

  return (
    <header className="h-14 border-b border-[#E7E5E4] bg-white flex items-center gap-4 px-6 flex-shrink-0">
      {/* Search bar */}
      <div className="flex-1 max-w-xs relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#78716C]"
          strokeWidth={1.5}
        />
        <input
          type="text"
          placeholder="Caută în produs..."
          className="w-full h-9 pl-9 pr-3 bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sync chip */}
      <Link
        href="/settings"
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F5F4] border border-[#E7E5E4] rounded-full text-xs text-[#78716C] hover:border-[#D4AF37] hover:text-[#1C1917] transition-colors"
      >
        <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
        Sincronizează Shopify
      </Link>

      {/* Icon actions */}
      <div className="flex items-center gap-1">
        <button className="p-2 rounded-lg text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917] transition-colors">
          <Bell className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button className="p-2 rounded-lg text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917] transition-colors">
          <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
        </button>
        {/* Profile avatar */}
        <button className="w-8 h-8 rounded-full bg-[#D4AF37] flex items-center justify-center ml-1">
          <span className="text-xs font-bold text-[#1C1917]">{initials}</span>
        </button>
      </div>
    </header>
  )
}
