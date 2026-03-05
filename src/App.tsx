import { useState, useEffect, useRef } from 'react'
import { hyoriCharacter } from './characters/hyori'
import { hyoriCharacterMd, hyoriMeta } from './characters/hyori/persona'
import { Live2DViewer } from './components/Live2DViewer'
import { MangaBackground } from './components/MangaBackground'
import { ChatPanel } from './components/ChatPanel'
import { GuideOverlay } from './components/GuideOverlay'
import { DevPanel } from './components/dev/DevPanel'
import { useSession } from './hooks/useSession'
import type { LlmConfig } from './hooks/useSession'
import { applyEmotionToLive2D } from './lib/live2d/emotion-controller'
import type { Live2DController, ActiveMotion } from './hooks/useLive2D'
import type { AgentResponse } from './lib/api/types'
import './App.css'

const EMOTION_SYMBOLS: Record<string, string> = {
  joy: '♪',
  excitement: '☆',
  contentment: '~',
  love: '♥',
  pride: '✧',
  gratitude: '☺',
  amusement: 'ㅋ',
  relief: 'ε~',
  anger: '#',
  fear: '!!',
  sadness: 'ㅠ',
  anxiety: '...?',
  disgust: ';;;',
  shame: '///',
  guilt: '...',
  surprise: '?!',
  trust: '♡',
  calm: '―',
  numbness: '. . .',
}

/** Any emotion change gets a symbol; unknown emotions default to '!' */
function emotionToSymbol(emotion: string): string {
  return EMOTION_SYMBOLS[emotion] ?? '!'
}

export default function App() {
  const [controller, setController] = useState<Live2DController | null>(null)
  const [activeMotion, setActiveMotion] = useState<ActiveMotion | null>(null)
  const [devOpen, setDevOpen] = useState(false)
  const [emotionReaction, setEmotionReaction] = useState<string | null>(null)
  const [guideVisible, setGuideVisible] = useState(true)
  const autoSessionRef = useRef(false)
  const prevEmotionRef = useRef<string | null>(null)

  const {
    session,
    llmConfig, setLlmConfig,
    turnHistory, currentState, isProcessing,
    createSession, resumeSession, sendMessage, reset,
  } = useSession()

  // Auto-create or resume session from URL params
  useEffect(() => {
    if (autoSessionRef.current) return
    const params = new URLSearchParams(window.location.search)

    const provider = params.get('provider')
      ?? (params.get('baseUrl') ? 'openai-compatible' : null)

    const personaId = params.get('personaId') ?? params.get('sessionId')
    if (!provider && !personaId) return

    autoSessionRef.current = true

    const config: LlmConfig | null = provider ? {
      provider,
      model: params.get('model') ?? undefined,
      baseUrl: params.get('baseUrl') ?? undefined,
    } : null

    if (config) setLlmConfig(config)

    if (personaId) {
      resumeSession(personaId)
    } else if (config) {
      createSession()
        .then(() => console.log('[AutoSession] created'))
        .catch((e: unknown) => console.error('[AutoSession] failed:', e))
    }

    const clean = params.toString()
    window.history.replaceState({}, '', clean ? `?${clean}` : window.location.pathname)
  }, [setLlmConfig, createSession, resumeSession])

  // Update URL with personaId when session becomes active
  useEffect(() => {
    if (session.status !== 'active' || !session.personaId) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('personaId') === session.personaId) return
    params.set('personaId', session.personaId)
    params.delete('sessionId') // Remove legacy param
    window.history.replaceState({}, '', `?${params.toString()}`)
  }, [session.status, session.personaId])

  const llmReady = llmConfig.provider !== 'none'

  useEffect(() => {
    if (session.status === 'idle' && !guideVisible) {
      setDevOpen(true)
    }
  }, [session.status, guideVisible])

  function handleTurnResponse(response: AgentResponse) {
    if (!controller) return
    applyEmotionToLive2D(controller, response, prevEmotionRef.current)

    // Show reaction bubble on emotion change
    const newEmotion = response.emotion.discrete.primary
    if (prevEmotionRef.current && prevEmotionRef.current !== newEmotion) {
      setEmotionReaction(emotionToSymbol(newEmotion))
    }
    prevEmotionRef.current = newEmotion
  }

  return (
    <div className="app-layout">
      {guideVisible && <GuideOverlay onDone={() => setGuideVisible(false)} />}

      {/* Main column: Live2D + Chat */}
      <div className="main-column">
        <MangaBackground />
        <Live2DViewer
          character={hyoriCharacter}
          onReady={(ctrl) => {
            setController(ctrl)
          }}
          onActiveMotionChange={setActiveMotion}
        />
        <ChatPanel
          characterName={hyoriMeta.name}
          session={session}
          isProcessing={isProcessing}
          llmReady={llmReady}
          onSend={sendMessage}
          onTurnResponse={handleTurnResponse}
          emotionReaction={emotionReaction}
          onEmotionReactionDone={() => setEmotionReaction(null)}
        />
        <div className="attribution">
          Powered by Live2D
        </div>

        {/* Toggle for DevPanel */}
        <button
          className="dev-toggle"
          onClick={() => setDevOpen(!devOpen)}
          aria-label="Toggle developer panel"
        >
          {devOpen ? '\u2715' : '</>'}
        </button>
      </div>

      {/* Developer panel */}
      <div className={`dev-column ${devOpen ? '' : 'dev-column--hidden'}`}>
        <DevPanel
          session={session}
          currentState={currentState}
          turnHistory={turnHistory}
          isProcessing={isProcessing}
          characterName={hyoriMeta.name}
          characterMd={hyoriCharacterMd}
          onCreateSession={() => createSession()}
          onReset={reset}
        />
      </div>
    </div>
  )
}
