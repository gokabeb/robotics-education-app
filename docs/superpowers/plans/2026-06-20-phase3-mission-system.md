# Xylo Platform — Phase 3: Mission System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mission runtime that evaluates completion criteria and hints against live simulation state, a three-pane mission sandbox UI that hosts the existing breadboard/code/serial components, the first 6 system missions (Arduino Fundamentals Module 1 + 2), and Supabase persistence for student mission attempts.

**Architecture:** `MissionRuntime` (pure, framework-free) ticks every 100ms against a `MissionSimSnapshot` assembled from the existing `CircuitBridge`/`GPIOBridge` event streams — no new simulation engine, no new worker. `MissionSandbox` composes the already-shipped `BreadboardCanvas`, `ComponentPalette`, `CodeExecutionPanel`, and `SerialMonitor` (built in Phase 1/2) plus new mission-only panels (briefing, goal checklist, hint, virtual button). Missions are static JSON shipped in `lib/missions/seed/` (no DB round-trip for definitions); only student *attempts* are persisted to Supabase.

**Tech Stack:** TypeScript, `vitest`, Next.js 16 App Router, Supabase (`@supabase/supabase-js`), Clerk (`@clerk/nextjs/server`), existing `lib/avr/` + `lib/circuit/` modules.

**Design spec:** `docs/superpowers/specs/2026-06-19-xylo-robotics-platform-design.md` §7 (Mission System), §13 (Build Sequence — Phase 3 bullet)

## Global Constraints

- Phase 3 ships exactly: Module 1 (Blink LED, Traffic Light, Morse Code Sender) + Module 2 (Button-Controlled LED, Debounced Button Counter, Toggle Lock) of "Arduino Fundamentals." No schematic view, no AI mentor, no flasher, no physics/robot canvas, no teacher authoring — those are Phase 4/5/6 per spec §13.
- **Deviation from spec §7.1/§7.2 (documented, not a mistake):** the spec's `CompletionCriterion` union includes `node-current`, `erc-pass`, `pwm-duty`, `analog-read-pin`, and `robot-*` variants. None of those are checkable yet — the circuit worker reports per-voltage-source current only (not generic per-component current), there's no ERC/schematic, and there's no physics arena wired to missions. Phase 3 instead defines a criterion set that maps directly onto data the circuit/AVR workers already emit: `component-present`, `component-param`, `led-lit`, `led-blinking`, `pin-toggled`, `serial-output-contains`, `serial-output-matches`, `code-contains`, `function-called`, `virtual-input-pressed`, `fault-free`. Each criterion also gets a required `id: string` field (the spec's union doesn't have one, but `Hint.unmetCriterionId` needs something to reference).
- **Deviation from spec §7.1 (documented):** Module 2 missions need digital input, but there's no push-button circuit component yet (Phase 4 work). Phase 3 adds a `VirtualInputSpec` to `Mission.initial` and a `<VirtualButton>` UI control that calls `GPIOBridge.setDigitalInput(pin, high)` directly — bypassing full circuit simulation of a physical button. This is swappable for a real breadboard pushbutton in Phase 4 without changing mission criteria (criteria reference the virtual input by `inputId`, not by circuit topology).
- **Prerequisite fix (this plan, Task 1):** the shipped `breadboard-canvas.tsx` cannot snap wires to Arduino pin holes at all — `snapToHole()` only checks breadboard tie-strip/rail holes. Every mission in this plan needs students to wire an Arduino pin (D13, D2, GND) into the breadboard, so Task 1 fixes this first, in the freeplay `/circuit` editor too (not mission-only).
- Supabase schema for this phase is scoped to `mission_attempts` only. The spec's `missions`, `saved_circuits`, and `mission_templates` tables, and the `assignments.mission_id` column, are deferred to Phase 6 (teacher authoring / classroom assignment) since they serve author/classroom workflows this phase doesn't touch.
- Scoring formula drops the spec's `+10 flashed_to_hardware` bonus (flasher is Phase 5, unreachable now) and clamps to `[0, 100]` instead of `[0, 110]`.
- Mission JSON authored in `lib/missions/seed/*.json` is the single source of truth for system missions in this phase — `GET /api/missions` and `GET /api/missions/[id]` read directly from an in-process registry built from these files, no DB read for mission *definitions*.

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `lib/missions/types.ts` | `Mission`, `CompletionCriterion`, `Hint`, `VirtualInputSpec`, `MissionSimSnapshot`, `CriterionStatus` |
| `lib/missions/runtime.ts` | `MissionRuntime` class: ticks criteria, tracks sustained-duration + hint timers |
| `lib/missions/scoring.ts` | `computeScore()` |
| `lib/missions/seed/*.json` | 6 mission definitions |
| `lib/missions/seed/index.ts` | Registry: `getAllMissions()`, `getMissionById(id)` |
| `lib/circuit/__tests__/breadboard-state.test.ts` | New: wire-to-Arduino-pin netlist resolution |
| `lib/missions/__tests__/runtime.test.ts` | New: criteria evaluation, sustained duration, hints, pass logic |
| `lib/missions/__tests__/scoring.test.ts` | New: score formula |
| `components/mission/virtual-button.tsx` | On-screen button → `GPIOBridge.setDigitalInput` |
| `components/mission/mission-briefing.tsx` | Markdown briefing panel shown on mission start |
| `components/mission/mission-goal-panel.tsx` | Criteria checklist + progress |
| `components/mission/mission-hint.tsx` | Tiered hint trigger + display |
| `components/mission/mission-sandbox.tsx` | Three-pane layout coordinator |
| `supabase-missions-schema.sql` | `mission_attempts` table |
| `app/api/missions/route.ts` | `GET` — list missions |
| `app/api/missions/[id]/route.ts` | `GET` — single mission config |
| `app/api/missions/[id]/attempts/route.ts` | `POST` — save attempt |
| `app/missions/[missionId]/page.tsx` | Mission route |
| `app/missions/[missionId]/layout.tsx` | Mission layout (full-height, no app chrome) |

### Modified Files

| File | Change |
|---|---|
| `lib/circuit/breadboard/breadboard-state.ts` | `WireEndpoint` union (hole \| arduino pin); named-net union-find priority |
| `lib/circuit/breadboard/breadboard-renderer.ts` | `endpointXY()` helper; `drawWires` supports both endpoint kinds |
| `components/circuit/breadboard-canvas.tsx` | Wire-drawing mode can snap to Arduino pin holes |
| `components/circuit/component-palette.tsx` | Accepts optional `items` prop (mission-restricted palette) |

---

## Task 1: Wire Endpoints — Arduino Pin Support

**Files:**
- Modify: `lib/circuit/breadboard/breadboard-state.ts`
- Modify: `lib/circuit/breadboard/breadboard-renderer.ts`
- Modify: `components/circuit/breadboard-canvas.tsx`
- Create: `lib/circuit/__tests__/breadboard-state.test.ts`

**Interfaces:**
- Produces: `WireEndpoint` type (`{ kind: "hole"; row: number; col: BBColumn } | { kind: "arduino"; pinKey: string }`), `BreadboardState.addWire(from: WireEndpoint, to: WireEndpoint): string`, `endpointXY(e: WireEndpoint): { x: number; y: number }` (exported from `breadboard-renderer.ts`).

- [ ] **Step 1: Write failing test for named-net union-find priority and Arduino wire endpoints**

```typescript
// lib/circuit/__tests__/breadboard-state.test.ts
import { describe, it, expect } from "vitest"
import { BreadboardState } from "../breadboard/breadboard-state"

describe("BreadboardState — Arduino pin wire endpoints", () => {
  it("wiring D13 to a tie-strip hole resolves that strip's net to literal 'D13'", () => {
    const bb = new BreadboardState()
    bb.addComponent({
      id: "r1",
      type: "resistor",
      params: { resistance: 220 },
      terminal1: { row: 10, col: "a" },
      terminal2: { row: 12, col: "a" },
    })
    bb.addWire(
      { kind: "arduino", pinKey: "D13" },
      { kind: "hole", row: 10, col: "a" }
    )
    const netlist = bb.toNetlist()
    const resistor = netlist.components.find(c => c.id === "r1")!
    expect(resistor.terminals.n1).toBe("D13")
  })

  it("wiring GND to a tie-strip hole resolves that strip's net to literal 'GND'", () => {
    const bb = new BreadboardState()
    bb.addComponent({
      id: "led1",
      type: "led",
      params: { color: "red" },
      terminal1: { row: 20, col: "f" },
      terminal2: { row: 22, col: "f" },
    })
    bb.addWire(
      { kind: "hole", row: 22, col: "f" },
      { kind: "arduino", pinKey: "GND_14" }
    )
    const netlist = bb.toNetlist()
    const led = netlist.components.find(c => c.id === "led1")!
    expect(led.terminals.cathode).toBe("GND")
  })

  it("two tie-strip holes merge with normal rank-based union when neither is named", () => {
    const bb = new BreadboardState()
    bb.addWire({ kind: "hole", row: 5, col: "a" }, { kind: "hole", row: 7, col: "a" })
    const netlist = bb.toNetlist()
    // Both R5L and R7L existed before the union; one becomes root — just confirm
    // the netlist doesn't crash and produces exactly one merged net (no FLOATING leak).
    expect(netlist.nodes.every(n => n !== "FLOATING")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/breadboard-state.test.ts 2>&1 | tail -15
```

Expected: FAIL (`addWire` doesn't accept `WireEndpoint` objects yet — type error or runtime `holeNet` crash on `undefined.row`).

- [ ] **Step 3: Update `lib/circuit/breadboard/breadboard-state.ts`**

```typescript
// lib/circuit/breadboard/breadboard-state.ts
// Mutable state for the breadboard editor.
// Placed components + wires → SerializedNetlist via union-find net merging.

import { holeNet, ARDUINO_HOLES, BBColumn } from "./breadboard-layout"
import type { SerializedNetlist, SerializedComponent, ComponentId, NodeId, ComponentParams } from "../types"
import { GND, VCC } from "../types"

export interface HolePosition {
  row: number
  col: BBColumn
}

export type WireEndpoint =
  | { kind: "hole"; row: number; col: BBColumn }
  | { kind: "arduino"; pinKey: string }   // key into ARDUINO_HOLES, e.g. "D13", "GND_14"

export interface PlacedComponent {
  id: ComponentId
  type: "resistor" | "led" | "voltage-source"
  params: Record<string, number | string>
  terminal1: HolePosition
  terminal2: HolePosition
}

export interface UserWire {
  id: string
  from: WireEndpoint
  to: WireEndpoint
}

function netForEndpoint(e: WireEndpoint): NodeId {
  if (e.kind === "arduino") {
    return ARDUINO_HOLES.get(e.pinKey)?.nodeId ?? "FLOATING"
  }
  return holeNet(e.row, e.col)
}

// A net name is "named" (fixed, student-meaningful) if it isn't an internal
// tie-strip label like "R12L". GND, VCC, and every Arduino pin nodeId
// (D0-D13, A0-A5, AREF, VIN, V33) are named. Named nets always win as the
// union-find root, so mission criteria can reference them by literal string
// regardless of which physical strip a student wired them through.
function isNamedNet(id: NodeId): boolean {
  return !/^R\d+[LR]$/.test(id)
}

// ── Union-Find for net merging ───────────────────────────────────────────────

function makeUnionFind(nodes: string[]): { parent: Map<string, string>; find: (x: string) => string; union: (a: string, b: string) => void } {
  const parent = new Map<string, string>(nodes.map(n => [n, n]))
  const rank   = new Map<string, number>(nodes.map(n => [n, 0]))

  function find(x: string): string {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const root = find(p)
    parent.set(x, root)
    return root
  }

  function union(a: string, b: string): void {
    const ra = find(a), rb = find(b)
    if (ra === rb) return
    const aNamed = isNamedNet(ra), bNamed = isNamedNet(rb)
    if (bNamed && !aNamed) { parent.set(ra, rb); return }
    if (aNamed && !bNamed) { parent.set(rb, ra); return }
    const rankA = rank.get(ra) ?? 0, rankB = rank.get(rb) ?? 0
    if (rankA >= rankB) { parent.set(rb, ra); if (rankA === rankB) rank.set(ra, rankA + 1) }
    else                { parent.set(ra, rb) }
  }

  return { parent, find, union }
}

// ── BreadboardState class ─────────────────────────────────────────────────────

export class BreadboardState {
  private components: PlacedComponent[] = []
  private wires:      UserWire[]       = []
  private nextWireId = 1

  addComponent(comp: PlacedComponent): void {
    this.components.push(comp)
  }

  removeComponent(id: ComponentId): void {
    this.components = this.components.filter(c => c.id !== id)
  }

  addWire(from: WireEndpoint, to: WireEndpoint): string {
    const id = `wire_${this.nextWireId++}`
    this.wires.push({ id, from, to })
    return id
  }

  removeWire(id: string): void {
    this.wires = this.wires.filter(w => w.id !== id)
  }

  getComponents(): readonly PlacedComponent[] { return this.components }
  getWires():      readonly UserWire[]        { return this.wires }

  toNetlist(): SerializedNetlist {
    const allBaseNets = new Set<NodeId>([GND, VCC])
    for (const comp of this.components) {
      allBaseNets.add(holeNet(comp.terminal1.row, comp.terminal1.col))
      allBaseNets.add(holeNet(comp.terminal2.row, comp.terminal2.col))
    }
    for (const wire of this.wires) {
      allBaseNets.add(netForEndpoint(wire.from))
      allBaseNets.add(netForEndpoint(wire.to))
    }

    const uf = makeUnionFind([...allBaseNets])

    for (const wire of this.wires) {
      uf.union(netForEndpoint(wire.from), netForEndpoint(wire.to))
    }

    const resolve = (pos: HolePosition): NodeId => uf.find(holeNet(pos.row, pos.col))

    const netSet = new Set<NodeId>()
    for (const net of allBaseNets) {
      const root = uf.find(net)
      if (root !== GND) netSet.add(root)
    }

    const serializedComponents: SerializedComponent[] = this.components.map(comp => {
      const net1 = resolve(comp.terminal1)
      const net2 = resolve(comp.terminal2)
      const p = comp.params as ComponentParams
      let terminals: Record<string, NodeId>
      switch (comp.type) {
        case "resistor":       terminals = { n1: net1, n2: net2 };       break
        case "led":            terminals = { anode: net1, cathode: net2 }; break
        case "voltage-source": terminals = { plus: net1, minus: net2 };  break
      }
      return { id: comp.id, type: comp.type, terminals, params: p } as SerializedComponent
    })

    return {
      nodes: [...netSet].filter(n => n !== GND),
      components: serializedComponents,
    }
  }

  clear(): void {
    this.components = []
    this.wires = []
    this.nextWireId = 1
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/breadboard-state.test.ts 2>&1 | tail -15
```

Expected: 3 tests PASS.

- [ ] **Step 5: Update `lib/circuit/breadboard/breadboard-renderer.ts`**

Replace the `RenderState.pendingWireFrom` field type and `drawWires` function. Apply these changes to the existing file (full file shown for clarity — only the import line, `RenderState` interface, and `drawWires` function actually change):

```typescript
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
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep -E "breadboard-renderer|breadboard-state"
```

Expected: errors only in `breadboard-canvas.tsx` (not yet updated — fixed in Step 7).

- [ ] **Step 7: Update `components/circuit/breadboard-canvas.tsx`**

Apply these targeted edits to the existing file:

1. Update imports — add `ARDUINO_HOLES` and `endpointXY`:

```typescript
import { renderBreadboard, CANVAS_WIDTH, CANVAS_HEIGHT, HOLE_PITCH, holeX, holeY, endpointXY, arduinoHoleXY } from "@/lib/circuit/breadboard/breadboard-renderer"
import type { RenderState } from "@/lib/circuit/breadboard/breadboard-renderer"
import { BreadboardState } from "@/lib/circuit/breadboard/breadboard-state"
import type { WireEndpoint } from "@/lib/circuit/breadboard/breadboard-state"
import { BB_COLS_LEFT, BB_COLS_RIGHT, BREADBOARD_ROWS, ARDUINO_HOLES } from "@/lib/circuit/breadboard/breadboard-layout"
import { BB_OFFSET_X } from "@/lib/circuit/breadboard/breadboard-renderer"
import type { BBColumn } from "@/lib/circuit/breadboard/breadboard-layout"
import { cn } from "@/lib/utils"
import type { NodeId } from "@/lib/circuit/types"
```

(Remove the now-unused `HolePosition` import — components still use it internally for `terminal1`/`terminal2`, so keep importing it from `breadboard-state` alongside `WireEndpoint`.)

2. Replace `snapToHole` with two functions — one for component placement (breadboard-only, unchanged behavior) and one for wire endpoints (breadboard holes + Arduino pins):

```typescript
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

/** Wire endpoints can land on a breadboard hole OR an Arduino pin hole. */
function snapToWireEndpoint(canvasX: number, canvasY: number): WireEndpoint | null {
  const hole = snapToHole(canvasX, canvasY)
  if (hole) return { kind: "hole", row: hole.row, col: hole.col }

  for (const [pinKey, arduinoHole] of ARDUINO_HOLES) {
    const { x, y } = arduinoHoleXY(arduinoHole)
    if (Math.hypot(canvasX - x, canvasY - y) <= HOLE_PITCH * 0.65) {
      return { kind: "arduino", pinKey }
    }
  }
  return null
}
```

3. Update `pendingWireFrom` state type and the `handleClick` wire-drawing branch:

```typescript
const [pendingWireFrom, setPendingWireFrom] = useState<WireEndpoint | null>(null)
```

```typescript
      const wireEndpoint = snapToWireEndpoint(cx, cy)

      // Wire drawing mode
      if (wireEndpoint) {
        if (!pendingWireFrom) {
          setPendingWireFrom(wireEndpoint)
        } else {
          bbState.addWire(pendingWireFrom, wireEndpoint)
          setPendingWireFrom(null)
          onNetlistChange()
          redraw()
        }
        return
      }
```

4. Update the wire-click hit-test at the bottom of `handleClick` to use `endpointXY`:

```typescript
      // Check wire click for selection
      const wires = bbState.getWires()
      for (const wire of [...wires].reverse()) {
        const { x: x1, y: y1 } = endpointXY(wire.from)
        const { x: x2, y: y2 } = endpointXY(wire.to)
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
      }
```

- [ ] **Step 8: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep -E "breadboard-canvas|breadboard-renderer|breadboard-state"
```

Expected: no errors.

- [ ] **Step 9: Run all tests**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run 2>&1 | tail -15
```

Expected: all tests pass (44 existing + 3 new = 47).

- [ ] **Step 10: Commit**

```bash
git add lib/circuit/breadboard/breadboard-state.ts lib/circuit/breadboard/breadboard-renderer.ts components/circuit/breadboard-canvas.tsx lib/circuit/__tests__/breadboard-state.test.ts
git commit -m "feat(circuit): support wiring Arduino pin holes into the breadboard netlist"
```

---

## Task 2: Mission Types

**Files:**
- Create: `lib/missions/types.ts`

**Interfaces:**
- Consumes: `SerializedNetlist`, `NodeId`, `ComponentFault` from `lib/circuit/types`.
- Produces: `Mission`, `CompletionCriterion`, `Hint`, `VirtualInputSpec`, `ComponentSpec`, `MissionSimSnapshot`, `CriterionStatus` — every later task imports from here.

- [ ] **Step 1: Create `lib/missions/types.ts`**

```typescript
// lib/missions/types.ts

import type { SerializedNetlist, NodeId, ComponentFault } from "@/lib/circuit/types"

export type AssistanceLevel = "full" | "nudge" | "circuit-only" | "disabled"
export type LEDColor = "red" | "green" | "blue" | "white" | "yellow"

/** A button the student clicks on-screen, driving an AVR digital input pin
 *  directly via GPIOBridge.setDigitalInput — stands in for a real circuit
 *  pushbutton component until one exists (Phase 4). */
export interface VirtualInputSpec {
  id: string
  label: string
  pin: number
  simulateBounce?: boolean
}

export interface ComponentSpec {
  type: "resistor" | "led"
  label: string
  params: Record<string, number | string>
  color?: string
}

interface CriterionBase {
  id: string
}

export type CompletionCriterion = CriterionBase & (
  | { type: "component-present"; componentType: "resistor" | "led"; minCount?: number }
  | { type: "component-param"; componentType: "resistor" | "led"; param: string; min: number; max: number }
  | { type: "led-lit"; color?: LEDColor; minBrightness?: number; durationMs?: number }
  | { type: "led-blinking"; color?: LEDColor; minFreqHz: number; maxFreqHz: number; durationMs?: number }
  | { type: "pin-toggled"; pin: number; minFreqHz?: number; maxFreqHz?: number; durationMs?: number }
  | { type: "serial-output-contains"; substring: string; caseSensitive?: boolean }
  | { type: "serial-output-matches"; pattern: string }
  | { type: "code-contains"; pattern: string }
  | { type: "function-called"; functionName: string }
  | { type: "virtual-input-pressed"; inputId: string; minPresses?: number }
  | { type: "fault-free" }
)

export interface Hint {
  id: string
  afterSeconds: number
  unmetCriterionId?: string
  tier: 1 | 2 | 3
  content: string
}

export interface Mission {
  id: string
  title: string
  subtitle: string
  difficulty: 1 | 2 | 3 | 4 | 5
  ageRange: [number, number]
  estimatedMinutes: number
  tags: string[]

  layout: {
    circuit: boolean
    codeEditor: boolean
    serialMonitor: boolean
  }

  initial: {
    circuit: SerializedNetlist
    code: string
    lockedComponentIds: string[]
    lockedWireIds: string[]
    virtualInputs: VirtualInputSpec[]
  }

  palette: ComponentSpec[]

  completionCriteria: CompletionCriterion[]
  passCriteria: "all" | "any" | { minOf: number }

  hints: Hint[]

  narrative: {
    briefing: string
    context: string
    successMessage: string
    failureMessage?: string
  }

  aiMentorConfig: {
    assistanceLevel: AssistanceLevel
    neverReveal: string[]
  }
}

/** One tick of live state, assembled by MissionSandbox from CircuitBridge/
 *  GPIOBridge events, fed into MissionRuntime.tick(). */
export interface MissionSimSnapshot {
  nowMs: number
  netlist: SerializedNetlist
  brightnessMap: Record<string, number>
  faults: ComponentFault[]
  code: string
  serialBuffer: string
  newPinEvents: Array<{ pin: number; high: boolean; timestampMs: number }>
  newVirtualPresses: string[]
}

export interface CriterionStatus {
  id: string
  met: boolean
  label: string
}

export interface MissionTickResult {
  criteria: CriterionStatus[]
  complete: boolean
  activeHint: Hint | null
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "missions/types"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/missions/types.ts
git commit -m "feat(missions): add Mission, CompletionCriterion, Hint, and runtime snapshot types"
```

---

## Task 3: Scoring

**Files:**
- Create: `lib/missions/scoring.ts`
- Create: `lib/missions/__tests__/scoring.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/missions/__tests__/scoring.test.ts
import { describe, it, expect } from "vitest"
import { computeScore } from "../scoring"

describe("computeScore", () => {
  it("returns 100 for a no-hint, on-time completion", () => {
    expect(computeScore({ hintsUsed: 0, timeSeconds: 300, estimatedMinutes: 10 })).toBe(100)
  })

  it("deducts 10 points per hint used", () => {
    expect(computeScore({ hintsUsed: 2, timeSeconds: 300, estimatedMinutes: 10 })).toBe(80)
  })

  it("deducts up to 20 points for taking 2x the estimated time", () => {
    // estimated = 600s; took 1200s = 2x → full 20-point time penalty
    const score = computeScore({ hintsUsed: 0, timeSeconds: 1200, estimatedMinutes: 10 })
    expect(score).toBe(80)
  })

  it("never drops below 0", () => {
    expect(computeScore({ hintsUsed: 20, timeSeconds: 100000, estimatedMinutes: 1 })).toBe(0)
  })

  it("never exceeds 100", () => {
    expect(computeScore({ hintsUsed: 0, timeSeconds: 1, estimatedMinutes: 10 })).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/missions/__tests__/scoring.test.ts 2>&1 | tail -10
```

Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/missions/scoring.ts`**

```typescript
// lib/missions/scoring.ts
//
// score = 100 - (hintsUsed * 10) - timePenalty, clamped to [0, 100]
// timePenalty = max(0, (timeSeconds - estimatedSeconds) / estimatedSeconds * 20)
//
// Deviates from the design spec's formula by dropping the +10
// flashed-to-hardware bonus (flasher ships in Phase 5) and clamping to
// [0, 100] instead of [0, 110], since the bonus is unreachable right now.

export interface ScoringInput {
  hintsUsed: number
  timeSeconds: number
  estimatedMinutes: number
}

export function computeScore(input: ScoringInput): number {
  const estimatedSeconds = input.estimatedMinutes * 60
  const timePenalty = Math.max(
    0,
    ((input.timeSeconds - estimatedSeconds) / estimatedSeconds) * 20
  )
  const raw = 100 - input.hintsUsed * 10 - timePenalty
  return Math.max(0, Math.min(100, Math.round(raw)))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/missions/__tests__/scoring.test.ts 2>&1 | tail -10
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/missions/scoring.ts lib/missions/__tests__/scoring.test.ts
git commit -m "feat(missions): add score computation (hints + time penalty, clamped 0-100)"
```

---

## Task 4: Mission Runtime

**Files:**
- Create: `lib/missions/runtime.ts`
- Create: `lib/missions/__tests__/runtime.test.ts`

**Interfaces:**
- Consumes: `Mission`, `CompletionCriterion`, `MissionSimSnapshot`, `MissionTickResult`, `CriterionStatus`, `Hint` from `lib/missions/types`.
- Produces: `MissionRuntime` class with `tick(snapshot: MissionSimSnapshot): MissionTickResult`, `getHintsUsedCount(): number`, `getStartedAtMs(): number`.

- [ ] **Step 1: Write failing tests**

```typescript
// lib/missions/__tests__/runtime.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { MissionRuntime } from "../runtime"
import type { Mission, MissionSimSnapshot } from "../types"

function emptySnapshot(overrides: Partial<MissionSimSnapshot> = {}): MissionSimSnapshot {
  return {
    nowMs: 0,
    netlist: { nodes: [], components: [] },
    brightnessMap: {},
    faults: [],
    code: "",
    serialBuffer: "",
    newPinEvents: [],
    newVirtualPresses: [],
    ...overrides,
  }
}

function baseMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "test-mission",
    title: "Test",
    subtitle: "",
    difficulty: 1,
    ageRange: [8, 16],
    estimatedMinutes: 5,
    tags: [],
    layout: { circuit: true, codeEditor: true, serialMonitor: false },
    initial: { circuit: { nodes: [], components: [] }, code: "", lockedComponentIds: [], lockedWireIds: [], virtualInputs: [] },
    palette: [],
    completionCriteria: [],
    passCriteria: "all",
    hints: [],
    narrative: { briefing: "", context: "", successMessage: "" },
    aiMentorConfig: { assistanceLevel: "nudge", neverReveal: [] },
    ...overrides,
  }
}

describe("MissionRuntime — component-present", () => {
  it("is unmet with an empty netlist, met once a matching component exists", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "component-present", componentType: "led", minCount: 1 }],
    })
    const runtime = new MissionRuntime(mission, 0)

    let result = runtime.tick(emptySnapshot())
    expect(result.criteria[0].met).toBe(false)
    expect(result.complete).toBe(false)

    result = runtime.tick(emptySnapshot({
      netlist: { nodes: ["D13", "GND"], components: [
        { id: "led1", type: "led", terminals: { anode: "D13", cathode: "GND" }, params: { color: "red" } },
      ] },
    }))
    expect(result.criteria[0].met).toBe(true)
    expect(result.complete).toBe(true)
  })
})

describe("MissionRuntime — led-lit with sustained duration", () => {
  it("only counts as met once brightness has been sustained for durationMs", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "led-lit", minBrightness: 0.3, durationMs: 1000 }],
    })
    const runtime = new MissionRuntime(mission, 0)
    const litSnapshot = (nowMs: number) => emptySnapshot({
      nowMs,
      netlist: { nodes: [], components: [
        { id: "led1", type: "led", terminals: { anode: "X", cathode: "GND" }, params: { color: "red" } },
      ] },
      brightnessMap: { led1: 0.8 },
    })

    expect(runtime.tick(litSnapshot(0)).criteria[0].met).toBe(false)
    expect(runtime.tick(litSnapshot(500)).criteria[0].met).toBe(false)
    expect(runtime.tick(litSnapshot(1100)).criteria[0].met).toBe(true)
  })

  it("resets the sustain timer if brightness drops below threshold", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "led-lit", minBrightness: 0.3, durationMs: 1000 }],
    })
    const runtime = new MissionRuntime(mission, 0)
    const snap = (nowMs: number, brightness: number) => emptySnapshot({
      nowMs,
      netlist: { nodes: [], components: [
        { id: "led1", type: "led", terminals: { anode: "X", cathode: "GND" }, params: { color: "red" } },
      ] },
      brightnessMap: { led1: brightness },
    })

    runtime.tick(snap(0, 0.8))
    runtime.tick(snap(500, 0.0))   // drops out — resets sustain timer
    expect(runtime.tick(snap(800, 0.8)).criteria[0].met).toBe(false)  // only 300ms sustained
    expect(runtime.tick(snap(1600, 0.8)).criteria[0].met).toBe(true)  // 1100ms sustained
  })
})

describe("MissionRuntime — pin-toggled frequency", () => {
  it("detects a ~1Hz toggle as met for a 0.5-2Hz target range", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "pin-toggled", pin: 13, minFreqHz: 0.5, maxFreqHz: 2, durationMs: 0 }],
    })
    const runtime = new MissionRuntime(mission, 0)

    // Simulate toggles every 500ms (1Hz) for 3 seconds
    let result
    for (let t = 0; t <= 3000; t += 500) {
      result = runtime.tick(emptySnapshot({
        nowMs: t,
        newPinEvents: t > 0 ? [{ pin: 13, high: t % 1000 === 0, timestampMs: t }] : [],
      }))
    }
    expect(result!.criteria[0].met).toBe(true)
  })
})

describe("MissionRuntime — serial-output-contains", () => {
  it("matches a substring in the accumulated serial buffer", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "serial-output-contains", substring: "SOS" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ serialBuffer: "hello\n" })).criteria[0].met).toBe(false)
    expect(runtime.tick(emptySnapshot({ serialBuffer: "hello\nSOS sent\n" })).criteria[0].met).toBe(true)
  })
})

describe("MissionRuntime — code-contains and function-called", () => {
  it("checks a regex pattern against the source code", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "code-contains", pattern: "digitalWrite\\(13" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ code: "void loop() {}" })).criteria[0].met).toBe(false)
    expect(runtime.tick(emptySnapshot({ code: "digitalWrite(13, HIGH);" })).criteria[0].met).toBe(true)
  })

  it("checks for a function call by name", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "function-called", functionName: "millis" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ code: "delay(1000);" })).criteria[0].met).toBe(false)
    expect(runtime.tick(emptySnapshot({ code: "if (millis() - last > 50) {}" })).criteria[0].met).toBe(true)
  })
})

describe("MissionRuntime — virtual-input-pressed", () => {
  it("counts presses across ticks until minPresses is reached", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "virtual-input-pressed", inputId: "btn1", minPresses: 3 }],
    })
    const runtime = new MissionRuntime(mission, 0)
    runtime.tick(emptySnapshot({ newVirtualPresses: ["btn1"] }))
    runtime.tick(emptySnapshot({ newVirtualPresses: ["btn1"] }))
    expect(runtime.tick(emptySnapshot({ newVirtualPresses: [] })).criteria[0].met).toBe(false)
    expect(runtime.tick(emptySnapshot({ newVirtualPresses: ["btn1"] })).criteria[0].met).toBe(true)
  })
})

describe("MissionRuntime — fault-free", () => {
  it("is unmet on any tick with a reported fault", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "fault-free" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot()).criteria[0].met).toBe(true)
    expect(runtime.tick(emptySnapshot({
      faults: [{ severity: "damage", componentId: "led1", message: "x", technical: "x", suggestion: "x" }],
    })).criteria[0].met).toBe(false)
  })
})

describe("MissionRuntime — passCriteria", () => {
  it("'any' completes when at least one criterion is met", () => {
    const mission = baseMission({
      passCriteria: "any",
      completionCriteria: [
        { id: "c1", type: "fault-free" },
        { id: "c2", type: "serial-output-contains", substring: "NEVER" },
      ],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot()).complete).toBe(true)
  })

  it("{ minOf: N } completes once N criteria are met", () => {
    const mission = baseMission({
      passCriteria: { minOf: 1 },
      completionCriteria: [
        { id: "c1", type: "fault-free" },
        { id: "c2", type: "serial-output-contains", substring: "NEVER" },
      ],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot()).complete).toBe(true)
  })
})

describe("MissionRuntime — hints", () => {
  it("surfaces a tier-1 hint once afterSeconds has elapsed without completion", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "serial-output-contains", substring: "NEVER" }],
      hints: [{ id: "h1", afterSeconds: 90, tier: 1, content: "Try wiring pin 13." }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ nowMs: 1000 })).activeHint).toBeNull()
    expect(runtime.tick(emptySnapshot({ nowMs: 91000 })).activeHint?.id).toBe("h1")
  })

  it("does not surface hints once the mission is already complete", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "fault-free" }],
      hints: [{ id: "h1", afterSeconds: 0, tier: 1, content: "x" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ nowMs: 1000 })).activeHint).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/missions/__tests__/runtime.test.ts 2>&1 | tail -10
```

Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/missions/runtime.ts`**

```typescript
// lib/missions/runtime.ts
//
// Pure, framework-free criteria evaluator. Ticked by MissionSandbox with a
// MissionSimSnapshot assembled from CircuitBridge/GPIOBridge event streams.
// Holds no DOM/worker references — fully unit-testable in isolation.

import type {
  Mission, CompletionCriterion, MissionSimSnapshot, MissionTickResult,
  CriterionStatus, Hint,
} from "./types"

const PIN_TOGGLE_WINDOW_MS = 5000

export class MissionRuntime {
  private mission: Mission
  private startedAtMs: number

  private pinToggleHistory = new Map<number, number[]>()       // pin -> recent toggle timestamps
  private virtualPressCounts = new Map<string, number>()       // inputId -> count
  private criterionMetSinceMs = new Map<string, number>()      // criterion id -> first-met timestamp
  private hintsShown = new Set<string>()

  constructor(mission: Mission, nowMs: number) {
    this.mission = mission
    this.startedAtMs = nowMs
  }

  getStartedAtMs(): number {
    return this.startedAtMs
  }

  getHintsUsedCount(): number {
    return this.hintsShown.size
  }

  tick(snapshot: MissionSimSnapshot): MissionTickResult {
    this.recordPinEvents(snapshot)
    this.recordVirtualPresses(snapshot)

    const criteria: CriterionStatus[] = this.mission.completionCriteria.map(c =>
      this.evaluateWithSustain(c, snapshot)
    )

    const complete = this.isPassing(criteria)
    const activeHint = complete ? null : this.computeActiveHint(snapshot.nowMs, criteria)

    return { criteria, complete, activeHint }
  }

  private recordPinEvents(snapshot: MissionSimSnapshot): void {
    for (const ev of snapshot.newPinEvents) {
      const hist = this.pinToggleHistory.get(ev.pin) ?? []
      hist.push(ev.timestampMs)
      while (hist.length > 0 && ev.timestampMs - hist[0] > PIN_TOGGLE_WINDOW_MS) hist.shift()
      this.pinToggleHistory.set(ev.pin, hist)
    }
  }

  private recordVirtualPresses(snapshot: MissionSimSnapshot): void {
    for (const inputId of snapshot.newVirtualPresses) {
      this.virtualPressCounts.set(inputId, (this.virtualPressCounts.get(inputId) ?? 0) + 1)
    }
  }

  private evaluateWithSustain(c: CompletionCriterion, s: MissionSimSnapshot): CriterionStatus {
    const instantMet = this.evaluateInstant(c, s)
    const durationMs = "durationMs" in c ? c.durationMs ?? 0 : 0

    if (!instantMet) {
      this.criterionMetSinceMs.delete(c.id)
      return { id: c.id, met: false, label: describeCriterion(c) }
    }

    if (!this.criterionMetSinceMs.has(c.id)) {
      this.criterionMetSinceMs.set(c.id, s.nowMs)
    }
    const metSince = this.criterionMetSinceMs.get(c.id)!
    const sustained = s.nowMs - metSince >= durationMs

    return { id: c.id, met: sustained, label: describeCriterion(c) }
  }

  private evaluateInstant(c: CompletionCriterion, s: MissionSimSnapshot): boolean {
    switch (c.type) {
      case "component-present": {
        const count = s.netlist.components.filter(comp => comp.type === c.componentType).length
        return count >= (c.minCount ?? 1)
      }
      case "component-param": {
        const comp = s.netlist.components.find(comp => comp.type === c.componentType)
        if (!comp) return false
        const val = (comp.params as Record<string, unknown>)[c.param]
        return typeof val === "number" && val >= c.min && val <= c.max
      }
      case "led-lit": {
        const led = s.netlist.components.find(comp =>
          comp.type === "led" && (!c.color || comp.params.color === c.color)
        )
        if (!led) return false
        const brightness = s.brightnessMap[led.id] ?? 0
        return brightness >= (c.minBrightness ?? 0.3)
      }
      case "led-blinking": {
        return this.evaluateLedBlinking(c, s)
      }
      case "pin-toggled": {
        const hist = this.pinToggleHistory.get(c.pin) ?? []
        if (hist.length < 2) return false
        const windowSeconds = (hist[hist.length - 1] - hist[0]) / 1000
        if (windowSeconds <= 0) return false
        const freqHz = (hist.length - 1) / 2 / windowSeconds
        const minOk = c.minFreqHz === undefined || freqHz >= c.minFreqHz
        const maxOk = c.maxFreqHz === undefined || freqHz <= c.maxFreqHz
        return minOk && maxOk
      }
      case "serial-output-contains": {
        const haystack = c.caseSensitive ? s.serialBuffer : s.serialBuffer.toLowerCase()
        const needle = c.caseSensitive ? c.substring : c.substring.toLowerCase()
        return haystack.includes(needle)
      }
      case "serial-output-matches": {
        return new RegExp(c.pattern).test(s.serialBuffer)
      }
      case "code-contains": {
        return new RegExp(c.pattern).test(s.code)
      }
      case "function-called": {
        return new RegExp(`${escapeRegExp(c.functionName)}\\s*\\(`).test(s.code)
      }
      case "virtual-input-pressed": {
        const count = this.virtualPressCounts.get(c.inputId) ?? 0
        return count >= (c.minPresses ?? 1)
      }
      case "fault-free": {
        return s.faults.length === 0
      }
    }
  }

  // Tracks brightness lit/unlit transitions per matching LED to estimate a
  // blink frequency, mirroring the pin-toggled sliding-window approach.
  private ledBlinkHistory = new Map<string, { lastLit: boolean; transitions: number[] }>()

  private evaluateLedBlinking(
    c: Extract<CompletionCriterion, { type: "led-blinking" }>,
    s: MissionSimSnapshot
  ): boolean {
    const led = s.netlist.components.find(comp =>
      comp.type === "led" && (!c.color || comp.params.color === c.color)
    )
    if (!led) return false

    const isLit = (s.brightnessMap[led.id] ?? 0) >= 0.3
    const key = led.id
    const state = this.ledBlinkHistory.get(key) ?? { lastLit: isLit, transitions: [] }

    if (isLit !== state.lastLit) {
      state.transitions.push(s.nowMs)
      while (state.transitions.length > 0 && s.nowMs - state.transitions[0] > PIN_TOGGLE_WINDOW_MS) {
        state.transitions.shift()
      }
    }
    state.lastLit = isLit
    this.ledBlinkHistory.set(key, state)

    if (state.transitions.length < 2) return false
    const windowSeconds = (state.transitions[state.transitions.length - 1] - state.transitions[0]) / 1000
    if (windowSeconds <= 0) return false
    const freqHz = (state.transitions.length - 1) / 2 / windowSeconds
    return freqHz >= c.minFreqHz && freqHz <= c.maxFreqHz
  }

  private isPassing(statuses: CriterionStatus[]): boolean {
    const pass = this.mission.passCriteria
    if (pass === "all") return statuses.length > 0 && statuses.every(s => s.met)
    if (pass === "any") return statuses.some(s => s.met)
    return statuses.filter(s => s.met).length >= pass.minOf
  }

  private computeActiveHint(nowMs: number, criteria: CriterionStatus[]): Hint | null {
    const elapsedSeconds = (nowMs - this.startedAtMs) / 1000
    const unmetIds = new Set(criteria.filter(c => !c.met).map(c => c.id))

    let best: Hint | null = null
    for (const hint of this.mission.hints) {
      if (elapsedSeconds < hint.afterSeconds) continue
      if (hint.unmetCriterionId && !unmetIds.has(hint.unmetCriterionId)) continue
      this.hintsShown.add(hint.id)
      if (!best || hint.tier > best.tier) best = hint
    }
    return best
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function describeCriterion(c: CompletionCriterion): string {
  switch (c.type) {
    case "component-present": return `Place ${c.minCount ?? 1}+ ${c.componentType}`
    case "component-param": return `Set ${c.componentType} ${c.param} between ${c.min} and ${c.max}`
    case "led-lit": return `Light up the ${c.color ?? ""} LED`.trim()
    case "led-blinking": return `Blink the ${c.color ?? ""} LED`.trim()
    case "pin-toggled": return `Toggle pin ${c.pin}`
    case "serial-output-contains": return `Print "${c.substring}" to Serial`
    case "serial-output-matches": return `Match Serial output to /${c.pattern}/`
    case "code-contains": return `Use the pattern: ${c.pattern}`
    case "function-called": return `Call ${c.functionName}()`
    case "virtual-input-pressed": return `Press the button ${c.minPresses ?? 1}+ times`
    case "fault-free": return "Avoid circuit faults"
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/missions/__tests__/runtime.test.ts 2>&1 | tail -20
```

Expected: all tests PASS (14 tests across the `describe` blocks above).

- [ ] **Step 5: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "missions/runtime"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/missions/runtime.ts lib/missions/__tests__/runtime.test.ts
git commit -m "feat(missions): add MissionRuntime — criteria evaluation, sustained duration, hints"
```

---

## Task 5: Seed Missions

**Files:**
- Create: `lib/missions/seed/01-blink-led.json`
- Create: `lib/missions/seed/02-traffic-light.json`
- Create: `lib/missions/seed/03-morse-code-sender.json`
- Create: `lib/missions/seed/04-button-controlled-led.json`
- Create: `lib/missions/seed/05-debounced-button-counter.json`
- Create: `lib/missions/seed/06-toggle-lock.json`
- Create: `lib/missions/seed/index.ts`
- Create: `lib/missions/__tests__/seed.test.ts`

Each JSON file is a `Mission` literal (Task 2's type). All six share `initial.circuit: { "nodes": [], "components": [] }` (students build from scratch) and an empty `lockedComponentIds`/`lockedWireIds` (nothing pre-placed in Phase 3 — Phase 6 teacher authoring is where locked starter circuits matter most).

- [ ] **Step 1: Create `lib/missions/seed/01-blink-led.json`**

```json
{
  "id": "blink-led",
  "title": "Make an LED Blink",
  "subtitle": "Wire an LED to pin 13 and blink it once a second.",
  "difficulty": 1,
  "ageRange": [8, 12],
  "estimatedMinutes": 10,
  "tags": ["LED", "digital-output", "resistor"],
  "layout": { "circuit": true, "codeEditor": true, "serialMonitor": false },
  "initial": {
    "circuit": { "nodes": [], "components": [] },
    "code": "void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  // TODO: turn the LED on, wait, turn it off, wait\n}\n",
    "lockedComponentIds": [],
    "lockedWireIds": [],
    "virtualInputs": []
  },
  "palette": [
    { "type": "resistor", "label": "220Ω", "params": { "resistance": 220 } },
    { "type": "resistor", "label": "1kΩ", "params": { "resistance": 1000 } },
    { "type": "led", "label": "LED Red", "params": { "color": "red" }, "color": "#ff3333" }
  ],
  "completionCriteria": [
    { "id": "c-resistor", "type": "component-present", "componentType": "resistor", "minCount": 1 },
    { "id": "c-led", "type": "component-present", "componentType": "led", "minCount": 1 },
    { "id": "c-blink", "type": "led-blinking", "minFreqHz": 0.3, "maxFreqHz": 3, "durationMs": 3000 },
    { "id": "c-safe", "type": "fault-free" }
  ],
  "passCriteria": "all",
  "hints": [
    { "id": "h1", "afterSeconds": 90, "tier": 1, "content": "Have you wired the LED all the way to pin 13 and to GND?" },
    { "id": "h2", "afterSeconds": 180, "tier": 2, "content": "Place a 220Ω resistor between pin 13 and the LED's anode (long leg), then wire the cathode (short leg) to GND." },
    { "id": "h3", "afterSeconds": 360, "tier": 3, "content": "In loop(): digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500);" }
  ],
  "narrative": {
    "briefing": "Every robot needs a way to signal what it's doing. The simplest signal is a blinking light. Wire an LED to pin 13, write code to blink it, and you've built your first working circuit.",
    "context": "Arduino pin 13 can only output 5V or 0V — never anything in between. An LED needs a resistor in series to limit current, or it burns out almost instantly.",
    "successMessage": "Your LED is blinking! You just controlled real current with code."
  },
  "aiMentorConfig": { "assistanceLevel": "nudge", "neverReveal": ["c-blink"] }
}
```

- [ ] **Step 2: Create `lib/missions/seed/02-traffic-light.json`**

```json
{
  "id": "traffic-light",
  "title": "Build a Traffic Light",
  "subtitle": "Light up red, yellow, and green LEDs in sequence.",
  "difficulty": 2,
  "ageRange": [9, 13],
  "estimatedMinutes": 15,
  "tags": ["LED", "digital-output", "sequencing"],
  "layout": { "circuit": true, "codeEditor": true, "serialMonitor": false },
  "initial": {
    "circuit": { "nodes": [], "components": [] },
    "code": "void setup() {\n  pinMode(11, OUTPUT); // red\n  pinMode(12, OUTPUT); // yellow\n  pinMode(13, OUTPUT); // green\n}\n\nvoid loop() {\n  // TODO: red, then yellow, then green, then repeat\n}\n",
    "lockedComponentIds": [],
    "lockedWireIds": [],
    "virtualInputs": []
  },
  "palette": [
    { "type": "resistor", "label": "220Ω", "params": { "resistance": 220 } },
    { "type": "led", "label": "LED Red", "params": { "color": "red" }, "color": "#ff3333" },
    { "type": "led", "label": "LED Yellow", "params": { "color": "yellow" }, "color": "#ffee33" },
    { "type": "led", "label": "LED Green", "params": { "color": "green" }, "color": "#33ff66" }
  ],
  "completionCriteria": [
    { "id": "c-leds", "type": "component-present", "componentType": "led", "minCount": 3 },
    { "id": "c-resistors", "type": "component-present", "componentType": "resistor", "minCount": 3 },
    { "id": "c-red", "type": "led-lit", "color": "red", "minBrightness": 0.3, "durationMs": 1500 },
    { "id": "c-yellow", "type": "led-lit", "color": "yellow", "minBrightness": 0.3, "durationMs": 1500 },
    { "id": "c-green", "type": "led-lit", "color": "green", "minBrightness": 0.3, "durationMs": 1500 },
    { "id": "c-safe", "type": "fault-free" }
  ],
  "passCriteria": "all",
  "hints": [
    { "id": "h1", "afterSeconds": 120, "tier": 1, "content": "Each LED needs its own resistor and its own Arduino pin." },
    { "id": "h2", "afterSeconds": 240, "tier": 2, "content": "Wire pin 11 → resistor → red LED → GND, pin 12 → resistor → yellow LED → GND, pin 13 → resistor → green LED → GND." },
    { "id": "h3", "afterSeconds": 420, "tier": 3, "content": "digitalWrite(11,HIGH); delay(2000); digitalWrite(11,LOW); digitalWrite(12,HIGH); delay(1000); digitalWrite(12,LOW); digitalWrite(13,HIGH); delay(2000); digitalWrite(13,LOW);" }
  ],
  "narrative": {
    "briefing": "Real traffic lights cycle through three colors on a timer. Wire three LEDs to three pins and sequence them: red, yellow, green, repeat.",
    "context": "Each LED is electrically independent — they each need their own resistor and their own digital pin. Sharing one resistor across LEDs would let current flow unpredictably between them.",
    "successMessage": "All three lights worked! That's the same logic real traffic signals use."
  },
  "aiMentorConfig": { "assistanceLevel": "nudge", "neverReveal": ["c-red", "c-yellow", "c-green"] }
}
```

- [ ] **Step 3: Create `lib/missions/seed/03-morse-code-sender.json`**

```json
{
  "id": "morse-code-sender",
  "title": "Morse Code Sender",
  "subtitle": "Blink \"SOS\" in Morse code and print it to Serial.",
  "difficulty": 3,
  "ageRange": [10, 14],
  "estimatedMinutes": 20,
  "tags": ["LED", "digital-output", "serial", "timing"],
  "layout": { "circuit": true, "codeEditor": true, "serialMonitor": true },
  "initial": {
    "circuit": { "nodes": [], "components": [] },
    "code": "void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  // TODO: blink S-O-S (short-short-short, long-long-long, short-short-short)\n  // and Serial.println(\"SOS\") once per cycle\n}\n",
    "lockedComponentIds": [],
    "lockedWireIds": [],
    "virtualInputs": []
  },
  "palette": [
    { "type": "resistor", "label": "220Ω", "params": { "resistance": 220 } },
    { "type": "led", "label": "LED Red", "params": { "color": "red" }, "color": "#ff3333" }
  ],
  "completionCriteria": [
    { "id": "c-resistor", "type": "component-present", "componentType": "resistor", "minCount": 1 },
    { "id": "c-led", "type": "component-present", "componentType": "led", "minCount": 1 },
    { "id": "c-blink", "type": "led-blinking", "minFreqHz": 0.2, "maxFreqHz": 6, "durationMs": 2000 },
    { "id": "c-serial", "type": "serial-output-contains", "substring": "SOS" },
    { "id": "c-safe", "type": "fault-free" }
  ],
  "passCriteria": "all",
  "hints": [
    { "id": "h1", "afterSeconds": 150, "tier": 1, "content": "Morse \"S\" is three short blinks, \"O\" is three long blinks." },
    { "id": "h2", "afterSeconds": 300, "tier": 2, "content": "Try a short blink = 200ms on, long blink = 600ms on, with a short gap between blinks." },
    { "id": "h3", "afterSeconds": 540, "tier": 3, "content": "Write a blink(int ms) helper that does digitalWrite HIGH, delay(ms), digitalWrite LOW, delay(200) — call it 3x short, 3x long, 3x short, then Serial.println(\"SOS\")." }
  ],
  "narrative": {
    "briefing": "Before radio voice transmission, ships sent emergency calls in Morse code — dots and dashes encoded as short and long signals. Recreate the most famous Morse message of all: SOS.",
    "context": "Morse code is just timing: a \"dot\" is a short pulse, a \"dash\" is roughly three times as long. The same idea shows up everywhere in electronics, from PWM to data encoding.",
    "successMessage": "S-O-S received! You just sent a real distress signal using nothing but timing."
  },
  "aiMentorConfig": { "assistanceLevel": "nudge", "neverReveal": ["c-blink", "c-serial"] }
}
```

- [ ] **Step 4: Create `lib/missions/seed/04-button-controlled-led.json`**

```json
{
  "id": "button-controlled-led",
  "title": "Button-Controlled LED",
  "subtitle": "Light an LED only while a button is held down.",
  "difficulty": 2,
  "ageRange": [9, 13],
  "estimatedMinutes": 12,
  "tags": ["LED", "digital-input", "button"],
  "layout": { "circuit": true, "codeEditor": true, "serialMonitor": false },
  "initial": {
    "circuit": { "nodes": [], "components": [] },
    "code": "void setup() {\n  pinMode(2, INPUT_PULLUP); // button\n  pinMode(13, OUTPUT);      // LED\n}\n\nvoid loop() {\n  // TODO: read the button on pin 2, drive the LED to match\n}\n",
    "lockedComponentIds": [],
    "lockedWireIds": [],
    "virtualInputs": [
      { "id": "btn1", "label": "Push Button", "pin": 2 }
    ]
  },
  "palette": [
    { "type": "resistor", "label": "220Ω", "params": { "resistance": 220 } },
    { "type": "led", "label": "LED Red", "params": { "color": "red" }, "color": "#ff3333" }
  ],
  "completionCriteria": [
    { "id": "c-resistor", "type": "component-present", "componentType": "resistor", "minCount": 1 },
    { "id": "c-led", "type": "component-present", "componentType": "led", "minCount": 1 },
    { "id": "c-press", "type": "virtual-input-pressed", "inputId": "btn1", "minPresses": 1 },
    { "id": "c-lit", "type": "led-lit", "minBrightness": 0.3, "durationMs": 500 },
    { "id": "c-read", "type": "function-called", "functionName": "digitalRead" },
    { "id": "c-safe", "type": "fault-free" }
  ],
  "passCriteria": "all",
  "hints": [
    { "id": "h1", "afterSeconds": 100, "tier": 1, "content": "INPUT_PULLUP means the pin reads HIGH when the button is NOT pressed, and LOW when it IS pressed." },
    { "id": "h2", "afterSeconds": 200, "tier": 2, "content": "Wire the LED through a resistor to pin 13 and GND, just like the blink mission — then use digitalRead(2) to decide HIGH or LOW." },
    { "id": "h3", "afterSeconds": 360, "tier": 3, "content": "void loop() { digitalWrite(13, digitalRead(2) == LOW ? HIGH : LOW); }" }
  ],
  "narrative": {
    "briefing": "Robots react to the world through inputs, not just outputs. Wire up a push button and make an LED respond to it in real time.",
    "context": "digitalRead() returns the current voltage on a pin as HIGH or LOW. Combined with INPUT_PULLUP, a button press pulls the pin to LOW.",
    "successMessage": "Your LED responds to the button! You just built your first input-driven circuit."
  },
  "aiMentorConfig": { "assistanceLevel": "nudge", "neverReveal": ["c-lit"] }
}
```

- [ ] **Step 5: Create `lib/missions/seed/05-debounced-button-counter.json`**

```json
{
  "id": "debounced-button-counter",
  "title": "Debounced Button Counter",
  "subtitle": "Count button presses without double-counting bounce.",
  "difficulty": 3,
  "ageRange": [10, 14],
  "estimatedMinutes": 20,
  "tags": ["digital-input", "button", "debounce", "serial"],
  "layout": { "circuit": true, "codeEditor": true, "serialMonitor": true },
  "initial": {
    "circuit": { "nodes": [], "components": [] },
    "code": "int count = 0;\nunsigned long lastPressMs = 0;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  // TODO: detect a press, debounce it with millis(), increment count,\n  // and Serial.println(\"Count: \" + String(count))\n}\n",
    "lockedComponentIds": [],
    "lockedWireIds": [],
    "virtualInputs": [
      { "id": "btn1", "label": "Push Button", "pin": 2, "simulateBounce": true }
    ]
  },
  "palette": [],
  "completionCriteria": [
    { "id": "c-press", "type": "virtual-input-pressed", "inputId": "btn1", "minPresses": 3 },
    { "id": "c-millis", "type": "function-called", "functionName": "millis" },
    { "id": "c-serial", "type": "serial-output-matches", "pattern": "Count:\\s*\\d+" },
    { "id": "c-safe", "type": "fault-free" }
  ],
  "passCriteria": "all",
  "hints": [
    { "id": "h1", "afterSeconds": 150, "tier": 1, "content": "Real buttons don't switch cleanly — they \"bounce\" and can register several presses in a few milliseconds. This button simulates that." },
    { "id": "h2", "afterSeconds": 300, "tier": 2, "content": "Track the time of the last accepted press with millis(). Ignore new presses that happen within ~50ms of the last one." },
    { "id": "h3", "afterSeconds": 540, "tier": 3, "content": "if (digitalRead(2) == LOW && millis() - lastPressMs > 50) { count++; lastPressMs = millis(); Serial.println(\"Count: \" + String(count)); }" }
  ],
  "narrative": {
    "briefing": "Mechanical buttons physically bounce when pressed, sending several rapid on/off signals instead of one clean click. Build a counter that ignores the bounce and counts real presses.",
    "context": "Debouncing is one of the first \"real world is messy\" lessons in embedded programming — the same pattern shows up reading sensors, encoders, and switches on every robot you'll ever build.",
    "successMessage": "Your counter ignored the bounce and counted real presses — that's a debounce filter, and you'll use that trick constantly."
  },
  "aiMentorConfig": { "assistanceLevel": "nudge", "neverReveal": ["c-serial"] }
}
```

- [ ] **Step 6: Create `lib/missions/seed/06-toggle-lock.json`**

```json
{
  "id": "toggle-lock",
  "title": "Toggle Lock",
  "subtitle": "Each button press flips an LED between locked and unlocked.",
  "difficulty": 3,
  "ageRange": [10, 14],
  "estimatedMinutes": 18,
  "tags": ["digital-input", "button", "state", "serial"],
  "layout": { "circuit": true, "codeEditor": true, "serialMonitor": true },
  "initial": {
    "circuit": { "nodes": [], "components": [] },
    "code": "bool locked = true;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  // TODO: on each new press, flip `locked` and print LOCKED/UNLOCKED,\n  // drive the LED to match the locked state\n}\n",
    "lockedComponentIds": [],
    "lockedWireIds": [],
    "virtualInputs": [
      { "id": "btn1", "label": "Push Button", "pin": 2 }
    ]
  },
  "palette": [
    { "type": "resistor", "label": "220Ω", "params": { "resistance": 220 } },
    { "type": "led", "label": "LED Red", "params": { "color": "red" }, "color": "#ff3333" }
  ],
  "completionCriteria": [
    { "id": "c-resistor", "type": "component-present", "componentType": "resistor", "minCount": 1 },
    { "id": "c-led", "type": "component-present", "componentType": "led", "minCount": 1 },
    { "id": "c-press", "type": "virtual-input-pressed", "inputId": "btn1", "minPresses": 2 },
    { "id": "c-read", "type": "function-called", "functionName": "digitalRead" },
    { "id": "c-serial", "type": "serial-output-contains", "substring": "LOCKED" },
    { "id": "c-safe", "type": "fault-free" }
  ],
  "passCriteria": "all",
  "hints": [
    { "id": "h1", "afterSeconds": 150, "tier": 1, "content": "This is different from the button-controlled LED — the LED state should only change ON A PRESS, not stay tied to whether the button is currently held." },
    { "id": "h2", "afterSeconds": 300, "tier": 2, "content": "Track the button's previous reading in a variable. Only flip `locked` when it changes from not-pressed to pressed." },
    { "id": "h3", "afterSeconds": 540, "tier": 3, "content": "bool wasPressed = false; ... bool isPressed = digitalRead(2) == LOW; if (isPressed && !wasPressed) { locked = !locked; Serial.println(locked ? \"LOCKED\" : \"UNLOCKED\"); } wasPressed = isPressed; digitalWrite(13, locked ? LOW : HIGH);" }
  ],
  "narrative": {
    "briefing": "A real lock doesn't unlock only while you're touching the key — it flips state once per press and holds that state. Build a toggle: each press flips between LOCKED and UNLOCKED.",
    "context": "This requires remembering state between loop() iterations — the button's previous reading — so you can detect the moment of a press (the edge), not just whether it's currently held.",
    "successMessage": "Locked, unlocked, locked again — your circuit remembers its state. That's the same pattern behind real keypad locks and toggle switches."
  },
  "aiMentorConfig": { "assistanceLevel": "nudge", "neverReveal": ["c-serial"] }
}
```

- [ ] **Step 7: Create `lib/missions/seed/index.ts`**

```typescript
// lib/missions/seed/index.ts
// In-process registry of system missions. Definitions ship as JSON in this
// directory; only student *attempts* round-trip through Supabase (see Task 10).

import type { Mission } from "../types"
import blinkLed from "./01-blink-led.json"
import trafficLight from "./02-traffic-light.json"
import morseCodeSender from "./03-morse-code-sender.json"
import buttonControlledLed from "./04-button-controlled-led.json"
import debouncedButtonCounter from "./05-debounced-button-counter.json"
import toggleLock from "./06-toggle-lock.json"

const MISSIONS = [
  blinkLed,
  trafficLight,
  morseCodeSender,
  buttonControlledLed,
  debouncedButtonCounter,
  toggleLock,
] as unknown as Mission[]

export function getAllMissions(): Mission[] {
  return MISSIONS
}

export function getMissionById(id: string): Mission | null {
  return MISSIONS.find(m => m.id === id) ?? null
}
```

- [ ] **Step 8: Write a test that every seed mission parses as a valid `Mission` and has unique criterion/hint ids**

```typescript
// lib/missions/__tests__/seed.test.ts
import { describe, it, expect } from "vitest"
import { getAllMissions, getMissionById } from "../seed"

describe("mission seed registry", () => {
  it("loads exactly 6 missions with unique ids", () => {
    const missions = getAllMissions()
    expect(missions).toHaveLength(6)
    const ids = missions.map(m => m.id)
    expect(new Set(ids).size).toBe(6)
  })

  it("every mission has at least one completion criterion and passCriteria 'all'", () => {
    for (const mission of getAllMissions()) {
      expect(mission.completionCriteria.length).toBeGreaterThan(0)
      expect(mission.passCriteria).toBe("all")
    }
  })

  it("every mission has unique criterion ids", () => {
    for (const mission of getAllMissions()) {
      const ids = mission.completionCriteria.map(c => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("every hint's unmetCriterionId (if set) references a real criterion", () => {
    for (const mission of getAllMissions()) {
      const criterionIds = new Set(mission.completionCriteria.map(c => c.id))
      for (const hint of mission.hints) {
        if (hint.unmetCriterionId) {
          expect(criterionIds.has(hint.unmetCriterionId)).toBe(true)
        }
      }
    }
  })

  it("getMissionById finds a known mission and returns null for unknown ids", () => {
    expect(getMissionById("blink-led")?.title).toBe("Make an LED Blink")
    expect(getMissionById("does-not-exist")).toBeNull()
  })
})
```

- [ ] **Step 9: Run tests**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/missions/__tests__/seed.test.ts 2>&1 | tail -15
```

Expected: 5 tests PASS.

- [ ] **Step 10: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "missions/seed"
```

Expected: no errors. If `resolveJsonModule` isn't enabled, add it to `tsconfig.json`'s `compilerOptions` and re-run.

- [ ] **Step 11: Commit**

```bash
git add lib/missions/seed/ lib/missions/__tests__/seed.test.ts
git commit -m "feat(missions): seed the first 6 system missions (Arduino Fundamentals Module 1+2)"
```

---

## Task 6: Configurable Component Palette

**Files:**
- Modify: `components/circuit/component-palette.tsx`

Missions restrict which components a student can place (`Mission.palette`). The freeplay `/circuit` page keeps its current full list by simply not passing the new prop.

**Interfaces:**
- Produces: `ComponentPaletteProps.items?: PaletteItem[]` (optional — defaults to the existing hardcoded list).

- [ ] **Step 1: Update `components/circuit/component-palette.tsx`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript and that the freeplay /circuit page still compiles unchanged**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep -E "component-palette|circuit-view"
```

Expected: no errors (`circuit-view.tsx` doesn't pass `items`, so it keeps the default palette).

- [ ] **Step 3: Commit**

```bash
git add components/circuit/component-palette.tsx
git commit -m "feat(circuit): allow ComponentPalette to accept a restricted item list"
```

---

## Task 7: Virtual Button

**Files:**
- Create: `components/mission/virtual-button.tsx`

Stands in for a real breadboard pushbutton (deferred to Phase 4 per `Global Constraints`). Calls `GPIOBridge.setDigitalInput` directly. When `simulateBounce` is set, the press triggers a few rapid HIGH/LOW flips before settling — giving students a real signal to debounce in Mission 5.

**Interfaces:**
- Consumes: `VirtualInputSpec` from `lib/missions/types`.
- Produces: `<VirtualButton spec={...} onPress={(inputId) => void} onSetDigitalInput={(pin, high) => void} />`. The sandbox (Task 9) wires `onSetDigitalInput` to `gpioBridgeRef.current.setDigitalInput` and `onPress` to the mission runtime's `newVirtualPresses` queue.

- [ ] **Step 1: Create `components/mission/virtual-button.tsx`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "virtual-button"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/mission/virtual-button.tsx
git commit -m "feat(mission): add VirtualButton — simulated digital input control with optional bounce"
```

---

## Task 8: Mission UI — Briefing, Goal Panel, Hint

**Files:**
- Create: `components/mission/mission-briefing.tsx`
- Create: `components/mission/mission-goal-panel.tsx`
- Create: `components/mission/mission-hint.tsx`

- [ ] **Step 1: Create `components/mission/mission-briefing.tsx`**

```typescript
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
```

- [ ] **Step 2: Create `components/mission/mission-goal-panel.tsx`**

```typescript
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
```

- [ ] **Step 3: Create `components/mission/mission-hint.tsx`**

```typescript
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
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep -E "mission-briefing|mission-goal-panel|mission-hint"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/mission/mission-briefing.tsx components/mission/mission-goal-panel.tsx components/mission/mission-hint.tsx
git commit -m "feat(mission): add briefing, goal checklist, and tiered hint UI panels"
```

---

## Task 9: Mission Sandbox

**Files:**
- Create: `components/mission/mission-sandbox.tsx`

The three-pane layout coordinator. Mirrors `circuit-view.tsx`'s worker wiring (Phase 2) exactly — same `CircuitBridge`/`GPIOBridge` setup — and layers a `MissionRuntime` tick loop, mission-restricted palette, virtual buttons, and the briefing/goal/hint panels on top.

**Out of scope for this task (documented, not an oversight):**
- `Mission.initial.lockedComponentIds`/`lockedWireIds` enforcement in the canvas. All 6 seed missions ship with empty arrays (students build from scratch), so there's nothing to lock yet — real enforcement UI lands in Phase 6 alongside teacher-authored starter circuits, when there's something to test it against.
- `Mission.layout.circuit`/`codeEditor` are defined in the type (Task 2) but not read by `MissionSandbox` below — the breadboard and code panels always render. Only `layout.serialMonitor` is actually checked. All 6 seed missions have `circuit: true, codeEditor: true`, so this is inert config today, not a bug; wire it up if/when a future mission needs to hide one of those panels (e.g. a pure-physics mission in Phase 4+).

**Interfaces:**
- Consumes: `Mission`, `MissionRuntime`, `MissionSimSnapshot`, `MissionTickResult` (`lib/missions/*`), `BreadboardCanvas`, `ComponentPalette` (`components/circuit/*`), `CodeExecutionPanel`, `SerialMonitor` (`components/simulator/*`), `BreadboardState`, `CircuitBridge`, `GPIOBridge`, `ARDUINO_HOLES`, `VirtualButton`, `MissionBriefing`, `MissionGoalPanel`, `MissionHint`.
- Produces: `<MissionSandbox mission={mission} onComplete={(result) => void} />` — `onComplete` is called once, the first tick `complete` flips `true`, with `{ timeSeconds, hintsUsed, finalCircuit, finalCode }` for Task 11's attempt POST.

- [ ] **Step 1: Create `components/mission/mission-sandbox.tsx`**

```typescript
// components/mission/mission-sandbox.tsx
"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { BreadboardCanvas } from "@/components/circuit/breadboard-canvas"
import type { DraggedComponent } from "@/components/circuit/breadboard-canvas"
import { ComponentPalette } from "@/components/circuit/component-palette"
import type { PaletteItem } from "@/components/circuit/component-palette"
import { CodeExecutionPanel } from "@/components/simulator/code-execution-panel"
import { SerialMonitor, makeSerialLine } from "@/components/simulator/serial-monitor"
import type { SerialLine } from "@/components/simulator/serial-monitor"
import { BreadboardState } from "@/lib/circuit/breadboard/breadboard-state"
import { CircuitBridge } from "@/lib/circuit/circuit-bridge"
import type { PinNodeMap } from "@/lib/circuit/circuit-bridge"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { ARDUINO_HOLES } from "@/lib/circuit/breadboard/breadboard-layout"
import type { AVRCommand, AVREvent, CompileDiagnostic, BoardId } from "@/lib/avr/types"
import type { CircuitEvent, ComponentFault, SerializedNetlist } from "@/lib/circuit/types"
import { MissionRuntime } from "@/lib/missions/runtime"
import type { Mission, MissionSimSnapshot, MissionTickResult } from "@/lib/missions/types"
import { MissionBriefing } from "./mission-briefing"
import { MissionGoalPanel } from "./mission-goal-panel"
import { MissionHint } from "./mission-hint"
import { VirtualButton } from "./virtual-button"
import { cn } from "@/lib/utils"

type RunState = "idle" | "compiling" | "running" | "paused"
const TICK_MS = 100

export interface MissionCompletionResult {
  timeSeconds: number
  hintsUsed: number
  finalCircuit: SerializedNetlist
  finalCode: string
  criteriaMet: string[]
}

export interface MissionSandboxProps {
  mission: Mission
  onComplete: (result: MissionCompletionResult) => void
  className?: string
}

function buildPinNodeMap(): PinNodeMap {
  const digitalPins = new Map<number, string>()
  const analogPins = new Map<number, string>()
  for (const hole of ARDUINO_HOLES.values()) {
    const dMatch = hole.label.match(/^D(\d+)$/)
    if (dMatch) digitalPins.set(parseInt(dMatch[1], 10), hole.nodeId)
    const aMatch = hole.label.match(/^A(\d+)$/)
    if (aMatch) analogPins.set(parseInt(aMatch[1], 10), hole.nodeId)
  }
  return { digitalPins, analogPins }
}

function missionPaletteItems(mission: Mission): PaletteItem[] {
  return mission.palette.map(spec => ({
    label: spec.label,
    component: { type: spec.type, params: spec.params } as DraggedComponent,
    color: spec.color,
  }))
}

type TabId = "code" | "serial"

export function MissionSandbox({ mission, onComplete, className }: MissionSandboxProps) {
  const [code, setCode] = useState(mission.initial.code)
  const [board, setBoard] = useState<BoardId>("arduino-uno")
  const [runState, setRunState] = useState<RunState>("idle")
  const [compileErrors, setCompileErrors] = useState<CompileDiagnostic[]>([])
  const [serialLines, setSerialLines] = useState<SerialLine[]>([])
  const [brightnessMap, setBrightnessMap] = useState<Record<string, number>>({})
  const [draggedComp, setDraggedComp] = useState<DraggedComponent | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("code")
  const [showBriefing, setShowBriefing] = useState(true)
  const [tickResult, setTickResult] = useState<MissionTickResult>({ criteria: [], complete: false, activeHint: null })
  const [, forceRedraw] = useState(0)

  const bbStateRef = useRef<BreadboardState>(new BreadboardState())
  const avrWorkerRef = useRef<Worker | null>(null)
  const circuitWorkerRef = useRef<Worker | null>(null)
  const bridgeRef = useRef<CircuitBridge | null>(null)
  const gpioBridgeRef = useRef<GPIOBridge | null>(null)
  const runtimeRef = useRef<MissionRuntime | null>(null)
  const completedRef = useRef(false)
  const codeRef = useRef(code)
  const latestFaultsRef = useRef<ComponentFault[]>([])
  const latestNetlistRef = useRef<SerializedNetlist>(mission.initial.circuit)

  // Buffers drained on each 100ms tick — see Task 4's MissionSimSnapshot shape.
  const serialBufferRef = useRef("")
  const pendingPinEventsRef = useRef<Array<{ pin: number; high: boolean; timestampMs: number }>>([])
  const pendingVirtualPressesRef = useRef<string[]>([])

  useEffect(() => { codeRef.current = code }, [code])

  const handleErrors = useCallback((errors: CompileDiagnostic[]) => {
    setCompileErrors(errors)
    setRunState("idle")
  }, [])

  const handleNetlistChange = useCallback(() => {
    const netlist = bbStateRef.current.toNetlist()
    latestNetlistRef.current = netlist
    bridgeRef.current?.sendNetlist(netlist)
    forceRedraw(n => n + 1)
  }, [])

  const handleAVRCommand = useCallback((cmd: AVRCommand) => {
    if (cmd.type === "load" && cmd.hex === "") setRunState("compiling")
    avrWorkerRef.current?.postMessage(cmd)
  }, [])

  const handleVirtualPress = useCallback((inputId: string) => {
    pendingVirtualPressesRef.current.push(inputId)
  }, [])

  const handleVirtualSetDigitalInput = useCallback((pin: number, high: boolean) => {
    gpioBridgeRef.current?.setDigitalInput(pin, high)
  }, [])

  // Worker setup — identical wiring to Phase 2's circuit-view.tsx.
  useEffect(() => {
    const avrWorker = new Worker(new URL("@/workers/avr-worker.ts", import.meta.url))
    const circuitWorker = new Worker(new URL("@/workers/circuit-worker.ts", import.meta.url))
    avrWorkerRef.current = avrWorker
    circuitWorkerRef.current = circuitWorker

    const bridge = new CircuitBridge({
      avrWorker,
      circuitWorker,
      pinNodeMap: buildPinNodeMap(),
      onFault: (f) => { latestFaultsRef.current = f },
      onBrightnessUpdate: (bm) => setBrightnessMap(bm),
    })
    bridgeRef.current = bridge

    const gpioBridge = new GPIOBridge({
      avrWorker,
      onPinChange: ({ pin, high, isPWM, dutyCycle }) => {
        pendingPinEventsRef.current.push({ pin, high, timestampMs: Date.now() })
        bridge.handleAVREvent({ type: "pinChange", pin, high, isPWM, dutyCycle })
      },
      onSerialOutput: (text: string) => {
        serialBufferRef.current += text
        setSerialLines(prev => [...prev, makeSerialLine(text)])
      },
      onAVRError: (message: string) => {
        setCompileErrors([{ line: null, column: null, message, severity: "error" }])
        setRunState("idle")
      },
      onAVRStopped: () => setRunState("idle"),
    })
    gpioBridgeRef.current = gpioBridge

    avrWorker.onmessage = (e: MessageEvent<AVREvent>) => {
      const ev = e.data
      if (ev.type === "running") setRunState("running")
      else if (ev.type === "paused") setRunState("paused")
      else if (ev.type === "stopped") setRunState("idle")
      else gpioBridge.handleAVREvent(ev)
    }

    circuitWorker.onmessage = (e: MessageEvent<CircuitEvent>) => bridge.handleCircuitEvent(e.data)
    circuitWorker.postMessage({ type: "start" })

    runtimeRef.current = new MissionRuntime(mission, Date.now())
    bbStateRef.current = new BreadboardState()
    latestNetlistRef.current = bbStateRef.current.toNetlist()

    return () => {
      avrWorker.terminate()
      circuitWorker.terminate()
      avrWorkerRef.current = null
      circuitWorkerRef.current = null
      bridgeRef.current = null
      gpioBridgeRef.current = null
    }
    // mission is treated as immutable for the lifetime of one sandbox mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mission runtime tick loop — drains the event buffers every 100ms.
  useEffect(() => {
    const interval = setInterval(() => {
      const runtime = runtimeRef.current
      if (!runtime || completedRef.current) return

      const snapshot: MissionSimSnapshot = {
        nowMs: Date.now(),
        netlist: latestNetlistRef.current,
        brightnessMap,
        faults: latestFaultsRef.current,
        code: codeRef.current,
        serialBuffer: serialBufferRef.current,
        newPinEvents: pendingPinEventsRef.current,
        newVirtualPresses: pendingVirtualPressesRef.current,
      }
      pendingPinEventsRef.current = []
      pendingVirtualPressesRef.current = []
      latestFaultsRef.current = []

      const result = runtime.tick(snapshot)
      setTickResult(result)

      if (result.complete && !completedRef.current) {
        completedRef.current = true
        onComplete({
          timeSeconds: Math.round((snapshot.nowMs - runtime.getStartedAtMs()) / 1000),
          hintsUsed: runtime.getHintsUsedCount(),
          finalCircuit: latestNetlistRef.current,
          finalCode: codeRef.current,
          criteriaMet: result.criteria.filter(c => c.met).map(c => c.id),
        })
      }
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [brightnessMap, onComplete])

  const handleSerialSend = useCallback((data: string) => {
    gpioBridgeRef.current?.sendSerial(data)
  }, [])

  const paletteItems = missionPaletteItems(mission)

  return (
    <div className={cn("flex h-screen w-full overflow-hidden bg-background", className)}>
      {showBriefing && (
        <MissionBriefing mission={mission} onDismiss={() => setShowBriefing(false)} />
      )}

      {/* Left: palette + breadboard */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <div className="w-40 shrink-0 border-r border-border p-2 overflow-y-auto bg-card space-y-2">
          <ComponentPalette items={paletteItems} onPick={(comp) => setDraggedComp(comp)} />
          {draggedComp && (
            <div className="rounded bg-primary/10 border border-primary/30 px-2 py-1 text-[10px] text-primary">
              {draggedComp.type} selected — click a hole to place
            </div>
          )}
          {mission.initial.virtualInputs.map(spec => (
            <VirtualButton
              key={spec.id}
              spec={spec}
              onPress={handleVirtualPress}
              onSetDigitalInput={handleVirtualSetDigitalInput}
              className="w-full"
            />
          ))}
        </div>

        <div className="flex-1 overflow-auto p-2">
          <div className="text-[10px] text-muted-foreground/60 mb-1">
            Click two holes (or an Arduino pin) to draw a wire · Click to select · Del to remove
          </div>
          <BreadboardCanvas
            bbState={bbStateRef.current}
            brightnessMap={brightnessMap}
            onNetlistChange={handleNetlistChange}
            draggedComponent={draggedComp}
            onDragConsumed={() => setDraggedComp(null)}
          />
        </div>
      </div>

      {/* Right: goal panel, hint, code/serial */}
      <div className="w-[360px] shrink-0 flex flex-col border-l border-border overflow-hidden">
        <div className="p-2 space-y-2 border-b border-border">
          <MissionGoalPanel criteria={tickResult.criteria} complete={tickResult.complete} />
          <MissionHint hint={tickResult.activeHint} />
        </div>

        <div className="flex shrink-0 border-b border-border">
          {(["code", "serial"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium capitalize transition-colors",
                activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "code" ? "Code" : "Serial"}
              {tab === "serial" && serialLines.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">({serialLines.length})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div className={cn("h-full", activeTab === "code" ? "flex" : "hidden")}>
            <CodeExecutionPanel
              code={code}
              onCodeChange={setCode}
              runState={runState}
              onCommand={handleAVRCommand}
              errors={compileErrors}
              onErrors={handleErrors}
              board={board}
              onBoardChange={setBoard}
            />
          </div>
          {mission.layout.serialMonitor && (
            <div className={cn("h-full p-2", activeTab === "serial" ? "flex flex-col" : "hidden")}>
              <SerialMonitor
                lines={serialLines}
                onSend={handleSerialSend}
                onClear={() => setSerialLines([])}
                className="flex-1"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "mission-sandbox"
```

Resolve any prop-shape mismatches against the actual `CodeExecutionPanel`/`SerialMonitor`/`CircuitBridge`/`GPIOBridge` signatures (Task 9 assumes the exact signatures already shipped in Phase 1/2 — see `components/circuit/circuit-view.tsx` for the reference wiring this mirrors).

- [ ] **Step 3: Commit**

```bash
git add components/mission/mission-sandbox.tsx
git commit -m "feat(mission): add MissionSandbox — three-pane layout, runtime tick loop, virtual buttons"
```

---

## Task 10: Supabase Schema — Mission Attempts

**Files:**
- Create: `supabase-missions-schema.sql`

Scoped to `mission_attempts` only per `Global Constraints` — no `missions`, `saved_circuits`, `mission_templates` tables, no `assignments.mission_id` column (all deferred to Phase 6). `mission_id` is a plain `TEXT` matching the JSON `Mission.id` (e.g. `"blink-led"`), not a foreign key, since there's no `missions` table yet to reference.

- [ ] **Step 1: Create `supabase-missions-schema.sql`**

```sql
-- Mission Attempts Table
-- Run after: supabase-schema.sql → supabase-curriculum-schema.sql →
--            supabase-educator-schema.sql → supabase-subscription-schema.sql
--
-- mission_id is plain TEXT (matches Mission.id from lib/missions/seed/*.json)
-- rather than a foreign key — the `missions` DB table doesn't exist until
-- Phase 6 (teacher-authored / DB-driven missions).

CREATE TABLE IF NOT EXISTS mission_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,            -- Clerk user ID
  mission_id      TEXT NOT NULL,            -- matches Mission.id from lib/missions/seed/
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'abandoned')),
  time_seconds    INTEGER NOT NULL DEFAULT 0,
  hints_used      INTEGER NOT NULL DEFAULT 0,
  criteria_met    TEXT[] DEFAULT '{}',
  final_circuit   JSONB,
  final_code      TEXT,
  score           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mission_attempts_user
  ON mission_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_mission_attempts_mission
  ON mission_attempts(mission_id);

-- Best (highest-score) completed attempt per user per mission.
CREATE OR REPLACE VIEW mission_best_attempts AS
  SELECT DISTINCT ON (mission_id, user_id)
    mission_id,
    user_id,
    score,
    time_seconds,
    hints_used,
    created_at
  FROM mission_attempts
  WHERE status = 'completed'
  ORDER BY mission_id, user_id, score DESC, time_seconds ASC;
```

- [ ] **Step 2: Apply the schema**

```bash
echo "Run supabase-missions-schema.sql against the project's Supabase instance (Supabase dashboard SQL editor, or psql if DATABASE_URL is configured locally) — same process used for the existing supabase-*.sql files in this repo."
```

(No automated migration runner exists in this repo — confirmed during research; every other `supabase-*-schema.sql` file is applied manually the same way.)

- [ ] **Step 3: Commit**

```bash
git add supabase-missions-schema.sql
git commit -m "feat(missions): add mission_attempts table + best-attempt leaderboard view"
```

---

## Task 11: Mission API Routes

**Files:**
- Create: `app/api/missions/route.ts`
- Create: `app/api/missions/[id]/route.ts`
- Create: `app/api/missions/[id]/attempts/route.ts`

Mirrors the existing `app/api/challenges/attempt/route.ts` convention exactly: `createClient()` from `@supabase/supabase-js`, `auth()` from `@clerk/nextjs/server`, `{ error }` checked on every Supabase call.

- [ ] **Step 1: Create `app/api/missions/route.ts`**

```typescript
// app/api/missions/route.ts
import { NextResponse } from "next/server"
import { getAllMissions } from "@/lib/missions/seed"

// GET /api/missions — list all system missions (summary fields only)
export async function GET() {
  const missions = getAllMissions().map(m => ({
    id: m.id,
    title: m.title,
    subtitle: m.subtitle,
    difficulty: m.difficulty,
    ageRange: m.ageRange,
    estimatedMinutes: m.estimatedMinutes,
    tags: m.tags,
  }))
  return NextResponse.json({ missions })
}
```

- [ ] **Step 2: Create `app/api/missions/[id]/route.ts`**

```typescript
// app/api/missions/[id]/route.ts
import { NextResponse } from "next/server"
import { getMissionById } from "@/lib/missions/seed"

// GET /api/missions/[id] — full mission config (everything MissionSandbox needs)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mission = getMissionById(id)
  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 })
  }
  return NextResponse.json({ mission })
}
```

- [ ] **Step 3: Create `app/api/missions/[id]/attempts/route.ts`**

```typescript
// app/api/missions/[id]/attempts/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"
import { getMissionById } from "@/lib/missions/seed"
import { computeScore } from "@/lib/missions/scoring"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// POST /api/missions/[id]/attempts
// Body: { timeSeconds, hintsUsed, finalCircuit, finalCode, criteriaMet }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: missionId } = await params
    const mission = getMissionById(missionId)
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { timeSeconds, hintsUsed, finalCircuit, finalCode, criteriaMet } = await request.json()

    if (typeof timeSeconds !== "number" || typeof hintsUsed !== "number") {
      return NextResponse.json({ error: "timeSeconds and hintsUsed are required numbers" }, { status: 400 })
    }

    const score = computeScore({
      hintsUsed,
      timeSeconds,
      estimatedMinutes: mission.estimatedMinutes,
    })

    const { error: insertError } = await supabase.from("mission_attempts").insert({
      user_id: userId,
      mission_id: missionId,
      status: "completed",
      time_seconds: timeSeconds,
      hints_used: hintsUsed,
      criteria_met: criteriaMet ?? [],
      final_circuit: finalCircuit ?? null,
      final_code: finalCode ?? null,
      score,
    })

    if (insertError) {
      console.error("Insert mission attempt error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      score,
      message: mission.narrative.successMessage,
    })
  } catch (error) {
    console.error("Mission attempt API error:", error)
    return NextResponse.json({ error: "Failed to submit attempt" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "api/missions"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/missions/
git commit -m "feat(missions): add mission list/get/attempt API routes"
```

---

## Task 12: Mission Route

**Files:**
- Create: `app/missions/[missionId]/page.tsx`
- Create: `app/missions/[missionId]/layout.tsx`

- [ ] **Step 1: Create `app/missions/[missionId]/layout.tsx`**

```typescript
// app/missions/[missionId]/layout.tsx
// Full-height, no app chrome — the mission sandbox owns the entire viewport.
export default function MissionLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden">{children}</div>
}
```

- [ ] **Step 2: Create `app/missions/[missionId]/page.tsx`**

```typescript
// app/missions/[missionId]/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { MissionSandbox } from "@/components/mission/mission-sandbox"
import type { MissionCompletionResult } from "@/components/mission/mission-sandbox"
import type { Mission } from "@/lib/missions/types"

export default function MissionPage() {
  const params = useParams<{ missionId: string }>()
  const router = useRouter()
  const [mission, setMission] = useState<Mission | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/missions/${params.missionId}`)
      .then(res => {
        if (!res.ok) throw new Error("not found")
        return res.json()
      })
      .then(data => setMission(data.mission))
      .catch(() => setNotFound(true))
  }, [params.missionId])

  const handleComplete = useCallback(async (result: MissionCompletionResult) => {
    const res = await fetch(`/api/missions/${params.missionId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    })
    const data = await res.json()
    setResultMessage(data.message ?? "Mission complete!")
  }, [params.missionId])

  if (notFound) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Mission not found</p>
          <button onClick={() => router.push("/missions")} className="text-sm text-primary underline">
            Back to missions
          </button>
        </div>
      </div>
    )
  }

  if (!mission) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading mission…</div>
  }

  return (
    <div className="relative h-full">
      <MissionSandbox mission={mission} onComplete={handleComplete} />
      {resultMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
          <div className="max-w-sm rounded-xl border border-border bg-card p-6 space-y-4 text-center">
            <p className="text-base font-semibold">{resultMessage}</p>
            <button
              onClick={() => router.push("/missions")}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold"
            >
              Back to missions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "app/missions"
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run 2>&1 | tail -20
```

Expected: all tests pass (44 from Phase 1+2 + 3 breadboard-state + 14 runtime + 5 scoring + 5 seed = 71).

- [ ] **Step 5: Commit**

```bash
git add app/missions/
git commit -m "feat(missions): add /missions/[missionId] route — loads mission config, posts attempt on completion"
```

---

## Manual Smoke Test Checklist

Run `pnpm dev`, sign in, and open `http://localhost:3000/missions/blink-led`.

- [ ] Briefing modal appears with the mission title/briefing text; "Start Mission" dismisses it
- [ ] Goal panel shows 4 unmet criteria (resistor, LED, blinking, fault-free)
- [ ] Click a resistor in the palette, place it on the breadboard; click an LED, place it
- [ ] Click the D13 Arduino pin hole, then a breadboard hole — a wire is drawn (confirms Task 1's fix)
- [ ] Wire resistor → LED → GND rail
- [ ] In the code editor, write the blink sketch and click Run
- [ ] LED glows red, fades, repeats — goal panel's "blinking" criterion flips to ✓ after ~3s
- [ ] After ~90s without finishing, the tier-1 hint button appears (pulsing)
- [ ] Once all 4 criteria are met, "Mission complete!" appears in the goal panel, then the completion modal appears
- [ ] Check Supabase `mission_attempts` table — a new row exists with `mission_id = 'blink-led'`, a `score`, and `final_circuit` populated

Repeat a lighter pass on `/missions/button-controlled-led` to confirm the virtual button control appears and `setDigitalInput` actually flips the LED via `digitalRead(2)` in the running sketch.

