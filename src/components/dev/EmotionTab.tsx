import type { PersonaState } from '../../lib/api/types'
import { Badge } from '../ui/badge'

interface EmotionTabProps {
  state: PersonaState | null
}

export function EmotionTab({ state }: EmotionTabProps) {
  if (!state) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No session active. Create one in Setup tab.</p>
  }

  const { emotion } = state

  return (
    <div className="space-y-5">
      <Section title="VAD State">
        <VadBar label="V" value={emotion.vad.V} />
        <VadBar label="A" value={emotion.vad.A} />
        <VadBar label="D" value={emotion.vad.D} />
      </Section>

      {state.mood && (
        <Section title="Mood">
          <VadBar label="V" value={state.mood.vad.V} />
          <VadBar label="A" value={state.mood.vad.A} />
          <VadBar label="D" value={state.mood.vad.D} />
        </Section>
      )}

      {emotion.discrete && (
        <Section title="Discrete Emotion">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">{emotion.discrete.primary}</Badge>
            {emotion.discrete.secondary && <Badge variant="secondary">{emotion.discrete.secondary}</Badge>}
            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
              {emotion.discrete.intensity.toFixed(2)}
            </Badge>
          </div>
        </Section>
      )}

      <Section title="Status">
        <div className="space-y-2">
          {state.somatic && state.somatic.length > 0 && (
            <StatusRow label="Somatic">
              <span className="text-xs text-muted-foreground">{state.somatic.join(', ')}</span>
            </StatusRow>
          )}
          {state.narrative && (
            <>
              <StatusRow label="Tone">
                <span className="font-mono text-xs text-muted-foreground">{state.narrative.tone.toFixed(2)}</span>
              </StatusRow>
              <StatusRow label="Agency">
                <span className="font-mono text-xs text-muted-foreground">{state.narrative.agency.toFixed(2)}</span>
              </StatusRow>
              <StatusRow label="Coherence">
                <span className="font-mono text-xs text-muted-foreground">{state.narrative.coherence.toFixed(2)}</span>
              </StatusRow>
            </>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}

function VadBar({ label, value }: { label: string; value: number }) {
  const pct = ((value + 1) / 2) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-[11px] font-semibold text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-muted">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
        <div className="absolute top-0 h-full rounded-full transition-all duration-300"
          style={{
            left: value >= 0 ? '50%' : `${pct}%`,
            width: `${Math.abs(value) * 50}%`,
            background: value >= 0 ? '#4ade80' : '#f87171',
          }} />
      </div>
      <span className="w-13 text-right font-mono text-[11px] text-muted-foreground">{value.toFixed(3)}</span>
    </div>
  )
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
