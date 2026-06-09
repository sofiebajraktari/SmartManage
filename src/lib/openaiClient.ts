/**
 * OpenAI API wrapper.
 * Frontend-i nuk mban OPENAI_API_KEY; thirrjet kalojne nga Supabase Edge Function.
 */

import { isSupabaseConfigured, supabase } from './supabase.js'

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenAIResponse {
  text: string
  model: string
  confidence: number
  tokensUsed: number
  hasErrors: boolean
  errorMessage?: string
}

class OpenAIClient {
  private model = 'gpt-3.5-turbo'

  async sendMessage(messages: OpenAIMessage[], temperature: number = 0.3): Promise<OpenAIResponse> {
    if (!isSupabaseConfigured) {
      return {
        text: '',
        model: this.model,
        confidence: 0,
        tokensUsed: 0,
        hasErrors: true,
        errorMessage: 'Supabase nuk eshte i konfiguruar per AI gateway',
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke<{
        text?: string
        model?: string
        confidence?: number
        tokensUsed?: number
        error?: string
      }>('openai-chat', {
        body: {
          model: this.model,
          messages,
          temperature,
          max_tokens: 1024,
        },
      })

      if (error || data?.error) {
        return {
          text: '',
          model: this.model,
          confidence: 0,
          tokensUsed: 0,
          hasErrors: true,
          errorMessage: error?.message || data?.error || 'OpenAI gateway error',
        }
      }

      return {
        text: data?.text || '',
        model: data?.model || this.model,
        confidence: data?.confidence ?? 85,
        tokensUsed: data?.tokensUsed ?? 0,
        hasErrors: false,
      }
    } catch (error) {
      return {
        text: '',
        model: this.model,
        confidence: 0,
        tokensUsed: 0,
        hasErrors: true,
        errorMessage: `Request failed: ${String(error)}`,
      }
    }
  }
}

function parseJsonObject<T>(value: string): T {
  const trimmed = value.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  return JSON.parse(fenced || trimmed) as T
}

export async function analyzeShortageWithAI(shortageText: string): Promise<{
  productName: string
  quantity: number
  urgency: 'LOW' | 'MEDIUM' | 'HIGH'
  notes: string
  confidence: number
}> {
  const client = new OpenAIClient()

  const prompt = `Analizo kete tekst per mungesa ne farmaci/dyqan shendetesor ne shqip:
"${shortageText}"

Pergjigju vetem ne JSON:
{
  "productName": "emri i produktit",
  "quantity": numer,
  "urgency": "LOW|MEDIUM|HIGH",
  "notes": "shenim shtese"
}`

  const response = await client.sendMessage([
    {
      role: 'system',
      content: 'Ti je asistent per analiza te mungesave ne farmaci. Pergjigju gjithmone vetem ne JSON valid.',
    },
    { role: 'user', content: prompt },
  ])

  if (response.hasErrors) {
    return {
      productName: '',
      quantity: 0,
      urgency: 'LOW',
      notes: response.errorMessage || 'AI unavailable',
      confidence: 0,
    }
  }

  try {
    const parsed = parseJsonObject<{
      productName?: string
      quantity?: number
      urgency?: 'LOW' | 'MEDIUM' | 'HIGH'
      notes?: string
    }>(response.text)

    return {
      productName: parsed.productName || '',
      quantity: Number.isFinite(parsed.quantity) ? Number(parsed.quantity) : 0,
      urgency: parsed.urgency || 'LOW',
      notes: parsed.notes || '',
      confidence: Math.min(95, response.confidence + 10),
    }
  } catch {
    return {
      productName: '',
      quantity: 0,
      urgency: 'LOW',
      notes: 'Failed to parse AI response',
      confidence: 0,
    }
  }
}

export async function generateProductRecommendation(input: {
  currentProduct: string
  symptomOrIndication: string
  alternatives?: string[]
}): Promise<{
  recommendations: string[]
  reasoning: string
  confidence: number
}> {
  const client = new OpenAIClient()
  const alternativesText = input.alternatives?.join(', ') || 'asnje'
  const prompt = `Produkti aktual: ${input.currentProduct}
Indikacioni/simptomat: ${input.symptomOrIndication}
Alternativa te disponueshme: ${alternativesText}

Pergjigju vetem ne JSON:
{
  "recommendations": ["emri1", "emri2"],
  "reasoning": "arsyetim i shkurter"
}`

  const response = await client.sendMessage([
    {
      role: 'system',
      content: 'Ti je asistent farmacie. Jep rekomandime te kujdesshme dhe sugjero verifikim profesional kur duhet.',
    },
    { role: 'user', content: prompt },
  ])

  if (response.hasErrors) {
    return {
      recommendations: [],
      reasoning: response.errorMessage || 'Error processing request',
      confidence: 0,
    }
  }

  try {
    const parsed = parseJsonObject<{ recommendations?: string[]; reasoning?: string }>(response.text)
    return {
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      reasoning: parsed.reasoning || '',
      confidence: Math.min(95, response.confidence + 5),
    }
  } catch {
    return {
      recommendations: [],
      reasoning: 'Failed to parse recommendation',
      confidence: 0,
    }
  }
}

export async function parseSupplierOfferWithAI(offerText: string): Promise<{
  products: Array<{
    name: string
    price: number
    quantity: number
    unit: string
  }>
  supplier: string
  validUntil?: string
  notes: string
}> {
  const client = new OpenAIClient()
  const prompt = `Analizo kete oferte furnitori dhe ekstrakto strukturen:
"${offerText}"

Pergjigju vetem ne JSON:
{
  "products": [
    {"name": "...", "price": 0, "quantity": 0, "unit": "..."}
  ],
  "supplier": "...",
  "validUntil": "ISO date ose null",
  "notes": "..."
}`

  const response = await client.sendMessage([
    {
      role: 'system',
      content: 'Ti je parser i ofertave te furnitoreve. Ekstrakto info ne JSON valid.',
    },
    { role: 'user', content: prompt },
  ])

  if (response.hasErrors) {
    return {
      products: [],
      supplier: '',
      notes: response.errorMessage || 'Error parsing offer',
    }
  }

  try {
    const parsed = parseJsonObject<{
      products?: Array<{ name: string; price: number; quantity: number; unit: string }>
      supplier?: string
      validUntil?: string
      notes?: string
    }>(response.text)
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      supplier: parsed.supplier || '',
      validUntil: parsed.validUntil,
      notes: parsed.notes || '',
    }
  } catch {
    return {
      products: [],
      supplier: '',
      notes: 'Failed to parse offer',
    }
  }
}

export async function analyzeTextWithAI(text: string, instruction: string): Promise<OpenAIResponse> {
  const client = new OpenAIClient()
  return client.sendMessage([
    {
      role: 'system',
      content: 'Ti je asistent per farmaci. Jep pergjigje te sakta, te shkurtra dhe te sigurta.',
    },
    {
      role: 'user',
      content: `${instruction}\n\nTeksti:\n${text}`,
    },
  ])
}
