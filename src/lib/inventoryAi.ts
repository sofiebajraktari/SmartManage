export type AiRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface AiProductCandidate {
  productId: string
  name: string
  supplierName: string
  dailySeries: number[]
  defaultOrderQty?: number
  lastFinalQty?: number
  addedCount?: number
  urgentNow?: boolean
}

export interface AiDemandForecast {
  forecastPerDay: number
  forecastNext7Days: number
  recommendedQty: number
  confidence: number
  riskScore: number
  anomalyScore: number
  riskLevel: AiRiskLevel
  reason: string
}

export interface AiPriorityProduct {
  productId: string
  name: string
  supplierName: string
  forecastNext7Days: number
  recommendedQty: number
  confidence: number
  riskScore: number
  anomalyScore: number
  riskLevel: AiRiskLevel
  reason: string
}

export interface AiOverview {
  predictedNext7Days: number
  averageConfidence: number
  anomalyScore: number
  anomalyLevel: AiRiskLevel
  summary: string
  action: string
  topRiskProducts: AiPriorityProduct[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return sum(values) / values.length
}

function stdDev(values: number[]): number {
  if (!values.length) return 0
  const avg = mean(values)
  const variance = mean(values.map((value) => (value - avg) ** 2))
  return Math.sqrt(variance)
}

function weightedMean(values: number[]): number {
  if (!values.length) return 0
  let totalWeight = 0
  let weightedTotal = 0
  values.forEach((value, index) => {
    const weight = index + 1
    totalWeight += weight
    weightedTotal += value * weight
  })
  return totalWeight > 0 ? weightedTotal / totalWeight : 0
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10
}

function toRiskLevel(score: number): AiRiskLevel {
  if (score >= 70) return 'HIGH'
  if (score >= 45) return 'MEDIUM'
  return 'LOW'
}

function buildReason(input: {
  trendRatio: number
  urgentNow: boolean
  anomalyScore: number
  coverage: number
  forecastPerDay: number
}): string {
  const parts: string[] = []
  if (input.urgentNow) parts.push('Urgjence aktive')
  if (input.trendRatio >= 1.2) parts.push('trend ne rritje')
  if (input.anomalyScore >= 60) parts.push('sjellje anormale ne ditet e fundit')
  if (parts.length === 0 && input.coverage < 0.2) parts.push('pak histori, rekomandim konservativ')
  if (parts.length === 0 && input.forecastPerDay >= 1) parts.push('kerkese e qendrueshme')
  if (parts.length === 0) parts.push('presion i ulet mbi stokun')
  return parts.slice(0, 2).join(', ')
}

export function forecastProductDemand(input: AiProductCandidate): AiDemandForecast {
  const series = input.dailySeries.map((value) => Math.max(0, Number(value) || 0))
  const recent14 = series.slice(-14)
  const recent7 = series.slice(-7)
  const previous7 = series.slice(-14, -7)
  const recent3 = series.slice(-3)

  const total = sum(series)
  const nonZeroDays = series.filter((value) => value > 0).length
  const coverage = nonZeroDays / Math.max(series.length, 1)
  const recentAvg = mean(recent7)
  const previousAvg = mean(previous7)
  const smoothedRecent = weightedMean(recent14.length ? recent14 : series)
  const trendRatio =
    previousAvg > 0 ? recentAvg / previousAvg : recentAvg > 0 ? 1.35 : 1
  const trendFactor = clamp(1 + (trendRatio - 1) * 0.45, 0.75, 1.55)
  const forecastPerDay = Math.max(0, smoothedRecent * 0.65 + recentAvg * 0.35) * trendFactor
  const forecastNext7Days = Math.max(0, Math.round(forecastPerDay * 7))

  const lastFinalQty = Math.max(0, Number(input.lastFinalQty ?? 0))
  const addedCount = Math.max(1, Number(input.addedCount ?? 1))
  const defaultOrderQty = Math.max(1, Number(input.defaultOrderQty ?? 1))
  const lastOrderAnchor = lastFinalQty > 0 ? Math.max(1, Math.round(lastFinalQty * 0.35)) : 0
  const coverQty = Math.max(1, Math.ceil(forecastPerDay * 5))

  let recommendedQty = Math.max(defaultOrderQty, addedCount, lastOrderAnchor, coverQty)
  if (input.urgentNow) recommendedQty += 1
  if (mean(recent3) >= Math.max(1.5, recentAvg + 0.5)) recommendedQty += 1
  recommendedQty = clamp(Math.round(recommendedQty), 1, 999)

  const volatility = stdDev(recent14) / Math.max(mean(recent14), 1)
  const riskScore = clamp(
    Math.round(
      12 +
        Math.min(30, forecastPerDay * 15) +
        Math.max(0, Math.min(18, (trendRatio - 1) * 24)) +
        Math.min(10, addedCount * 2) +
        (input.urgentNow ? 18 : 0) +
        Math.min(12, volatility * 8)
    ),
    5,
    99
  )

  const anomalyBaseline = previous7.length ? previousAvg : mean(series)
  const anomalySpread = previous7.length ? stdDev(previous7) : stdDev(series)
  const latest = recent7[recent7.length - 1] ?? 0
  const recentBurst = mean(recent3)
  const anomalyScore = clamp(
    Math.round(
      Math.max(
        0,
        ((latest - anomalyBaseline) / Math.max(anomalySpread || 1, 1)) * 18 +
          Math.max(0, (recentBurst - anomalyBaseline) * 10) +
          (input.urgentNow ? 10 : 0)
      )
    ),
    0,
    100
  )

  const confidence = clamp(
    Math.round(
      38 +
        coverage * 24 +
        Math.min(total, 20) * 1.2 -
        volatility * 10 +
        (lastFinalQty > 0 ? 7 : 0)
    ),
    35,
    95
  )

  return {
    forecastPerDay: roundOne(forecastPerDay),
    forecastNext7Days,
    recommendedQty,
    confidence,
    riskScore,
    anomalyScore,
    riskLevel: toRiskLevel(riskScore),
    reason: buildReason({
      trendRatio,
      urgentNow: Boolean(input.urgentNow),
      anomalyScore,
      coverage,
      forecastPerDay,
    }),
  }
}

export function buildAiOverview(products: AiProductCandidate[]): AiOverview {
  if (!products.length) {
    return {
      predictedNext7Days: 0,
      averageConfidence: 0,
      anomalyScore: 0,
      anomalyLevel: 'LOW',
      summary: 'Nuk ka te dhena te mjaftueshme per parashikim.',
      action: 'Vazhdo mbledhjen e historikut te mungesave dhe porosive.',
      topRiskProducts: [],
    }
  }

  const scored = products
    .map((product) => {
      const forecast = forecastProductDemand(product)
      return {
        productId: product.productId,
        name: product.name,
        supplierName: product.supplierName,
        forecastNext7Days: forecast.forecastNext7Days,
        recommendedQty: forecast.recommendedQty,
        confidence: forecast.confidence,
        riskScore: forecast.riskScore,
        anomalyScore: forecast.anomalyScore,
        riskLevel: forecast.riskLevel,
        reason: forecast.reason,
        dailySeries: product.dailySeries,
      }
    })
    .sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore
      if (b.anomalyScore !== a.anomalyScore) return b.anomalyScore - a.anomalyScore
      return b.forecastNext7Days - a.forecastNext7Days
    })

  const predictedNext7Days = scored.reduce((total, row) => total + row.forecastNext7Days, 0)
  const averageConfidence = Math.round(mean(scored.map((row) => row.confidence)))
  const companySeriesLength = Math.max(...scored.map((row) => row.dailySeries.length), 0)
  const companySeries = Array.from({ length: companySeriesLength }, (_, index) =>
    scored.reduce((total, row) => total + (row.dailySeries[index] ?? 0), 0)
  )
  const companyRecent7 = companySeries.slice(-7)
  const companyPrevious7 = companySeries.slice(-14, -7)
  const companyRecentAvg = mean(companyRecent7)
  const companyPreviousAvg = mean(companyPrevious7)
  const companyTrendRatio =
    companyPreviousAvg > 0 ? companyRecentAvg / companyPreviousAvg : companyRecentAvg > 0 ? 1.3 : 1
  const companyLatest = companyRecent7[companyRecent7.length - 1] ?? 0
  const companyBaseline = companyPrevious7.length ? companyPreviousAvg : mean(companySeries)
  const companySpread = companyPrevious7.length ? stdDev(companyPrevious7) : stdDev(companySeries)
  const companyAnomaly = clamp(
    Math.round(
      Math.max(
        0,
        ((companyLatest - companyBaseline) / Math.max(companySpread || 1, 1)) * 22 +
          Math.max(0, (companyTrendRatio - 1) * 28)
      )
    ),
    0,
    100
  )
  const anomalyScore = Math.round(
    Math.max(companyAnomaly, mean(scored.slice(0, 3).map((row) => row.anomalyScore)))
  )
  const anomalyLevel = toRiskLevel(anomalyScore)

  const summary =
    predictedNext7Days > 0
      ? `AI parashikon rreth ${predictedNext7Days} sinjale mungese per 7 ditet e ardhshme.`
      : 'AI nuk sheh presion te larte per mungesa ne 7 ditet e ardhshme.'

  const topRisk = scored.slice(0, 5).map(({ dailySeries: _dailySeries, ...row }) => row)
  const primaryTarget = topRisk[0]
  const action = primaryTarget
    ? `Prioritetizo ${primaryTarget.name} nga ${primaryTarget.supplierName} me sasi ${primaryTarget.recommendedQty}.`
    : 'Nuk ka produkte me rrezik te larte per momentin.'

  return {
    predictedNext7Days,
    averageConfidence,
    anomalyScore,
    anomalyLevel,
    summary,
    action,
    topRiskProducts: topRisk,
  }
}
