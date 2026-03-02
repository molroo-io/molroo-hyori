import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

interface Env {
  LLM_API_KEY: string
}

const ALLOWED_ORIGINS = [
  'https://hyori.molroo.io',
  'https://molroo-hyori.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('Origin')),
  })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin')
  const headers = corsHeaders(origin)

  try {
    const body = await request.json<{
      provider: string
      model: string
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      system?: string
      temperature?: number
      maxTokens?: number
      baseUrl?: string
    }>()

    const apiKey = env.LLM_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'LLM_API_KEY not configured' }, { status: 500, headers })
    }

    const model = createModel(body.provider, apiKey, body.model, body.baseUrl)

    const result = await generateText({
      model,
      system: body.system,
      messages: body.messages,
      ...(body.temperature !== undefined && { temperature: body.temperature }),
      ...(body.maxTokens !== undefined && { maxOutputTokens: body.maxTokens }),
    })

    return Response.json({ text: result.text }, { headers })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return Response.json({ error: message }, { status: 500, headers })
  }
}

function createModel(provider: string, apiKey: string, modelId: string, baseUrl?: string) {
  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey })
    return anthropic(modelId)
  }

  const openai = createOpenAI({ apiKey, baseURL: baseUrl || getBaseUrl(provider) })
  if (provider === 'openai') return openai(modelId)
  return openai.chat(modelId)
}

function getBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    'openai': 'https://api.openai.com/v1',
    'google-generative-ai': 'https://generativelanguage.googleapis.com/v1beta/openai',
    'openrouter-ai': 'https://openrouter.ai/api/v1',
    'groq': 'https://api.groq.com/openai/v1',
    'mistral-ai': 'https://api.mistral.ai/v1',
    'deepseek': 'https://api.deepseek.com',
    'xai': 'https://api.x.ai/v1',
    'together-ai': 'https://api.together.xyz/v1',
    'fireworks-ai': 'https://api.fireworks.ai/inference/v1',
    'cerebras-ai': 'https://api.cerebras.ai/v1',
    'perplexity-ai': 'https://api.perplexity.ai',
  }
  return urls[provider] || 'https://api.openai.com/v1'
}
