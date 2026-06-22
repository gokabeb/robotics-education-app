// components/circuit/component-palette.tsx
"use client"

import { cn } from "@/lib/utils"
import type { DraggedComponent } from "./breadboard-canvas"

export interface PaletteItem {
  label: string
  component: DraggedComponent
  color?: string
}

const DEFAULT_PALETTE_ITEMS: PaletteItem[] = [
  {
    label: "220Ω",
    component: { type: "resistor", params: { resistance: 220 } },
  },
  {
    label: "1kΩ",
    component: { type: "resistor", params: { resistance: 1000 } },
  },
  {
    label: "10kΩ",
    component: { type: "resistor", params: { resistance: 10000 } },
  },
  {
    label: "LED Red",
    component: { type: "led", params: { color: "red", forwardVoltage: 1.8, maxCurrent: 0.02 } },
    color: "#ff3333",
  },
  {
    label: "LED Green",
    component: { type: "led", params: { color: "green", forwardVoltage: 2.1, maxCurrent: 0.02 } },
    color: "#33ff66",
  },
  {
    label: "LED Blue",
    component: { type: "led", params: { color: "blue", forwardVoltage: 3.0, maxCurrent: 0.02 } },
    color: "#3399ff",
  },
]

export interface ComponentPaletteProps {
  onPick: (comp: DraggedComponent) => void
  /** Restrict the palette (e.g. to a mission's allowed components). Defaults
   *  to the full freeplay set. */
  items?: PaletteItem[]
  className?: string
}

export function ComponentPalette({ onPick, items, className }: ComponentPaletteProps) {
  const paletteItems = items ?? DEFAULT_PALETTE_ITEMS
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-0.5">
        Components
      </p>
      {paletteItems.map((item) => (
        <button
          key={item.label}
          onClick={() => onPick(item.component)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium",
            "bg-card border border-border hover:border-primary/60 hover:bg-accent",
            "transition-colors text-left"
          )}
          aria-label={`Add ${item.label}`}
        >
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{
              background: item.color ?? "#c8a060",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          />
          {item.label}
        </button>
      ))}
      <p className="text-[10px] text-muted-foreground/60 px-1 mt-1">
        Click to pick, then click a hole to place.
        <br />
        Click two holes to draw a wire.
        <br />
        Del / Backspace removes selected.
      </p>
    </div>
  )
}
