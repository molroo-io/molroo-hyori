/**
 * Browser LLM adapter — proxy mode.
 *
 * Sends requests to CF Pages Function proxy (/api/llm/*) instead of
 * calling LLM APIs directly from the browser. API key stays server-side.
 */

import { type ZodType, toJSONSchema } from 'zod'
import { getProvider } from './providers'

// ── Internalized LLMAdapter types (matches @molroo-io/sdk interface) ──

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GenerateTextOptions {
  model?: string
  system?: string
  messages: Message[]
  temperature?: number
  maxTokens?: number
}

export interface GenerateObjectOptions<T> {
  model?: string
  system?: string
  messages: Message[]
  schema: ZodType<T>
  temperature?: number
}

export interface LLMAdapter {
  generateText(options: GenerateTextOptions): Promise<{ text: string }>
  generateObject<T>(options: GenerateObjectOptions<T>): Promise<{ object: T }>
}

// ── Config ──

export interface LlmConfig {
  provider: string
  model?: string
  baseUrl?: string
}

const PROXY_BASE = import.meta.env.VITE_LLM_PROXY_URL ?? '/api/llm'

/**
 * Create an LLMAdapter that calls the CF Pages Function proxy.
 * Returns null if provider is 'none'.
 */
export function createBrowserAdapter(config: LlmConfig): LLMAdapter | null {
  if (config.provider === 'none') return null

  const providerDef = getProvider(config.provider)
  if (!providerDef) return null

  const modelId = config.model || providerDef.defaultModel
  if (!modelId) return null

  return {
    async generateText(options: GenerateTextOptions): Promise<{ text: string }> {
      const res = await fetch(`${PROXY_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          model: modelId,
          messages: options.messages,
          system: options.system,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          baseUrl: config.baseUrl || providerDef!.baseUrl,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error((err as any).error || `Proxy error ${res.status}`)
      }

      return res.json() as Promise<{ text: string }>
    },

    async generateObject<T>(options: GenerateObjectOptions<T>): Promise<{ object: T }> {
      const schema = toJSONSchema(options.schema, { io: 'input' })

      const res = await fetch(`${PROXY_BASE}/structured`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          model: modelId,
          messages: options.messages,
          system: options.system,
          temperature: options.temperature,
          schema,
          baseUrl: config.baseUrl || providerDef!.baseUrl,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error((err as any).error || `Proxy error ${res.status}`)
      }

      return res.json() as Promise<{ object: T }>
    },
  }
}
