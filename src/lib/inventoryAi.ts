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

export interface SupplierRecommendationProduct {
  id: string
  name: string
  supplierId?: string
  supplierName: string
  category: 'barna' | 'front'
  aliases: string[]
  genericName?: string
  unitPrice?: number
  leadTimeDays?: number
  minOrderQty?: number
  offerPriority?: number
  isActiveOffer?: boolean
}

export interface SupplierAlternativeRecommendation {
  productId: string
  supplierId?: string
  supplierName: string
  productName: string
  score: number
  matchScore: number
  label: 'PREFERRED' | 'FASTEST' | 'BEST_VALUE' | 'BEST_MATCH'
  reasons: string[]
}

export type AiOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface AiReorderPlanInput {
  productName: string
  supplierName: string
  suggestedQty: number
  forecastPerDay?: number
  forecastNext7Days?: number
  aiRiskScore?: number
  aiRiskLevel?: AiRiskLevel
  urgentNow?: boolean
  unitPrice?: number
  leadTimeDays?: number
  minOrderQty?: number
}

export interface AiReorderPlan {
  optimizedQty: number
  coverageDays: number
  estimatedCost: number | null
  priority: AiOrderPriority
  priorityScore: number
  action: string
}

export interface AiSafetyStockInput {
  dailySeries: number[]
  leadTimeDays?: number
  currentReorderPoint?: number
  currentMinStock?: number
  serviceLevel?: 'STANDARD' | 'HIGH' | 'CRITICAL'
  urgentNow?: boolean
}

// ============ SEASONAL & TREND ANALYSIS ============
export interface SeasonalTrendAnalysis {
  hasSeasonal: boolean
  seasonalScore: number // 0-100
  peakDays: number[] // Ditet me demand maksimal (day of week: 0-6)
  lowDays: number[] // Ditet me demand minimal
  monthlyPattern?: number[] // Ndryshim mesatar për çdo muaj
  trendDirection: 'UP' | 'DOWN' | 'STABLE'
  volatilityIndex: number
}

export interface SupplierReliabilityMetrics {
  supplierId?: string
  supplierName: string
  onTimeDeliveryRate: number // 0-100, përqindja e porosive në kohë
  averageLeadTime: number // ditë
  leadTimeVariance: number // std dev e lead time
  orderAccuracyRate: number // % e porosive pa gabime
  responseTime: number // orë mesatare për response
  priceStability: number // 0-100, sa stabil janë çmimet
  minimumReliabilityScore: number // 0-100
}

export interface PriceTrendAnalysis {
  currentPrice: number
  avgPrice30Days: number
  priceChange7Days: number // % ndryshim
  priceChange30Days: number
  trendDirection: 'UP' | 'DOWN' | 'STABLE'
  volatility: number // std dev e çmimit
  expectedPriceIn7Days: number
  seasonalPriceAdjustment: number
}

export interface LeadTimePrediction {
  expectedDays: number
  confidenceLevel: number // 0-100
  minDays: number
  maxDays: number
  seasonalAdjustment: number // ditë shtesë për sezonë peak
  supplierHistoryLength: number // ditë të të dhënave historike
}

export interface DemandPatternType {
  type: 'STEADY' | 'SEASONAL' | 'SPORADIC' | 'TRENDING_UP' | 'TRENDING_DOWN' | 'CYCLICAL'
  confidence: number
  description: string
}

// ============ EXISTING INTERFACES ============


export interface AiSafetyStockPlan {
  averageDailyDemand: number
  demandStdDev: number
  leadTimeDays: number
  serviceLevel: 'STANDARD' | 'HIGH' | 'CRITICAL'
  serviceFactor: number
  safetyStock: number
  dynamicReorderPoint: number
  reorderPointDelta: number
  confidence: number
  riskLevel: AiRiskLevel
  reason: string
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

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase('sq-AL')
}

function tokenizeText(value: string): string[] {
  return normalizeText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function uniqueTokens(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  if (!setA.size || !setB.size) return 0
  let intersection = 0
  setA.forEach((value) => {
    if (setB.has(value)) intersection += 1
  })
  const union = new Set([...setA, ...setB]).size
  return union > 0 ? intersection / union : 0
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

function normalizeProductKey(product: Pick<SupplierRecommendationProduct, 'name' | 'genericName' | 'aliases'>): {
  name: string
  genericName: string
  aliases: string[]
  tokens: string[]
} {
  const name = normalizeText(product.name)
  const genericName = normalizeText(product.genericName ?? '')
  const aliases = uniqueTokens(product.aliases.map((alias) => normalizeText(alias)))
  const tokens = uniqueTokens([
    ...tokenizeText(name),
    ...tokenizeText(genericName),
    ...aliases.flatMap((alias) => tokenizeText(alias)),
  ])
  return { name, genericName, aliases, tokens }
}

function pickRecommendationLabel(input: {
  preferred: boolean
  hasPriceAdvantage: boolean
  hasLeadAdvantage: boolean
}): SupplierAlternativeRecommendation['label'] {
  if (input.preferred) return 'PREFERRED'
  if (input.hasLeadAdvantage) return 'FASTEST'
  if (input.hasPriceAdvantage) return 'BEST_VALUE'
  return 'BEST_MATCH'
}

function labelReasons(label: SupplierAlternativeRecommendation['label']): string {
  if (label === 'PREFERRED') return 'furnitor i preferuar'
  if (label === 'FASTEST') return 'lead time me i shpejte'
  if (label === 'BEST_VALUE') return 'vlere me e mire ekonomike'
  return 'pershtatje e forte me produktin'
}

function toOrderPriority(score: number): AiOrderPriority {
  if (score >= 80) return 'HIGH'
  if (score >= 55) return 'MEDIUM'
  return 'LOW'
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function serviceFactor(level: AiSafetyStockPlan['serviceLevel']): number {
  if (level === 'CRITICAL') return 2.05
  if (level === 'HIGH') return 1.65
  return 1.28
}

export function calculateDynamicSafetyStock(input: AiSafetyStockInput): AiSafetyStockPlan {
  const series = input.dailySeries.map((value) => Math.max(0, Number(value) || 0))
  const recent = series.slice(-28)
  const recent14 = recent.slice(-14)
  const activeSeries = recent14.length >= 7 ? recent14 : recent.length ? recent : [0]
  const averageDailyDemand = roundOne(weightedMean(activeSeries))
  const demandStdDev = roundOne(stdDev(activeSeries))
  const leadTimeDays = clamp(Math.round(Math.max(1, Number(input.leadTimeDays ?? 2))), 1, 30)
  const nonZeroCoverage = activeSeries.filter((value) => value > 0).length / Math.max(activeSeries.length, 1)
  const serviceLevel: AiSafetyStockPlan['serviceLevel'] =
    input.serviceLevel ?? (input.urgentNow ? 'CRITICAL' : nonZeroCoverage >= 0.45 ? 'HIGH' : 'STANDARD')
  const z = serviceFactor(serviceLevel)
  const leadDemand = Math.ceil(averageDailyDemand * leadTimeDays)
  const variabilityBuffer = Math.ceil(z * demandStdDev * Math.sqrt(leadTimeDays))
  const sparseDemandBuffer = nonZeroCoverage > 0 && nonZeroCoverage < 0.2 ? 1 : 0
  const urgentBuffer = input.urgentNow ? 1 : 0
  const safetyStock = clamp(variabilityBuffer + sparseDemandBuffer + urgentBuffer, 0, 999)
  const dynamicReorderPoint = clamp(Math.max(1, leadDemand + safetyStock), 1, 999)
  const currentThreshold = Math.max(0, Number(input.currentReorderPoint ?? 0), Number(input.currentMinStock ?? 0))
  const reorderPointDelta = dynamicReorderPoint - currentThreshold
  const confidence = clamp(
    Math.round(42 + nonZeroCoverage * 28 + Math.min(sum(activeSeries), 20) * 1.1 - demandStdDev * 4),
    35,
    94
  )
  const riskScore = clamp(
    Math.round(
      Math.max(0, reorderPointDelta) * 8 +
        averageDailyDemand * 12 +
        demandStdDev * 10 +
        (input.urgentNow ? 18 : 0) +
        (serviceLevel === 'CRITICAL' ? 8 : serviceLevel === 'HIGH' ? 4 : 0)
    ),
    5,
    99
  )
  const reasonParts: string[] = []
  if (averageDailyDemand > 0) reasonParts.push(`kerkese mesatare ${averageDailyDemand}/dite`)
  if (demandStdDev >= 0.8) reasonParts.push('variabilitet i larte')
  if (leadTimeDays > 2) reasonParts.push(`lead time ${leadTimeDays} dite`)
  if (input.urgentNow) reasonParts.push('sinjal urgjent aktiv')
  if (!reasonParts.length) reasonParts.push('pak histori, prag konservativ')

  return {
    averageDailyDemand,
    demandStdDev,
    leadTimeDays,
    serviceLevel,
    serviceFactor: z,
    safetyStock,
    dynamicReorderPoint,
    reorderPointDelta,
    confidence,
    riskLevel: toRiskLevel(riskScore),
    reason: reasonParts.slice(0, 3).join(', '),
  }
}

export function optimizeReorderPlan(input: AiReorderPlanInput): AiReorderPlan {
  const suggestedQty = Math.max(1, Math.round(Number(input.suggestedQty ?? 1)))
  const derivedForecastPerDay = Math.max(
    0.2,
    Number(input.forecastPerDay ?? 0) > 0
      ? Number(input.forecastPerDay ?? 0)
      : Number(input.forecastNext7Days ?? 0) / 7
  )
  const leadTimeDays = clamp(Math.round(Math.max(1, Number(input.leadTimeDays ?? (input.urgentNow ? 1 : 2)))), 1, 30)
  const minOrderQty = Math.max(1, Math.round(Number(input.minOrderQty ?? 1)))
  const riskScore = clamp(Math.round(Number(input.aiRiskScore ?? 0)), 0, 100)
  const riskLevel = input.aiRiskLevel ?? toRiskLevel(riskScore)
  const unitPrice = Number(input.unitPrice)
  const currentCoverageDays = suggestedQty / Math.max(derivedForecastPerDay, 0.25)
  const safetyDays =
    input.urgentNow || riskLevel === 'HIGH' ? 6 : riskLevel === 'MEDIUM' ? 4 : 3
  const leadDemand = Math.ceil(derivedForecastPerDay * leadTimeDays)
  const safetyStock = Math.ceil(derivedForecastPerDay * safetyDays)
  const volatilityBuffer = riskScore >= 70 ? 2 : riskScore >= 45 ? 1 : 0
  let optimizedQty = Math.max(suggestedQty, leadDemand + safetyStock + volatilityBuffer, minOrderQty)

  if (input.urgentNow) optimizedQty = Math.max(optimizedQty, suggestedQty + 1)
  if (minOrderQty > 1) optimizedQty = Math.ceil(optimizedQty / minOrderQty) * minOrderQty
  optimizedQty = clamp(Math.round(optimizedQty), 1, 999)

  const coverageDays = roundOne(optimizedQty / Math.max(derivedForecastPerDay, 0.25))
  const estimatedCost =
    Number.isFinite(unitPrice) && unitPrice > 0 ? roundMoney(optimizedQty * unitPrice) : null

  const coverageGap = Math.max(0, leadTimeDays + safetyDays - currentCoverageDays)
  const priorityScore = clamp(
    Math.round(
      riskScore * 0.55 +
        (input.urgentNow ? 18 : 0) +
        Math.min(16, leadTimeDays * 3) +
        Math.min(22, coverageGap * 7)
    ),
    0,
    100
  )
  const priority = toOrderPriority(priorityScore)

  const action =
    priority === 'HIGH'
      ? `Porosi sot me ${optimizedQty} njesi; mbulim rreth ${coverageDays} dite.`
      : priority === 'MEDIUM'
        ? `Planifiko porosine brenda 24 oresh me ${optimizedQty} njesi.`
        : `Ri-porosi rutine me ${optimizedQty} njesi per ritmin aktual.`

  return {
    optimizedQty,
    coverageDays,
    estimatedCost,
    priority,
    priorityScore,
    action,
  }
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

export function recommendAlternativeSuppliers(input: {
  currentProduct: SupplierRecommendationProduct
  products: SupplierRecommendationProduct[]
  preferredProductByName?: Record<string, string>
  limit?: number
}): SupplierAlternativeRecommendation[] {
  const current = input.currentProduct
  const limit = Math.max(1, Math.floor(input.limit ?? 4))
  const preferredMap = input.preferredProductByName ?? {}
  const preferredProductId = preferredMap[normalizeText(current.name)] ?? ''
  const currentNorm = normalizeProductKey(current)

  const alternatives = input.products.filter((candidate) => {
    if (candidate.id === current.id) return false
    if (normalizeText(candidate.supplierName) === normalizeText(current.supplierName)) return false
    if (candidate.category !== current.category) return false
    return true
  })
  if (!alternatives.length) return []

  const priceValues = alternatives
    .map((candidate) => Number(candidate.unitPrice))
    .filter((value) => Number.isFinite(value) && value > 0)
  const leadValues = alternatives
    .map((candidate) => Number(candidate.leadTimeDays))
    .filter((value) => Number.isFinite(value) && value >= 0)
  const bestPrice = priceValues.length ? Math.min(...priceValues) : null
  const bestLead = leadValues.length ? Math.min(...leadValues) : null

  const ranked = alternatives
    .map((candidate) => {
      const candidateNorm = normalizeProductKey(candidate)
      const sameName = currentNorm.name !== '' && currentNorm.name === candidateNorm.name
      const sameGeneric =
        currentNorm.genericName !== '' &&
        candidateNorm.genericName !== '' &&
        currentNorm.genericName === candidateNorm.genericName
      const aliasOverlap = jaccardSimilarity(currentNorm.aliases, candidateNorm.aliases)
      const tokenOverlap = jaccardSimilarity(currentNorm.tokens, candidateNorm.tokens)
      const matchScore = clamp(
        Math.round(
          (sameName ? 62 : 0) +
            (sameGeneric ? 18 : 0) +
            aliasOverlap * 14 +
            tokenOverlap * 24 +
            (candidate.isActiveOffer === false ? -12 : 4)
        ),
        0,
        100
      )

      if (matchScore < 28) return null

      const unitPrice = Number(candidate.unitPrice)
      const leadTimeDays = Number(candidate.leadTimeDays)
      const minOrderQty = Math.max(1, Number(candidate.minOrderQty ?? 1))
      const offerPriority = Math.max(0, Number(candidate.offerPriority ?? 100))
      const preferredBoost = preferredProductId === candidate.id ? 24 : 0
      const priceBoost =
        bestPrice && Number.isFinite(unitPrice) && unitPrice > 0
          ? clamp(Math.round(14 - ((unitPrice - bestPrice) / bestPrice) * 18), 0, 14)
          : 0
      const leadBoost =
        bestLead !== null && Number.isFinite(leadTimeDays) && leadTimeDays >= 0
          ? clamp(Math.round(12 - (leadTimeDays - bestLead) * 3), 0, 12)
          : 0
      const priorityBoost = clamp(Math.round(14 - offerPriority / 8), 0, 14)
      const minQtyPenalty = clamp((minOrderQty - 1) * 2, 0, 10)
      const totalScore = clamp(
        Math.round(matchScore + preferredBoost + priceBoost + leadBoost + priorityBoost - minQtyPenalty),
        0,
        100
      )

      const hasPriceAdvantage = bestPrice !== null && Number.isFinite(unitPrice) && unitPrice === bestPrice
      const hasLeadAdvantage = bestLead !== null && Number.isFinite(leadTimeDays) && leadTimeDays === bestLead
      const label = pickRecommendationLabel({
        preferred: preferredBoost > 0,
        hasPriceAdvantage,
        hasLeadAdvantage,
      })
      const reasons = [labelReasons(label)]
      if (sameName) reasons.push('emer identik i produktit')
      else if (sameGeneric) reasons.push('emer gjenerik i njejte')
      else if (tokenOverlap >= 0.45) reasons.push('ngjashmeri e larte ne emer/alias')
      if (hasPriceAdvantage && Number.isFinite(unitPrice)) reasons.push(`cmim ${unitPrice.toFixed(2)}`)
      if (hasLeadAdvantage && Number.isFinite(leadTimeDays)) reasons.push(`${leadTimeDays} dite lead time`)
      if (minOrderQty > 1) reasons.push(`MOQ ${minOrderQty}`)

      const recommendation: SupplierAlternativeRecommendation = {
        productId: candidate.id,
        supplierId: candidate.supplierId,
        supplierName: candidate.supplierName,
        productName: candidate.name,
        score: totalScore,
        matchScore,
        label,
        reasons: uniqueTokens(reasons),
      }
      return recommendation
    })
    .filter((candidate): candidate is SupplierAlternativeRecommendation => candidate !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
      return a.supplierName.localeCompare(b.supplierName, 'sq-AL')
    })
    .slice(0, limit)
  return ranked
}

// ============ NEW SEASONAL & TREND ANALYSIS FUNCTIONS ============

/**
 * Analiza seasonal - shikon nëse ka pattern sezonal në demand
 * Bazuar në data ditor dhe hetohet pattern përjavë, pernajave
 */
export function analyzeSeasonalTrend(dailySeries: number[]): SeasonalTrendAnalysis {
  const series = dailySeries.map((v) => Math.max(0, Number(v) || 0))
  if (series.length < 7) {
    return {
      hasSeasonal: false,
      seasonalScore: 0,
      peakDays: [],
      lowDays: [],
      trendDirection: 'STABLE',
      volatilityIndex: stdDev(series) / Math.max(mean(series), 1),
    }
  }

  // Analiza përjavore (7 ditë pattern)
  const dayOfWeekData: Record<number, number[]> = {}
  for (let i = 0; i < series.length; i++) {
    const dayOfWeek = i % 7
    if (!dayOfWeekData[dayOfWeek]) dayOfWeekData[dayOfWeek] = []
    dayOfWeekData[dayOfWeek].push(series[i])
  }

  const dayAverages = Object.entries(dayOfWeekData)
    .map(([day, values]) => ({
      dayOfWeek: Number(day),
      avg: mean(values),
    }))
    .sort((a, b) => b.avg - a.avg)

  const peakDays = dayAverages.slice(0, 2).map((d) => d.dayOfWeek)
  const lowDays = dayAverages.slice(-2).map((d) => d.dayOfWeek)

  // Seasonal score: mesatarja e variancës përjavore vs total variance
  const betweenGroupVar = mean(
    Object.values(dayOfWeekData).map((values) => {
      const groupMean = mean(values)
      const globalMean = mean(series)
      return Math.pow(groupMean - globalMean, 2) * values.length
    })
  )
  const totalVar = Math.pow(stdDev(series), 2)
  const seasonalScore = totalVar > 0 ? clamp(Math.round((betweenGroupVar / totalVar) * 100), 0, 100) : 0

  // Trend direction
  const recent = series.slice(-14)
  const previous = series.slice(-28, -14)
  const recentAvg = mean(recent)
  const previousAvg = mean(previous)
  const trendDirection = recentAvg > previousAvg * 1.1 ? 'UP' : previousAvg > recentAvg * 1.1 ? 'DOWN' : 'STABLE'

  return {
    hasSeasonal: seasonalScore >= 35,
    seasonalScore,
    peakDays,
    lowDays,
    trendDirection,
    volatilityIndex: stdDev(series) / Math.max(mean(series), 1),
  }
}

/**
 * Analiza pattern i demand - detektim i tipeve të ndryshme
 */
export function identifyDemandPattern(dailySeries: number[]): DemandPatternType {
  const series = dailySeries.map((v) => Math.max(0, Number(v) || 0))
  if (series.length < 7) {
    return {
      type: 'STEADY',
      confidence: 40,
      description: 'Pak data për analiza',
    }
  }

  const recent14 = series.slice(-14)
  const previous7 = series.slice(-14, -7)
  const recentAvg = mean(recent14)
  const previousAvg = mean(previous7)

  // Variance metrics
  const volatility = stdDev(recent14) / Math.max(recentAvg, 1)
  const zeroCount = recent14.filter((v) => v === 0).length
  const isSporadic = zeroCount > 4 && zeroCount < 10

  // Trend
  const trendRatio = previousAvg > 0 ? recentAvg / previousAvg : 1
  const isUpTrend = trendRatio >= 1.2
  const isDownTrend = previousAvg > 0 && trendRatio <= 0.8

  // Cycle detection - shiko nëse ka pattern të përsëritur
  let isCyclical = false
  if (series.length >= 28) {
    const last28 = series.slice(-28)
    const pattern1 = mean(last28.slice(0, 14))
    const pattern2 = mean(last28.slice(14, 28))
    isCyclical = Math.abs(pattern1 - pattern2) < stdDev(last28) * 0.5
  }

  let type: DemandPatternType['type'] = 'STEADY'
  let confidence = 65
  let description = 'Demand stabil'

  if (isSporadic) {
    type = 'SPORADIC'
    confidence = 75
    description = 'Perioda me mungesa dhe perioda pa kërkesë'
  } else if (isUpTrend) {
    type = 'TRENDING_UP'
    confidence = 70
    description = `Trend në rritje - +${Math.round((trendRatio - 1) * 100)}%`
  } else if (isDownTrend) {
    type = 'TRENDING_DOWN'
    confidence = 70
    description = `Trend në rënie - ${Math.round((1 - trendRatio) * 100)}%`
  } else if (isCyclical) {
    type = 'CYCLICAL'
    confidence = 60
    description = 'Perioda të përsëritura të demand'
  } else if (volatility > 0.7) {
    type = 'SEASONAL'
    confidence = analyzeSeasonalTrend(series).seasonalScore
    description = 'Variacione të ndjeshme, mundësisht sezonale'
  }

  return { type, confidence: clamp(confidence, 30, 95), description }
}

/**
 * Llogarit price trend analysis bazuar në historical prices
 */
export function analyzePriceTrend(prices: number[]): PriceTrendAnalysis {
  const validPrices = prices.filter((p) => Number.isFinite(p) && p > 0)
  if (validPrices.length === 0) {
    return {
      currentPrice: 0,
      avgPrice30Days: 0,
      priceChange7Days: 0,
      priceChange30Days: 0,
      trendDirection: 'STABLE',
      volatility: 0,
      expectedPriceIn7Days: 0,
      seasonalPriceAdjustment: 0,
    }
  }

  const currentPrice = validPrices[validPrices.length - 1]
  const last30 = validPrices.slice(-30)
  const last7 = validPrices.slice(-7)

  const avgPrice30Days = mean(last30)
  const avgPrice7Days = mean(last7)
  const priceChange7Days = avgPrice7Days > 0 ? ((currentPrice - avgPrice7Days) / avgPrice7Days) * 100 : 0
  const priceChange30Days = avgPrice30Days > 0 ? ((currentPrice - avgPrice30Days) / avgPrice30Days) * 100 : 0

  const volatility = stdDev(last30)
  const trendDirection =
    priceChange7Days > 2.5 ? 'UP' : priceChange7Days < -2.5 ? 'DOWN' : 'STABLE'

  // Forecast për 7 ditë
  const direction = priceChange7Days > 0 ? 1 : priceChange7Days < 0 ? -1 : 0
  const expectedPriceIn7Days = currentPrice + (Math.abs(priceChange7Days) / 100) * currentPrice * direction * 0.5

  return {
    currentPrice,
    avgPrice30Days: roundMoney(avgPrice30Days),
    priceChange7Days: Math.round(priceChange7Days * 100) / 100,
    priceChange30Days: Math.round(priceChange30Days * 100) / 100,
    trendDirection,
    volatility: roundMoney(volatility),
    expectedPriceIn7Days: roundMoney(expectedPriceIn7Days),
    seasonalPriceAdjustment: 0,
  }
}

/**
 * Predikon lead time bazuar në historical data
 */
export function predictLeadTime(leadTimes: number[]): LeadTimePrediction {
  const validLeadTimes = leadTimes.filter((lt) => Number.isFinite(lt) && lt > 0)
  if (validLeadTimes.length === 0) {
    return {
      expectedDays: 2,
      confidenceLevel: 30,
      minDays: 1,
      maxDays: 5,
      seasonalAdjustment: 0,
      supplierHistoryLength: 0,
    }
  }

  const avgLeadTime = mean(validLeadTimes)
  const stdDevLeadTime = stdDev(validLeadTimes)
  const minDays = Math.max(1, Math.floor(Math.min(...validLeadTimes)))
  const maxDays = Math.ceil(Math.max(...validLeadTimes))

  // Confidence: më i lartë nëse ka shumë data dhe variabilitet i ulët
  let confidenceLevel = 50
  if (validLeadTimes.length >= 10) confidenceLevel += 20
  else if (validLeadTimes.length >= 5) confidenceLevel += 10

  if (stdDevLeadTime < avgLeadTime * 0.3) confidenceLevel += 15
  else if (stdDevLeadTime > avgLeadTime * 0.6) confidenceLevel -= 10

  return {
    expectedDays: Math.round(avgLeadTime),
    confidenceLevel: clamp(confidenceLevel, 25, 95),
    minDays,
    maxDays,
    seasonalAdjustment: 0,
    supplierHistoryLength: validLeadTimes.length,
  }
}

/**
 * Llogarit metrics e reliability të furnitorit
 * (këto duhet të arrihen nga data layer kur disponohen)
 */
export function calculateSupplierReliability(input: {
  onTimeOrderCount: number
  totalOrderCount: number
  avgLeadTime: number
  leadTimeVariance: number
  accurateOrders: number
  priceStability: number
}): SupplierReliabilityMetrics {
  const onTimeRate = input.totalOrderCount > 0 ? (input.onTimeOrderCount / input.totalOrderCount) * 100 : 0
  const orderAccuracyRate = input.totalOrderCount > 0 ? (input.accurateOrders / input.totalOrderCount) * 100 : 0

  const reliabilityScore = Math.round(
    onTimeRate * 0.4 + orderAccuracyRate * 0.3 + (input.priceStability * 0.2) + (100 - Math.min(input.leadTimeVariance * 10, 50)) * 0.1
  )

  return {
    supplierName: '',
    onTimeDeliveryRate: clamp(onTimeRate, 0, 100),
    averageLeadTime: input.avgLeadTime,
    leadTimeVariance: input.leadTimeVariance,
    orderAccuracyRate: clamp(orderAccuracyRate, 0, 100),
    responseTime: 24, // placeholder
    priceStability: clamp(input.priceStability, 0, 100),
    minimumReliabilityScore: clamp(reliabilityScore, 0, 100),
  }
}
