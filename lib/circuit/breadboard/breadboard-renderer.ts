// lib/circuit/breadboard/breadboard-renderer.ts
// Pure canvas drawing — no React, no DOM side effects beyond the provided ctx.

import {
  BREADBOARD_ROWS, BB_COLS_LEFT, BB_COLS_RIGHT,
  ARDUINO_HOLES, ARDUINO_WIDTH, ARDUINO_HEIGHT, ARDUINO_HOLE_PITCH,
  holeNet, type BBColumn, type ArduinoHole
} from "./breadboard-layout"
import type { PlacedComponent, UserWire, WireEndpoint } from "./breadboard-state"
import type { NodeId } from "../types"
import { GND, VCC } from "../types"

export const HOLE_PITCH  = 14
export const HOLE_RADIUS = 3
export const RAIL_HEIGHT = 22
export const GAP_HEIGHT  = 24
export const ARDUINO_OFFSET_X = 8
export const BB_OFFSET_X = ARDUINO_OFFSET_X + ARDUINO_WIDTH + 16
export const BB_HEIGHT = RAIL_HEIGHT + 5 * HOLE_PITCH + GAP_HEIGHT + 5 * HOLE_PITCH + RAIL_HEIGHT
export const CANVAS_WIDTH  = BB_OFFSET_X + BREADBOARD_ROWS * HOLE_PITCH + 16
export const CANVAS_HEIGHT = Math.max(BB_HEIGHT + 32, ARDUINO_HEIGHT + 32)

export function holeX(row: number): number {
  return BB_OFFSET_X + (row - 1) * HOLE_PITCH + HOLE_PITCH / 2
}

export function holeY(col: BBColumn): number {
  switch (col) {
    case "TOP_PLUS":  return 8
    case "TOP_MINUS": return 8 + HOLE_PITCH
    case "BOT_PLUS":  return BB_HEIGHT - RAIL_HEIGHT + HOLE_PITCH
    case "BOT_MINUS": return BB_HEIGHT - RAIL_HEIGHT + 8
    default:
      if ((BB_COLS_LEFT as readonly string[]).includes(col)) {
        const idx = "abcde".indexOf(col)
        return RAIL_HEIGHT + idx * HOLE_PITCH + HOLE_PITCH / 2
      } else {
        const idx = "fghij".indexOf(col)
        return RAIL_HEIGHT + 5 * HOLE_PITCH + GAP_HEIGHT + idx * HOLE_PITCH + HOLE_PITCH / 2
      }
  }
}

export function arduinoHoleXY(hole: ArduinoHole): { x: number; y: number } {
  return {
    x: ARDUINO_OFFSET_X + hole.x,
    y: 16 + hole.y,
  }
}

/** Canvas (x, y) for any wire endpoint — breadboard hole or Arduino pin. */
export function endpointXY(e: WireEndpoint): { x: number; y: number } {
  if (e.kind === "arduino") {
    const hole = ARDUINO_HOLES.get(e.pinKey)
    return hole ? arduinoHoleXY(hole) : { x: 0, y: 0 }
  }
  return { x: holeX(e.row), y: holeY(e.col) }
}

function netForEndpoint(e: WireEndpoint): NodeId {
  if (e.kind === "arduino") return ARDUINO_HOLES.get(e.pinKey)?.nodeId ?? "FLOATING"
  return holeNet(e.row, e.col)
}

const LED_COLORS: Record<string, string> = {
  red: "#ff3333", green: "#33ff66", blue: "#3399ff",
  white: "#ffffff", yellow: "#ffee33"
}

export interface RenderState {
  components:      PlacedComponent[]
  wires:           UserWire[]
  brightnessMap:   Record<string, number>
  hoveredNet:      NodeId | null
  netMap:          Map<string, NodeId>
  pendingWireFrom: WireEndpoint | null
  selectedId:      string | null
}

export function renderBreadboard(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const dpr = window.devicePixelRatio || 1
  ctx.save()
  ctx.scale(dpr, dpr)

  ctx.fillStyle = "#1a1a2e"
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  drawArduino(ctx)
  drawPowerRails(ctx)
  drawTieStrips(ctx, state)
  drawWires(ctx, state)
  drawComponents(ctx, state)

  ctx.restore()
}

function drawArduino(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#1a3a5c"
  ctx.strokeStyle = "#2a5a8c"
  ctx.lineWidth = 1.5
  roundRect(ctx, ARDUINO_OFFSET_X, 12, ARDUINO_WIDTH - 8, ARDUINO_HEIGHT, 6)
  ctx.fill(); ctx.stroke()

  ctx.fillStyle = "#4a90d9"
  ctx.font = "bold 9px monospace"
  ctx.textAlign = "center"
  ctx.fillText("ARDUINO", ARDUINO_OFFSET_X + (ARDUINO_WIDTH - 8) / 2, 28)
  ctx.fillText("UNO", ARDUINO_OFFSET_X + (ARDUINO_WIDTH - 8) / 2, 40)

  for (const hole of ARDUINO_HOLES.values()) {
    const { x, y } = arduinoHoleXY(hole)
    ctx.beginPath()
    ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = hole.nodeId === GND ? "#555555" : hole.nodeId === VCC ? "#cc4444" : "#888888"
    ctx.fill()

    ctx.fillStyle = "#aaaaaa"
    ctx.font = "7px monospace"
    ctx.textAlign = "right"
    ctx.fillText(hole.label, x - 6, y + 3)
  }
}

function drawPowerRails(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "rgba(200, 50, 50, 0.25)"
  ctx.fillRect(BB_OFFSET_X - 4, 4, BREADBOARD_ROWS * HOLE_PITCH + 8, RAIL_HEIGHT - 2)
  ctx.fillRect(BB_OFFSET_X - 4, BB_HEIGHT - RAIL_HEIGHT, BREADBOARD_ROWS * HOLE_PITCH + 8, RAIL_HEIGHT - 2)

  ctx.fillStyle = "rgba(50, 80, 200, 0.2)"
  ctx.fillRect(BB_OFFSET_X - 4, HOLE_PITCH + 2, BREADBOARD_ROWS * HOLE_PITCH + 8, RAIL_HEIGHT - HOLE_PITCH - 2)
  ctx.fillRect(BB_OFFSET_X - 4, BB_HEIGHT - RAIL_HEIGHT + 2, BREADBOARD_ROWS * HOLE_PITCH + 8, HOLE_PITCH)

  for (let row = 1; row <= BREADBOARD_ROWS; row++) {
    const x = holeX(row)
    for (const railCol of ["TOP_PLUS", "TOP_MINUS", "BOT_PLUS", "BOT_MINUS"] as BBColumn[]) {
      const y = holeY(railCol)
      const isPlus = railCol === "TOP_PLUS" || railCol === "BOT_PLUS"
      ctx.beginPath()
      ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = isPlus ? "#cc4444" : "#4466cc"
      ctx.fill()
    }
  }
}

function drawTieStrips(ctx: CanvasRenderingContext2D, state: RenderState): void {
  ctx.fillStyle = "#2a3a4a"
  ctx.fillRect(BB_OFFSET_X - 4, RAIL_HEIGHT + 2, BREADBOARD_ROWS * HOLE_PITCH + 8, 5 * HOLE_PITCH - 2)
  ctx.fillRect(BB_OFFSET_X - 4, RAIL_HEIGHT + 5 * HOLE_PITCH + GAP_HEIGHT, BREADBOARD_ROWS * HOLE_PITCH + 8, 5 * HOLE_PITCH - 2)

  ctx.fillStyle = "#888"
  ctx.font = "8px monospace"
  ctx.textAlign = "center"
  ctx.fillText("DIP", BB_OFFSET_X + 8, RAIL_HEIGHT + 5 * HOLE_PITCH + GAP_HEIGHT / 2 + 3)

  for (let row = 1; row <= BREADBOARD_ROWS; row++) {
    const x = holeX(row)
    const allCols = [...BB_COLS_LEFT, ...BB_COLS_RIGHT] as BBColumn[]
    for (const col of allCols) {
      const y = holeY(col)
      ctx.beginPath()
      ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = "#3a4a5a"
      ctx.fill()
      ctx.strokeStyle = "#4a6a8a"
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }
}

function drawWires(ctx: CanvasRenderingContext2D, state: RenderState): void {
  for (const wire of state.wires) {
    const { x: x1, y: y1 } = endpointXY(wire.from)
    const { x: x2, y: y2 } = endpointXY(wire.to)

    const fromNet = netForEndpoint(wire.from)
    const color = fromNet === GND ? "#4466ff" : fromNet === VCC ? "#ff4444" : "#44ddaa"

    ctx.beginPath()
    ctx.strokeStyle = state.selectedId === wire.id ? "#ffff00" : color
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

function drawComponents(ctx: CanvasRenderingContext2D, state: RenderState): void {
  for (const comp of state.components) {
    const x1 = holeX(comp.terminal1.row), y1 = holeY(comp.terminal1.col)
    const x2 = holeX(comp.terminal2.row), y2 = holeY(comp.terminal2.col)
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
    const isSelected = state.selectedId === comp.id

    if (comp.type === "resistor") {
      ctx.fillStyle = isSelected ? "#ffee88" : "#c8a060"
      ctx.strokeStyle = isSelected ? "#ffff00" : "#a07840"
      ctx.lineWidth = 1
      roundRect(ctx, cx - 14, cy - 5, 28, 10, 3)
      ctx.fill(); ctx.stroke()
      ctx.strokeStyle = "#888"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, y1); ctx.lineTo(cx - 14, cy)
      ctx.moveTo(x2, y2); ctx.lineTo(cx + 14, cy)
      ctx.stroke()
      ctx.fillStyle = "#333"
      ctx.font = "bold 7px monospace"
      ctx.textAlign = "center"
      const R = comp.params.resistance
      ctx.fillText(R ? `${R}Ω` : "R", cx, cy + 3)

    } else if (comp.type === "led") {
      const brightness = state.brightnessMap[comp.id] ?? 0
      const color = LED_COLORS[comp.params.color as string] ?? "#ff3333"

      ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, y1); ctx.lineTo(cx - 6, cy)
      ctx.moveTo(x2, y2); ctx.lineTo(cx + 6, cy)
      ctx.stroke()

      if (brightness > 0.01) {
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20 * brightness + 4)
        const alpha = Math.min(0.9, brightness * 0.8)
        grd.addColorStop(0, color + "ff")
        grd.addColorStop(1, color + "00")
        ctx.beginPath()
        ctx.arc(cx, cy, 20 * brightness + 4, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(cx, cy, 5, 0, Math.PI * 2)
      ctx.fillStyle = brightness > 0.05 ? color : (isSelected ? "#ffee88" : "#553333")
      ctx.fill()
      ctx.strokeStyle = isSelected ? "#ffff00" : "#aa6666"
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
