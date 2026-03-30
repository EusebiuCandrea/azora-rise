"use client"

import { Bell } from "lucide-react"
import { useAlerts } from "@/features/meta/hooks/useAlerts"

const ALERT_LABELS: Record<string, string> = {
  ROAS_LOW:       "ROAS scăzut",
  SPEND_EXCEEDED: "Spend depășit",
  CTR_LOW:        "CTR mic",
  CPM_HIGH:       "CPM ridicat",
  AUTO_PAUSED:    "Oprită automat",
  LEARNING_PHASE: "Learning phase",
  BUDGET_ENDING:  "Buget pe terminate",
}

export function AlertsBadge() {
  const { data } = useAlerts()
  const unread = data?.alerts?.filter((a: any) => !a.isRead).length ?? 0

  if (unread === 0) return null

  return (
    <span className="relative inline-flex">
      <Bell className="w-5 h-5 text-[#78716C]" />
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
        {unread > 9 ? "9+" : unread}
      </span>
    </span>
  )
}

export function AlertsPanel() {
  const { data } = useAlerts()
  const alerts: any[] = data?.alerts ?? []

  return (
    <div className="space-y-2">
      {alerts.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#78716C]">Nicio alertă activă</p>
      ) : (
        alerts.map((alert: any) => (
          <div key={alert.id} className="flex items-start gap-3 rounded-xl border border-[#E7E5E4] bg-white p-3 shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#D4AF37] font-medium">{ALERT_LABELS[alert.type] ?? alert.type}</p>
              <p className="mt-0.5 text-sm text-[#1C1917]">{alert.campaign?.name}</p>
              <p className="mt-0.5 text-xs text-[#78716C]">{alert.message}</p>
            </div>
            <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${alert.isRead ? "bg-[#C4C0BA]" : "bg-[#DC2626]"}`} />
          </div>
        ))
      )}
    </div>
  )
}
