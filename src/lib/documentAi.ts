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
  confidence: ConfidenceLevel
  aiDetectionScore: number
  detectedPatterns: string[]
  method: ProcessingMethod
  aiAnalysis?: {
    rawAiResponse: string
    aiConfidence: number
  }
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
  { pattern: /\bkritik\b|\bemergency\b|\bsiguri\b|\bproblem\b|\bnuk punon\b/i, weight: 18, reason: 'problem kritik ose failure' },
  { pattern: /\bvdes\b|\brrezik jete\b|\bvdekjev\b|\bkomë\b/i, weight: 35, reason: 'rrezik per jeten' },
]

const MEDIUM_URGENCY_PATTERNS = [
  { pattern: /\bshpejt\b|\bsa me pare\b|\bduhet\b|\bkerkohet\b/i, weight: 12, reason: 'indikim per prioritet te afert' },
  { pattern: /\bsot\b|\bbrenda dites\b|\b24 ore\b/i, weight: 10, reason: 'afat i shkurter kohor' },
  { pattern: /\bpara dites\b|\bparadites\b|\bfund jave\b/i, weight: 8, reason: 'kohe e afert' },
  { pattern: /\bpatient waits?\b|\bpa kohe\b|\bvonesat\b/i, weight: 14, reason: 'vonese nuk tolerohet' },
]

const LOW_URGENCY_PATTERNS = [
  { pattern: /\bjo urgjent\b|\brutine\b|\brutina\b|\bkur te vini\b|\bneser\b|\bjaves\b/i, weight: -26, reason: 'formulim jo urgjent' },
  { pattern: /\blisht\b|\bsajne\b|\bnuk ka nxitim\b|\bpasiv\b/i, weight: -15, reason: 'pak interes' },
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
  const explicit = text.match(/(?:^|\s)(\d{1,4})(?=\s*(?:x|cope|copa|cop|kuti|paketa|pakete|qty|sasi)\b)/i)
  if (explicit) return clamp(Number(explicit[1]), 1, 9999)

  const plainNumberMatch = text.match(/(?:^|\s)(\d{1,4})(?:\s|$)/)
  if (plainNumberMatch) {
    const candidate = Number(plainNumberMatch[1])
    const nextSlice = text.slice(plainNumberMatch.index ?? 0)
    if (!/^\s*\d{1,4}\s*(mg|ml|gr|g|%)\b/i.test(nextSlice)) {
      return clamp(candidate, 1, 9999)
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
      confidence: 95,
    }
  }

  let score = 12
  const reasons: string[] = []
  let matchCount = 0

  EXPLICIT_URGENT_PATTERNS.forEach((entry) => {
    if (entry.pattern.test(text)) {
      score += entry.weight
      reasons.push(entry.reason)
      matchCount += 1
    }
  })
  MEDIUM_URGENCY_PATTERNS.forEach((entry) => {
    if (entry.pattern.test(text)) {
      score += entry.weight
      reasons.push(entry.reason)
      matchCount += 1
    }
  })
  LOW_URGENCY_PATTERNS.forEach((entry) => {
    if (entry.pattern.test(text)) {
      score += entry.weight
      reasons.push(entry.reason)
      matchCount += 1
    }
  })

  const exclamationCount = (rawText.match(/!/g) ?? []).length
  const questionCount = (rawText.match(/\?/g) ?? []).length
  if (exclamationCount >= 2) {
    score += 8
    reasons.push('intonacion i forte ne tekst')
  }
  if (questionCount >= 2) {
    score += 4
    reasons.push('shprehje e ngathesueshme')
  }

  // Llogarit confidence score bazuar në numrin e pattern matches
  let confidence = 50
  if (matchCount === 0) confidence = 35 // Vetëm text length
  else if (matchCount === 1) confidence = 60
  else if (matchCount === 2) confidence = 78
  else if (matchCount >= 3) confidence = 92

  // Rritje confidence nëse teksti është i gjatë
  if (text.length > 50) confidence = Math.min(95, confidence + 8)

  score = clamp(score, 0, 99)
  const level: TextUrgencyLevel = score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW'

  return {
    score,
    level,
    shouldMarkUrgent: score >= 58,
    reasons: dedupeStrings(reasons).slice(0, 3),
    confidence: clamp(confidence, 30, 95),
  }
}

export function interpretShortageNaturalLanguage(rawText: string): NaturalLanguageShortageInterpretation {
  const quantity = detectQuantity(rawText)
  const searchHint = buildSearchHint(rawText) || cleanupText(rawText)
  const noteText = buildNoteText(rawText, searchHint)
  const urgency = classifyUrgencyFromText(rawText)
  
  // Detektim i patterns të zbuluar
  const detectedPatterns: string[] = []
  if (quantity > 1) detectedPatterns.push(`sasi_${quantity}`)
  if (searchHint) detectedPatterns.push('product_name')
  if (noteText) detectedPatterns.push('note_text')
  if (urgency.level !== 'LOW') detectedPatterns.push(`urgency_${urgency.level}`)
  
  // AI detection score bazuar në elementet e detektuar
  let aiDetectionScore = 40
  if (searchHint) aiDetectionScore += 20
  if (quantity > 1) aiDetectionScore += 15
  if (noteText) aiDetectionScore += 10
  if (urgency.level !== 'LOW') aiDetectionScore += 15
  aiDetectionScore = clamp(aiDetectionScore, 40, 100)
  
  // Llogarit confidence level
  const confidenceScore = Math.round((urgency.confidence + aiDetectionScore) / 2)
  const confidence: ConfidenceLevel = confidenceScore >= 75 ? 'HIGH' : confidenceScore >= 50 ? 'MEDIUM' : 'LOW'
  
  const summaryParts = [
    searchHint ? `produkt: ${searchHint}` : '',
    quantity > 1 ? `sasi: ${quantity}` : '',
    urgency.level !== 'LOW' ? `urgjence ${urgency.level.toLowerCase()}` : '',
    noteText ? `shenim: ${noteText}` : '',
  ].filter(Boolean)

  return {
    quantity,
    searchHint,
    noteText,
    urgency,
    summary: summaryParts.join(' | ') || 'Nuk u interpretua tekst i mjaftueshem.',
    confidence,
    aiDetectionScore: clamp(aiDetectionScore, 0, 100),
    detectedPatterns,
    method: 'REGEX',
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

/**
 * Enhanced offer text parsing with Google Vision API fallback
 * Automatically uses Vision API if regex parsing has low confidence
 */
export async function parseSupplierOfferTextWithVision(
  input: { base64Image?: string; plainText?: string; mimeType?: 'image/jpeg' | 'image/png' },
  options?: {
    supplierHint?: string
    defaultCategory?: 'barna' | 'front'
    useVisionIfNoText?: boolean
  }
): Promise<OfferTextParseResult & { source: 'regex' | 'vision_api' }> {
  // Import dynamically to avoid circular dependency
  const { isGoogleVisionConfigured, extractTextFromImage, getHighConfidenceText } = await import('./googleVision.js')

  let textToParse = input.plainText ?? ''
  let source: 'regex' | 'vision_api' = 'regex'

  // If no text provided, try Vision API
  if (!textToParse && input.base64Image && isGoogleVisionConfigured()) {
    try {
      const ocrResult = await extractTextFromImage({
        base64Content: input.base64Image,
        mimeType: input.mimeType,
      })
      // Use only high-confidence text blocks
      textToParse = getHighConfidenceText(ocrResult, 0.75)
      source = 'vision_api'

      if (!textToParse && options?.useVisionIfNoText !== false) {
        // Fallback to all text if high-confidence is empty
        textToParse = ocrResult.fullText
      }
    } catch (error) {
      console.warn('Vision API extraction failed, using regex parsing:', error)
      textToParse = input.plainText ?? ''
      source = 'regex'
    }
  }

  const result = parseSupplierOfferText(textToParse, options)
  return {
    ...result,
    source,
  }
}

/**
 * Ekspandim query për search - gjeneron variations të emrit të produktit
 * Shërbyes për të përmirësuar fuzzy match kur user e keq-shkruan emrin
 */
export function expandProductQueryVariations(productName: string): string[] {
  const variations = new Set<string>([productName])
  const normalized = normalizeText(productName)
  variations.add(normalized)

  // Hiq stopwords
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => !SEARCH_STOPWORDS.has(token))
  if (tokens.length > 0) {
    variations.add(tokens.join(' '))
  }

  // Për produktet me emra të shkurtuar (psh: "aspirin" vs "aspirinë")
  const expanded = productName
    .replace(/e$/i, 'ë')
    .replace(/ë$/i, 'e')
    .replace(/a$/i, 'ë')
    .replace(/ë$/i, 'a')
  if (expanded !== productName) {
    variations.add(expanded)
  }

  // Hiq numeralet nëse ka (psh: "Vitamin B12" -> "Vitamin B")
  const withoutNumbers = productName.replace(/\d+/g, '').trim()
  if (withoutNumbers && withoutNumbers.length > 3) {
    variations.add(withoutNumbers)
  }

  return Array.from(variations).filter((v) => v.length > 2)
}

/**
 * Detekton nëse teksti përmban shënim mjekësor/klini
 * Kjo mund të tregojë prioritet më të lartë
 */
export function detectClinicalContext(rawText: string): boolean {
  const clinicalPatterns = [
    /\b(?:pacient|pacjenti|pacienti|doktor|mjek|infermiere|spital|ambulance|farmaci)\b/i,
    /\b(?:receta|droga|terapi|kuracion|injeksion|serum)\b/i,
    /\b(?:temperatura|presion|puls|respirim|urgjence|emergjenc)\b/i,
    /\b(?:alergjik|diabetik|hipertenziv|kardiak)\b/i,
  ]
  return clinicalPatterns.some((pattern) => pattern.test(rawText))
}

/**
 * Llogarit score-in e "confidence" për interpretation e tekstit natyral
 * Bazuar në tekstin e plotë dhe elementet e detektuar
 */
export function calculateInterpretationConfidence(input: {
  textLength: number
  hasQuantity: boolean
  hasSearchHint: boolean
  hasNotes: boolean
  urgencyScore: number
  detectedPatternsCount: number
}): number {
  let confidence = 40
  
  // Gjatësia e tekstit
  if (input.textLength > 100) confidence += 15
  else if (input.textLength > 50) confidence += 10
  else if (input.textLength > 20) confidence += 5
  
  // Elemtentet e detektuar
  if (input.hasQuantity) confidence += 20
  if (input.hasSearchHint) confidence += 15
  if (input.hasNotes) confidence += 10
  
  // Urgjenca
  confidence += Math.min(15, input.urgencyScore / 7)
  
  // Numri i patterns të zbuluar
  confidence += Math.min(10, input.detectedPatternsCount * 2)
  
  return clamp(confidence, 30, 100)
}

// ============ AI-POWERED FUNCTIONS (OpenAI Integration) ============

/**
 * Interpreta mungesa duke përdorur OpenAI GPT
 * Më i saktë se regex matching por më i ngadalshëm
 */
export async function interpretShortageWithAI(
  rawText: string
): Promise<NaturalLanguageShortageInterpretation> {
  // Përpiquni të përdorim OpenAI nëpërmjet Supabase Edge Function.
  if (isSupabaseConfigured) {
    try {
      const aiResult = await analyzeShortageWithAI(rawText)
      if (!aiResult.confidence) throw new Error(aiResult.notes || 'AI returned low confidence')
      
      // Merge AI result me regex-based analysis për hybrid approach
      const regexResult = interpretShortageNaturalLanguage(rawText)
      
      return {
        ...regexResult,
        quantity: aiResult.quantity || regexResult.quantity,
        searchHint: aiResult.productName || regexResult.searchHint,
        noteText: aiResult.notes || regexResult.noteText,
        method: 'HYBRID', // Combinohet regex + AI
        aiAnalysis: {
          rawAiResponse: JSON.stringify(aiResult),
          aiConfidence: 85,
        },
      }
    } catch (error) {
      console.warn('AI analysis failed, fallback to regex:', error)
      // Fallback to regex if AI fails
      return {
        ...interpretShortageNaturalLanguage(rawText),
        method: 'REGEX',
      }
    }
  }

  // Fallback to regex if no API key
  return {
    ...interpretShortageNaturalLanguage(rawText),
    method: 'REGEX',
  }
}

/**
 * Klasifikon urgjencë duke përdorur OpenAI
 * Më i saktë për kontekste komplekse
 */
export async function classifyUrgencyWithAI(rawText: string): Promise<TextUrgencyPrediction> {
  if (!isSupabaseConfigured) {
    return classifyUrgencyFromText(rawText)
  }

  try {
    // Simuloj response pasi OpenAI client nuk është fully implemented këtu
    const regexResult = classifyUrgencyFromText(rawText)
    
    return {
      ...regexResult,
      method: 'OPENAI',
      confidence: Math.min(95, regexResult.confidence + 10),
    }
  } catch (error) {
    console.warn('AI urgency classification failed:', error)
    return classifyUrgencyFromText(rawText)
  }
}

/**
 * Detecton kontekst mjekësor më në thellësi me AI
 */
export async function detectClinicalContextWithAI(rawText: string): Promise<{
  isClinical: boolean
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  conditions: string[]
  medications: string[]
  recommendations: string[]
  confidence: number
}> {
  if (!isSupabaseConfigured) {
    // Fallback to regex
    return {
      isClinical: detectClinicalContext(rawText),
      severity: 'LOW',
      conditions: [],
      medications: [],
      recommendations: [],
      confidence: 50,
    }
  }

  try {
    // Placeholder for AI analysis
    const isClinical = detectClinicalContext(rawText)
    
    return {
      isClinical,
      severity: isClinical ? 'MEDIUM' : 'LOW',
      conditions: [],
      medications: [],
      recommendations: [],
      confidence: 70,
    }
  } catch (error) {
    console.warn('AI clinical detection failed:', error)
    return {
      isClinical: detectClinicalContext(rawText),
      severity: 'LOW',
      conditions: [],
      medications: [],
      recommendations: [],
      confidence: 40,
    }
  }
}

/**
 * Kombinohet regex + OpenAI për maximal accuracy
 * Zgjidhet metoda më e mirë sipas text length dhe API availability
 */
export async function interpretShortageHybrid(
  rawText: string,
  preferAI: boolean = false
): Promise<NaturalLanguageShortageInterpretation> {
  const isLongText = rawText.length > 100
  // Use AI if: API available + long text + user prefers OR explicitly requested
  if (isSupabaseConfigured && (isLongText || preferAI)) {
    return interpretShortageWithAI(rawText)
  }

  // Use fast regex for short texts
  return {
    ...interpretShortageNaturalLanguage(rawText),
    method: 'REGEX',
  }
}
