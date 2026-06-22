// components/mission/virtual-button.tsx
"use client"

import { useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import type { VirtualInputSpec } from "@/lib/missions/types"

export interface VirtualButtonProps {
  spec: VirtualInputSpec
  onPress: (inputId: string) => void
  onSetDigitalInput: (pin: number, high: boolean) => void
  className?: string
}

// Real mechanical buttons bounce: a handful of rapid open/close transitions
// before the contact settles. Simulated here as a short burst of toggles.
const BOUNCE_SEQUENCE_MS = [0, 8, 14, 22, 30]

export function VirtualButton({ spec, onPress, onSetDigitalInput, className }: VirtualButtonProps) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const handlePressStart = useCallback(() => {
    clearTimers()
    onPress(spec.id)

    if (spec.simulateBounce) {
      BOUNCE_SEQUENCE_MS.forEach((delay, i) => {
        const high = i % 2 === 1 // alternate, ending LOW (pressed) on the last step
        timersRef.current.push(
          setTimeout(() => onSetDigitalInput(spec.pin, i === BOUNCE_SEQUENCE_MS.length - 1 ? false : high), delay)
        )
      })
    } else {
      onSetDigitalInput(spec.pin, false) // INPUT_PULLUP convention: pressed = LOW
    }
  }, [spec, onPress, onSetDigitalInput, clearTimers])

  const handlePressEnd = useCallback(() => {
    clearTimers()
    onSetDigitalInput(spec.pin, true) // released = HIGH
  }, [spec, onSetDigitalInput, clearTimers])

  return (
    <button
      type="button"
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      className={cn(
        "select-none rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium",
        "active:bg-primary/20 active:border-primary/60 transition-colors",
        className
      )}
      aria-label={spec.label}
    >
      {spec.label}
      <span className="block text-[10px] text-muted-foreground mt-0.5">Pin {spec.pin} · hold to press</span>
    </button>
  )
}
