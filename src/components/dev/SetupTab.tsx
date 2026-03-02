import type { SessionState } from '../../hooks/useSession'
import { Button } from '../ui/button'

interface SetupTabProps {
  session: SessionState
  isProcessing: boolean
  characterName: string
  characterMd: string
  onCreateSession: () => void
}

export function SetupTab({
  session, isProcessing,
  characterName, characterMd,
  onCreateSession,
}: SetupTabProps) {
  const isActive = session.status === 'active'
  const isCreating = session.status === 'creating'

  return (
    <div className="space-y-5">
      <Section title="Character">
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white">{characterName}</span>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Character Description</summary>
            <pre className="mt-1 text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto text-[11px]">
              {characterMd.slice(0, 1000)}{characterMd.length > 1000 ? '...' : ''}
            </pre>
          </details>
        </div>
      </Section>

      {!isActive && (
        <Button className="w-full" onClick={onCreateSession} disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create Session'}
        </Button>
      )}
      {isActive && session.personaId && (
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Persona ID</span>
          <code className="mt-1 block break-all text-xs text-primary">{session.personaId}</code>
        </div>
      )}
      {session.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {session.error}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}
