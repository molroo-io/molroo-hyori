/**
 * Browser-compatible LLM adapter factory.
 *
 * Maps the UI's LlmConfig to an SDK-compatible LLMAdapter.
 * Handles browser-specific concerns (e.g. Anthropic browser-access header).
 */

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, generateObject, jsonSchema } from 'ai'
import type { LLMAdapter, GenerateTextOptions, GenerateObjectOptions } from '@molroo-ai/sdk'
import type { ZodType } from 'zod'
import { getProvider } from './providers'

export interface LlmConfig {
  provider: string
  apiKey: string
  model?: string
  baseUrl?: string
}

function isZodSchema(schema: any): schema is ZodType {
  return schema && typeof schema === 'object' && '_def' in schema
}

/**
 * Create an LLMAdapter from UI LlmConfig for browser use.
 * Returns null if provider is 'none' or misconfigured.
 */
export function createBrowserAdapter(config: LlmConfig): LLMAdapter | null {
  if (config.provider === 'none') return null

  const providerDef = getProvider(config.provider)
  if (!providerDef) return null
  if (providerDef.apiKeyRequired && !config.apiKey) return null

  const modelId = config.model || providerDef.defaultModel
  if (!modelId) return null

  function getModel() {
    if (config.provider === 'anthropic') {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
      })
      return anthropic(modelId)
    }

    const baseURL = config.baseUrl || providerDef!.baseUrl
    const openai = createOpenAI({
      apiKey: config.apiKey || undefined,
      baseURL,
    })

    // openai(model) → Responses API (only actual OpenAI)
    // openai.chat(model) → Chat Completions API (works everywhere)
    if (config.provider === 'openai') {
      return openai(modelId)
    }
    return openai.chat(modelId)
  }

  return {
    async generateText(options: GenerateTextOptions): Promise<{ text: string }> {
      const result = await generateText({
        model: getModel(),
        system: options.system,
        messages: options.messages,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { maxOutputTokens: options.maxTokens }),
      })
      return { text: result.text }
    },

    async generateObject<T>(options: GenerateObjectOptions<T>): Promise<{ object: T }> {
      const resolvedSchema = isZodSchema(options.schema)
        ? options.schema
        : jsonSchema(options.schema as any)

      const result = await generateObject({
        model: getModel(),
        schema: resolvedSchema as any,
        system: options.system,
        messages: options.messages,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        maxOutputTokens: 2048,
      })
      return { object: result.object as T }
    },
  }
}
