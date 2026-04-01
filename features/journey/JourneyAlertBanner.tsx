import { AlertTriangle } from 'lucide-react'

interface JourneyAlertBannerProps {
  message: string
}

export function JourneyAlertBanner({ message }: JourneyAlertBannerProps) {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={1.5} />
      <p className="text-sm text-red-800 font-medium">
        <span className="font-bold">Alertă Conversie:</span> {message}
      </p>
    </div>
  )
}
