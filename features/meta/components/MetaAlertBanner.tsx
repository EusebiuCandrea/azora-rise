"use client"

import { AlertCircle, X } from "lucide-react"
import { useAlerts, useMarkAlertRead } from "@/features/meta/hooks/useAlerts"

const ALERT_COLORS: Record<string, string> = {
  ROAS_LOW:       "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]",
  SPEND_EXCEEDED: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  CTR_LOW:        "border-[#FDE68A] bg-[#FFFBEB] text-[#A16207]",
  CPM_HIGH:       "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]",
  AUTO_PAUSED:    "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  LEARNING_PHASE: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
  BUDGET_ENDING:  "border-[#FDE68A] bg-[#FFFBEB] text-[#A16207]",
}

export function MetaAlertBanner() {
  const { data } = useAlerts()
  const { mutate: markRead } = useMarkAlertRead()
  const alerts: any[] = data?.alerts?.filter((a: any) => !a.isRead) ?? []

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.slice(0, 3).map((alert: any) => (
        <div
          key={alert.id}
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${ALERT_COLORS[alert.type] ?? ALERT_COLORS.ROAS_LOW}`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>{alert.campaign?.name}: </strong>
              {alert.message}
            </span>
          </div>
          <button
            onClick={() => markRead(alert.id)}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
