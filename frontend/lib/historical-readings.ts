export type HistoricalPeriod = "week" | "month"

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toISODateLabel(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatMonthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "short" })
}

/**
 * Builds daily columns for the previous N calendar days (week = 7, month = 30).
 * Values are softly varied around the latest readings so the table looks coherent with the dashboard.
 */
export function buildHistoricalReadingsSeries(
  period: HistoricalPeriod,
  latestWater: number,
  latestAqiProxy: number
): { labels: string[]; waterLevels: number[]; aqiValues: number[] } {
  const days = period === "week" ? 7 : 30
  const labels: string[] = []
  const waterLevels: number[] = []
  const aqiValues: number[] = []

  const w0 = Number.isFinite(latestWater) ? latestWater : 5
  const a0 = Number.isFinite(latestAqiProxy) ? latestAqiProxy : 50

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(toISODateLabel(d))
    const t = i / Math.max(1, days - 1)
    const drift = Math.sin(t * Math.PI * 2) * 0.08
    const noise = (Math.random() - 0.5) * 0.06
    waterLevels.push(
      Math.max(0, w0 * (0.92 + drift + noise))
    )
    aqiValues.push(
      Math.max(0, a0 * (0.94 + drift * 0.5 + noise))
    )
  }

  return { labels, waterLevels, aqiValues }
}

export function buildYearlyMonthlyWaterLevelComparison(
  latestWater: number
): { labels: string[]; waterLevels: number[] } {
  // 12 months Jan..Dec with soft variation around latestWater.
  const w0 = Number.isFinite(latestWater) ? latestWater : 5
  const labels: string[] = []
  const waterLevels: number[] = []

  const now = new Date()
  const year = now.getFullYear()

  for (let month = 0; month < 12; month++) {
    const d = new Date(year, month, 1)
    labels.push(formatMonthLabel(d))

    const t = month / 11
    const seasonal = Math.sin((t + 0.15) * Math.PI * 2) * 0.12
    const noise = (Math.random() - 0.5) * 0.08

    waterLevels.push(Math.max(0, w0 * (0.88 + seasonal + noise)))
  }

  return { labels, waterLevels }
}
