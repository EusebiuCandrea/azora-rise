import { requireAuth } from '@/features/auth/helpers'
import { JourneyPageClient } from '@/features/journey/JourneyPageClient'

export default async function JourneyPage() {
  await requireAuth()
  return <JourneyPageClient />
}
