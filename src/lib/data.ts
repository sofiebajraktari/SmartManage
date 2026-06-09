import { isSupabaseConfigured, supabase } from './supabase.js'
import {
  addProduct as addProductMock,
  adjustProductStock as adjustProductStockMock,
  deleteProduct as deleteProductMock,
  addShortage as addShortageMock,
  deleteShortage as deleteShortageMock,
  getProducts as getProductsMock,
  updateProduct as updateProductMock,
  getShortages as getShortagesMock,
  updateShortageMeta as updateShortageMetaMock,
  updateSuggestedQty as updateSuggestedQtyMock,
  type MissingItem as MockMissingItem,
  type MockProduct,
} from './mockData.js'
import {
  buildAiOverview,
  calculateDynamicSafetyStock,
  forecastProductDemand,
  optimizeReorderPlan,
  type AiOrderPriority,
  type AiOverview,
  type AiRiskLevel,
} from './inventoryAi.js'

export interface OwnerOrderLine {
  productName: string
  qty: number
  urgent: boolean
  estimatedCost?: number | null
  leadTimeDays?: number
  coverageDays?: number
  priority?: AiOrderPriority
}

export interface OwnerOrder {
  id: number
  dbId?: string
  supplier: string
  items: string[]
  status?: 'DRAFT' | 'SENT' | 'FAILED'
  lines?: OwnerOrderLine[]
  aiEstimatedCost?: number | null
  aiMaxLeadTimeDays?: number | null
  aiCoverageDays?: number | null
  aiPriority?: AiOrderPriority
  aiSummary?: string
}

export interface ProductView {
  id: string
  name: string
  genericName?: string
  defaultOrderQty?: number
  supplierId?: string
  supplierName: string
  category: 'barna' | 'front'
  aliases: string[]
  unitPrice?: number
  leadTimeDays?: number
  minOrderQty?: number
  offerPriority?: number
  isActiveOffer?: boolean
  currentStock: number
  minStock: number
  reorderPoint: number
}

export type StockMovementType =
  | 'INITIAL_COUNT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'MANUAL_CORRECTION'

export interface ShortageView {
  id: string
  productId: string
  productName: string
  supplierId?: string
  supplierName: string
  urgent: boolean
  note: string
  addedCount: number
  suggestedQty: number
  unitPrice?: number
  leadTimeDays?: number
  minOrderQty?: number
  aiSuggestedQty?: number
  aiConfidence?: number
  aiRiskScore?: number
  aiRiskLevel?: AiRiskLevel
  aiReason?: string
  aiForecastPerDay?: number
  aiForecastNext7Days?: number
  aiOptimizedQty?: number
  aiCoverageDays?: number
  aiEstimatedCost?: number | null
  aiOrderPriority?: AiOrderPriority
  aiOrderAction?: string
  createdById?: string
  createdByRole?: 'OWNER' | 'MANAGER' | 'WORKER'
  createdByLabel?: string
}

export interface SupplierView {
  id: string
  name: string
  productCount: number
}

export interface CompanyDetails {
  name: string
  posName: string
  address: string
  phone: string
  email: string
  logoUrl: string
  otherInfo: string
}

export interface AiStockEarlyWarning {
  productId: string
  name: string
  supplierName: string
  currentStock: number
  reorderPoint: number
  minStock: number
  forecastPerDay: number
  forecastNext7Days: number
  daysLeft: number | null
  leadTimeDays: number
  safetyStock: number
  dynamicReorderPoint: number
  reorderPointDelta: number
  serviceLevel: 'STANDARD' | 'HIGH' | 'CRITICAL'
  recommendedQty: number
  riskLevel: AiRiskLevel
  reason: string
  action: string
}

export interface AiDeadStockAlert {
  productId: string
  name: string
  supplierName: string
  currentStock: number
  reorderPoint: number
  minStock: number
  forecastPerDay: number
  daysSinceLastSignal: number | null
  stockCoverageDays: number | null
  label: 'OVERSTOCK' | 'DEAD_STOCK'
  riskLevel: AiRiskLevel
  reason: string
  action: string
}

export interface AiSupplierScorecard {
  supplierName: string
  score: number
  riskLevel: AiRiskLevel
  shortageCount: number
  urgentCount: number
  productCount: number
  criticalProductCount: number
  averageLeadTimeDays: number | null
  alternativePressure: number
  label: 'STABLE' | 'WATCH' | 'REVIEW'
  reason: string
  action: string
}

export interface AiAbcXyzProduct {
  productId: string
  name: string
  supplierName: string
  abcClass: 'A' | 'B' | 'C'
  xyzClass: 'X' | 'Y' | 'Z'
  combinedClass: string
  totalSignals: number
  variability: number
  recommendedPolicy: string
  riskLevel: AiRiskLevel
}

export interface AiDataQualityIssue {
  id: string
  category: 'CATALOG' | 'STOCK' | 'SUPPLIER' | 'PRICING' | 'DUPLICATE'
  severity: AiRiskLevel
  title: string
  detail: string
  productId?: string
  productName?: string
  supplierName?: string
  action: string
}

export interface AiDecisionExplanation {
  id: string
  subject: string
  decision: string
  technique: 'FORECAST' | 'SAFETY_STOCK' | 'ABC_XYZ' | 'SUPPLIER_SCORE' | 'DATA_QUALITY'
  confidence: number
  riskLevel: AiRiskLevel
  factors: string[]
  formula: string
  sensitivity: string
}

export interface DashboardInsights {
  shortageTrend: Array<{ date: string; count: number }>
  topSuppliers: Array<{ name: string; count: number }>
  topProducts: Array<{ name: string; count: number }>
  urgentBreakdown: { urgent: number; normal: number }
  weekdayTrend: Array<{ day: string; count: number }>
  ai: AiOverview
  stockWarnings: AiStockEarlyWarning[]
  deadStockAlerts: AiDeadStockAlert[]
  supplierScorecards: AiSupplierScorecard[]
  abcXyzProducts: AiAbcXyzProduct[]
  dataQualityIssues: AiDataQualityIssue[]
  explanations: AiDecisionExplanation[]
}

const COMPANY_ID_CACHE_TTL_MS = 60_000
let companyIdCache: { userId: string; companyId: string; expiresAt: number } | null = null
let companyIdPromise: Promise<string | null> | null = null

function readCachedCompanyId(userId: string): string | null {
  if (!companyIdCache) return null
  if (companyIdCache.userId !== userId) return null
  if (companyIdCache.expiresAt <= Date.now()) return null
  return companyIdCache.companyId
}

function writeCachedCompanyId(userId: string, companyId: string): string {
  companyIdCache = {
    userId,
    companyId,
    expiresAt: Date.now() + COMPANY_ID_CACHE_TTL_MS,
  }
  return companyId
}

async function resolveProductsInput(
  productsInput?: ProductView[] | Promise<ProductView[]>
): Promise<ProductView[]> {
  if (Array.isArray(productsInput)) return productsInput
  if (productsInput) return productsInput
  return getProducts()
}

function isUuidValue(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function toSafeInteger(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : value != null ? Number(value) : fallback
  if (!Number.isFinite(parsed)) return Math.trunc(fallback)
  return Math.trunc(parsed)
}

function shiftIsoDays(base: Date, offsetDays: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildIsoRangeFromAnchor(anchorIso: string, days: number): string[] {
  const safeDays = Math.max(1, Math.floor(days))
  const anchor = new Date(`${anchorIso}T00:00:00`)
  if (Number.isNaN(anchor.getTime())) {
    const today = new Date()
    return Array.from({ length: safeDays }, (_, idx) => shiftIsoDays(today, -(safeDays - 1 - idx)))
  }
  return Array.from({ length: safeDays }, (_, idx) => shiftIsoDays(anchor, -(safeDays - 1 - idx)))
}

function emptyAiOverview(): AiOverview {
  return {
    predictedNext7Days: 0,
    averageConfidence: 0,
    anomalyScore: 0,
    anomalyLevel: 'LOW',
    summary: 'Nuk ka te dhena te mjaftueshme per parashikim.',
    action: 'Mbledh me shume histori per rekomandime me te sakta.',
    topRiskProducts: [],
  }
}

async function resolveCurrentCompanyId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return null
  const user = sessionData.session?.user
  const userId = String(user?.id ?? '').trim()
  if (!userId) {
    companyIdCache = null
    return null
  }
  const currentUser = user!

  const cachedCompanyId = readCachedCompanyId(userId)
  if (cachedCompanyId) return cachedCompanyId
  if (companyIdPromise) return companyIdPromise

  companyIdPromise = (async () => {
    const currentCompany = await supabase.rpc('current_company_id')
    if (!currentCompany.error) {
      const companyId = String(currentCompany.data ?? '').trim()
      if (companyId) return writeCachedCompanyId(userId, companyId)
    }

    const metadataCompanyId = String(currentUser.user_metadata?.company_id ?? '').trim()
    if (isUuidValue(metadataCompanyId)) {
      return writeCachedCompanyId(userId, metadataCompanyId)
    }

    const username =
      String(currentUser.user_metadata?.username ?? '').trim().toLocaleLowerCase('sq-AL') ||
      String(currentUser.email ?? '').split('@')[0].trim().toLocaleLowerCase('sq-AL') ||
      'owner'
    const roleMeta = String(currentUser.user_metadata?.role ?? '').trim().toUpperCase()
    const canBootstrap = roleMeta === '' || roleMeta === 'OWNER' || roleMeta === 'MANAGER'
    if (!canBootstrap) return null

    const profileRes = await supabase
      .from('profiles')
      .select('company_id,role')
      .eq('id', userId)
      .maybeSingle()
    if (!profileRes.error && profileRes.data) {
      const companyId = String((profileRes.data as { company_id?: unknown }).company_id ?? '').trim()
      if (companyId) return writeCachedCompanyId(userId, companyId)
      const role = String((profileRes.data as { role?: unknown }).role ?? '').trim().toUpperCase()
      if (role && role !== 'OWNER' && role !== 'MANAGER') return null
    }

    const codeFromMeta = String(currentUser.user_metadata?.company_code ?? '').trim().toLocaleLowerCase('sq-AL')
    const rawCode = codeFromMeta || username || 'main'
    const companyCode =
      rawCode
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'main'
    const companyName =
      String(currentUser.user_metadata?.company_name ?? '').trim() ||
      `Company ${username || 'Owner'}`

    let bootstrap = await supabase.rpc('bootstrap_company_owner', {
      p_company_name: companyName,
      p_company_code: companyCode,
      p_username: username,
    })
    if (bootstrap.error) {
      const msg = String(bootstrap.error.message ?? '')
      const codeTaken = /company_code_taken|duplicate|already exists/i.test(msg)
      if (codeTaken) {
        const uniqueCode = `${companyCode || 'main'}-${String(userId).replace(/-/g, '').slice(0, 6)}`
        bootstrap = await supabase.rpc('bootstrap_company_owner', {
          p_company_name: companyName,
          p_company_code: uniqueCode,
          p_username: username,
        })
      }
    }
    if (!bootstrap.error) {
      const createdCompanyId = String(bootstrap.data ?? '').trim()
      if (createdCompanyId) return writeCachedCompanyId(userId, createdCompanyId)
    }

    const retryCurrentCompany = await supabase.rpc('current_company_id')
    if (!retryCurrentCompany.error) {
      const companyId = String(retryCurrentCompany.data ?? '').trim()
      if (companyId) return writeCachedCompanyId(userId, companyId)
    }
    return null
  })().finally(() => {
    companyIdPromise = null
  })

  return companyIdPromise
}

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function stableOrderUiId(id: string, fallback: number): number {
  const compact = (id ?? '').replace(/-/g, '')
  const head = compact.slice(0, 8)
  const parsed = Number.parseInt(head, 16)
  if (Number.isFinite(parsed) && parsed > 0) return (parsed % 900000) + 100000
  return fallback
}

function buildProductDailySeries(
  dateRange: string[],
  rows: Array<{ day: string; productId: string; count: number }>
): Map<string, number[]> {
  const dateIndex = new Map(dateRange.map((date, index) => [date, index]))
  const out = new Map<string, number[]>()
  rows.forEach((row) => {
    const index = dateIndex.get(row.day)
    if (index == null) return
    const productId = String(row.productId ?? '').trim()
    if (!productId) return
    const current = out.get(productId) ?? Array.from({ length: dateRange.length }, () => 0)
    current[index] += Math.max(0, Number(row.count ?? 0))
    out.set(productId, current)
  })
  return out
}

function priorityRank(priority?: AiOrderPriority): number {
  if (priority === 'HIGH') return 3
  if (priority === 'MEDIUM') return 2
  return 1
}

function priorityLabel(priority?: AiOrderPriority): string {
  if (priority === 'HIGH') return 'i larte'
  if (priority === 'MEDIUM') return 'mesatar'
  return 'i ulet'
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : 0
}

function stdDev(values: number[]): number {
  if (!values.length) return 0
  const avg = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)))
}

function toRiskLevel(score: number): AiRiskLevel {
  if (score >= 70) return 'HIGH'
  if (score >= 45) return 'MEDIUM'
  return 'LOW'
}

function riskRank(level: AiRiskLevel): number {
  if (level === 'HIGH') return 3
  if (level === 'MEDIUM') return 2
  return 1
}

function buildEmptySeries(length: number): number[] {
  return Array.from({ length: Math.max(1, length) }, () => 0)
}

function daysSinceLastPositiveSignal(series: number[]): number | null {
  for (let idx = series.length - 1; idx >= 0; idx -= 1) {
    if (Number(series[idx] ?? 0) > 0) {
      return series.length - 1 - idx
    }
  }
  return null
}

function normalizeQualityText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('sq-AL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(tbl|tab|tablet|caps|capsule|kaps|kapsule|sirup|syrup)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function qualityIssueRank(issue: AiDataQualityIssue): number {
  return riskRank(issue.severity) * 100 + (issue.category === 'DUPLICATE' ? 15 : issue.category === 'STOCK' ? 12 : 0)
}

function buildStockSignals(input: {
  products: ProductView[]
  analysisRange: string[]
  seriesByProduct: Map<string, number[]>
  urgentRecentByProduct: Map<string, number>
}): Pick<DashboardInsights, 'stockWarnings' | 'deadStockAlerts'> {
  const stockWarnings: AiStockEarlyWarning[] = []
  const deadStockAlerts: AiDeadStockAlert[] = []

  input.products.forEach((product) => {
    const dailySeries = input.seriesByProduct.get(product.id) ?? buildEmptySeries(input.analysisRange.length)
    const currentStock = Math.max(0, Number(product.currentStock ?? 0))
    const reorderPoint = Math.max(0, Number(product.reorderPoint ?? 0))
    const minStock = Math.max(0, Number(product.minStock ?? 0))
    const stockThreshold = Math.max(reorderPoint, minStock)
    const leadTimeDays = Math.max(1, Math.round(Number(product.leadTimeDays ?? 2)))
    const urgentNow = (input.urgentRecentByProduct.get(product.id) ?? 0) > 0
    const safetyPlan = calculateDynamicSafetyStock({
      dailySeries,
      leadTimeDays,
      currentReorderPoint: reorderPoint,
      currentMinStock: minStock,
      urgentNow,
    })
    const forecast = forecastProductDemand({
      productId: product.id,
      name: product.name,
      supplierName: product.supplierName,
      dailySeries,
      defaultOrderQty: product.defaultOrderQty ?? 1,
      addedCount: dailySeries[dailySeries.length - 1] ?? 0,
      urgentNow,
    })
    const forecastPerDay = Math.max(0, Number(forecast.forecastPerDay ?? 0))
    const derivedDemandPerDay =
      forecastPerDay > 0 ? forecastPerDay : currentStock <= stockThreshold && currentStock > 0 ? 0.25 : 0
    const daysLeft =
      currentStock <= 0
        ? 0
        : derivedDemandPerDay > 0
          ? roundOne(currentStock / Math.max(derivedDemandPerDay, 0.1))
          : null
    const reorderPlan = optimizeReorderPlan({
      productName: product.name,
      supplierName: product.supplierName,
      suggestedQty: forecast.recommendedQty,
      forecastPerDay: Math.max(0.2, forecastPerDay || (stockThreshold > 0 ? stockThreshold / 14 : 0.2)),
      forecastNext7Days: Math.max(forecast.forecastNext7Days, Math.round(Math.max(0.2, forecastPerDay) * 7)),
      aiRiskScore: forecast.riskScore,
      aiRiskLevel: forecast.riskLevel,
      urgentNow,
      unitPrice: product.unitPrice,
      leadTimeDays: product.leadTimeDays,
      minOrderQty: product.minOrderQty,
    })
    const shortageSoon = daysLeft != null && daysLeft <= leadTimeDays + 2
    const warningScore = clamp(
      Math.round(
        forecast.riskScore * 0.45 +
          (currentStock <= 0 ? 42 : 0) +
          (stockThreshold > 0 && currentStock <= stockThreshold ? 24 : 0) +
          (shortageSoon ? 18 : daysLeft != null && daysLeft <= 7 ? 10 : 0) +
          (urgentNow ? 10 : 0)
      ),
      0,
      99
    )
    const warningRiskLevel = toRiskLevel(warningScore)
    const needsEarlyWarning =
      currentStock <= 0 ||
      (stockThreshold > 0 && currentStock <= stockThreshold) ||
      (daysLeft != null && daysLeft <= 10)

    if (needsEarlyWarning) {
      const reasonParts: string[] = []
      if (currentStock <= 0) reasonParts.push('stok zero')
      else if (stockThreshold > 0 && currentStock <= stockThreshold) reasonParts.push('stok nen pragun e ri-porosise')
      if (daysLeft != null && daysLeft > 0) reasonParts.push(`stok per rreth ${daysLeft} dite`)
      if (urgentNow) reasonParts.push('sinjale urgjente ne 7 ditet e fundit')
      else if (forecastPerDay >= 1) reasonParts.push('kerkese e qendrueshme')
      if (!reasonParts.length) reasonParts.push('monitorim preventiv i stokut')

      const action =
        currentStock <= 0
          ? `Rimbush stokun sot; AI sugjeron rreth ${reorderPlan.optimizedQty} njesi.`
          : shortageSoon
            ? `Porosite brenda 24 oresh; AI sugjeron ${reorderPlan.optimizedQty} njesi.`
            : `Vendose ne watchlist dhe planifiko ${reorderPlan.optimizedQty} njesi.`

      stockWarnings.push({
        productId: product.id,
        name: product.name,
        supplierName: product.supplierName,
        currentStock,
        reorderPoint,
        minStock,
        forecastPerDay: forecast.forecastPerDay,
        forecastNext7Days: forecast.forecastNext7Days,
        daysLeft,
        leadTimeDays,
        safetyStock: safetyPlan.safetyStock,
        dynamicReorderPoint: safetyPlan.dynamicReorderPoint,
        reorderPointDelta: safetyPlan.reorderPointDelta,
        serviceLevel: safetyPlan.serviceLevel,
        recommendedQty: reorderPlan.optimizedQty,
        riskLevel: riskRank(safetyPlan.riskLevel) > riskRank(warningRiskLevel) ? safetyPlan.riskLevel : warningRiskLevel,
        reason: `${reasonParts.join(', ')}; SS ${safetyPlan.safetyStock}, ROP AI ${safetyPlan.dynamicReorderPoint}`,
        action,
      })
    }

    if (currentStock <= 0) return

    const totalSignals = sum(dailySeries)
    const daysSinceLastSignal = daysSinceLastPositiveSignal(dailySeries)
    const stockCoverageDays =
      forecastPerDay > 0 ? roundOne(currentStock / Math.max(forecastPerDay, 0.1)) : null
    const deadStock =
      currentStock >= Math.max(4, stockThreshold > 0 ? stockThreshold * 2 : 4) && totalSignals === 0
    const overstock =
      currentStock >= Math.max(6, stockThreshold > 0 ? stockThreshold * 2 : 6) &&
      (
        (stockCoverageDays != null && stockCoverageDays >= 45) ||
        (forecastPerDay < 0.25 && (daysSinceLastSignal == null || daysSinceLastSignal >= 21))
      )

    if (!deadStock && !overstock) return

    const label: AiDeadStockAlert['label'] = deadStock ? 'DEAD_STOCK' : 'OVERSTOCK'
    const deadStockRiskLevel: AiRiskLevel =
      deadStock || (stockCoverageDays != null && stockCoverageDays >= 60) ? 'HIGH' : 'MEDIUM'
    const reason =
      label === 'DEAD_STOCK'
        ? `Pa sinjale mungese ne ${input.analysisRange.length} dite; stok aktual ${currentStock}.`
        : stockCoverageDays != null
          ? `Stoku aktual mbulon rreth ${stockCoverageDays} dite me ritmin aktual.`
          : 'Stok i larte krahasuar me sinjalet e fundit te mungesave.'
    const action =
      label === 'DEAD_STOCK'
        ? 'Ngri porosite e reja dhe rishiko transferim, promovim ose ulje te reorder point.'
        : 'Ule sasine e ri-porosise dhe rishiko min stock / reorder point.'

    deadStockAlerts.push({
      productId: product.id,
      name: product.name,
      supplierName: product.supplierName,
      currentStock,
      reorderPoint,
      minStock,
      forecastPerDay: forecast.forecastPerDay,
      daysSinceLastSignal,
      stockCoverageDays,
      label,
      riskLevel: deadStockRiskLevel,
      reason,
      action,
    })
  })

  stockWarnings.sort((a, b) => {
    const riskDiff = riskRank(b.riskLevel) - riskRank(a.riskLevel)
    if (riskDiff !== 0) return riskDiff
    const daysLeftA = a.daysLeft ?? Number.POSITIVE_INFINITY
    const daysLeftB = b.daysLeft ?? Number.POSITIVE_INFINITY
    if (daysLeftA !== daysLeftB) return daysLeftA - daysLeftB
    return a.currentStock - b.currentStock
  })

  deadStockAlerts.sort((a, b) => {
    const riskDiff = riskRank(b.riskLevel) - riskRank(a.riskLevel)
    if (riskDiff !== 0) return riskDiff
    if (a.label !== b.label) return a.label === 'DEAD_STOCK' ? -1 : 1
    return b.currentStock - a.currentStock
  })

  return {
    stockWarnings: stockWarnings.slice(0, 5),
    deadStockAlerts: deadStockAlerts.slice(0, 5),
  }
}

function buildAbcXyzAnalysis(input: {
  products: ProductView[]
  seriesByProduct: Map<string, number[]>
}): AiAbcXyzProduct[] {
  const scored = input.products
    .map((product) => {
      const series = input.seriesByProduct.get(product.id) ?? buildEmptySeries(30)
      const totalSignals = sum(series)
      const avg = mean(series)
      const variability = avg > 0 ? roundOne(stdDev(series) / Math.max(avg, 0.1)) : 0
      return { product, totalSignals, variability }
    })
    .filter((row) => row.totalSignals > 0 || Number(row.product.currentStock ?? 0) > 0)
    .sort((a, b) => b.totalSignals - a.totalSignals)

  const totalDemand = Math.max(1, scored.reduce((total, row) => total + row.totalSignals, 0))
  let cumulative = 0

  return scored
    .map((row) => {
      cumulative += row.totalSignals
      const share = cumulative / totalDemand
      const abcClass: AiAbcXyzProduct['abcClass'] = share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C'
      const xyzClass: AiAbcXyzProduct['xyzClass'] =
        row.variability <= 0.45 ? 'X' : row.variability <= 1.05 ? 'Y' : 'Z'
      const combinedClass = `${abcClass}-${xyzClass}`
      const riskLevel: AiRiskLevel =
        abcClass === 'A' && xyzClass === 'Z' ? 'HIGH' : abcClass === 'A' || xyzClass === 'Z' ? 'MEDIUM' : 'LOW'
      const recommendedPolicy =
        abcClass === 'A' && xyzClass === 'Z'
          ? 'Mbaj safety stock te larte dhe kontroll javor.'
          : abcClass === 'A'
            ? 'Prioritet per furnizim dhe monitorim te afert.'
            : xyzClass === 'Z'
              ? 'Porosit konservativisht; kerkesa eshte e paparashikueshme.'
              : 'Menaxhim rutine me prag standard.'
      return {
        productId: row.product.id,
        name: row.product.name,
        supplierName: row.product.supplierName,
        abcClass,
        xyzClass,
        combinedClass,
        totalSignals: row.totalSignals,
        variability: row.variability,
        recommendedPolicy,
        riskLevel,
      }
    })
    .sort((a, b) => {
      const riskDiff = riskRank(b.riskLevel) - riskRank(a.riskLevel)
      if (riskDiff !== 0) return riskDiff
      return b.totalSignals - a.totalSignals
    })
    .slice(0, 6)
}

function buildSupplierScorecards(input: {
  products: ProductView[]
  seriesByProduct: Map<string, number[]>
  urgentRecentByProduct: Map<string, number>
  stockWarnings: AiStockEarlyWarning[]
  abcXyzProducts: AiAbcXyzProduct[]
}): AiSupplierScorecard[] {
  const bySupplier = new Map<
    string,
    {
      productCount: number
      shortageCount: number
      urgentCount: number
      criticalProductCount: number
      leadTimes: number[]
      alternativePressure: number
    }
  >()
  const duplicateNames = new Map<string, Set<string>>()
  input.products.forEach((product) => {
    const key = product.name.trim().toLocaleLowerCase('sq-AL')
    const set = duplicateNames.get(key) ?? new Set<string>()
    set.add(product.supplierName)
    duplicateNames.set(key, set)
  })
  const warningByProduct = new Set(input.stockWarnings.map((row) => row.productId))
  const criticalByProduct = new Set(
    input.abcXyzProducts.filter((row) => row.riskLevel !== 'LOW').map((row) => row.productId)
  )

  input.products.forEach((product) => {
    const supplierName = product.supplierName || 'Pa furnitor'
    const row = bySupplier.get(supplierName) ?? {
      productCount: 0,
      shortageCount: 0,
      urgentCount: 0,
      criticalProductCount: 0,
      leadTimes: [],
      alternativePressure: 0,
    }
    const series = input.seriesByProduct.get(product.id) ?? []
    row.productCount += 1
    row.shortageCount += sum(series)
    row.urgentCount += input.urgentRecentByProduct.get(product.id) ?? 0
    if (warningByProduct.has(product.id) || criticalByProduct.has(product.id)) row.criticalProductCount += 1
    const lead = Number(product.leadTimeDays)
    if (Number.isFinite(lead) && lead > 0) row.leadTimes.push(lead)
    const duplicateSupplierCount = duplicateNames.get(product.name.trim().toLocaleLowerCase('sq-AL'))?.size ?? 0
    if (duplicateSupplierCount > 1) row.alternativePressure += 1
    bySupplier.set(supplierName, row)
  })

  return [...bySupplier.entries()]
    .map(([supplierName, row]) => {
      const averageLeadTimeDays = row.leadTimes.length ? roundOne(mean(row.leadTimes)) : null
      const score = clamp(
        Math.round(
          row.shortageCount * 7 +
            row.urgentCount * 12 +
            row.criticalProductCount * 15 +
            (averageLeadTimeDays != null ? averageLeadTimeDays * 4 : 4) +
            row.alternativePressure * 5
        ),
        0,
        100
      )
      const riskLevel = toRiskLevel(score)
      const label: AiSupplierScorecard['label'] = score >= 70 ? 'REVIEW' : score >= 45 ? 'WATCH' : 'STABLE'
      const reasonParts: string[] = []
      if (row.shortageCount > 0) reasonParts.push(`${row.shortageCount} sinjale mungese`)
      if (row.urgentCount > 0) reasonParts.push(`${row.urgentCount} urgjente`)
      if (row.criticalProductCount > 0) reasonParts.push(`${row.criticalProductCount} produkte kritike`)
      if (averageLeadTimeDays != null) reasonParts.push(`lead ${averageLeadTimeDays}d`)
      if (row.alternativePressure > 0) reasonParts.push(`${row.alternativePressure} alternativa ne treg`)
      const action =
        label === 'REVIEW'
          ? 'Rishiko marreveshjen, lead time ose furnitor alternativ.'
          : label === 'WATCH'
            ? 'Mbaje ne vezhgim dhe krahaso alternativat per produktet kritike.'
            : 'Furnitor stabil per ritmin aktual.'
      return {
        supplierName,
        score,
        riskLevel,
        shortageCount: row.shortageCount,
        urgentCount: row.urgentCount,
        productCount: row.productCount,
        criticalProductCount: row.criticalProductCount,
        averageLeadTimeDays,
        alternativePressure: row.alternativePressure,
        label,
        reason: reasonParts.slice(0, 4).join(', ') || 'pa sinjale te forta rreziku',
        action,
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.shortageCount - a.shortageCount
    })
    .slice(0, 5)
}

function buildDataQualityAudit(input: {
  products: ProductView[]
  seriesByProduct: Map<string, number[]>
  stockWarnings: AiStockEarlyWarning[]
  deadStockAlerts: AiDeadStockAlert[]
  supplierScorecards: AiSupplierScorecard[]
}): AiDataQualityIssue[] {
  const issues: AiDataQualityIssue[] = []
  const pushIssue = (issue: AiDataQualityIssue): void => {
    issues.push(issue)
  }
  const nameGroups = new Map<string, ProductView[]>()
  input.products.forEach((product) => {
    const key = normalizeQualityText(product.name)
    if (!key) return
    const rows = nameGroups.get(key) ?? []
    rows.push(product)
    nameGroups.set(key, rows)
  })

  input.products.forEach((product) => {
    const series = input.seriesByProduct.get(product.id) ?? []
    const totalSignals = sum(series)
    const stock = Number(product.currentStock ?? 0)
    const hasNoThreshold = Number(product.minStock ?? 0) <= 0 && Number(product.reorderPoint ?? 0) <= 0
    const hasDemand = totalSignals > 0
    const hasCriticalStockWarning = input.stockWarnings.some((row) => row.productId === product.id)

    if (hasNoThreshold && (hasDemand || stock > 0)) {
      pushIssue({
        id: `threshold:${product.id}`,
        category: 'CATALOG',
        severity: hasDemand ? 'HIGH' : 'MEDIUM',
        title: 'Prag ri-porosie mungon',
        detail: hasDemand
          ? `Ka ${totalSignals} sinjale mungese, por min stock dhe ROP jane 0.`
          : 'Produkti ka stok, por nuk ka prag per monitorim automatik.',
        productId: product.id,
        productName: product.name,
        supplierName: product.supplierName,
        action: 'Vendos min stock / ROP ose apliko ROP AI.',
      })
    }

    if (stock <= 0 && hasDemand) {
      pushIssue({
        id: `zero-demand:${product.id}`,
        category: 'STOCK',
        severity: 'HIGH',
        title: 'Stok zero me kerkese aktive',
        detail: `Produkti ka ${totalSignals} sinjale ne historik dhe stok aktual ${stock}.`,
        productId: product.id,
        productName: product.name,
        supplierName: product.supplierName,
        action: 'Kontrollo numerimin fizik dhe krijo porosi prioritare.',
      })
    }

    if (stock > 0 && hasDemand && stock <= Math.max(1, Number(product.reorderPoint ?? 0)) && !hasCriticalStockWarning) {
      pushIssue({
        id: `quiet-low:${product.id}`,
        category: 'STOCK',
        severity: 'MEDIUM',
        title: 'Stok afer pragut pa alarm te forte',
        detail: `Stok ${stock}, ROP ${product.reorderPoint}, sinjale ${totalSignals}.`,
        productId: product.id,
        productName: product.name,
        supplierName: product.supplierName,
        action: 'Rishiko pragun dhe safety stock per kete produkt.',
      })
    }

    if (!(product.aliases ?? []).length && normalizeQualityText(product.name).split(' ').length >= 2) {
      pushIssue({
        id: `aliases:${product.id}`,
        category: 'CATALOG',
        severity: 'LOW',
        title: 'Produkti pa alias',
        detail: 'Kerkimi dhe importi OCR jane me te sakta kur produkti ka emra alternative.',
        productId: product.id,
        productName: product.name,
        supplierName: product.supplierName,
        action: 'Shto alias per emrat qe perdor ekipa ose furnitori.',
      })
    }

    if (product.unitPrice == null && hasDemand) {
      pushIssue({
        id: `price:${product.id}`,
        category: 'PRICING',
        severity: 'LOW',
        title: 'Mungon cmimi per produkt aktiv',
        detail: `Ka ${totalSignals} sinjale, por nuk ka cmim per llogaritje kostoje.`,
        productId: product.id,
        productName: product.name,
        supplierName: product.supplierName,
        action: 'Ploteso cmimin e fundit nga oferta/importi.',
      })
    }
  })

  nameGroups.forEach((rows, key) => {
    const supplierCount = new Set(rows.map((row) => row.supplierName)).size
    if (rows.length < 2 || supplierCount < 2) return
    const totalSignals = rows.reduce((total, row) => total + sum(input.seriesByProduct.get(row.id) ?? []), 0)
    const primary = rows.slice().sort((a, b) => Number(b.currentStock ?? 0) - Number(a.currentStock ?? 0))[0]
    pushIssue({
      id: `duplicate:${key}`,
      category: 'DUPLICATE',
      severity: totalSignals > 0 ? 'MEDIUM' : 'LOW',
      title: 'Duplikat i mundshem ne katalog',
      detail: `"${primary.name}" gjendet te ${supplierCount} furnitore; mund te duhet preferred supplier ose alias i perbashket.`,
      productId: primary.id,
      productName: primary.name,
      supplierName: primary.supplierName,
      action: 'Vendos preferred supplier ose pastro emrat/aliaset.',
    })
  })

  input.deadStockAlerts.slice(0, 3).forEach((alert) => {
    pushIssue({
      id: `deadstock:${alert.productId}`,
      category: 'STOCK',
      severity: alert.riskLevel,
      title: alert.label === 'DEAD_STOCK' ? 'Dead stock i mundshem' : 'Overstock i mundshem',
      detail: alert.reason,
      productId: alert.productId,
      productName: alert.name,
      supplierName: alert.supplierName,
      action: alert.action,
    })
  })

  input.supplierScorecards
    .filter((supplier) => supplier.label === 'REVIEW')
    .slice(0, 3)
    .forEach((supplier) => {
      pushIssue({
        id: `supplier:${normalizeQualityText(supplier.supplierName)}`,
        category: 'SUPPLIER',
        severity: supplier.riskLevel,
        title: 'Furnitor ne review',
        detail: supplier.reason,
        supplierName: supplier.supplierName,
        action: supplier.action,
      })
    })

  const seen = new Set<string>()
  return issues
    .filter((issue) => {
      if (seen.has(issue.id)) return false
      seen.add(issue.id)
      return true
    })
    .sort((a, b) => {
      const rankDiff = qualityIssueRank(b) - qualityIssueRank(a)
      if (rankDiff !== 0) return rankDiff
      return a.title.localeCompare(b.title, 'sq-AL')
    })
    .slice(0, 8)
}

function buildAiExplanations(input: {
  ai: AiOverview
  stockWarnings: AiStockEarlyWarning[]
  supplierScorecards: AiSupplierScorecard[]
  abcXyzProducts: AiAbcXyzProduct[]
  dataQualityIssues: AiDataQualityIssue[]
}): AiDecisionExplanation[] {
  const explanations: AiDecisionExplanation[] = []

  input.stockWarnings.slice(0, 3).forEach((item) => {
    const confidence = clamp(
      Math.round(
        45 +
          Math.min(25, item.forecastNext7Days * 3) +
          (item.serviceLevel === 'CRITICAL' ? 12 : item.serviceLevel === 'HIGH' ? 8 : 4) +
          (item.daysLeft != null && item.daysLeft <= item.leadTimeDays + 2 ? 12 : 0)
      ),
      35,
      96
    )
    explanations.push({
      id: `safety:${item.productId}`,
      subject: item.name,
      decision: item.dynamicReorderPoint !== item.reorderPoint
        ? `ROP AI ${item.dynamicReorderPoint} dhe porosi e sugjeruar ${item.recommendedQty}`
        : `Mbaj ROP ${item.reorderPoint}; porosi e sugjeruar ${item.recommendedQty}`,
      technique: 'SAFETY_STOCK',
      confidence,
      riskLevel: item.riskLevel,
      factors: [
        `Stok aktual ${item.currentStock}`,
        `ROP aktual ${item.reorderPoint}`,
        `Lead time ${item.leadTimeDays} dite`,
        `Safety stock ${item.safetyStock}`,
        item.daysLeft != null ? `Mbulim rreth ${item.daysLeft} dite` : 'Mbulimi ditor i paqarte',
      ],
      formula: 'ROP dinamik = kerkesa gjate lead time + safety stock; safety stock perdor variabilitetin dhe service level.',
      sensitivity: 'Ndryshon nese lead time, ritmi i mungesave, stoku fizik ose urgjencat e fundit ndryshojne.',
    })
  })

  input.ai.topRiskProducts.slice(0, 2).forEach((item) => {
    explanations.push({
      id: `forecast:${item.productId}`,
      subject: item.name,
      decision: `Prioritet ri-porosie me sasi ${item.recommendedQty}`,
      technique: 'FORECAST',
      confidence: item.confidence,
      riskLevel: item.riskLevel,
      factors: [
        `Parashikim 7 dite: ${item.forecastNext7Days}`,
        `Risk score ${item.riskScore}`,
        `Anomaly score ${item.anomalyScore}`,
        `Furnitor: ${item.supplierName}`,
      ],
      formula: 'Forecast kombinon mesataren e fundit, trendin 7/14 ditor, volatilitetin dhe sinjalet urgjente.',
      sensitivity: 'Ndryshon me mungesa te reja, anulime, korrigjim sasie ose ndryshim te ritmit javor.',
    })
  })

  input.abcXyzProducts.slice(0, 2).forEach((item) => {
    explanations.push({
      id: `abcxyz:${item.productId}`,
      subject: item.name,
      decision: `Klasifikim ${item.combinedClass}`,
      technique: 'ABC_XYZ',
      confidence: clamp(Math.round(52 + Math.min(30, item.totalSignals * 3) - Math.min(12, item.variability * 4)), 35, 92),
      riskLevel: item.riskLevel,
      factors: [
        `ABC ${item.abcClass}: pesha/frekuenca e sinjaleve`,
        `XYZ ${item.xyzClass}: variabilitet ${item.variability}`,
        `${item.totalSignals} sinjale historike`,
        `Furnitor: ${item.supplierName}`,
      ],
      formula: 'ABC bazohet ne kontributin kumulativ te sinjaleve; XYZ bazohet ne koeficientin e variacionit.',
      sensitivity: 'Ndryshon kur shtohen sinjale te reja ose kerkesa behet me e qendrueshme/me e paparashikueshme.',
    })
  })

  input.supplierScorecards.slice(0, 2).forEach((item) => {
    explanations.push({
      id: `supplier:${normalizeQualityText(item.supplierName)}`,
      subject: item.supplierName,
      decision: `Status furnitori: ${item.label}`,
      technique: 'SUPPLIER_SCORE',
      confidence: clamp(Math.round(45 + Math.min(25, item.productCount * 3) + Math.min(20, item.shortageCount * 2)), 35, 90),
      riskLevel: item.riskLevel,
      factors: [
        `${item.shortageCount} mungesa`,
        `${item.urgentCount} urgjente`,
        `${item.criticalProductCount} produkte kritike`,
        item.averageLeadTimeDays != null ? `Lead time mesatar ${item.averageLeadTimeDays} dite` : 'Lead time i paplotesuar',
      ],
      formula: 'Supplier score peshon mungesat, urgjencat, produktet kritike, lead time dhe presionin nga alternativat.',
      sensitivity: 'Ndryshon nese permiresohet lead time, ulen urgjencat ose caktohen furnitore alternative.',
    })
  })

  input.dataQualityIssues.slice(0, 2).forEach((item) => {
    explanations.push({
      id: `quality:${item.id}`,
      subject: item.productName ?? item.supplierName ?? item.title,
      decision: item.title,
      technique: 'DATA_QUALITY',
      confidence: item.severity === 'HIGH' ? 88 : item.severity === 'MEDIUM' ? 72 : 58,
      riskLevel: item.severity,
      factors: [
        `Kategoria: ${item.category}`,
        item.detail,
        item.productName ? `Produkt: ${item.productName}` : item.supplierName ? `Furnitor: ${item.supplierName}` : 'Audit i pergjithshem',
      ],
      formula: 'Audit-i perdor rregulla deterministike mbi pragje, stok, duplikate, metadata, cmime dhe furnitore me risk.',
      sensitivity: 'Ndryshon kur plotesohen te dhenat, pastrohen duplikatet ose korrigjohet stoku/pragu.',
    })
  })

  return explanations
    .sort((a, b) => {
      const riskDiff = riskRank(b.riskLevel) - riskRank(a.riskLevel)
      if (riskDiff !== 0) return riskDiff
      return b.confidence - a.confidence
    })
    .slice(0, 6)
}

function buildOrderDetails(items: ShortageView[]): {
  lines: OwnerOrderLine[]
  aiEstimatedCost: number | null
  aiMaxLeadTimeDays: number | null
  aiCoverageDays: number | null
  aiPriority: AiOrderPriority
  aiSummary: string
} {
  const lines: OwnerOrderLine[] = items.map((row) => ({
    productName: row.productName,
    qty: Math.max(1, Number(row.suggestedQty ?? 1)),
    urgent: Boolean(row.urgent),
    estimatedCost:
      row.aiEstimatedCost != null
        ? Number(row.aiEstimatedCost)
        : row.unitPrice != null
          ? roundMoney(Math.max(1, Number(row.suggestedQty ?? 1)) * Number(row.unitPrice))
          : null,
    leadTimeDays: row.leadTimeDays,
    coverageDays: row.aiCoverageDays,
    priority: row.aiOrderPriority,
  }))

  const costValues = lines
    .map((line) => Number(line.estimatedCost))
    .filter((value) => Number.isFinite(value) && value > 0)
  const leadValues = lines
    .map((line) => Number(line.leadTimeDays))
    .filter((value) => Number.isFinite(value) && value >= 0)
  const coverageValues = lines
    .map((line) => Number(line.coverageDays))
    .filter((value) => Number.isFinite(value) && value > 0)
  const topLine =
    lines
      .slice()
      .sort((a, b) => {
        const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority)
        if (priorityDiff !== 0) return priorityDiff
        return Number(b.qty ?? 0) - Number(a.qty ?? 0)
      })[0] ?? null
  const aiEstimatedCost = costValues.length ? roundMoney(costValues.reduce((sum, value) => sum + value, 0)) : null
  const aiMaxLeadTimeDays = leadValues.length ? Math.max(...leadValues) : null
  const aiCoverageDays = coverageValues.length ? Math.round(Math.min(...coverageValues) * 10) / 10 : null
  const aiPriority = lines.reduce<AiOrderPriority>(
    (best, line) => (priorityRank(line.priority) > priorityRank(best) ? line.priority ?? best : best),
    'LOW'
  )
  const summaryParts = [`Prioritet ${priorityLabel(aiPriority)}`]
  if (topLine?.productName) summaryParts.push(`fokus ${topLine.productName}`)
  if (aiCoverageDays != null) summaryParts.push(`mbulim ~${aiCoverageDays} dite`)
  if (aiMaxLeadTimeDays != null) summaryParts.push(`lead deri ${aiMaxLeadTimeDays} dite`)
  if (aiEstimatedCost != null) summaryParts.push(`kosto ~${aiEstimatedCost.toFixed(2)} EUR`)
  return {
    lines,
    aiEstimatedCost,
    aiMaxLeadTimeDays,
    aiCoverageDays,
    aiPriority,
    aiSummary: summaryParts.join(', '),
  }
}

export function formatOwnerOrderReceipt(order: OwnerOrder): string {
  const date = new Date().toLocaleString('sq-AL')
  const aiLines: string[] = []
  if (order.aiPriority) aiLines.push(`AI prioriteti: ${order.aiPriority}`)
  if (order.aiCoverageDays != null) aiLines.push(`AI mbulim: ${order.aiCoverageDays.toFixed(1)} dite`)
  if (order.aiMaxLeadTimeDays != null) aiLines.push(`AI lead time: ${order.aiMaxLeadTimeDays} dite`)
  if (order.aiEstimatedCost != null) aiLines.push(`AI kosto: ${order.aiEstimatedCost.toFixed(2)} EUR`)
  if (order.aiSummary) aiLines.push(`AI rekomandim: ${order.aiSummary}`)

  return `POROSI MUNGESASH
Data: ${date}
Furnitori: ${order.supplier}
ID: #${order.id}
${aiLines.length ? `${aiLines.join('\n')}\n` : ''}---------------------------
${order.items.join('\n')}

Shenim: Ju lutem konfirmoni disponueshmerine dhe kohen e dorezimit.`
}

export function formatOwnerOrderWhatsappMessage(order: OwnerOrder): string {
  const date = new Date().toLocaleDateString('sq-AL')
  const aiContext: string[] = []
  if (order.aiPriority) aiContext.push(`prioritet ${priorityLabel(order.aiPriority)}`)
  if (order.aiCoverageDays != null) aiContext.push(`mbulim rreth ${order.aiCoverageDays.toFixed(1)} dite`)
  if (order.aiEstimatedCost != null) aiContext.push(`vlere rreth ${order.aiEstimatedCost.toFixed(2)} EUR`)
  const aiSummary = aiContext.length ? `AI: ${aiContext.join(', ')}.` : ''
  const items = order.items.map((item) => `- ${String(item ?? '').replace(/\s+/g, ' ').trim()}`).join('\n')

  return `Pershendetje ${order.supplier},

Po ju dergoj porosine e dates ${date}.
${aiSummary ? `${aiSummary}\n` : ''}Produktet e kerkuara:
${items}

Ju lutem na konfirmoni:
1. Disponueshmerine per secilin produkt
2. Cmimin e perditesuar
3. Kohen e dorezimit / ETA
4. Alternativat nese ndonje artikull mungon

Faleminderit.`
}

function parseOwnerOrderReceiptAi(receiptText: string): Pick<
  OwnerOrder,
  'aiEstimatedCost' | 'aiMaxLeadTimeDays' | 'aiCoverageDays' | 'aiPriority' | 'aiSummary'
> {
  const text = String(receiptText ?? '')
  const priorityMatch = text.match(/AI prioriteti:\s*(HIGH|MEDIUM|LOW)/i)
  const coverageMatch = text.match(/AI mbulim:\s*([0-9]+(?:\.[0-9]+)?)\s*dite/i)
  const leadMatch = text.match(/AI lead time:\s*([0-9]+)\s*dite/i)
  const costMatch = text.match(/AI kosto:\s*([0-9]+(?:\.[0-9]+)?)\s*EUR/i)
  const summaryMatch = text.match(/AI rekomandim:\s*(.+)/i)
  return {
    aiPriority: priorityMatch ? (priorityMatch[1].toUpperCase() as AiOrderPriority) : undefined,
    aiCoverageDays: coverageMatch ? Number(coverageMatch[1]) : undefined,
    aiMaxLeadTimeDays: leadMatch ? Number(leadMatch[1]) : undefined,
    aiEstimatedCost: costMatch ? Number(costMatch[1]) : undefined,
    aiSummary: summaryMatch ? summaryMatch[1].trim() : undefined,
  }
}

function fromMockShortages(rows: MockMissingItem[]): ShortageView[] {
  return rows.map((r) => {
    const baseSuggestedQty = Math.max(1, Number(r.suggestedQty ?? 1))
    const forecastPerDay = Math.max(0.3, baseSuggestedQty / 5)
    const forecastNext7Days = Math.max(baseSuggestedQty, Math.round(forecastPerDay * 7))
    const aiRiskScore = r.urgent ? 78 : 46
    const aiRiskLevel: AiRiskLevel = r.urgent ? 'HIGH' : 'MEDIUM'
    const plan = optimizeReorderPlan({
      productName: r.product.name,
      supplierName: r.product.supplier,
      suggestedQty: baseSuggestedQty,
      forecastPerDay,
      forecastNext7Days,
      aiRiskScore,
      aiRiskLevel,
      urgentNow: r.urgent,
      unitPrice: r.product.unitPrice,
      leadTimeDays: r.product.leadTimeDays,
      minOrderQty: r.product.minOrderQty,
    })
    return {
      id: r.id,
      productId: r.product.id,
      productName: r.product.name,
      supplierName: r.product.supplier,
      urgent: r.urgent,
      note: r.note,
      addedCount: r.addedCount,
      suggestedQty: plan.optimizedQty,
      unitPrice: r.product.unitPrice,
      leadTimeDays: r.product.leadTimeDays,
      minOrderQty: r.product.minOrderQty,
      aiSuggestedQty: baseSuggestedQty,
      aiConfidence: 42,
      aiRiskScore,
      aiRiskLevel,
      aiReason: r.urgent ? 'Urgjence aktive' : 'Bazuar ne mungesat e ruajtura lokalisht',
      aiForecastPerDay: forecastPerDay,
      aiForecastNext7Days: forecastNext7Days,
      aiOptimizedQty: plan.optimizedQty,
      aiCoverageDays: plan.coverageDays,
      aiEstimatedCost: plan.estimatedCost,
      aiOrderPriority: plan.priority,
      aiOrderAction: plan.action,
      createdById: undefined,
      createdByRole: undefined,
      createdByLabel: undefined,
    }
  })
}

function fromMockProducts(rows: MockProduct[]): ProductView[] {
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    genericName: p.genericName ?? undefined,
    defaultOrderQty: 1,
    supplierName: p.supplier,
    category: p.category,
    aliases: p.aliases ?? [],
    unitPrice: p.unitPrice,
    leadTimeDays: p.leadTimeDays,
    minOrderQty: p.minOrderQty,
    offerPriority: p.offerPriority,
    isActiveOffer: p.isActiveOffer,
    currentStock: toSafeInteger(p.currentStock, 0),
    minStock: Math.max(0, toSafeInteger(p.minStock, 0)),
    reorderPoint: Math.max(0, toSafeInteger(p.reorderPoint, p.minStock ?? 0)),
  }))
}

export async function getProducts(): Promise<ProductView[]> {
  if (!isSupabaseConfigured) return fromMockProducts(getProductsMock())
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return []

  const [productsRes, stockRes] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id,name,generic_name,default_order_qty,category,aliases,supplier_id,unit_price,lead_time_days,min_order_qty,offer_priority,is_active_offer,min_stock,reorder_point,suppliers(name)'
      )
      .eq('company_id', companyId)
      .order('name'),
    supabase.rpc('current_stock_by_product'),
  ])

  if (productsRes.error || !productsRes.data) return []

  const stockByProduct = new Map<string, number>()
  if (!stockRes.error && Array.isArray(stockRes.data)) {
    for (const row of stockRes.data as Array<{ product_id?: unknown; current_stock?: unknown }>) {
      const productId = String(row.product_id ?? '').trim()
      if (!productId) continue
      stockByProduct.set(productId, toSafeInteger(row.current_stock, 0))
    }
  }

  return productsRes.data.map((row: any) => ({
    id: row.id,
    name: row.name,
    genericName: row.generic_name ?? undefined,
    defaultOrderQty: Number(row.default_order_qty ?? 1),
    supplierId: row.supplier_id ?? undefined,
    supplierName: row.suppliers?.name ?? 'Pa furnitor',
    category: row.category === 'front' ? 'front' : 'barna',
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    unitPrice: typeof row.unit_price === 'number' ? row.unit_price : row.unit_price != null ? Number(row.unit_price) : undefined,
    leadTimeDays:
      typeof row.lead_time_days === 'number'
        ? row.lead_time_days
        : row.lead_time_days != null
          ? Number(row.lead_time_days)
          : undefined,
    minOrderQty:
      typeof row.min_order_qty === 'number'
        ? row.min_order_qty
        : row.min_order_qty != null
          ? Number(row.min_order_qty)
          : undefined,
    offerPriority:
      typeof row.offer_priority === 'number'
        ? row.offer_priority
        : row.offer_priority != null
          ? Number(row.offer_priority)
          : undefined,
    isActiveOffer: typeof row.is_active_offer === 'boolean' ? row.is_active_offer : undefined,
    currentStock: toSafeInteger(stockByProduct.get(String(row.id ?? '').trim()), 0),
    minStock: Math.max(0, toSafeInteger(row.min_stock, 0)),
    reorderPoint: Math.max(0, toSafeInteger(row.reorder_point, row.min_stock ?? 0)),
  }))
}

export async function getSuppliers(): Promise<SupplierView[]> {
  if (!isSupabaseConfigured) {
    const grouped = new Map<string, number>()
    fromMockProducts(getProductsMock()).forEach((p) => {
      grouped.set(p.supplierName, (grouped.get(p.supplierName) ?? 0) + 1)
    })
    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'sq-AL'))
      .map(([name, count], idx) => ({ id: `mock-${idx}`, name, productCount: count }))
  }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return []
  const { data, error } = await supabase
    .from('suppliers')
    .select('id,name,products(count)')
    .eq('company_id', companyId)
    .order('name')
  if (error || !data) return []
  return data.map((row: any) => ({
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    productCount: Number(row.products?.[0]?.count ?? 0),
  }))
}

export async function addSupplier(name: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supplierName = name.trim()
  if (!supplierName) return { ok: false, message: 'Shkruaj emrin e furnitorit.' }
  if (!isSupabaseConfigured) return { ok: true }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }
  const existing = await supabase
    .from('suppliers')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', supplierName)
    .limit(1)
    .maybeSingle()
  if (existing.data?.id) return { ok: false, message: 'Ky furnitor ekziston.' }
  const ins = await supabase.from('suppliers').insert({ name: supplierName, company_id: companyId })
  if (ins.error) return { ok: false, message: ins.error.message }
  return { ok: true }
}

export async function renameSupplier(id: string, name: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supplierId = id.trim()
  const supplierName = name.trim()
  if (!supplierId) return { ok: false, message: 'ID e furnitorit mungon.' }
  if (!supplierName) return { ok: false, message: 'Shkruaj emrin e furnitorit.' }
  if (!isSupabaseConfigured) return { ok: true }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }
  const duplicate = await supabase
    .from('suppliers')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', supplierName)
    .limit(1)
    .maybeSingle()
  if (duplicate.data?.id && duplicate.data.id !== supplierId) {
    return { ok: false, message: 'Ekziston furnitor me këtë emër.' }
  }
  const up = await supabase
    .from('suppliers')
    .update({ name: supplierName })
    .eq('id', supplierId)
    .eq('company_id', companyId)
  if (up.error) return { ok: false, message: up.error.message }
  return { ok: true }
}

export async function deleteSupplier(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supplierId = id.trim()
  if (!supplierId) return { ok: false, message: 'ID e furnitorit mungon.' }
  if (!isSupabaseConfigured) return { ok: true }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }
  const used = await supabase
    .from('products')
    .select('id')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .limit(1)
    .maybeSingle()
  if (used.data?.id) {
    return { ok: false, message: 'Furnitori ka produkte aktive. Hiqi ose ndrysho furnitorin e produkteve.' }
  }
  const del = await supabase.from('suppliers').delete().eq('id', supplierId).eq('company_id', companyId)
  if (del.error) return { ok: false, message: del.error.message }
  return { ok: true }
}

export async function getPreferredProductByName(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {}
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return {}
  const { data, error } = await supabase
    .from('product_supplier_preferences')
    .select('product_name_norm,preferred_product_id')
    .eq('company_id', companyId)
  if (error || !data) return {}
  const out: Record<string, string> = {}
  for (const row of data as Array<{ product_name_norm?: unknown; preferred_product_id?: unknown }>) {
    const key = String(row.product_name_norm ?? '').trim().toLocaleLowerCase('sq-AL')
    const value = String(row.preferred_product_id ?? '').trim()
    if (key && value) out[key] = value
  }
  return out
}

export async function setPreferredProductByName(
  productName: string,
  productId: string,
  supplierId?: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const key = productName.trim().toLocaleLowerCase('sq-AL')
  const value = productId.trim()
  if (!key) return { ok: false, message: 'Emri i produktit mungon.' }
  if (!value) return { ok: false, message: 'Produkti i preferuar mungon.' }
  if (!isSupabaseConfigured) return { ok: true }
  const { data: authData } = await supabase.auth.getUser()
  const ownerId = authData.user?.id
  const companyId = await resolveCurrentCompanyId()
  if (!ownerId || !companyId) return { ok: false, message: 'User jo i kyçur.' }
  const upsert = await supabase.from('product_supplier_preferences').upsert(
    {
      company_id: companyId,
      owner_id: ownerId,
      product_name_norm: key,
      preferred_product_id: value,
      preferred_supplier_id: supplierId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,product_name_norm' }
  )
  if (upsert.error) return { ok: false, message: upsert.error.message }
  return { ok: true }
}

export async function getCompanyDetails(): Promise<CompanyDetails> {
  const empty: CompanyDetails = { name: '', posName: '', address: '', phone: '', email: '', logoUrl: '', otherInfo: '' }
  if (!isSupabaseConfigured) return empty
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return empty
  const { data: authData } = await supabase.auth.getUser()
  const userEmail = String(authData.user?.email ?? '').trim()
  const companyRes = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle()
  const companyName = String((companyRes.data as { name?: unknown } | null)?.name ?? '').trim()
  const fallback: CompanyDetails = {
    name: companyName,
    posName: companyName,
    address: '',
    phone: '',
    email: userEmail,
    logoUrl: '',
    otherInfo: '',
  }
  const { data, error } = await supabase
    .from('company_details')
    .select('name,pos_name,address,phone,email,logo_url,other_info')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error || !Array.isArray(data) || !data.length) return fallback
  const d = data[0] as Record<string, unknown>
  return {
    name: String(d.name ?? '').trim() || fallback.name,
    posName: String(d.pos_name ?? '').trim() || fallback.posName,
    address: String(d.address ?? '').trim() || fallback.address,
    phone: String(d.phone ?? '').trim() || fallback.phone,
    email: String(d.email ?? '').trim() || fallback.email,
    logoUrl: String(d.logo_url ?? '').trim() || fallback.logoUrl,
    otherInfo: String(d.other_info ?? '').trim() || fallback.otherInfo,
  }
}

export async function updateCompanyDetails(input: CompanyDetails): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: true }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }
  const { data: authData } = await supabase.auth.getUser()
  const userId = String(authData.user?.id ?? '').trim()
  const baseValues = {
    name: input.name.trim(),
    pos_name: input.posName.trim(),
    address: input.address.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    logo_url: input.logoUrl.trim(),
    other_info: input.otherInfo.trim(),
    updated_at: new Date().toISOString(),
  }
  const insertWithFallbacks = async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const insertCandidates: Array<Record<string, unknown>> = [
      {
        company_id: companyId,
        owner_id: userId || null,
        ...baseValues,
        branch_name: '',
        business_number: '',
      },
      {
        company_id: companyId,
        owner_id: userId || null,
        ...baseValues,
      },
      {
        owner_id: userId || null,
        ...baseValues,
      },
    ]
    for (const payload of insertCandidates) {
      const attempt = await supabase.from('company_details').insert(payload)
      if (!attempt.error) return { ok: true }
      const msg = String(attempt.error.message ?? '')
      const shouldTryNext =
        /column .* does not exist|branch_name|business_number|company_id|owner_id/i.test(msg)
      if (!shouldTryNext) return { ok: false, message: attempt.error.message }
    }
    return { ok: false, message: 'Nuk u ruajtën të dhënat e kompanisë.' }
  }

  const updateByCompany = await supabase
    .from('company_details')
    .update(baseValues)
    .eq('company_id', companyId)
    .select('company_id')
  if (!updateByCompany.error && Array.isArray(updateByCompany.data) && updateByCompany.data.length > 0) {
    return { ok: true }
  }

  if (updateByCompany.error) {
    const updateByOwner = await supabase
      .from('company_details')
      .update(baseValues)
      .eq('owner_id', userId)
      .select('owner_id')
    if (!updateByOwner.error && Array.isArray(updateByOwner.data) && updateByOwner.data.length > 0) {
      return { ok: true }
    }
    if (updateByOwner.error) {
      const msg = String(updateByOwner.error.message ?? '')
      const recoverable = /column .* does not exist|company_id|owner_id/i.test(msg)
      if (!recoverable) return { ok: false, message: updateByOwner.error.message }
    }
  }

  return insertWithFallbacks()
}

export async function adminCreateUser(input: {
  email?: string
  password: string
  username?: string
  role: 'OWNER' | 'MANAGER' | 'WORKER'
}): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const emailInput = String(input.email ?? '').trim().toLocaleLowerCase('sq-AL')
  const usernameInput = String(input.username ?? '').trim().toLocaleLowerCase('sq-AL')
  const email = emailInput || (usernameInput ? `${usernameInput}@smartmanage.local` : '')
  if (!email) return { ok: false, message: 'Email mungon.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Shkruaj një email valid.' }
  }
  const localPart = email.split('@')[0] ?? ''
  const sanitizedLocalPart = localPart.replace(/[^a-z0-9._-]/gi, '.').replace(/[._-]{2,}/g, '.')
  let username = (usernameInput || sanitizedLocalPart).replace(/^[._-]+|[._-]+$/g, '')
  if (username.length < 3) username = `${username}usr`.slice(0, 32)
  if (username.length > 32) username = username.slice(0, 32)
  const password = input.password
  const role = input.role === 'OWNER' ? 'OWNER' : input.role === 'MANAGER' ? 'MANAGER' : 'WORKER'
  if (!password || password.length < 6) return { ok: false, message: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.' }
  if (username.length < 3 || username.length > 32) {
    return { ok: false, message: 'Username duhet të ketë 3-32 karaktere.' }
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return { ok: false, message: 'Username lejon vetëm a-z, 0-9, ., _, -.' }
  }
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase nuk është i konfiguruar.' }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }
  const existingInCompany = await supabase
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('username', username)
    .maybeSingle()
  if (existingInCompany.error) {
    return { ok: false, message: existingInCompany.error.message }
  }
  if (existingInCompany.data?.id) {
    return {
      ok: false,
      message:
        'Ky username ekziston tashmë në këtë kompani. Përdor username tjetër ose përditëso user-in ekzistues.',
    }
  }
  const isRpcMissing = (err: unknown): boolean => {
    const code = typeof err === 'object' && err && 'code' in err ? String((err as any).code ?? '') : ''
    const msg = typeof err === 'object' && err && 'message' in err ? String((err as any).message ?? '') : ''
    const msgLower = msg.toLowerCase()
    const referencesTargetRpc =
      msgLower.includes('admin_create_user') ||
      msgLower.includes('public.admin_create_user') ||
      msgLower.includes('could not find the function')
    return (
      code === 'PGRST202' ||
      (code === '42883' && referencesTargetRpc) ||
      referencesTargetRpc
    )
  }
  const isAlreadyRegistered = (err: unknown): boolean => {
    const msg = typeof err === 'object' && err && 'message' in err ? String((err as any).message ?? '') : ''
    return /already registered|already been registered|user already registered|already exists|duplicate/i.test(
      msg.toLowerCase()
    )
  }
  let data: unknown = null
  let error: any = null

  // Use only the unique email RPC to avoid PostgREST confusion
  // from overloaded legacy admin_create_user signatures.
  const emailRpcResult = await supabase.rpc('admin_create_user_email', {
    p_email: email,
    p_password: password,
    p_role: role,
    p_username: username,
  })
  data = emailRpcResult.data
  error = emailRpcResult.error

  if (!error) {
    const userId = String(data ?? '').trim()
    if (!userId) return { ok: false, message: 'Krijimi i përdoruesit dështoi (nuk u kthye userId).' }
    const verify = await supabase
      .from('profiles')
      .select('id,company_id')
      .eq('id', userId)
      .maybeSingle()

    if (verify.error) return { ok: false, message: verify.error.message }
    const assignedCompanyId = String((verify.data as { company_id?: unknown } | null)?.company_id ?? '').trim()
    if (!assignedCompanyId || assignedCompanyId !== companyId) {
      return { ok: false, message: 'User u krijua por jo në kompaninë aktive. Kontrollo company_id te profile.' }
    }
    return { ok: true, userId }
  }

  if (error && isRpcMissing(error)) {
    const rawCode = String((error as { code?: unknown })?.code ?? '').trim()
    const rawMessage = String((error as { message?: unknown })?.message ?? '').trim()
    return {
      ok: false,
      message:
        `RPC admin_create_user_email nuk u gjet. Ekzekuto migrimin 20260329224500_admin_create_user_email_rpc.sql dhe pastaj: notify pgrst, 'reload schema'. (${rawCode || 'no-code'} ${rawMessage || ''})`,
    }
  }
  if (error) {
    if (isAlreadyRegistered(error)) {
      return {
        ok: false,
        message:
          'Ky username/email ekziston tashmë. Nëse ky user nuk kyçet, fshije dhe krijoje prapë pas migrimit të fundit SQL.',
      }
    }
    return { ok: false, message: error.message }
  }
  const userId = String(data ?? '').trim()
  if (!userId) return { ok: false, message: 'Krijimi i përdoruesit dështoi.' }
  const verify = await supabase
    .from('profiles')
    .select('id,company_id')
    .eq('id', userId)
    .maybeSingle()
  if (verify.error) return { ok: false, message: verify.error.message }
  const assignedCompanyId = String((verify.data as { company_id?: unknown } | null)?.company_id ?? '').trim()
  if (!assignedCompanyId || assignedCompanyId !== companyId) {
    return { ok: false, message: 'User u krijua por jo në kompaninë aktive. Kontrollo company_id te profile.' }
  }
  return { ok: true, userId }
}

export async function adminUpdateUserRole(
  userId: string,
  role: 'OWNER' | 'MANAGER' | 'WORKER'
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = userId.trim()
  if (!id) return { ok: false, message: 'ID e përdoruesit mungon.' }
  if (!isSupabaseConfigured) return { ok: true }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }
  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id')
  if (error) return { ok: false, message: error.message }
  if (!Array.isArray(data) || !data.length) {
    return { ok: false, message: 'Përdoruesi nuk u gjet në kompaninë aktive.' }
  }
  return { ok: true }
}

export async function adminUpdateUsername(
  userId: string,
  username: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = userId.trim()
  const nextUsername = username.trim().toLocaleLowerCase('sq-AL')
  if (!id) return { ok: false, message: 'ID e përdoruesit mungon.' }
  if (nextUsername.length < 3 || nextUsername.length > 32) {
    return { ok: false, message: 'Username duhet të ketë 3-32 karaktere.' }
  }
  if (!/^[a-z0-9._-]+$/.test(nextUsername)) {
    return { ok: false, message: 'Username lejon vetëm a-z, 0-9, ., _, -.' }
  }
  if (!isSupabaseConfigured) return { ok: true }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }
  const dupe = await supabase
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('username', nextUsername)
    .neq('id', id)
    .maybeSingle()
  if (dupe.error) return { ok: false, message: dupe.error.message }
  if (dupe.data?.id) return { ok: false, message: 'Ky username përdoret nga një user tjetër.' }
  const { data, error } = await supabase
    .from('profiles')
    .update({ username: nextUsername, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id')
  if (error) return { ok: false, message: error.message }
  if (!Array.isArray(data) || !data.length) {
    return { ok: false, message: 'Përdoruesi nuk u gjet në kompaninë aktive.' }
  }
  return { ok: true }
}

export async function adminUpdateUserPassword(
  userId: string,
  password: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = userId.trim()
  const nextPassword = String(password ?? '')
  if (!id) return { ok: false, message: 'ID e përdoruesit mungon.' }
  if (nextPassword.length < 6) {
    return { ok: false, message: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.' }
  }
  if (!isSupabaseConfigured) return { ok: true }

  const { error } = await supabase.rpc('admin_update_user_password', {
    p_user_id: id,
    p_password: nextPassword,
  })
  if (!error) return { ok: true }

  const code = String(error.code ?? '').trim()
  const message = String(error.message ?? '').trim()
  const lower = message.toLowerCase()
  const rpcMissing =
    code === 'PGRST202' ||
    lower.includes('admin_update_user_password') ||
    lower.includes('could not find the function')

  if (rpcMissing) {
    return {
      ok: false,
      message:
        "RPC admin_update_user_password nuk u gjet. Ekzekuto migrimin 20260331193000_admin_update_user_password_rpc.sql dhe pastaj: notify pgrst, 'reload schema'.",
    }
  }
  if (lower.includes('invalid_password')) {
    return { ok: false, message: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.' }
  }
  if (lower.includes('forbidden_owner_only')) {
    return { ok: false, message: 'Vetëm OWNER mund të ndryshojë fjalëkalimin e përdoruesve.' }
  }
  if (lower.includes('forbidden_other_company')) {
    return { ok: false, message: 'Përdoruesi nuk i përket kompanisë aktive.' }
  }
  if (lower.includes('user_not_found') || lower.includes('auth_user_not_found')) {
    return { ok: false, message: 'Përdoruesi nuk u gjet.' }
  }

  return { ok: false, message: message || 'Ndryshimi i fjalëkalimit dështoi.' }
}

export async function adminSetUserActive(
  userId: string,
  isActive: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = userId.trim()
  if (!id) return { ok: false, message: 'ID e përdoruesit mungon.' }
  if (!isSupabaseConfigured) return { ok: true }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }
  const updatePayload: Record<string, unknown> = {
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }
  if (!isActive) updatePayload.active_session_id = null
  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id')
  if (error) return { ok: false, message: error.message }
  if (!Array.isArray(data) || !data.length) {
    return { ok: false, message: 'Përdoruesi nuk u gjet në kompaninë aktive.' }
  }
  return { ok: true }
}

export async function adminDeleteUser(userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = userId.trim()
  if (!id) return { ok: false, message: 'ID e përdoruesit mungon.' }
  if (!isSupabaseConfigured) return { ok: true }
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: id })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function getDashboardInsights(
  days = 7,
  productsInput?: ProductView[] | Promise<ProductView[]>
): Promise<DashboardInsights> {
  const safeDays = Math.max(1, Math.min(30, Math.floor(days)))
  const weekdayLabels = ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die']
  const buildRange = (anchorIso: string): string[] => {
    const anchor = new Date(`${anchorIso}T00:00:00`)
    if (Number.isNaN(anchor.getTime())) {
      const d = new Date()
      return Array.from({ length: safeDays }, (_, idx) => shiftIsoDays(d, -(safeDays - 1 - idx)))
    }
    return Array.from({ length: safeDays }, (_, idx) => shiftIsoDays(anchor, -(safeDays - 1 - idx)))
  }
  const today = new Date()
  const defaultRange = Array.from({ length: safeDays }, (_, idx) => shiftIsoDays(today, -(safeDays - 1 - idx)))
  const emptyTrend = defaultRange.map((date) => ({ date, count: 0 }))
  const emptyWeekdays = weekdayLabels.map((day) => ({ day, count: 0 }))

  if (!isSupabaseConfigured) {
    const shortages = fromMockShortages(getShortagesMock())
    const products = fromMockProducts(getProductsMock())
    const supplierMap = new Map<string, number>()
    const productMap = new Map<string, number>()
    const weekdayMap = new Map<string, number>(weekdayLabels.map((day) => [day, 0]))
    const analysisRange = buildIsoRangeFromAnchor(todayIso(), 30)
    const historyRows = shortages.map((row) => ({
      day: analysisRange[analysisRange.length - 1],
      productId: row.productId,
      count: row.addedCount,
    }))
    const seriesByProduct = buildProductDailySeries(analysisRange, historyRows)
    let urgent = 0
    let normal = 0
    for (const row of shortages) {
      const c = Math.max(1, Number(row.addedCount ?? 1))
      supplierMap.set(row.supplierName, (supplierMap.get(row.supplierName) ?? 0) + c)
      productMap.set(row.productName, (productMap.get(row.productName) ?? 0) + c)
      if (row.urgent) urgent += c
      else normal += c
      const dayIndex = new Date().getDay()
      const mondayIndex = (dayIndex + 6) % 7
      const dayLabel = weekdayLabels[mondayIndex]
      weekdayMap.set(dayLabel, (weekdayMap.get(dayLabel) ?? 0) + c)
    }
    if (emptyTrend.length) emptyTrend[emptyTrend.length - 1].count = shortages.length
    const ai = buildAiOverview(
      [...seriesByProduct.entries()].map(([productId, dailySeries]) => {
        const product = products.find((row) => row.id === productId)
        return {
          productId,
          name: product?.name ?? 'Produkt',
          supplierName: product?.supplierName ?? 'Pa furnitor',
          dailySeries,
          defaultOrderQty: product?.defaultOrderQty ?? 1,
          addedCount: dailySeries[dailySeries.length - 1] ?? 0,
          urgentNow: shortages.some((row) => row.productId === productId && row.urgent),
        }
      })
    )
    const stockSignals = buildStockSignals({
      products,
      analysisRange,
      seriesByProduct,
      urgentRecentByProduct: new Map(
        shortages.filter((row) => row.urgent).map((row) => [row.productId, Number(row.addedCount ?? 1)])
      ),
    })
    const abcXyzProducts = buildAbcXyzAnalysis({ products, seriesByProduct })
    const supplierScorecards = buildSupplierScorecards({
      products,
      seriesByProduct,
      urgentRecentByProduct: new Map(
        shortages.filter((row) => row.urgent).map((row) => [row.productId, Number(row.addedCount ?? 1)])
      ),
      stockWarnings: stockSignals.stockWarnings,
      abcXyzProducts,
    })
    const dataQualityIssues = buildDataQualityAudit({
      products,
      seriesByProduct,
      stockWarnings: stockSignals.stockWarnings,
      deadStockAlerts: stockSignals.deadStockAlerts,
      supplierScorecards,
    })
    const explanations = buildAiExplanations({
      ai,
      stockWarnings: stockSignals.stockWarnings,
      supplierScorecards,
      abcXyzProducts,
      dataQualityIssues,
    })
    return {
      shortageTrend: emptyTrend,
      topSuppliers: [...supplierMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
      topProducts: [...productMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
      urgentBreakdown: { urgent, normal },
      weekdayTrend: weekdayLabels.map((day) => ({ day, count: weekdayMap.get(day) ?? 0 })),
      ai,
      ...stockSignals,
      supplierScorecards,
      abcXyzProducts,
      dataQualityIssues,
      explanations,
    }
  }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) {
    return {
      shortageTrend: emptyTrend,
      topSuppliers: [],
      topProducts: [],
      urgentBreakdown: { urgent: 0, normal: 0 },
      weekdayTrend: emptyWeekdays,
      ai: emptyAiOverview(),
      stockWarnings: [],
      deadStockAlerts: [],
      supplierScorecards: [],
      abcXyzProducts: [],
      dataQualityIssues: [],
      explanations: [],
    }
  }

  const latestShortageRes = await supabase
    .from('mungesat')
    .select('entry_date,created_at')
    .eq('company_id', companyId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const latestShortage = (latestShortageRes.data ?? null) as { entry_date?: unknown; created_at?: unknown } | null
  const latestDay =
    String(latestShortage?.entry_date ?? '').trim() ||
    String(latestShortage?.created_at ?? '').trim().slice(0, 10) ||
    todayIso()
  const dateRange = buildRange(latestDay)
  const analysisRange = buildIsoRangeFromAnchor(latestDay, Math.max(30, safeDays))
  const sinceIso = analysisRange[0]

  const [shortagesRes, products] = await Promise.all([
    supabase
      .from('mungesat')
      .select('entry_date,created_at,added_count,product_id,urgent')
      .eq('company_id', companyId)
      .gte('created_at', `${sinceIso}T00:00:00.000Z`)
      .order('created_at', { ascending: true }),
    resolveProductsInput(productsInput),
  ])
  const productById = new Map(
    products.map((p) => [
      p.id,
      {
        name: String(p.name ?? '').trim() || 'Produkt',
        supplier: String(p.supplierName ?? '').trim() || 'Pa furnitor',
        defaultOrderQty: Math.max(1, Number(p.defaultOrderQty ?? 1)),
      },
    ])
  )
  const normalizedRows = ((shortagesRes.error || !Array.isArray(shortagesRes.data) ? [] : shortagesRes.data) as any[])
    .map((row) => {
      const entryDay = String(row.entry_date ?? '').trim()
      const createdAt = String(row.created_at ?? '').trim()
      const createdDay = createdAt ? createdAt.slice(0, 10) : ''
      const day = entryDay || createdDay
      const count = Math.max(1, Number(row.added_count ?? 1))
      const productId = String(row.product_id ?? '').trim()
      const urgent = Boolean(row.urgent)
      return { day, count, productId, urgent }
    })
    .filter((row) => Boolean(row.day))

  const byDay = new Map<string, number>(dateRange.map((date) => [date, 0]))
  const bySupplier = new Map<string, number>()
  const byProduct = new Map<string, number>()
  const weekdayMap = new Map<string, number>(weekdayLabels.map((day) => [day, 0]))
  const urgentRecentByProduct = new Map<string, number>()
  const analysisDateSet = new Set(analysisRange)
  const recentUrgencyThreshold = analysisRange[Math.max(0, analysisRange.length - 7)] ?? analysisRange[0]
  let urgentCount = 0
  let normalCount = 0
  for (const row of normalizedRows) {
    const day = row.day
    if (!day || !analysisDateSet.has(day)) continue
    if (row.urgent && day >= recentUrgencyThreshold) {
      urgentRecentByProduct.set(row.productId, (urgentRecentByProduct.get(row.productId) ?? 0) + row.count)
    }
    if (!byDay.has(day)) continue
    const count = row.count
    byDay.set(day, (byDay.get(day) ?? 0) + count)
    if (row.urgent) urgentCount += count
    else normalCount += count
    const dateObj = new Date(`${day}T00:00:00`)
    if (!Number.isNaN(dateObj.getTime())) {
      const mondayIndex = (dateObj.getDay() + 6) % 7
      const dayLabel = weekdayLabels[mondayIndex]
      weekdayMap.set(dayLabel, (weekdayMap.get(dayLabel) ?? 0) + count)
    }

    const p = productById.get(row.productId)
    const supplier = p?.supplier ?? 'Pa furnitor'
    const product = p?.name ?? 'Produkt'
    bySupplier.set(supplier, (bySupplier.get(supplier) ?? 0) + count)
    byProduct.set(product, (byProduct.get(product) ?? 0) + count)
  }
  const seriesByProduct = buildProductDailySeries(analysisRange, normalizedRows)
  const stockSignals = buildStockSignals({
    products,
    analysisRange,
    seriesByProduct,
    urgentRecentByProduct,
  })
  const abcXyzProducts = buildAbcXyzAnalysis({ products, seriesByProduct })
  const supplierScorecards = buildSupplierScorecards({
    products,
    seriesByProduct,
    urgentRecentByProduct,
    stockWarnings: stockSignals.stockWarnings,
    abcXyzProducts,
  })
  const dataQualityIssues = buildDataQualityAudit({
    products,
    seriesByProduct,
    stockWarnings: stockSignals.stockWarnings,
    deadStockAlerts: stockSignals.deadStockAlerts,
    supplierScorecards,
  })
  const ai = buildAiOverview(
    [...seriesByProduct.entries()].map(([productId, dailySeries]) => {
      const product = productById.get(productId)
      return {
        productId,
        name: product?.name ?? 'Produkt',
        supplierName: product?.supplier ?? 'Pa furnitor',
        dailySeries,
        defaultOrderQty: product?.defaultOrderQty ?? 1,
        addedCount: dailySeries[dailySeries.length - 1] ?? 0,
        urgentNow: (urgentRecentByProduct.get(productId) ?? 0) > 0,
      }
    })
  )
  const explanations = buildAiExplanations({
    ai,
    stockWarnings: stockSignals.stockWarnings,
    supplierScorecards,
    abcXyzProducts,
    dataQualityIssues,
  })
  return {
    shortageTrend: dateRange.map((date) => ({ date, count: byDay.get(date) ?? 0 })),
    topSuppliers: [...bySupplier.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    topProducts: [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    urgentBreakdown: { urgent: urgentCount, normal: normalCount },
    weekdayTrend: weekdayLabels.map((day) => ({ day, count: weekdayMap.get(day) ?? 0 })),
    ai,
    ...stockSignals,
    supplierScorecards,
    abcXyzProducts,
    dataQualityIssues,
    explanations,
  }
}

export async function addProduct(input: {
  name: string
  supplier: string
  category: 'barna' | 'front'
  aliases: string[]
  producerName?: string
  lastPaidPrice?: number
  lastPriceDate?: string
  defaultOrderQty?: number
  minStock?: number
  reorderPoint?: number
}): Promise<{ ok: true; productId?: string; existed?: boolean } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) {
    const result = addProductMock({
      name: input.name,
      supplier: input.supplier,
      category: input.category,
      aliases: input.aliases,
      minStock: input.minStock,
      reorderPoint: input.reorderPoint,
    })
    if (!result.ok) return result
    const created =
      result.products.find(
        (row) =>
          row.name.trim().toLocaleLowerCase('sq-AL') === input.name.trim().toLocaleLowerCase('sq-AL') &&
          row.supplier.trim().toLocaleLowerCase('sq-AL') === input.supplier.trim().toLocaleLowerCase('sq-AL')
      ) ?? null
    return { ok: true, productId: created?.id }
  }

  const name = input.name.trim()
  const supplierName = input.supplier.trim()
  const producerName = (input.producerName ?? '').trim()
  const defaultOrderQty = Math.max(1, Number(input.defaultOrderQty ?? 1))
  const minStock = Math.max(0, toSafeInteger(input.minStock, 0))
  const reorderPoint = Math.max(0, toSafeInteger(input.reorderPoint, minStock))
  const lastPaidPrice =
    typeof input.lastPaidPrice === 'number' && Number.isFinite(input.lastPaidPrice)
      ? input.lastPaidPrice
      : null
  const lastPriceDate = (input.lastPriceDate ?? '').trim() || null
  if (!name) return { ok: false, message: 'Shkruaj emrin e barit.' }
  if (!supplierName) return { ok: false, message: 'Shkruaj furnitorin.' }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }

  let supplierId: string | null = null
  const supplierRes = await supabase
    .from('suppliers')
    .select('id,name')
    .eq('company_id', companyId)
    .ilike('name', supplierName)
    .limit(1)
    .maybeSingle()

  if (supplierRes.data?.id) {
    supplierId = supplierRes.data.id
  } else {
    const insertSupplier = await supabase
      .from('suppliers')
      .insert({ name: supplierName, company_id: companyId })
      .select('id')
      .single()
    if (insertSupplier.error || !insertSupplier.data?.id) {
      return { ok: false, message: insertSupplier.error?.message ?? 'Nuk u krijua furnitori.' }
    }
    supplierId = insertSupplier.data.id
  }

  const { data: sameSupplierProducts, error: listErr } = await supabase
    .from('products')
    .select('id,name')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
  if (listErr) return { ok: false, message: listErr.message }
  const nameNorm = name.trim().toLocaleLowerCase('sq-AL')
  const existingId =
    sameSupplierProducts?.find((r: { id: string; name: string }) => r.name.trim().toLocaleLowerCase('sq-AL') === nameNorm)
      ?.id ?? null

  const payload = {
    category: input.category,
    aliases: input.aliases,
    producer_name: producerName || null,
    last_paid_price: lastPaidPrice,
    last_price_date: lastPriceDate,
    default_order_qty: defaultOrderQty,
    min_stock: minStock,
    reorder_point: reorderPoint,
    updated_at: new Date().toISOString(),
  }

  if (existingId) {
    const { error } = await supabase.from('products').update(payload).eq('id', existingId).eq('company_id', companyId)
    if (error) return { ok: false, message: error.message }
    return { ok: true, productId: existingId, existed: true }
  }

  const insertProduct = await supabase
    .from('products')
    .insert({
      name,
      company_id: companyId,
      supplier_id: supplierId,
      ...payload,
    })
    .select('id')
    .single()
  if (insertProduct.error) return { ok: false, message: insertProduct.error.message }

  return { ok: true, productId: String(insertProduct.data?.id ?? '').trim() || undefined, existed: false }
}

export async function updateProduct(input: {
  id: string
  name: string
  supplier: string
  category: 'barna' | 'front'
  aliases: string[]
  producerName?: string
  lastPaidPrice?: number
  lastPriceDate?: string
  defaultOrderQty?: number
  minStock?: number
  reorderPoint?: number
}): Promise<{ ok: true; productId?: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) {
    const result = updateProductMock(input.id, {
      name: input.name,
      supplier: input.supplier,
      category: input.category,
      aliases: input.aliases,
      minStock: input.minStock,
      reorderPoint: input.reorderPoint,
    })
    return result.ok ? { ok: true, productId: input.id } : result
  }

  const id = input.id.trim()
  const name = input.name.trim()
  const supplierName = input.supplier.trim()
  const producerName = (input.producerName ?? '').trim()
  const defaultOrderQty = Math.max(1, Number(input.defaultOrderQty ?? 1))
  const minStock = Math.max(0, toSafeInteger(input.minStock, 0))
  const reorderPoint = Math.max(0, toSafeInteger(input.reorderPoint, minStock))
  const lastPaidPrice =
    typeof input.lastPaidPrice === 'number' && Number.isFinite(input.lastPaidPrice)
      ? input.lastPaidPrice
      : null
  const lastPriceDate = (input.lastPriceDate ?? '').trim() || null

  if (!id) return { ok: false, message: 'ID e produktit mungon.' }
  if (!name) return { ok: false, message: 'Shkruaj emrin e barit.' }
  if (!supplierName) return { ok: false, message: 'Shkruaj furnitorin.' }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }

  let supplierId: string | null = null
  const supplierRes = await supabase
    .from('suppliers')
    .select('id,name')
    .eq('company_id', companyId)
    .ilike('name', supplierName)
    .limit(1)
    .maybeSingle()
  if (supplierRes.data?.id) {
    supplierId = supplierRes.data.id
  } else {
    const insertSupplier = await supabase
      .from('suppliers')
      .insert({ name: supplierName, company_id: companyId })
      .select('id')
      .single()
    if (insertSupplier.error || !insertSupplier.data?.id) {
      return { ok: false, message: insertSupplier.error?.message ?? 'Nuk u krijua furnitori.' }
    }
    supplierId = insertSupplier.data.id
  }

  const { data: sameSupplierProducts, error: listErr } = await supabase
    .from('products')
    .select('id,name')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
  if (listErr) return { ok: false, message: listErr.message }
  const nameNorm = name.toLocaleLowerCase('sq-AL')
  const duplicateId =
    sameSupplierProducts?.find(
      (r: { id: string; name: string }) =>
        r.id !== id && r.name.trim().toLocaleLowerCase('sq-AL') === nameNorm
    )?.id ?? null
  if (duplicateId) {
    return { ok: false, message: 'Ekziston produkt me këtë emër për të njëjtin furnitor.' }
  }

  const { error } = await supabase
    .from('products')
    .update({
      name,
      supplier_id: supplierId,
      category: input.category,
      aliases: input.aliases,
      producer_name: producerName || null,
      last_paid_price: lastPaidPrice,
      last_price_date: lastPriceDate,
      default_order_qty: defaultOrderQty,
      min_stock: minStock,
      reorder_point: reorderPoint,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { ok: false, message: error.message }
  return { ok: true, productId: id }
}

export async function adjustProductStock(input: {
  productId: string
  quantityDelta: number
  note?: string
  movementType?: StockMovementType
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const productId = input.productId.trim()
  const quantityDelta = toSafeInteger(input.quantityDelta, 0)
  const note = String(input.note ?? '').trim()
  const movementType = (input.movementType ?? 'MANUAL_CORRECTION') as StockMovementType

  if (!productId) return { ok: false, message: 'Produkti mungon.' }
  if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
    return { ok: false, message: 'Levizja e stokut duhet te jete numer i plote dhe jo zero.' }
  }

  if (!isSupabaseConfigured) {
    const result = adjustProductStockMock(productId, quantityDelta, note, movementType)
    return result.ok ? { ok: true } : result
  }

  const rpc = await supabase.rpc('adjust_product_stock', {
    p_product_id: productId,
    p_quantity_delta: quantityDelta,
    p_movement_type: movementType,
    p_note: note || null,
  })
  if (!rpc.error) return { ok: true }

  const msg = String(rpc.error.message ?? '')
  const missingRpc =
    String((rpc.error as { code?: unknown }).code ?? '').trim() === 'PGRST202' ||
    /adjust_product_stock|could not find the function|function .* does not exist/i.test(msg)
  if (missingRpc) {
    return {
      ok: false,
      message:
        "RPC adjust_product_stock nuk u gjet. Ekzekuto migrimin 20260417100000_inventory_stock_movements.sql dhe pastaj: notify pgrst, 'reload schema'.",
    }
  }
  return { ok: false, message: msg || 'Levizja e stokut deshtoi.' }
}

export async function deleteProduct(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) {
    const result = deleteProductMock(id)
    return result.ok ? { ok: true } : result
  }
  const productId = id.trim()
  if (!productId) return { ok: false, message: 'ID e produktit mungon.' }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'User jo i kyçur.' }

  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('company_id', companyId)
    .select('id')
    .maybeSingle()
  if (error) {
    if ((error as { code?: string }).code === '23503') {
      return {
        ok: false,
        message: 'Produkti nuk mund të fshihet sepse përdoret në mungesa ose porosi.',
      }
    }
    return { ok: false, message: error.message }
  }
  if (!data?.id) {
    return { ok: false, message: 'Produkti nuk u gjet ose nuk u fshi.' }
  }
  return { ok: true }
}

export async function addMungese(productId: string, urgent: boolean, note: string): Promise<void> {
  if (!isSupabaseConfigured) {
    addShortageMock(productId, urgent, note)
    return
  }
  const { error } = await supabase.rpc('add_mungese', {
    p_product_id: productId,
    p_urgent: urgent,
    p_note: note,
  })
  if (error) throw error
}

export async function getTodayShortages(
  productsInput?: ProductView[] | Promise<ProductView[]>
): Promise<ShortageView[]> {
  if (!isSupabaseConfigured) return fromMockShortages(getShortagesMock())
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return []
  const historyRange = buildIsoRangeFromAnchor(todayIso(), 30)
  const historySinceIso = historyRange[0]

  const [productsRes, shortagesRes, lastQtyRpc, historyRes] = await Promise.all([
    resolveProductsInput(productsInput),
    supabase
      .from('mungesat')
      .select('id,product_id,urgent,note,added_count,created_by,created_by_role')
      .eq('company_id', companyId)
      .eq('entry_date', todayIso())
      .order('created_at', { ascending: false }),
    supabase.rpc('last_final_qty_by_product'),
    supabase
      .from('mungesat')
      .select('entry_date,created_at,added_count,product_id')
      .eq('company_id', companyId)
      .gte('created_at', `${historySinceIso}T00:00:00.000Z`)
      .order('created_at', { ascending: true }),
  ])

  if (shortagesRes.error || !shortagesRes.data) return []
  const productMap = new Map(productsRes.map((p) => [p.id, p]))
  const createdByIds = Array.from(
    new Set(
      shortagesRes.data
        .map((row: any) => String(row.created_by ?? '').trim())
        .filter((id: string) => Boolean(id))
    )
  )
  const profileLabelById = new Map<string, string>()
  if (createdByIds.length) {
    const profilesRes = await supabase
      .from('profiles')
      .select('id,username,email')
      .eq('company_id', companyId)
      .in('id', createdByIds)
    if (!profilesRes.error && Array.isArray(profilesRes.data)) {
      for (const row of profilesRes.data as Array<{ id: string; username?: string | null; email?: string | null }>) {
        const id = String(row.id ?? '').trim()
        if (!id) continue
        const label = String(row.username ?? '').trim() || String(row.email ?? '').trim() || 'Përdorues'
        profileLabelById.set(id, label)
      }
    }
  }
  const lastFinalQtyByProduct = new Map<string, number>()
  if (!lastQtyRpc.error && Array.isArray(lastQtyRpc.data)) {
    for (const row of lastQtyRpc.data as Array<{ product_id: string; final_qty: number | null }>) {
      if (!row?.product_id) continue
      const qty = Number(row.final_qty ?? 0)
      if (Number.isFinite(qty) && qty > 0) lastFinalQtyByProduct.set(row.product_id, qty)
    }
  }
  const historyRows = !historyRes.error && Array.isArray(historyRes.data)
    ? historyRes.data
        .map((row: any) => {
          const entryDay = String(row.entry_date ?? '').trim()
          const createdAt = String(row.created_at ?? '').trim()
          const createdDay = createdAt ? createdAt.slice(0, 10) : ''
          const day = entryDay || createdDay
          return {
            day,
            productId: String(row.product_id ?? '').trim(),
            count: Math.max(1, Number(row.added_count ?? 1)),
          }
        })
        .filter((row: { day: string; productId: string; count: number }) => Boolean(row.day && row.productId))
    : []
  const historySeriesByProduct = buildProductDailySeries(historyRange, historyRows)

  return shortagesRes.data.map((row: any) => {
    const product = productMap.get(row.product_id)
    const addedCount = Math.max(1, Number(row.added_count ?? 1))
    const lastFinalQty = lastFinalQtyByProduct.get(row.product_id)
    const productId = String(row.product_id ?? '').trim()
    const forecast = forecastProductDemand({
      productId,
      name: product?.name ?? 'Produkt',
      supplierName: product?.supplierName ?? 'Pa furnitor',
      dailySeries: historySeriesByProduct.get(productId) ?? Array.from({ length: historyRange.length }, () => 0),
      defaultOrderQty: product?.defaultOrderQty ?? 1,
      lastFinalQty,
      addedCount,
      urgentNow: Boolean(row.urgent),
    })
    const reorderPlan = optimizeReorderPlan({
      productName: product?.name ?? 'Produkt',
      supplierName: product?.supplierName ?? 'Pa furnitor',
      suggestedQty: forecast.recommendedQty,
      forecastPerDay: forecast.forecastPerDay,
      forecastNext7Days: forecast.forecastNext7Days,
      aiRiskScore: forecast.riskScore,
      aiRiskLevel: forecast.riskLevel,
      urgentNow: Boolean(row.urgent),
      unitPrice: product?.unitPrice,
      leadTimeDays: product?.leadTimeDays,
      minOrderQty: product?.minOrderQty,
    })
    const suggestedQty = Math.max(1, reorderPlan.optimizedQty)
    return {
      id: row.id,
      productId: row.product_id,
      productName: product?.name ?? 'Produkt',
      supplierId: product?.supplierId,
      supplierName: product?.supplierName ?? 'Pa furnitor',
      urgent: Boolean(row.urgent),
      note: row.note ?? '',
      addedCount,
      suggestedQty,
      unitPrice: product?.unitPrice,
      leadTimeDays: product?.leadTimeDays,
      minOrderQty: product?.minOrderQty,
      aiSuggestedQty: forecast.recommendedQty,
      aiConfidence: forecast.confidence,
      aiRiskScore: forecast.riskScore,
      aiRiskLevel: forecast.riskLevel,
      aiReason: forecast.reason,
      aiForecastPerDay: forecast.forecastPerDay,
      aiForecastNext7Days: forecast.forecastNext7Days,
      aiOptimizedQty: reorderPlan.optimizedQty,
      aiCoverageDays: reorderPlan.coverageDays,
      aiEstimatedCost: reorderPlan.estimatedCost,
      aiOrderPriority: reorderPlan.priority,
      aiOrderAction: reorderPlan.action,
      createdById: String(row.created_by ?? '').trim() || undefined,
      createdByRole: String(row.created_by_role ?? '').trim().toUpperCase() as
        | 'OWNER'
        | 'MANAGER'
        | 'WORKER'
        | undefined,
      createdByLabel: profileLabelById.get(String(row.created_by ?? '').trim()) ?? undefined,
    }
  })
}

export async function updateSuggestedQty(id: string, delta: number): Promise<ShortageView[]> {
  if (!isSupabaseConfigured) {
    const rows = updateSuggestedQtyMock(id, delta)
    return fromMockShortages(rows)
  }

  const rows = await getTodayShortages()
  return rows.map((r) =>
    r.id === id ? { ...r, suggestedQty: Math.max(1, r.suggestedQty + delta) } : r
  )
}

export async function updateShortageMeta(
  id: string,
  patch: { urgent?: boolean; note?: string }
): Promise<ShortageView[]> {
  if (!isSupabaseConfigured) {
    const rows = updateShortageMetaMock(id, patch)
    return fromMockShortages(rows)
  }

  const payload: Record<string, unknown> = {}
  if (typeof patch.urgent === 'boolean') payload.urgent = patch.urgent
  if (typeof patch.note === 'string') payload.note = patch.note
  if (!Object.keys(payload).length) return getTodayShortages()
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return getTodayShortages()

  const { error } = await supabase.from('mungesat').update(payload).eq('id', id).eq('company_id', companyId)
  if (error) throw error
  return getTodayShortages()
}

export async function reassignShortageProduct(shortageId: string, productId: string): Promise<ShortageView[]> {
  if (!isSupabaseConfigured) return getTodayShortages()
  const targetShortageId = shortageId.trim()
  const targetProductId = productId.trim()
  if (!targetShortageId || !targetProductId) return getTodayShortages()
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return getTodayShortages()
  const { error } = await supabase
    .from('mungesat')
    .update({ product_id: targetProductId, updated_at: new Date().toISOString() })
    .eq('id', targetShortageId)
    .eq('company_id', companyId)
  if (error) throw error
  return getTodayShortages()
}

export async function deleteShortage(id: string): Promise<ShortageView[]> {
  if (!isSupabaseConfigured) {
    const rows = deleteShortageMock(id)
    return fromMockShortages(rows)
  }
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return getTodayShortages()
  const { error } = await supabase.from('mungesat').delete().eq('id', id).eq('company_id', companyId)
  if (error) throw error
  return getTodayShortages()
}

export async function generateOrdersFromShortages(rows: ShortageView[]): Promise<OwnerOrder[]> {
  if (!isSupabaseConfigured) {
    const grouped = new Map<string, ShortageView[]>()
    rows
      .filter((r) => r.suggestedQty > 0)
      .forEach((row) => {
        const current = grouped.get(row.supplierName) ?? []
        current.push(row)
        grouped.set(row.supplierName, current)
      })
    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'sq-AL'))
      .map(([supplier, items], index) => ({
        id: 100 + index,
        supplier,
        items: items.map((row) => `${row.suggestedQty} x ${row.productName}${row.urgent ? ' (URGJENT)' : ''}`),
        status: 'DRAFT',
        ...buildOrderDetails(items),
      }))
  }

  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) throw new Error('Kompania aktive mungon.')
  if (!userId) throw new Error('User jo i kyçur.')

  const grouped = new Map<string, ShortageView[]>()
  rows
    .filter((r) => r.suggestedQty > 0)
    .forEach((r) => {
      const key = r.supplierId ?? `fallback:${r.supplierName}`
      const current = grouped.get(key) ?? []
      current.push(r)
      grouped.set(key, current)
    })

  const created: OwnerOrder[] = []

  for (const [, items] of grouped.entries()) {
    let supplierId = items[0].supplierId
    if (!supplierId) {
      const supplierName = items[0].supplierName
      const supplierRes = await supabase
        .from('suppliers')
        .select('id')
        .eq('company_id', companyId)
        .ilike('name', supplierName)
        .limit(1)
        .maybeSingle()
      supplierId = supplierRes.data?.id ?? null
      if (!supplierId) {
        const ins = await supabase
          .from('suppliers')
          .insert({ name: supplierName, company_id: companyId })
          .select('id')
          .single()
        supplierId = ins.data?.id ?? null
      }
    }
    if (!supplierId) continue

    const existingDraftsRes = await supabase
      .from('orders')
      .select('id')
      .eq('company_id', companyId)
      .eq('supplier_id', supplierId)
      .eq('created_by', userId)
      .eq('status', 'DRAFT')
      .order('created_at', { ascending: false })

    let orderId: string | null = null
    const existingDraftIds = Array.isArray(existingDraftsRes.data)
      ? existingDraftsRes.data.map((r: any) => String(r.id)).filter(Boolean)
      : []

    if (existingDraftIds.length > 0) {
      orderId = existingDraftIds[0]
      const staleDraftIds = existingDraftIds.slice(1)
      if (staleDraftIds.length > 0) {
        await supabase.from('orders').delete().eq('company_id', companyId).in('id', staleDraftIds)
      }
      await supabase.from('order_items').delete().eq('company_id', companyId).eq('order_id', orderId)
    } else {
      const orderInsert = await supabase
        .from('orders')
        .insert({
          company_id: companyId,
          supplier_id: supplierId,
          status: 'DRAFT',
          created_by: userId,
        })
        .select('id')
        .single()
      if (orderInsert.error || !orderInsert.data?.id) continue
      orderId = String(orderInsert.data.id)
    }
    if (!orderId) continue

    const details = buildOrderDetails(items)
    const orderItemsPayload = items.map((r) => ({
      company_id: companyId,
      order_id: orderId,
      product_id: r.productId,
      suggested_qty: r.suggestedQty,
      final_qty: r.suggestedQty,
      note: [r.note?.trim(), r.aiOrderAction?.trim()].filter(Boolean).join(' | '),
    }))
    await supabase.from('order_items').insert(orderItemsPayload)

    const renderedItems = items.map(
      (r) => `${r.suggestedQty} ${r.productName}${r.urgent ? ' URGJENT' : ''}`
    )
    const legacyReceipt = `POROSI MUNGESASH
Data: ${new Date().toLocaleString('sq-AL')}
Furnitori: ${items[0].supplierName}
ID: ${orderId}
---------------------------
${renderedItems.join('\n')}
Shënim: Ju lutem konfirmoni disponueshmërinë dhe kohën e dorëzimit.`

    void legacyReceipt
    const orderUiId = stableOrderUiId(orderId, created.length + 100)
    const order: OwnerOrder = {
      id: orderUiId,
      dbId: orderId,
      supplier: items[0].supplierName,
      items: items.map((r) => `${r.suggestedQty} x ${r.productName}${r.urgent ? ' (URGJENT)' : ''}`),
      status: 'DRAFT',
      ...details,
    }
    const receipt = formatOwnerOrderReceipt(order)

    await supabase.from('orders').update({ receipt_text: receipt }).eq('id', orderId).eq('company_id', companyId)

    created.push({
      ...order,
      id: stableOrderUiId(orderId, created.length + 100),
      dbId: orderId,
      supplier: items[0].supplierName,
      items: items.map((r) => `${r.suggestedQty} × ${r.productName}${r.urgent ? ' (URGJENT)' : ''}`),
      status: 'DRAFT',
    })
  }

  return created
}

export async function getRecentOrders(limit = 100): Promise<OwnerOrder[]> {
  if (!isSupabaseConfigured) return []
  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return []

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data, error } = await supabase
    .from('orders')
    .select('id,status,created_at,receipt_text,suppliers(name),order_items(final_qty,suggested_qty,products(name))')
    .eq('company_id', companyId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row: any, idx: number) => {
    const orderItems = Array.isArray(row.order_items) ? row.order_items : []
    const items = orderItems.map((it: any) => {
      const qty = Number(it.final_qty ?? it.suggested_qty ?? 1)
      const productName = it.products?.name ?? 'Produkt'
      return `${qty} x ${productName}`
    })
    const dbId = String(row.id)
    const rawStatus = String(row.status ?? '').toUpperCase()
    const aiMeta = parseOwnerOrderReceiptAi(String(row.receipt_text ?? ''))
    return {
      id: stableOrderUiId(dbId, 1000 + idx),
      dbId,
      supplier: row.suppliers?.name ?? 'Pa furnitor',
      items,
      status: rawStatus === 'SENT' ? 'SENT' : 'DRAFT',
      ...aiMeta,
    } satisfies OwnerOrder
  })
}

export async function markOrderAsSent(order: OwnerOrder): Promise<OwnerOrder> {
  if (!isSupabaseConfigured) {
    return { ...order, status: 'SENT' }
  }
  if (!order.dbId) {
    throw new Error('Porosia nuk ka ID nga baza - nuk mund te ruhet statusi.')
  }

  const companyId = await resolveCurrentCompanyId()
  if (!companyId) throw new Error('Kompania aktive mungon.')

  const { error: rpcError } = await supabase.rpc('mark_order_sent', {
    p_order_id: order.dbId,
  })
  if (!rpcError) {
    return { ...order, status: 'SENT' }
  }

  const code = (rpcError as { code?: string }).code
  const msg = rpcError.message ?? ''
  const rpcMissing =
    code === 'PGRST202' ||
    code === '42883' ||
    /mark_order_sent|function .* does not exist|Could not find the function/i.test(msg)

  if (!rpcMissing) {
    throw new Error(msg || 'Shenimi si derguar deshtoi.')
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'SENT', sent_at: new Date().toISOString() })
    .eq('id', order.dbId)
    .eq('company_id', companyId)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data?.id) {
    throw new Error(
      'Asnje rresht nuk u perditesua. Ekzekuto migrimin mark_order_sent ne Supabase dhe kontrollo qe profili yt eshte OWNER.'
    )
  }
  return { ...order, status: 'SENT' }
}

export async function recordShortageHistory(input: {
  productId: string
  shortageQty: number
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  urgencyScore: number
  notes?: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: true }

  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'Company mungon.' }

  const { error } = await supabase.from('shortage_history').insert({
    company_id: companyId,
    product_id: input.productId,
    shortage_date: todayIso(),
    source: 'worker_entry',
    shortage_qty: Math.max(1, input.shortageQty),
    fulfilled: false,
    urgency_level: input.urgencyLevel,
    urgency_score: input.urgencyScore,
    notes: input.notes ?? '',
    created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function getShortageHistory(productId: string): Promise<
  Array<{
    shortageDate: string
    shortageQty: number
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH'
    fulfilled: boolean
  }>
> {
  if (!isSupabaseConfigured) return []

  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return []

  const { data, error } = await supabase.rpc('get_shortage_history', {
    p_company_id: companyId,
    p_product_id: productId,
    p_days_back: 180,
  })

  if (error || !Array.isArray(data)) return []

  return data.map((row: any) => ({
    shortageDate: String(row.shortage_date ?? ''),
    shortageQty: Number(row.shortage_qty ?? 1),
    urgencyLevel: String(row.urgency_level ?? 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH',
    fulfilled: Boolean(row.fulfilled),
  }))
}

export async function recordSupplierPerformance(input: {
  supplierId: string
  productId: string
  actualLeadTimeDays?: number
  expectedLeadTimeDays?: number
  onTimeDelivery?: boolean
  orderedQty?: number
  receivedQty?: number
  unitPrice?: number
  hasCert?: boolean
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: true }

  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { ok: false, message: 'Company mungon.' }

  const { error } = await supabase.from('supplier_performance').insert({
    company_id: companyId,
    supplier_id: input.supplierId,
    product_id: input.productId,
    actual_lead_time_days: input.actualLeadTimeDays ?? null,
    expected_lead_time_days: input.expectedLeadTimeDays ?? 3,
    on_time_delivery: input.onTimeDelivery ?? true,
    ordered_qty: input.orderedQty ?? null,
    received_qty: input.receivedQty ?? null,
    unit_price: input.unitPrice ?? null,
    has_cert: input.hasCert ?? false,
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function getSupplierMetrics(supplierId: string): Promise<{
  avgLeadTime: number | null
  onTimePercent: number | null
  priceVarianceAvg: number | null
  totalOrders: number
}> {
  if (!isSupabaseConfigured)
    return { avgLeadTime: null, onTimePercent: null, priceVarianceAvg: null, totalOrders: 0 }

  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { avgLeadTime: null, onTimePercent: null, priceVarianceAvg: null, totalOrders: 0 }

  const { data, error } = await supabase.rpc('get_supplier_metrics', {
    p_company_id: companyId,
    p_supplier_id: supplierId,
    p_days_back: 180,
  })

  if (error || !Array.isArray(data) || !data[0]) {
    return { avgLeadTime: null, onTimePercent: null, priceVarianceAvg: null, totalOrders: 0 }
  }

  const row = data[0] as any
  return {
    avgLeadTime: row.avg_lead_time ? Number(row.avg_lead_time) : null,
    onTimePercent: row.on_time_percent ? Number(row.on_time_percent) : null,
    priceVarianceAvg: row.price_variance_avg ? Number(row.price_variance_avg) : null,
    totalOrders: Number(row.total_orders ?? 0),
  }
}

export async function cleanOldShortageHistory(): Promise<{ deletedCount: number }> {
  if (!isSupabaseConfigured) return { deletedCount: 0 }

  const companyId = await resolveCurrentCompanyId()
  if (!companyId) return { deletedCount: 0 }

  const { data, error } = await supabase.rpc('archive_and_clean_old_data')

  if (error || !Array.isArray(data) || !data[0]) return { deletedCount: 0 }

  return { deletedCount: Number(data[0].shortage_records_deleted ?? 0) }
}
