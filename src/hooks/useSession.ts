import { useState, useCallback, useRef, useMemo } from 'react'
import { Molroo } from '@molroo-io/sdk'
import type { PersonaChatResult, PersonaState } from '@molroo-io/sdk'
import { createBrowserAdapter } from '../lib/llm/adapter'
import type { LlmConfig } from '../lib/llm/adapter'
import { HYORI_CONFIG, HYORI_CONSUMER_SUFFIX } from '../characters/hyori/persona'

export type { LlmConfig } from '../lib/llm/adapter'

/** Inferred persona instance type from the Molroo class. */
type PersonaInstance = Awaited<ReturnType<Molroo['connectPersona']>>

export interface SessionState {
  status: 'idle' | 'creating' | 'active' | 'error'
  personaId: string | null
  error: string | null
}

export interface TurnEntry {
  id: number
  userMessage: string
  result: PersonaChatResult
  timestamp: number
}

const INITIAL_SESSION: SessionState = {
  status: 'idle',
  personaId: null,
  error: null,
}

const DEFAULT_API_URL = import.meta.env.VITE_MOLROO_API_URL ?? 'https://api.molroo.io'
const DEFAULT_API_KEY = import.meta.env.VITE_MOLROO_API_KEY ?? ''

const LS_KEY = 'molroo-llm-config'

const DEFAULT_LLM_PROVIDER = import.meta.env.VITE_LLM_PROVIDER ?? 'none'
const DEFAULT_LLM_MODEL = import.meta.env.VITE_LLM_MODEL ?? ''

function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<LlmConfig>
      return {
        provider: saved.provider ?? DEFAULT_LLM_PROVIDER,
        model: saved.model ?? DEFAULT_LLM_MODEL,
        baseUrl: saved.baseUrl,
      }
    }
  } catch { /* ignore */ }
  return { provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL }
}

function saveLlmConfig(config: LlmConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(config))
}

export function useSession() {
  const [session, setSession] = useState<SessionState>(INITIAL_SESSION)
  const [molrooApiKey, setMolrooApiKey] = useState(DEFAULT_API_KEY)
  const [llmConfig, setLlmConfigState] = useState<LlmConfig>(loadLlmConfig)
  const [turnHistory, setTurnHistory] = useState<TurnEntry[]>([])
  const [currentState, setCurrentState] = useState<PersonaState | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const turnIdRef = useRef(0)
  const personaRef = useRef<PersonaInstance | null>(null)

  const setLlmConfig = useCallback((config: LlmConfig) => {
    setLlmConfigState(config)
    saveLlmConfig(config)
  }, [])

  const molroo = useMemo(() => new Molroo({
    baseUrl: DEFAULT_API_URL,
    apiKey: molrooApiKey,
  }), [molrooApiKey])

  /**
   * Create a new persona session with the Hyori config.
   */
  const createSession = useCallback(async () => {
    setSession({ status: 'creating', personaId: null, error: null })
    try {
      const llm = createBrowserAdapter(llmConfig)

      console.log('[Session] Creating persona with SDK...')
      const persona = await molroo.createPersona(
        HYORI_CONFIG,
        { llm: llm ?? undefined },
      )
      console.log('[Session] created:', persona.id)

      personaRef.current = persona
      setSession({ status: 'active', personaId: persona.id, error: null })
      setTurnHistory([])
      turnIdRef.current = 0

      try {
        const state = await persona.getState()
        setCurrentState(state)
      } catch (stateErr) {
        console.warn('[Session] getState failed (non-fatal):', stateErr)
      }
    } catch (err) {
      console.error('[Session] createSession failed:', err)
      const msg = err instanceof Error ? err.message : 'Failed to create session'
      setSession(prev => ({ ...prev, status: 'error', error: msg }))
    }
  }, [molroo, llmConfig])

  /**
   * Send a message via SDK chat() — handles LLM generation + emotion processing.
   */
  const sendMessage = useCallback(async (message: string): Promise<{
    result: PersonaChatResult
    displayText: string
  } | { error: string } | null> => {
    if (session.status !== 'active' || !personaRef.current || isProcessing) return null
    setIsProcessing(true)
    try {
      let currentPersona = personaRef.current

      // Rebuild persona in case LLM config changed since session creation
      const llm = createBrowserAdapter(llmConfig)
      if (llm) {
        currentPersona = await molroo.connectPersona(currentPersona.id, { llm })
        personaRef.current = currentPersona
      }

      const history = turnHistory.flatMap(t => [
        { role: 'user' as const, content: t.userMessage },
        { role: 'assistant' as const, content: t.result.text },
      ])

      let chatResult: PersonaChatResult

      if (llmConfig.provider !== 'none') {
        chatResult = await currentPersona.chat(message, {
          history,
          consumerSuffix: HYORI_CONSUMER_SUFFIX,
        })
      } else {
        // No LLM — perceive-only with default appraisal
        const response = await currentPersona.perceive(message, {
          appraisal: {
            goal_relevance: 0, goal_congruence: 0, expectedness: 0.5,
            controllability: 0.5, agency: 0, norm_compatibility: 0,
            internal_standards: 0, adjustment_potential: 0.5, urgency: 0.5,
          },
        })
        chatResult = {
          text: response.text ?? message,
          response,
          updatedHistory: [
            ...history,
            { role: 'user' as const, content: message },
            { role: 'assistant' as const, content: response.text ?? message },
          ],
        }
      }

      const entry: TurnEntry = {
        id: ++turnIdRef.current,
        userMessage: message,
        result: chatResult,
        timestamp: Date.now(),
      }
      setTurnHistory(prev => [...prev, entry])

      // Update state from response
      if (chatResult.state) {
        setCurrentState(chatResult.state)
      } else {
        // Derive minimal state from response
        setCurrentState(prev => prev ? {
          ...prev,
          emotion: chatResult.response.emotion,
        } : {
          emotion: chatResult.response.emotion,
        })
      }

      return {
        result: chatResult,
        displayText: chatResult.text,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process turn'
      setSession(prev => ({ ...prev, error: msg }))
      return { error: msg }
    } finally {
      setIsProcessing(false)
    }
  }, [session.status, isProcessing, llmConfig, molroo, turnHistory])

  const resumeSession = useCallback(async (personaId: string) => {
    setSession({ status: 'creating', personaId: null, error: null })
    try {
      const llm = createBrowserAdapter(llmConfig)
      const persona = await molroo.connectPersona(
        personaId,
        { llm: llm ?? undefined },
      )

      personaRef.current = persona
      setSession({ status: 'active', personaId, error: null })
      setTurnHistory([])
      turnIdRef.current = 0

      const state = await persona.getState()
      setCurrentState(state)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Session not found'
      setSession(prev => ({ ...prev, status: 'error', error: msg }))
    }
  }, [molroo, llmConfig])

  const reset = useCallback(() => {
    personaRef.current = null
    setSession(INITIAL_SESSION)
    setTurnHistory([])
    setCurrentState(null)
    turnIdRef.current = 0
  }, [])

  return {
    session,
    molrooApiKey,
    setMolrooApiKey,
    llmConfig,
    setLlmConfig,
    turnHistory,
    currentState,
    isProcessing,
    createSession,
    resumeSession,
    sendMessage,
    reset,
  }
}
