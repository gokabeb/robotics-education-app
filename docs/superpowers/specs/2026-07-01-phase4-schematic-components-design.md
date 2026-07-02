# Xylo Platform — Phase 4: Schematic View + Full Component Library Design Spec

**Date:** 2026-07-01
**Status:** Approved for implementation planning
**Scope:** Read-only schematic view derived from breadboard netlist (React Flow, side-by-side layout); four new circuit components (Button, Potentiometer, Capacitor, NPN BJT); completion of Arduino pin-hole canvas wiring.

---

## 1. Executive Summary

Phase 4 completes the circuit editor's fidelity and comprehensibility. Students can now place buttons, potentiometers, capacitors, and transistors on the breadboard — and a live schematic panel renders alongside the breadboard, showing the abstract circuit that corresponds to their physical layout. The schematic updates in real time as they wire and is purely read-only (the breadboard remains the single authoring surface). The Arduino pin-hole snap infrastructure introduced in Phase 3 is completed to support all new component types.

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Schematic authoring surface | Read-only, derived from breadboard | Breadboard is more intuitive for 8–16 year olds; schematic is a "why it works" companion, not a second editor |
| Schematic ↔ breadboard sync | Netlist-as-truth; schematic subscribes | `SerializedNetlist` is the existing canonical representation — no new store or abstraction needed |
| Schematic auto-layout | dagre (left-to-right directed graph) | Standard React Flow companion; produces clean schematics that read naturally |
| Button model | Open/closed conductance stamp | Simplest correct model; avoids matrix singularity by stamping 0.1Ω when closed |
| Potentiometer model | Two-resistor voltage divider stamp | Linear, no NR; wiper position drives ADC via existing circuit→AVR feedback path |
| Capacitor model | Backward Euler companion model | Linearizes per-tick; makes capacitor look like resistor + current source to MNA — no solver changes |
| BJT model | Simplified Ebers-Moll (forward-active only) + NR | Reuses Shockley linearization from `led.ts`; sufficient for all beginner/intermediate NPN use cases |
| New component terminals | All as `HolePosition` (same as existing resistor/LED) | Consistent with `PlacedComponent` interface; no schema changes needed |
| Layout | `react-resizable-panels` split (breadboard 60%, schematic 40%) | Already installed; zero new dependencies for layout |

---

## 3. Architecture & Data Flow

The existing pipeline is unchanged. Phase 4 adds one new consumer of `SerializedNetlist`:

```
BreadboardCanvas (HTML5 Canvas)
  ↓ user places/wires components
BreadboardState.toNetlist()
  ↓
SerializedNetlist ──────────────────────→ SchematicView (React Flow, read-only)
  │                                           ↑ netlistToFlow() + dagre layout
  ↓
circuit-worker (MNA + Newton-Raphson at ~1kHz)
  ↓ tick events (brightness, faults, ADC values)
CircuitBridge (main thread)
  ↓
BreadboardCanvas (LED glow, brightness overlay)
  AVR worker (setADC for potentiometer wiper)
```

New components flow through the same path as existing ones:
```
ComponentPalette → drag → BreadboardCanvas.addComponent()
  ↓
BreadboardState (registers component + terminals)
  ↓ toNetlist()
SerializedNetlist (component entry with type + params)
  ↓
circuit-worker: buildComponent(entry) → Button | Potentiometer | Capacitor | BJT instance
  ↓
MNA stamp → solve → tick event
```

---

## 4. Arduino Pin-Hole Topology (Completion of Phase 3 Foundation)

Phase 3 established the infrastructure (`ARDUINO_HOLES` map in `breadboard-layout.ts`, `WireEndpoint` union with `{ kind: "arduino"; pinKey: string }` in `breadboard-state.ts`). Phase 4 completes the remaining pieces:

### 4a. `breadboard-canvas.tsx` — snap completion
`snapToHole()` currently only checks tie-strip and rail holes. It must also iterate `ARDUINO_HOLES` entries and return `{ kind: "arduino", pinKey }` when the mouse is within snap radius of an Arduino pin hole position. Wire drawing mode activates on mousedown over an Arduino hole exactly as it does over a tie-strip hole.

### 4b. `breadboard-renderer.ts` — Arduino header rendering
A new `drawArduinoHeader(ctx, holes, drivingHighPins)` function renders:
- The Arduino board outline (rectangle at canvas left edge)
- One circle per pin hole from `ARDUINO_HOLES`, labeled with pin name
- Pins currently driven HIGH by the AVR glow their net color; GND/5V/3.3V use fixed colors
- The existing `drawWires()` function is updated to handle `WireEndpoint` of kind `"arduino"` — wire endpoint coordinates come from `ARDUINO_HOLES.get(pinKey)?.{x, y}`.

### 4c. `breadboard-state.ts` — new component type registration
`PlacedComponent.type` union expands from `"resistor" | "led" | "voltage-source"` to:
```ts
"resistor" | "led" | "voltage-source" | "button" | "potentiometer" | "capacitor" | "bjt"
```
Button and BJT have three or two terminals (see §5). The `PlacedComponent` interface gains an optional `terminal3?: HolePosition` for the BJT's third terminal (Emitter).

---

## 5. New Component Models

All four components implement `CircuitComponent` from `lib/circuit/components/base-component.ts`. Button and Potentiometer implement `CircuitComponent` (linear — no `updateNonlinear`). Capacitor implements `CircuitComponent` (linear per-tick via companion model). BJT implements `NonlinearCircuitComponent`.

### 5a. Button (`lib/circuit/components/button.ts`)

**Terminals:** `terminal1`, `terminal2` (two-terminal, same as resistor).

**State:** `closed: boolean` — toggled by a click event in `BreadboardCanvas` that calls `breadboardState.setButtonState(id, closed)` and re-serializes the netlist, triggering a full circuit-worker reload.

**Stamp:**
- `closed = false`: stamp nothing (open circuit — no conductance between terminals, node floats)
- `closed = true`: stamp conductance `g = 1 / 0.1 = 10 S` between terminals (avoids matrix singularity)

**Brightness:** always `0` (buttons don't emit light).
**Fault:** none.

**Params in netlist:** `{ state: "open" | "closed" }`.

### 5b. Potentiometer (`lib/circuit/components/potentiometer.ts`)

**Terminals:** `terminal1` (VCC end), `terminal2` (GND end). Wiper is an internal node, not a physical hole — it connects to an ADC pin via a separate wire that the student draws from the potentiometer's wiper hole (a third hole between terminal1 and terminal2 on the rendered component silhouette).

**State:** `position: number` (0.0–1.0) — set via a slider in the component properties panel.

**Wiper terminal:** The potentiometer occupies three consecutive breadboard holes when placed: `terminal1` (VCC end), a middle hole whose net becomes the wiper (`wiperNet`), and `terminal2` (GND end). The wiper hole is stored as `terminal3: HolePosition` in `PlacedComponent`. Students draw a wire from that hole to an Arduino analog pin (A0–A5) to read the voltage. The wiper net name is derived from `holeNet(terminal3.row, terminal3.col)` — the same union-find path as any other hole.

**Stamp:**
```
g_top = 1 / (R × (1 − position))   between terminal1 and wiperNet
g_bot = 1 / (R × position)          between wiperNet and terminal2
```
Both are linear conductance stamps (`solver.stampG`). Default `R = 10000` (10 kΩ). When `position = 0`, `g_top` is clamped to `1 / (R × 0.001)` to avoid divide-by-zero.

**Brightness:** `0`.
**Fault:** none.

**Params in netlist:** `{ resistance: number; position: number; wiperNet: NodeId }`.

### 5c. Capacitor (`lib/circuit/components/capacitor.ts`)

**Terminals:** `terminal1`, `terminal2`.

**Model:** Backward Euler companion model. At each circuit-worker tick of interval `dt` (seconds):

```
g_companion = C / dt
I_hist      = g_companion × V_prev     (where V_prev = terminal1_voltage − terminal2_voltage at previous tick)
```

Stamps as:
- Conductance `g_companion` between terminals (via `solver.stampG`)
- Current source `I_hist` from terminal2 → terminal1 (via `solver.stampI`)

`V_prev` is stored as instance state and updated each tick from the solved node voltages.

**Initial condition:** `V_prev = 0` (capacitor starts uncharged).

**Brightness:** `0`.
**Fault:** open-circuit fault if `|V_terminal1 - V_terminal2| > 50` (voltage rating exceeded — for educational display only).

**Params in netlist:** `{ capacitance: number }`. Default `capacitance = 0.0001` (100 µF).

### 5d. NPN BJT (`lib/circuit/components/bjt.ts`)

**Terminals:** `terminal1` = Base (B), `terminal2` = Collector (C). Third terminal `terminal3` = Emitter (E). Implements `NonlinearCircuitComponent`.

**Model:** Simplified Ebers-Moll, forward-active region:
- `I_BE`: diode current using Shockley equation (same parameters as `led.ts` — `I_S = 1e-14`, `n = 1`, `V_T = 0.02585 V`)
- `I_C = β × I_BE` (controlled current source, C → E)
- `β` (h_FE) defaults to `100`, configurable via params

**Newton-Raphson stamps (`stampLinearized`):**
1. Linearized BE diode conductance + companion current (same technique as `led.ts` — re-linearize around current `V_BE` each iteration)
2. Controlled current source `β × I_BE` stamped as `solver.stampI` from C to E, with Jacobian corrections for `∂I_C/∂V_BE`

**`updateOperatingPoint`:** computes new `V_BE = V_B - V_E` from solution, re-evaluates `I_BE`, returns `true` if `|ΔI_BE| > 1e-9` (not yet converged).

**Brightness:** `0`.
**Fault:** saturation warning when `V_CE < 0.2 V` (for educational display — "your transistor is saturated").

**Params in netlist:** `{ beta: number }`. Default `beta = 100`.

---

## 6. Schematic View

### 6a. `lib/circuit/schematic/netlist-to-flow.ts`

Pure function:
```ts
function netlistToFlow(netlist: SerializedNetlist): {
  nodes: Node[],   // React Flow Node[]
  edges: Edge[],   // React Flow Edge[]
}
```

**Node creation:** One React Flow node per `SerializedComponent` in the netlist. Node `type` maps directly to component kind (`"resistor"`, `"led"`, `"button"`, etc.). Node `data` passes through the component's `params` plus `id`.

**Edge creation:** For each component, its terminal nets (`node1`, `node2`, and optionally `node3` for BJT) create edges connecting component nodes. Two components sharing a net name get an edge between their corresponding handles.

**Auto-layout:** After node/edge creation, dagre (`@dagrejs/dagre`) assigns `x/y` positions in a left-to-right directed graph. Power sources (VCC, voltage-source nodes) are placed at the left; ground nodes at the right. Layout runs synchronously — no async needed, netlists are small (< 50 components in any realistic Phase 4 circuit).

### 6b. `lib/circuit/schematic/node-types.ts`

Custom React Flow node renderers — each is a small SVG component:

| Node type | Symbol |
|---|---|
| `ResistorNode` | IEC rectangular box with value label |
| `LEDNode` | Triangle + bar + emission arrows (color from params) |
| `ButtonNode` | Normally-open switch symbol; dashed line when open |
| `PotentiometerNode` | Resistor box + diagonal arrow through center |
| `CapacitorNode` | Two horizontal parallel plates + value label |
| `BJTNode` | Standard NPN circle symbol with B/C/E terminal labels |
| `VoltageSourceNode` | Circle with + / − and net name label |
| `GroundNode` | Three descending horizontal lines |

All nodes: `nodeDrag={false}`, no connect handles rendered.

### 6c. `components/circuit/schematic-view.tsx`

```tsx
function SchematicView({ netlist }: { netlist: SerializedNetlist }) {
  const { nodes, edges } = useMemo(() => netlistToFlow(netlist), [netlist])
  // ...
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
    />
  )
}
```

Empty state: when `netlist.components.length === 0`, renders a centered "Wire your circuit to see the schematic" message.

---

## 7. UI Layout Changes

### `components/circuit/circuit-view.tsx`

The existing layout (full-width breadboard + code panel below) is replaced with a `react-resizable-panels` horizontal split:

```
┌────────────────────────────┬───────────────────────┐
│  Breadboard Canvas         │  Schematic View        │
│  + Component Palette       │  (React Flow)          │
│  (60% default)             │  (40% default)         │
├────────────────────────────┴───────────────────────┤
│  Code Editor + Serial Monitor (unchanged, full-width)│
└─────────────────────────────────────────────────────┘
```

The `PanelGroup` direction is `"horizontal"`. Both panels have a minimum size of 30% so neither can be collapsed entirely.

### `components/circuit/component-palette.tsx`

Four new entries in the palette, organized into a new "Advanced Components" section below the existing "Basic Components":

| Label | Type | Default params |
|---|---|---|
| Button | `button` | `{ state: "open" }` |
| Potentiometer 10kΩ | `potentiometer` | `{ resistance: 10000, position: 0.5 }` |
| Capacitor 100µF | `capacitor` | `{ capacitance: 0.0001 }` |
| NPN Transistor | `bjt` | `{ beta: 100 }` |

---

## 8. New Files

| File | Responsibility |
|---|---|
| `lib/circuit/components/button.ts` | Open/closed conductance stamp |
| `lib/circuit/components/potentiometer.ts` | Two-resistor voltage divider stamp; wiper net |
| `lib/circuit/components/capacitor.ts` | Backward Euler companion model; `V_prev` state |
| `lib/circuit/components/bjt.ts` | Ebers-Moll NPN; NR nonlinear stamps |
| `lib/circuit/schematic/netlist-to-flow.ts` | `netlistToFlow()` pure transform + dagre layout |
| `lib/circuit/schematic/node-types.ts` | Custom React Flow SVG node renderers (7 types) |
| `components/circuit/schematic-view.tsx` | React Flow wrapper; reads netlist prop |

## 9. Modified Files

| File | Change |
|---|---|
| `lib/circuit/breadboard/breadboard-layout.ts` | No change needed — `ARDUINO_HOLES` already complete |
| `lib/circuit/breadboard/breadboard-state.ts` | Expand `PlacedComponent.type` union; add `terminal3?`; add `setButtonState()` |
| `lib/circuit/breadboard/breadboard-renderer.ts` | `drawArduinoHeader()` with live pin glow; wire endpoint coords for `"arduino"` kind |
| `components/circuit/breadboard-canvas.tsx` | `snapToHole()` checks `ARDUINO_HOLES`; wire mode from Arduino holes; button click handler |
| `workers/circuit-worker.ts` | `buildComponent()` cases for 4 new types; pass `dt` to Capacitor |
| `components/circuit/circuit-view.tsx` | `react-resizable-panels` split; mount `SchematicView` |
| `components/circuit/component-palette.tsx` | 4 new entries in "Advanced Components" section |
| `package.json` | Add `@dagrejs/dagre` + `@types/dagre` |

## 10. Tests

| File | What it tests |
|---|---|
| `lib/circuit/__tests__/button.test.ts` | Open = no conductance; closed = 10 S stamp; `getFaultState` returns null |
| `lib/circuit/__tests__/potentiometer.test.ts` | Position 0.5 → equal R_top/R_bot; position 0 → R_top = 0, wiper = VCC; ADC voltage range |
| `lib/circuit/__tests__/capacitor.test.ts` | Initial V_prev = 0; companion conductance = C/dt; charging curve over N ticks |
| `lib/circuit/__tests__/bjt.test.ts` | NR convergence with V_BE = 0.7V; I_C ≈ β × I_BE; saturation fault at V_CE < 0.2 |
| `lib/circuit/__tests__/netlist-to-flow.test.ts` | Single resistor → 1 node 0 edges; R+LED series → 2 nodes 1 edge; empty netlist → empty arrays |

---

## 11. Out of Scope (Deferred)

- PNP BJT, MOSFET, JFET (Phase 4.5 or later)
- Schematic as an authoring surface (bidirectional sync — permanently deferred per design decision §2)
- Component property editor panel beyond button click toggle and potentiometer slider (full properties panel is Phase 5 work)
- ERC (electrical rules check) — Phase 5
- Schematic export to PDF/SVG — Phase 6
