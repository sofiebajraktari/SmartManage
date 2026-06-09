const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY mungon ne Supabase secrets' }, 500)
  }

  try {
    const body = await req.json()
    const messages = validateMessages(body.messages)
    const model =
      typeof body.model === 'string' && body.model.trim() ? body.model : Deno.env.get('OPENAI_MODEL') || 'gpt-3.5-turbo'
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.3
    const maxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : 1024

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return json({ error: data?.error?.message || 'OpenAI request failed' }, response.status)
    }

    return json({
      text: data.choices?.[0]?.message?.content || '',
      model: data.model || model,
      confidence: 85,
      tokensUsed: data.usage?.total_tokens || 0,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400)
  }
})

function validateMessages(value: unknown): OpenAIMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('messages duhet te jete array jo bosh')
  }

  return value.slice(0, 12).map((item) => {
    if (!item || typeof item !== 'object') throw new Error('message invalid')
    const candidate = item as Partial<OpenAIMessage>
    if (!['system', 'user', 'assistant'].includes(candidate.role || '')) {
      throw new Error('message role invalid')
    }
    if (typeof candidate.content !== 'string' || !candidate.content.trim()) {
      throw new Error('message content invalid')
    }
    return {
      role: candidate.role as OpenAIMessage['role'],
      content: candidate.content.slice(0, 8000),
    }
  })
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
