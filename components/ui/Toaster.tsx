'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

// ─── Provider + Renderer ────────────────────────────────────────────────────

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }])
    // Auto-dismiss: success and info after 4s, errors after 7s
    const delay = opts.type === 'error' ? 7000 : 4000
    const timer = setTimeout(() => dismiss(id), delay)
    timers.current.set(id, timer)
  }, [dismiss])

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout)
  }, [])

  const CONFIG = {
    success: {
      bar: 'bg-[#16A34A]',
      icon: <CheckCircle2 className="w-4 h-4 text-[#16A34A]" strokeWidth={1.5} />,
    },
    error: {
      bar: 'bg-[#DC2626]',
      icon: <AlertCircle className="w-4 h-4 text-[#DC2626]" strokeWidth={1.5} />,
    },
    info: {
      bar: 'bg-[#D4AF37]',
      icon: <Info className="w-4 h-4 text-[#D4AF37]" strokeWidth={1.5} />,
    },
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container — bottom right */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map((t) => {
          const c = CONFIG[t.type]
          return (
            <div
              key={t.id}
              className="bg-white border border-[#E7E5E4] rounded-xl shadow-lg flex overflow-hidden pointer-events-auto animate-in slide-in-from-right-4 fade-in duration-200"
            >
              <div className={`w-1 flex-shrink-0 ${c.bar}`} />
              <div className="flex-1 px-4 py-3 flex items-start gap-3">
                {c.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1C1917]">{t.title}</p>
                  {t.description && (
                    <p className="text-xs text-[#78716C] mt-0.5">{t.description}</p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-[#78716C] hover:text-[#1C1917] transition-colors flex-shrink-0 mt-0.5"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
