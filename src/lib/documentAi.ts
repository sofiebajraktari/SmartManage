export type TextUrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ProcessingMethod = 'REGEX' | 'OPENAI' | 'HYBRID'

// Import AI clients
import { analyzeShortageWithAI } from './openaiClient.js'
import { isSupabaseConfigured } from './supabase.js'

export interface TextUrgencyPrediction {
  score: number
  level: TextUrgencyLevel
  shouldMarkUrgent: boolean
  reasons: string[]
  confidence: number
  method?: ProcessingMethod
}

export interface NaturalLanguageShortageInterpretation {
  quantity: number
  searchHint: string
  noteText: string
  urgency: TextUrgencyPrediction
  summary: string
}

export interface OfferImportRow {
  name: string
  supplier: string
  producerName?: string
  lastPaidPrice?: number
  lastPriceDate?: string
  defaultOrderQty?: number
  category: 'barna' | 'front'
  aliases: string[]
}

export interface OfferTextParseResult {
  rows: OfferImportRow[]
  issues: string[]
  summary: string
  detectedSupplier?: string
}

const EXPLICIT_URGENT_PATTERNS = [
  { pattern: /\burgjent\b|\burgent\b|\bemergjenc/i, weight: 40, reason: 'fjale eksplicite urgjence' },
  { pattern: /\basap\b|\bsa me shpejt\b|\bmenjehere\b|\bmenjeher\b|\btani\b/i, weight: 28, reason: 'kerkese per veprim te menjehershem' },
  { pattern: /\bpa stok\b|\bzero stok\b|\bmbaruar\b|\bska stok\b|\bnuk ka stok\b/i, weight: 24, reason: 'mungese e plote e stokut' },
  { pattern: /\bpacient\b|\brecet\b|\brecete\b|\bfemij\b|\btemperatur\b|\bethe\b|\bdhimbje\b/i, weight: 16, reason: 'shenim klinik ose pacient specifik' },
]

const MEDIUM_URGENCY_PATTERNS = [
  { pattern: /\bshpejt\b|\bsa me pare\b|\bduhet\b|\bkerkohet\b/i, weight: 12, reason: 'indikim per prioritet te afert' },
  { pattern: /\bsot\b|\bbrenda dites\b|\b24 ore\b/i, weight: 10, reason: 'afat i shkurter kohor' },
]

const LOW_URGENCY_PATTERNS = [
  { pattern: /\bjo urgjent\b|\brutine\b|\brutina\b|\bkur te vini\b|\bneser\b|\bjaves\b/i, weight: -26, reason: 'formulim jo urgjent' },
]

const QUANTITY_WORDS: Record<string, number> = {
  nje: 1,
  një: 1,
  dy: 2,
  tri: 3,
  tre: 3,
  kater: 4,
  katër: 4,
  pese: 5,
  pesë: 5,
}

const SEARCH_STOPWORDS = new Set([
  'urgent',
  'urgjent',
  'asap',
  'menjehere',
  'menjeher',
  'tani',
  'sot',
  'pacient',
  'pacienti',
  'recete',
  'recet',
  'per',
  'për',
  'me',
  'pa',
  'stok',
  'duhet',
  'kerkohet',
  'shpejt',
  'sa',
  'pare',
  'se',
  'sepse',
  'nga',
  'te',
  'të',
  'kuti',
  'cop',
  'cope',
  'copa',
  'paketa',
  'pakete',
  'qty',
  'sasi',
  'x',
])

const FRONT_CATEGORY_HINTS = [
  'vitamin',
  'krem',
  'shampo',
  'losion',
  'kozmetik',
  'serum',
  'mask',
  'brush',
  'past',
  'gel',
  'baby',
  'dermo',
]

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('sq-AL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s./,%+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function cleanupText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parsePositiveNumber(raw: string): number | undefined {
  const normalized = raw.replace(',', '.').trim()
  if (!normalized) return undefined
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return undefined
  return Math.round(value * 100) / 100
}

function parsePositiveInteger(raw: string): number | undefined {
  const normalized = raw.trim()
  if (!normalized) return undefined
  const value = Number.parseInt(normalized, 10)
  if (!Number.isFinite(value) || value <= 0) return undefined
  return value
}

function parseDateIso(raw: string): string | undefined {
  const value = raw.trim()
  if (!value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3]
    const month = match[2].padStart(2, '0')
    const day = match[1].padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function detectQuantity(rawText: string): number {
  const text = normalizeText(rawText)
  const explicit = text.match(/(?:^|\s)(\d{1,2})(?=\s*(?:x|cope|copa|cop|kuti|paketa|pakete|qty|sasi)\b)/i)
  if (explicit) return clamp(Number(explicit[1]), 1, 20)

  const plainNumberMatch = text.match(/(?:^|\s)(\d{1,2})(?:\s|$)/)
  if (plainNumberMatch) {
    const candidate = Number(plainNumberMatch[1])
    const nextSlice = text.slice(plainNumberMatch.index ?? 0)
    if (!/^\s*\d{1,4}\s*(mg|ml|gr|g|%)\b/i.test(nextSlice)) {
      return clamp(candidate, 1, 20)
    }
  }

  for (const [word, quantity] of Object.entries(QUANTITY_WORDS)) {
    if (new RegExp(`(?:^|\\s)${word}(?:\\s|$)`, 'i').test(text)) {
      return quantity
    }
  }
  return 1
}

function buildSearchHint(rawText: string): string {
  const source = cleanupText(rawText.split(/[,;|]/)[0] ?? rawText)
  const tokens = normalizeText(source)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !SEARCH_STOPWORDS.has(token))
    .filter((token) => !QUANTITY_WORDS[token])
    .filter((token) => !/^\d+$/.test(token))
  return cleanupText(tokens.join(' '))
}

function buildNoteText(rawText: string, searchHint: string): string {
  const explicitTail = rawText.match(/(?:sepse|per|për|shenim|note)\s+(.+)/i)
  if (explicitTail?.[1]) return cleanupText(explicitTail[1])

  const parts = rawText.split(/[,;|]/).map((part) => cleanupText(part)).filter(Boolean)
  if (parts.length > 1) return cleanupText(parts.slice(1).join(' | '))

  const normalizedSearch = normalizeText(searchHint)
  const normalizedRaw = normalizeText(rawText)
  if (!normalizedSearch || normalizedRaw === normalizedSearch) return ''

  const tail = normalizedRaw.replace(normalizedSearch, '').trim()
  const cleanTail = tail
    .split(/\s+/)
    .filter((token) => !SEARCH_STOPWORDS.has(token))
    .filter((token) => !QUANTITY_WORDS[token])
    .filter((token) => !/^\d+$/.test(token))
    .join(' ')
  return cleanupText(cleanTail)
}

export function classifyUrgencyFromText(rawText: string): TextUrgencyPrediction {
  const text = normalizeText(rawText)
  if (!text) {
    return {
      score: 8,
      level: 'LOW',
      shouldMarkUrgent: false,
      reasons: ['pa tekst shtese'],
    }
  }

  let score = 12
  const reasons: string[] = []

  EXPLICIT_URGENT_PATTERNS.forEach((entry) => {
    if (entry.pattern.test(text)) {
      score += entry.weight
      reasons.push(entry.reason)
    }
  })
  MEDIUM_URGENCY_PATTERNS.forEach((entry) => {
    if (entry.pattern.test(text)) {
      score += entry.weight
      reasons.push(entry.reason)
    }
  })
  LOW_URGENCY_PATTERNS.forEach((entry) => {
    if (entry.pattern.test(text)) {
      score += entry.weight
      reasons.push(entry.reason)
    }
  })

  if ((rawText.match(/!/g) ?? []).length >= 2) {
    score += 8
    reasons.push('intonacion i forte ne tekst')
  }

  score = clamp(score, 0, 99)
  const level: TextUrgencyLevel = score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW'

  return {
    score,
    level,
    shouldMarkUrgent: score >= 58,
    reasons: dedupeStrings(reasons).slice(0, 3),
  }
}

export function interpretShortageNaturalLanguage(rawText: string): NaturalLanguageShortageInterpretation {
  const quantity = detectQuantity(rawText)
  const searchHint = buildSearchHint(rawText) || cleanupText(rawText)
  const noteText = buildNoteText(rawText, searchHint)
  const urgency = classifyUrgencyFromText(rawText)
  const summaryParts = [
    searchHint ? `produkt: ${searchHint}` : '',
    quantity > 1 ? `sasi e interpretuar: ${quantity}` : '',
    urgency.level !== 'LOW' ? `urgjence ${urgency.level.toLowerCase()}` : '',
    noteText ? `shenim: ${noteText}` : '',
  ].filter(Boolean)

  return {
    quantity,
    searchHint,
    noteText,
    urgency,
    summary: summaryParts.join(' | ') || 'Nuk u interpretua tekst i mjaftueshem.',
  }
}

function detectOfferSupplier(rawText: string): string | undefined {
  const lines = rawText.split(/\r?\n/).map((line) => cleanupText(line)).filter(Boolean)
  for (const line of lines) {
    const match = line.match(/(?:supplier|furnitor(?:i)?|distributor(?:i)?)\s*[:\-]\s*(.+)/i)
    if (match?.[1]) return cleanupText(match[1])
  }
  return undefined
}

function detectCategory(rawText: string): 'barna' | 'front' {
  const text = normalizeText(rawText)
  return FRONT_CATEGORY_HINTS.some((token) => text.includes(token)) ? 'front' : 'barna'
}

function cleanupOfferLine(line: string): string {
  return cleanupText(
    line
      .replace(/^[\d.)-]+\s*/, '')
      .replace(/[|;]/g, ' ')
      .replace(/\s{2,}/g, ' ')
  )
}

function parseOfferLine(line: string, supplier: string): OfferImportRow | null {
  const cleanLine = cleanupOfferLine(line)
  const normalized = normalizeText(cleanLine)
  if (!cleanLine || cleanLine.length < 4) return null
  if (!/[a-z]/i.test(normalized)) return null
  if (/^(supplier|furnitor|distributor|cmimi|price|total|date|data)\b/i.test(normalized)) return null

  const priceMatches = [...cleanLine.matchAll(/\b(\d+[.,]\d{1,2})\s*(?:eur|euro|€)?\b/gi)]
  const lastPaidPrice = priceMatches.length
    ? parsePositiveNumber(priceMatches[priceMatches.length - 1][1])
    : undefined
  const dateMatch = cleanLine.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/)
  const lastPriceDate = dateMatch ? parseDateIso(dateMatch[1]) : undefined
  const qtyMatch =
    cleanLine.match(/\b(?:moq|min(?:imum)?|qty|sasi|cop(?:e|a)?|kuti|paket(?:e|a)?)\s*[:x-]?\s*(\d{1,3})\b/i) ??
    cleanLine.match(/\bx\s*(\d{1,3})\b/i)
  const defaultOrderQty = qtyMatch ? parsePositiveInteger(qtyMatch[1]) : undefined
  const producerMatch = cleanLine.match(/\b(?:producer|prodhues(?:i)?)\s*[:\-]\s*([^,;]+)/i)
  const producerName = producerMatch?.[1] ? cleanupText(producerMatch[1]) : undefined

  let name = cleanLine
    .replace(/\b(?:eur|euro|€)\b/gi, ' ')
    .replace(/\b\d+[.,]\d{1,2}\b/g, ' ')
    .replace(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/g, ' ')
    .replace(/\b(?:moq|min(?:imum)?|qty|sasi|cop(?:e|a)?|kuti|paket(?:e|a)?)\s*[:x-]?\s*\d{1,3}\b/gi, ' ')
    .replace(/\bx\s*\d{1,3}\b/gi, ' ')
    .replace(/\b(?:producer|prodhues(?:i)?)\s*[:\-]\s*[^,;]+/gi, ' ')
  name = cleanupText(name)

  if (producerName && name.toLocaleLowerCase('sq-AL').includes(producerName.toLocaleLowerCase('sq-AL'))) {
    name = cleanupText(name.replace(new RegExp(producerName, 'i'), ' '))
  }

  if (!name || name.length < 4) return null

  return {
    name,
    supplier,
    producerName,
    lastPaidPrice,
    lastPriceDate,
    defaultOrderQty,
    category: detectCategory(cleanLine),
    aliases: [],
  }
}

export function parseSupplierOfferText(
  rawText: string,
  options?: {
    supplierHint?: string
    defaultCategory?: 'barna' | 'front'
  }
): OfferTextParseResult {
  const supplier = cleanupText(options?.supplierHint ?? '') || detectOfferSupplier(rawText) || ''
  const issues: string[] = []
  const rows: OfferImportRow[] = []
  const seenKeys = new Set<string>()
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => cleanupOfferLine(line))
    .filter(Boolean)

  if (!lines.length) {
    return {
      rows: [],
      issues: ['Teksti OCR Ã«shtÃ« bosh ose pa rreshta tÃ« lexueshÃ«m.'],
      summary: 'Pa tekst te mjaftueshem per parse.',
      detectedSupplier: supplier || undefined,
    }
  }

  if (!supplier) {
    issues.push('Nuk u gjet furnitori nÃ« tekst. PlotÃ«sojeni manualisht para parser-it.')
  }

  lines.forEach((line, index) => {
    const parsed = parseOfferLine(line, supplier || 'OCR Import')
    if (!parsed) {
      if (/[a-z]/i.test(normalizeText(line)) && line.length >= 6) {
        issues.push(`OCR rreshti ${index + 1}: nuk u interpretua sakte â€œ${line}â€`)
      }
      return
    }
    if (options?.defaultCategory) parsed.category = options.defaultCategory
    const key = `${normalizeText(parsed.name)}|${normalizeText(parsed.supplier)}`
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    rows.push(parsed)
  })

  return {
    rows,
    issues,
    summary:
      rows.length > 0
        ? `U interpretuan ${rows.length} rreshta nga OCR/text parser.`
        : 'Parser-i OCR nuk gjeti rreshta te mjaftueshem per import.',
    detectedSupplier: supplier || undefined,
  }
}
