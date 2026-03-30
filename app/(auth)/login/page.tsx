'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Email sau parolă incorectă.')
    } else {
      router.push('/products')
      router.refresh()
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#FAFAF9]"
      style={{
        backgroundImage: `repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 20px,
          rgba(0,0,0,0.015) 20px,
          rgba(0,0,0,0.015) 21px
        )`,
      }}
    >
      {/* Soft color blobs */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-64 h-64 bg-[#D4AF37]/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-[460px] mx-4">
        <div className="bg-white border border-[#E7E5E4] rounded-2xl shadow-lg overflow-hidden">
          {/* Logo */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-[#E7E5E4]">
            <div className="flex items-baseline justify-center gap-1.5 mb-0">
              <span className="text-[28px] font-bold text-[#1C1917] tracking-tight">Rise</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mb-0.5" />
              <span className="text-sm text-[#78716C]">by Azora</span>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-[#1C1917]">Bun venit înapoi</h1>
              <p className="text-sm text-[#78716C] mt-1">Intră în contul tău Azora</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#78716C] uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nume@exemplu.ro"
                  required
                  autoComplete="email"
                  className="w-full h-10 px-3 bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#78716C] uppercase tracking-wide">
                  Parolă
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full h-10 px-3 pr-10 bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-[#292524] hover:bg-[#44403C] text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'Se autentifică...' : 'Intră în cont'}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-[#78716C]">Platformă privată · Azora SRL</p>
          </div>
        </div>
      </div>
    </div>
  )
}
