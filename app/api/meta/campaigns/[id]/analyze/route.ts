import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getCurrentOrgId } from "@/features/auth/helpers"
import { generateCampaignAnalysis } from "@/features/meta/ai-analysis"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  const organizationId = await getCurrentOrgId(session)
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const { id } = await params

  try {
    const report = await generateCampaignAnalysis(organizationId, id)
    return NextResponse.json(report)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscută"

    if (message.includes("503") || message.toLowerCase().includes("unavailable")) {
      return NextResponse.json(
        { error: "Serviciul Gemini AI este temporar supraîncărcat. Încearcă din nou în câteva secunde." },
        { status: 503 }
      )
    }
    if (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate")) {
      return NextResponse.json(
        { error: "Limita de cereri Gemini AI a fost atinsă. Se resetează în fiecare zi la miezul nopții (UTC)." },
        { status: 429 }
      )
    }

    console.error("[Analyze] Gemini error:", message)
    return NextResponse.json({ error: `Eroare analiză AI: ${message}` }, { status: 500 })
  }
}
