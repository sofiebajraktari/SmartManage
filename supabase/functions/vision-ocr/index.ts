const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type VisionRequest = {
  base64Content?: string
  mimeType?: 'image/jpeg' | 'image/png' | 'application/pdf'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
  if (!apiKey) {
    return json({ error: 'GOOGLE_VISION_API_KEY mungon ne Supabase secrets' }, 500)
  }

  try {
    const startedAt = Date.now()
    const body = (await req.json()) as VisionRequest
    if ((body as { health?: boolean })?.health === true) {
      return json({
        ok: true,
        service: 'vision-ocr',
        hasGoogleVisionKey: true,
      })
    }
    const base64Content = String(body.base64Content || '').trim()

    if (!base64Content) {
      return json({ error: 'base64Content mungon' }, 400)
    }

    if (body.mimeType === 'application/pdf') {
      return json({ error: 'PDF OCR nuk suportohet nga ky endpoint; perdor image/jpeg ose image/png' }, 400)
    }

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Content },
            features: [
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 100 },
              { type: 'TEXT_DETECTION', maxResults: 100 },
            ],
            imageContext: { languageHints: ['sq', 'en'] },
          },
        ],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return json({ error: data?.error?.message || 'Google Vision request failed' }, response.status)
    }

    const first = data.responses?.[0]
    if (first?.error) {
      return json({ error: first.error.message || 'Vision API error' }, 502)
    }

    const documentAnnotation = first?.documentTextAnnotation
    const textAnnotations = first?.textAnnotations ?? []
    const fullText = String(documentAnnotation?.text || '').trim()
    const textBlocks = textAnnotations.slice(1).map((annotation: any) => {
      const vertices = annotation.boundingPoly?.vertices ?? []
      return {
        text: annotation.description ?? '',
        confidence: annotation.confidence ?? 0.9,
        boundingBox: vertices.length
          ? {
              x1: Math.min(...vertices.map((v: any) => v.x ?? 0)),
              y1: Math.min(...vertices.map((v: any) => v.y ?? 0)),
              x2: Math.max(...vertices.map((v: any) => v.x ?? 0)),
              y2: Math.max(...vertices.map((v: any) => v.y ?? 0)),
            }
          : undefined,
      }
    })

    const detectedLanguages = documentAnnotation?.pages?.[0]?.property?.detectedLanguages
      ? documentAnnotation.pages[0].property.detectedLanguages.map((lang: any) => lang.languageCode)
      : []
    const confidence = textBlocks.length
      ? Math.round((textBlocks.reduce((total: number, block: any) => total + Number(block.confidence ?? 0), 0) / textBlocks.length) * 100)
      : 0

    return json({
      fullText,
      textBlocks,
      detectedLanguages,
      confidence,
      processingTimeMs: Date.now() - startedAt,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400)
  }
})

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
