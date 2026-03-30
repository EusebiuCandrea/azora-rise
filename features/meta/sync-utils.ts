const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      return withRetry(fn, retries - 1)
    }
    throw error
  }
}

export function logSyncEvent(
  organizationId: string,
  type: "CAMPAIGNS" | "METRICS",
  status: "SUCCESS" | "PARTIAL" | "FAILED",
  details: object
) {
  console.log(`[Meta Sync] ${type} ${status}`, {
    organizationId,
    timestamp: new Date().toISOString(),
    ...details,
  })
}
