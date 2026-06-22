// components/mission/mission-hint.tsx
"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Hint } from "@/lib/missions/types"

export interface MissionHintProps {
  hint: Hint | null
  className?: string
}

// Presentation matches design spec §7.4: tier 1 is a passive pulsing trigger
// the student must click to reveal; tiers 2-3 surface automatically.
export function MissionHint({ hint, className }: MissionHintProps) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setRevealed(hint ? hint.tier >= 2 : false)
  }, [hint?.id, hint?.tier])

  if (!hint) return null

  if (!revealed) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10",
          "px-3 py-1.5 text-xs text-amber-400 animate-pulse",
          className
        )}
      >
        💡 Hint available
      </button>
    )
  }

  return (
    <div className={cn(
      "rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100",
      className
    )}>
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1">
        Hint (tier {hint.tier})
      </p>
      <p>{hint.content}</p>
    </div>
  )
}
