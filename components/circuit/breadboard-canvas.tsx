// components/circuit/breadboard-canvas.tsx
"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { renderBreadboard, CANVAS_WIDTH, CANVAS_HEIGHT, HOLE_PITCH, holeX, holeY } from "@/lib/circuit/breadboard/breadboard-renderer"
import type { RenderState } from "@/lib/circuit/breadboard/breadboard-renderer"
import { BreadboardState } from "@/lib/circuit/breadboard/breadboard-state"
import type { HolePosition } from "@/lib/circuit/breadboard/breadboard-state"
import { BB_COLS_LEFT, BB_COLS_RIGHT, BREADBOARD_ROWS } from "@/lib/circuit/breadboard/breadboard-layout"
import { BB_OFFSET_X } from "@/lib/circuit/breadboard/breadboard-renderer"
import type { BBColumn } from "@/lib/circuit/breadboard/breadboard-layout"
import { cn } from "@/lib/utils"
import type { NodeId } from "@/lib/circuit/types"

export interface DraggedComponent {
  type: "resistor" | "led"
  params: Record<string, number | string>
}

export interface BreadboardCanvasProps {
  bbState: BreadboardState
  brightnessMap: Record<string, number>
  onNetlistChange: () => void
  draggedComponent: DraggedComponent | null
  onDragConsumed: () => void
  className?: string
}

const ALL_BB_COLS = [...BB_COLS_LEFT, ...BB_COLS_RIGHT] as BBColumn[]

function snapToHole(canvasX: number, canvasY: number): HolePosition | null {
  // Try main tie strips
  for (const col of ALL_BB_COLS) {
    const colY = holeY(col)
    for (let row = 1; row <= BREADBOARD_ROWS; row++) {
      const rx = holeX(row)
      const dist = Math.hypot(canvasX - rx, canvasY - colY)
      if (dist <= HOLE_PITCH * 0.65) return { row, col }
    }
  }
  // Try rail cols
  const railCols: BBColumn[] = ["TOP_PLUS", "TOP_MINUS", "BOT_PLUS", "BOT_MINUS"]
  for (const col of railCols) {
    const colY = holeY(col)
    for (let row = 1; row <= BREADBOARD_ROWS; row++) {
      const rx = holeX(row)
      const dist = Math.hypot(canvasX - rx, canvasY - colY)
      if (dist <= HOLE_PITCH * 0.65) return { row, col }
    }
  }
  return null
}

let componentIdCounter = 1

export function BreadboardCanvas({
  bbState,
  brightnessMap,
  onNetlistChange,
  draggedComponent,
  onDragConsumed,
  className,
}: BreadboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingWireFrom, setPendingWireFrom] = useState<HolePosition | null>(null)
  const [hoveredNet, setHoveredNet] = useState<NodeId | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const netMap = new Map<string, NodeId>()

    const state: RenderState = {
      components: [...bbState.getComponents()],
      wires: [...bbState.getWires()],
      brightnessMap,
      hoveredNet,
      netMap,
      pendingWireFrom,
      selectedId,
    }
    renderBreadboard(ctx, state)
  }, [bbState, brightnessMap, hoveredNet, pendingWireFrom, selectedId])

  // Initial canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    canvas.style.width = `${CANVAS_WIDTH}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`
  }, [])

  useEffect(() => {
    redraw()
  }, [redraw])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = CANVAS_WIDTH / rect.width
      const scaleY = CANVAS_HEIGHT / rect.height
      const cx = (e.clientX - rect.left) * scaleX
      const cy = (e.clientY - rect.top) * scaleY

      // Place dragged component
      if (draggedComponent) {
        const hole = snapToHole(cx, cy)
        if (!hole) return
        const id = `comp_${componentIdCounter++}`
        // Second terminal is 2 rows over in the same column
        const terminal2Row = Math.min(hole.row + 2, BREADBOARD_ROWS)
        bbState.addComponent({
          id,
          type: draggedComponent.type,
          params: draggedComponent.params,
          terminal1: hole,
          terminal2: { row: terminal2Row, col: hole.col },
        })
        onDragConsumed()
        onNetlistChange()
        redraw()
        return
      }

      const hole = snapToHole(cx, cy)

      // Wire drawing mode
      if (hole) {
        if (!pendingWireFrom) {
          setPendingWireFrom(hole)
        } else {
          bbState.addWire(pendingWireFrom, hole)
          setPendingWireFrom(null)
          onNetlistChange()
          redraw()
        }
        return
      }

      // Check component click for selection
      const comps = bbState.getComponents()
      for (const comp of [...comps].reverse()) {
        const x1 = holeX(comp.terminal1.row)
        const y1 = holeY(comp.terminal1.col)
        const x2 = holeX(comp.terminal2.row)
        const y2 = holeY(comp.terminal2.col)
        const minX = Math.min(x1, x2) - 16
        const maxX = Math.max(x1, x2) + 16
        const minY = Math.min(y1, y2) - 8
        const maxY = Math.max(y1, y2) + 8
        if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
          setSelectedId(comp.id)
          return
        }
      }

      // Check wire click for selection
      const wires = bbState.getWires()
      for (const wire of [...wires].reverse()) {
        const x1 = holeX(wire.from.row), y1 = holeY(wire.from.col)
        const x2 = holeX(wire.to.row), y2 = holeY(wire.to.col)
        const midX = Math.min(x1, x2) + Math.abs(x2 - x1) / 2
        if (
          Math.abs(cy - y1) < 8 && cx >= Math.min(x1, x2) - 4 && cx <= Math.max(x1, x2) + 4
        ) {
          setSelectedId(wire.id)
          return
        }
        if (
          Math.abs(cx - x2) < 8 && cy >= Math.min(y1, y2) - 4 && cy <= Math.max(y1, y2) + 4
        ) {
          setSelectedId(wire.id)
          return
        }
        void midX
      }

      setSelectedId(null)
    },
    [draggedComponent, pendingWireFrom, bbState, onDragConsumed, onNetlistChange, redraw]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingWireFrom(null)
        return
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault()
        // Try removing as component
        const comps = bbState.getComponents()
        const isComp = comps.some(c => c.id === selectedId)
        if (isComp) {
          bbState.removeComponent(selectedId)
        } else {
          bbState.removeWire(selectedId)
        }
        setSelectedId(null)
        onNetlistChange()
        redraw()
      }
    },
    [selectedId, bbState, onNetlistChange, redraw]
  )

  return (
    <canvas
      ref={canvasRef}
      className={cn("cursor-crosshair focus:outline-none", className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="Breadboard canvas"
    />
  )
}
