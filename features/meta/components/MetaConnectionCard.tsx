"use client"

import { useState } from "react"
import { RefreshCw, Trash2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"

interface MetaConnection {
  id: string
  adAccountId: string
  pageId?: string | null
  pixelId?: string | null
  updatedAt: string
}

interface Props {
  connection: MetaConnection | null
  onConnect: () => void
}

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
      Conectat
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF9EC] text-[#92400E] border border-[#FDE68A]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
      Neconectat
    </span>
  )
}

export function MetaConnectionCard({ connection, onConnect }: Props) {
  const [token, setToken] = useState("")
  const [adAccountId, setAdAccountId] = useState("")
  const [pageId, setPageId] = useState("")
  const [pixelId, setPixelId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/meta/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token, adAccountId, pageId, pixelId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Eroare necunoscută")
      onConnect()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare")
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm("Ești sigur că vrei să deconectezi Meta?")) return
    await fetch("/api/meta/connect", { method: "DELETE" })
    onConnect()
  }

  async function handleSync() {
    setSyncLoading(true)
    await fetch("/api/meta/sync", { method: "POST" })
    setSyncLoading(false)
    onConnect()
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#1C1917]">Meta Ads</span>
        </div>
        <StatusBadge connected={!!connection} />
      </div>

      <div className="p-5">
        {connection ? (
          /* CONNECTED STATE */
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-[#F5F5F4] rounded-full border border-[#E7E5E4] text-xs font-mono text-[#78716C]">
                {connection.adAccountId}
              </span>
              {connection.pageId && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-[#F5F5F4] text-[#78716C] rounded border border-[#E7E5E4]">
                  Page: {connection.pageId}
                </span>
              )}
              {connection.pixelId && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-[#F5F5F4] text-[#78716C] rounded border border-[#E7E5E4]">
                  Pixel: {connection.pixelId}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-[#78716C]">
              <span>Ultima actualizare: {new Date(connection.updatedAt).toLocaleDateString("ro-RO")}</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="inline-flex items-center gap-2 px-4 h-9 bg-[#F5F5F4] border border-[#E7E5E4] rounded-lg text-sm font-medium text-[#1C1917] hover:bg-[#E7E5E4] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? "animate-spin" : ""}`} />
                {syncLoading ? "Se sincronizează..." : "Sincronizează acum"}
              </button>
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-2 px-4 h-9 border border-[#FECACA] rounded-lg text-sm font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Deconectează
              </button>
            </div>
          </div>
        ) : (
          /* DISCONNECTED STATE */
          <div className="space-y-4">
            <p className="text-sm text-[#78716C]">
              Conectează contul Meta pentru a sincroniza campanii și metrici de performanță.
            </p>

            <button
              onClick={() => setGuideOpen(!guideOpen)}
              className="flex items-center gap-1.5 text-sm text-[#D4AF37] hover:text-[#B8971F] font-medium transition-colors"
            >
              {guideOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Cum obții token-ul System User?
            </button>

            {guideOpen && (
              <div className="bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg p-4 text-sm text-[#78716C] space-y-2">
                <p>1. <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-[#1877F2] underline">developers.facebook.com</a> → My Apps → Create App (tip: Business)</p>
                <p>2. Add Product → Marketing API → Set Up</p>
                <p>3. <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" className="text-[#1877F2] underline">business.facebook.com/settings</a> → Users → System Users → Add (rol: Admin)</p>
                <p>4. Acordă acces System User-ului la Ad Account.</p>
                <p>5. Generate New Token → bifează: ads_management, ads_read, read_insights → Expiry: Never</p>
                <p>6. Copiază token-ul și Ad Account ID (format: <span className="font-mono">act_XXXXXXX</span>)</p>
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#78716C] block mb-1.5">System User Token *</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Lipește token-ul aici..."
                  required
                  className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#78716C] block mb-1.5">Ad Account ID *</label>
                  <input
                    value={adAccountId}
                    onChange={(e) => setAdAccountId(e.target.value)}
                    placeholder="act_123456789"
                    required
                    className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#78716C] block mb-1.5">Facebook Page ID (opțional)</label>
                  <input
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="123456789012345"
                    className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#78716C] block mb-1.5">Pixel ID (opțional)</label>
                <input
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  placeholder="1234567890123456"
                  className="w-full h-10 px-3 bg-white border border-[#E7E5E4] rounded-lg text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-colors"
                />
              </div>

              {error && (
                <p className="flex items-center gap-1.5 px-3 py-2 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-sm text-[#DC2626]">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 h-9 bg-[#D4AF37] hover:bg-[#B8971F] text-[#1C1917] font-semibold text-sm rounded-lg transition-colors disabled:opacity-60"
                >
                  {loading ? "Se verifică..." : "Conectează Meta"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
