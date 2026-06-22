// components/mission/mission-briefing.tsx
"use client"

import { cn } from "@/lib/utils"
import type { Mission } from "@/lib/missions/types"

export interface MissionBriefingProps {
  mission: Mission
  onDismiss: () => void
  className?: string
}

// Briefing/context fields are authored as plain text with markdown-style
// paragraphs in the seed JSON — Phase 3 renders them as plain paragraphs.
// A real markdown renderer (already a Phase 4+ dependency elsewhere in the
// app) can replace this without changing the Mission schema.
export function MissionBriefing({ mission, onDismiss, className }: MissionBriefingProps) {
  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6", className)}>
      <div className="max-w-lg rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Mission {mission.difficulty} · {mission.estimatedMinutes} min
          </p>
          <h2 className="text-lg font-bold mt-1">{mission.title}</h2>
          <p className="text-sm text-muted-foreground">{mission.subtitle}</p>
        </div>
        <p className="text-sm leading-relaxed">{mission.narrative.briefing}</p>
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
          {mission.narrative.context}
        </p>
        <button
          onClick={onDismiss}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Start Mission
        </button>
      </div>
    </div>
  )
}
