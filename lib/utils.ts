import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns midnight UTC of yesterday — safe for @db.Date Prisma columns.
 */
export function getYesterdayUTC(): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - 1)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
