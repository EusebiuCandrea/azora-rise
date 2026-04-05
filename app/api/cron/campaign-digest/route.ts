import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateDailyDigest } from "@/features/meta/ai-analysis"

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const organizations = await db.organization.findMany({
    where: { metaConnection: { isNot: null } },
    select: { id: true },
  })

  const results = await Promise.allSettled(
    organizations.map((org) => generateDailyDigest(org.id))
  )

  const succeeded = results.filter((r) => r.status === "fulfilled").length
  const failed = results.filter((r) => r.status === "rejected").length

  return NextResponse.json({ succeeded, failed, total: organizations.length })
}
