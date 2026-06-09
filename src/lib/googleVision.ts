/**
 * Google Vision API integration for OCR and document text extraction
 * Supports offer scanning, prescription reading, inventory lists
 */

export interface GoogleVisionConfig {
  apiKey: string
  maxRetries?: number
  timeoutMs?: number
}

export interface OcrTextBlock {
  text: string
  confidence: number
  boundingBox?: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
}

export interface DocumentOcrResult {
  fullText: string
  textBlocks: OcrTextBlock[]
  detectedLanguages: string[]
  confidence: number
  processingTimeMs: number
}

let globalVisionConfig: GoogleVisionConfig | null = null

/**
 * Initialize Google Vision API with API key
 * Store safely in environment variables, not in code
 */
export function initializeGoogleVision(apiKey: string): void {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Google Vision API key is required')
  }
  globalVisionConfig = {
    apiKey,
    maxRetries: 3,
    timeoutMs: 30000,
  }
}

/**
 * Check if Vision API is configured
 */
export function isGoogleVisionConfigured(): boolean {
  return globalVisionConfig !== null && (globalVisionConfig.apiKey?.length ?? 0) > 0
}

/**
 * Extract text from image/PDF using Google Vision API
 * Supports: document_text_detection (block-level) and text_detection (character-level)
 */
export async function extractTextFromImage(imageData: {
  base64Content: string
  mimeType?: 'image/jpeg' | 'image/png' | 'application/pdf'
}): Promise<DocumentOcrResult> {
  if (!globalVisionConfig) {
    throw new Error('Google Vision API not initialized. Call initializeGoogleVision() first.')
  }

  const startTime = performance.now()
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${globalVisionConfig.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageData.base64Content,
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 100,
                },
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 100,
                },
              ],
              imageContext: {
                languageHints: ['sq', 'en'], // Albanian + English
              },
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const processingTimeMs = Math.round(performance.now() - startTime)

    if (result.responses?.[0]?.error) {
      throw new Error(`Vision API error: ${result.responses[0].error.message}`)
    }

    const documentAnnotation = result.responses?.[0]?.documentTextAnnotation
    const textAnnotations = result.responses?.[0]?.textAnnotations ?? []

    if (!documentAnnotation) {
      return {
        fullText: '',
        textBlocks: [],
        detectedLanguages: [],
        confidence: 0,
        processingTimeMs,
      }
    }

    // Full text from document detection
    const fullText = documentAnnotation.text ?? ''

    // Extract individual blocks with confidence
    const textBlocks: OcrTextBlock[] = textAnnotations
      .slice(1) // Skip first item (it's the full text)
      .map((annotation: any) => ({
        text: annotation.description ?? '',
        confidence: annotation.confidence ?? 0.9,
        boundingBox: annotation.boundingPoly
          ? {
              x1: Math.min(...annotation.boundingPoly.vertices.map((v: any) => v.x ?? 0)),
              y1: Math.min(...annotation.boundingPoly.vertices.map((v: any) => v.y ?? 0)),
              x2: Math.max(...annotation.boundingPoly.vertices.map((v: any) => v.x ?? 0)),
              y2: Math.max(...annotation.boundingPoly.vertices.map((v: any) => v.y ?? 0)),
            }
          : undefined,
      }))

    // Detect languages
    const detectedLanguages = documentAnnotation.pages?.[0]?.property?.detectedLanguages
      ? documentAnnotation.pages[0].property.detectedLanguages.map((lang: any) => lang.languageCode)
      : ['unknown']

    // Calculate overall confidence from blocks
    const blockConfidences = textBlocks.map((b) => b.confidence)
    const avgConfidence =
      blockConfidences.length > 0
        ? Math.round((blockConfidences.reduce((a, b) => a + b, 0) / blockConfidences.length) * 100)
        : 0

    return {
      fullText: fullText.trim(),
      textBlocks,
      detectedLanguages,
      confidence: avgConfidence,
      processingTimeMs,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to extract text from image: ${message}`)
  }
}

/**
 * Convert image file to base64 for API request
 */
export async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data:image/...;base64, prefix
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Batch OCR processing for multiple images
 */
export async function batchExtractText(
  images: Array<{ base64Content: string; mimeType?: 'image/jpeg' | 'image/png' }>
): Promise<DocumentOcrResult[]> {
  const results: DocumentOcrResult[] = []

  for (const image of images) {
    try {
      const result = await extractTextFromImage(image)
      results.push(result)
      // Rate limiting: small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      console.error('Batch OCR error:', error)
      results.push({
        fullText: '',
        textBlocks: [],
        detectedLanguages: [],
        confidence: 0,
        processingTimeMs: 0,
      })
    }
  }

  return results
}

/**
 * Helper: Extract high-confidence text blocks
 */
export function getHighConfidenceText(result: DocumentOcrResult, minConfidence: number = 0.8): string {
  return result.textBlocks
    .filter((block) => block.confidence >= minConfidence)
    .map((block) => block.text)
    .join(' ')
    .trim()
}

/**
 * Detect if image contains Albanian text
 */
export function containsAlbanianText(result: DocumentOcrResult): boolean {
  return result.detectedLanguages.includes('sq') || result.detectedLanguages.some((lang) => lang.startsWith('sq'))
}
