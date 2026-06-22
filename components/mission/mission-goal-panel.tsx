// components/mission/mission-goal-panel.tsx
"use client"

import { cn } from "@/lib/utils"
import type { CriterionStatus } from "@/lib/missions/types"

export interface MissionGoalPanelProps {
  criteria: CriterionStatus[]
  complete: boolean
  className?: string
}

export function MissionGoalPanel({ criteria, complete, className }: MissionGoalPanelProps) {
  const metCount = criteria.filter(c => c.met).length

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Goal</p>
        <span className="text-xs text-muted-foreground">{metCount}/{criteria.length}</span>
      </div>
      <ul className="space-y-1">
        {criteria.map(c => (
          <li key={c.id} className="flex items-center gap-2 text-sm">
            <span className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
              c.met ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
            )}>
              {c.met ? "✓" : "○"}
            </span>
            <span className={cn(c.met ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
          </li>
        ))}
      </ul>
      {complete && (
        <p className="text-sm font-semibold text-emerald-400 pt-1 border-t border-border">
          Mission complete! 🎉
        </p>
      )}
    </div>
  )
}
