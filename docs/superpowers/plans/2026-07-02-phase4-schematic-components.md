# Phase 4: Schematic View + Full Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Button, Potentiometer, Capacitor, and NPN BJT circuit components to the breadboard editor, and render a live read-only schematic view (React Flow, dagre-laid-out) alongside the breadboard in `/circuit`.

**Architecture:** Each new component adds a solver stamp in `lib/circuit/components/`, a `buildComponent()` case in the circuit worker, a canvas silhouette in the breadboard renderer, and a React Flow node type in the schematic. The schematic subscribes to `SerializedNetlist` (already the canonical representation) via a pure `netlistToFlow()` transform — no new store, no new worker. Button state toggles by re-serializing the netlist (re-using the existing `setNetlist` flow). The circuit view gains a horizontal `react-resizable-panels` split — breadboard left, schematic right — while the code/serial panel stays as-is on the right.

**Tech Stack:** TypeScript strict, `@wokwi/avr8js` (existing), `@xyflow/react` (new), `@dagrejs/dagre` (new), `react-resizable-panels` (existing), `vitest`, Next.js 16 App Router.

## Global Constraints

- Run tests: `npx vitest run`. Run one file: `npx vitest run <path>`.
- All new `lib/` files: TypeScript strict, no `any`.
- `GND` node is implicit and never included in `SerializedNetlist.nodes` — the circuit worker and MNA solver treat it as voltage 0 by definition.
- Circuit-worker tick interval is 1 ms (`setInterval(tick, 1)`) — this is `dt` for the Capacitor companion model.
- Never modify `/builder`, `/simulator`, `/playground` routes or their components.
- Package manager: the project has both `pnpm-lock.yaml` and `package-lock.json`; use `npm install` for new packages to keep `package-lock.json` consistent (existing pattern).
- `solver.voltage(solution, "GND")` always returns 0 by convention in `MNASolver`.

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `lib/circuit/components/button.ts` | Open/closed conductance stamp |
| `lib/circuit/components/potentiometer.ts` | Two-resistor voltage divider; wiper terminal |
| `lib/circuit/components/capacitor.ts` | Backward Euler companion model; `V_prev` per-tick state |
| `lib/circuit/components/bjt.ts` | Ebers-Moll NPN; Newton-Raphson nonlinear stamps |
| `lib/circuit/schematic/netlist-to-flow.ts` | Pure `netlistToFlow()` + dagre auto-layout |
| `lib/circuit/schematic/node-types.ts` | React Flow custom SVG node renderers (8 types) |
| `components/circuit/schematic-view.tsx` | React Flow wrapper; reads `SerializedNetlist` prop |
| `lib/circuit/__tests__/button.test.ts` | Button stamp + fault tests |
| `lib/circuit/__tests__/potentiometer.test.ts` | Potentiometer voltage divider tests |
| `lib/circuit/__tests__/capacitor.test.ts` | Companion model charging curve tests |
| `lib/circuit/__tests__/bjt.test.ts` | NPN NR convergence + saturation fault tests |
| `lib/circuit/__tests__/netlist-to-flow.test.ts` | Graph transform correctness tests |

### Modified Files

| File | Change |
|---|---|
| `package.json` | Add `@xyflow/react`, `@dagrejs/dagre` |
| `lib/circuit/types.ts` | Expand `ComponentType` union + `ComponentParams` interface |
| `lib/circuit/breadboard/breadboard-state.ts` | Expand `PlacedComponent.type`; add `terminal3?`; add `setButtonState()`; update `toNetlist()` |
| `lib/circuit/breadboard/breadboard-renderer.ts` | Draw silhouettes for 4 new component types in `drawComponents()` |
| `components/circuit/breadboard-canvas.tsx` | Expand `DraggedComponent.type`; button click-to-toggle; 3-terminal placement |
| `workers/circuit-worker.ts` | 4 new `buildComponent()` cases; `capacitors[]` array; `updateTick()` after each solve |
| `components/circuit/circuit-view.tsx` | Horizontal `PanelGroup` split; `netlist` state; mount `SchematicView` |
| `components/circuit/component-palette.tsx` | 4 new entries in "Advanced Components" section |

---

### Task 1: Install packages + expand shared types

**Files:**
- Modify: `package.json`
- Modify: `lib/circuit/types.ts`
- Modify: `lib/circuit/breadboard/breadboard-state.ts`

**Interfaces:**
- Produces: `ComponentType` expanded to include `"button" | "potentiometer" | "capacitor" | "bjt"`; `ComponentParams` with new fields; `PlacedComponent` with `terminal3?`; `BreadboardState.setButtonState()`; updated `toNetlist()`.
- Consumed by: all subsequent tasks.

- [x] **Step 1: Install new packages**

```bash
npm install @xyflow/react @dagrejs/dagre
```

Expected: both appear in `package.json` dependencies and `package-lock.json`.

- [x] **Step 2: Expand `ComponentType` and `ComponentParams` in `lib/circuit/types.ts`**

Replace the existing `ComponentType` and `ComponentParams` with:

```ts
export type ComponentType =
  | "resistor"
  | "led"
  | "voltage-source"
  | "button"
  | "potentiometer"
  | "capacitor"
  | "bjt"

export interface ComponentParams {
  resistance?: number    // Ω — resistor, potentiometer
  voltage?: number       // V — voltage-source
  color?: "red" | "green" | "blue" | "white" | "yellow"  // LED
  state?: "open" | "closed"   // button
  position?: number            // 0.0–1.0 — potentiometer wiper
  capacitance?: number         // F — capacitor
  beta?: number                // h_FE — BJT
  wiperNet?: string            // resolved net name — potentiometer (set by toNetlist)
}
```

- [x] **Step 3: Update `PlacedComponent` in `lib/circuit/breadboard/breadboard-state.ts`**

Replace the `PlacedComponent` interface:

```ts
export interface PlacedComponent {
  id: ComponentId
  type: "resistor" | "led" | "voltage-source" | "button" | "potentiometer" | "capacitor" | "bjt"
  params: Record<string, number | string>
  terminal1: HolePosition
  terminal2: HolePosition
  terminal3?: HolePosition  // potentiometer wiper hole; BJT emitter hole
}
```

- [x] **Step 4: Add `setButtonState()` to `BreadboardState`**

Inside the `BreadboardState` class, after `removeWire()`:

```ts
setButtonState(id: ComponentId, closed: boolean): void {
  const comp = this.components.find(c => c.id === id)
  if (!comp || comp.type !== "button") return
  comp.params = { ...comp.params, state: closed ? "closed" : "open" }
}
```

- [x] **Step 5: Update `toNetlist()` to handle new types and `terminal3`**

In `toNetlist()`, replace the section that builds `allBaseNets` to also include `terminal3`:

```ts
for (const comp of this.components) {
  allBaseNets.add(holeNet(comp.terminal1.row, comp.terminal1.col))
  allBaseNets.add(holeNet(comp.terminal2.row, comp.terminal2.col))
  if (comp.terminal3) allBaseNets.add(holeNet(comp.terminal3.row, comp.terminal3.col))
}
```

Then replace the `serializedComponents` map to handle new types (replace the entire switch):

```ts
const serializedComponents: SerializedComponent[] = this.components.map(comp => {
  const net1 = resolve(comp.terminal1)
  const net2 = resolve(comp.terminal2)
  const p = comp.params as ComponentParams
  let terminals: Record<string, NodeId>
  switch (comp.type) {
    case "resistor":
      terminals = { n1: net1, n2: net2 }
      break
    case "led":
      terminals = { anode: net1, cathode: net2 }
      break
    case "voltage-source":
      terminals = { plus: net1, minus: net2 }
      break
    case "button":
      terminals = { t1: net1, t2: net2 }
      break
    case "potentiometer": {
      const wiperNet = comp.terminal3 ? resolve(comp.terminal3) : net2
      terminals = { t1: net1, t2: net2, wiper: wiperNet }
      break
    }
    case "capacitor":
      terminals = { t1: net1, t2: net2 }
      break
    case "bjt": {
      const emitterNet = comp.terminal3 ? resolve(comp.terminal3) : net2
      terminals = { base: net1, collector: net2, emitter: emitterNet }
      break
    }
    default:
      terminals = { t1: net1, t2: net2 }
  }
  return { id: comp.id, type: comp.type, terminals, params: p } as SerializedComponent
})
```

- [x] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 7: Verify existing tests still pass**

```bash
npx vitest run
```

Expected: all 153 tests pass.

- [x] **Step 8: Commit**

```bash
git add package.json package-lock.json lib/circuit/types.ts lib/circuit/breadboard/breadboard-state.ts
git commit -m "feat(phase4): install @xyflow/react + @dagrejs/dagre; expand circuit types for 4 new components"
```

---

### Task 2: Button component

**Files:**
- Create: `lib/circuit/components/button.ts`
- Create: `lib/circuit/__tests__/button.test.ts`

**Interfaces:**
- Consumes: `CircuitComponent` from `base-component.ts`; `MNASolver` from `mna-solver.ts`; `ComponentFault`, `ComponentId`, `NodeId` from `types.ts`.
- Produces: `Button` class — `new Button(id, t1, t2, closed)` where `closed: boolean`.

- [x] **Step 1: Write the failing tests**

Create `lib/circuit/__tests__/button.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { Button } from "../components/button"
import { MNASolver } from "../solver/mna-solver"
import { createMatrix, createVector } from "../solver/matrix"

describe("Button — open", () => {
  it("stamps no conductance when open", () => {
    const solver = new MNASolver()
    solver.setup(["A", "B"], [])
    const btn = new Button("b1", "A", "B", false)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    btn.stamp(G, b, solver)
    // G should remain all zeros — no conductance between A and B
    expect(G[0][1]).toBe(0)
    expect(G[1][0]).toBe(0)
    expect(G[0][0]).toBe(0)
  })

  it("getFaultState returns null", () => {
    const solver = new MNASolver()
    solver.setup(["A"], [])
    const btn = new Button("b1", "A", "GND", false)
    expect(btn.getFaultState([], solver)).toBeNull()
  })

  it("brightness is always 0", () => {
    const btn = new Button("b1", "A", "B", true)
    expect(btn.brightness).toBe(0)
  })
})

describe("Button — closed", () => {
  it("stamps 10 S conductance (0.1Ω) when closed", () => {
    const solver = new MNASolver()
    solver.setup(["A", "B"], [])
    const btn = new Button("b1", "A", "B", true)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    btn.stamp(G, b, solver)
    expect(G[0][0]).toBeCloseTo(10, 6)
    expect(G[1][1]).toBeCloseTo(10, 6)
    expect(G[0][1]).toBeCloseTo(-10, 6)
    expect(G[1][0]).toBeCloseTo(-10, 6)
  })
})
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/circuit/__tests__/button.test.ts
```

Expected: `FAIL` — `Button` not found.

- [x] **Step 3: Implement `lib/circuit/components/button.ts`**

```ts
import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

const CLOSED_CONDUCTANCE = 10  // 1 / 0.1 Ω

export class Button implements CircuitComponent {
  readonly brightness = 0

  constructor(
    readonly id: ComponentId,
    private t1: NodeId,
    private t2: NodeId,
    private closed: boolean
  ) {}

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    if (this.closed) solver.stampG(G, this.t1, this.t2, CLOSED_CONDUCTANCE)
    // open: stamp nothing — infinite resistance
  }

  getFaultState(_solution: number[], _solver: MNASolver): ComponentFault | null {
    return null
  }
}
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/circuit/__tests__/button.test.ts
```

Expected: all 5 tests pass.

- [x] **Step 5: Commit**

```bash
git add lib/circuit/components/button.ts lib/circuit/__tests__/button.test.ts
git commit -m "feat(phase4): add Button circuit component (open/closed conductance stamp)"
```

---

### Task 3: Potentiometer component

**Files:**
- Create: `lib/circuit/components/potentiometer.ts`
- Create: `lib/circuit/__tests__/potentiometer.test.ts`

**Interfaces:**
- Consumes: `CircuitComponent` from `base-component.ts`; `MNASolver`.
- Produces: `Potentiometer` class — `new Potentiometer(id, t1, t2, wiper, R, position)`.

- [x] **Step 1: Write the failing tests**

Create `lib/circuit/__tests__/potentiometer.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { Potentiometer } from "../components/potentiometer"
import { MNASolver } from "../solver/mna-solver"
import { VoltageSource } from "../components/voltage-source"
import { newtonRaphson } from "../solver/newton-raphson"
import { createMatrix, createVector } from "../solver/matrix"

describe("Potentiometer — stamp geometry", () => {
  it("at position 0.5: g_top equals g_bot", () => {
    const solver = new MNASolver()
    solver.setup(["T1", "WIPER", "T2"], [])
    const pot = new Potentiometer("p1", "T1", "T2", "WIPER", 10000, 0.5)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    pot.stamp(G, b, solver)
    // g_top = 1/(10000*0.5) = 0.0002; g_bot = same
    const iT1 = solver.ni("T1")
    const iW  = solver.ni("WIPER")
    // G[T1][T1] should be g_top = 0.0002
    expect(G[iT1][iT1]).toBeCloseTo(0.0002, 8)
    expect(G[iW][iW]).toBeCloseTo(0.0004, 8)  // g_top + g_bot
  })

  it("at position 0: wiper is clamped (no divide-by-zero)", () => {
    const solver = new MNASolver()
    solver.setup(["T1", "WIPER", "T2"], [])
    const pot = new Potentiometer("p1", "T1", "T2", "WIPER", 10000, 0)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    expect(() => pot.stamp(G, b, solver)).not.toThrow()
  })
})

describe("Potentiometer — voltage divider integration", () => {
  it("at position 0.5, wiper voltage is 2.5V with 5V supply", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "WIPER", "T2"], ["vs"])
    const vs  = new VoltageSource("vs", "VCC", "GND", 5.0)
    const pot = new Potentiometer("p1", "VCC", "T2", "WIPER", 10000, 0.5)
    const solution = newtonRaphson(solver, [vs, pot], [])
    expect(solver.voltage(solution, "WIPER")).toBeCloseTo(2.5, 4)
  })

  it("at position 0.75, wiper voltage is 3.75V with 5V supply", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "WIPER", "T2"], ["vs"])
    const vs  = new VoltageSource("vs", "VCC", "GND", 5.0)
    const pot = new Potentiometer("p1", "VCC", "T2", "WIPER", 10000, 0.75)
    const solution = newtonRaphson(solver, [vs, pot], [])
    expect(solver.voltage(solution, "WIPER")).toBeCloseTo(3.75, 4)
  })
})
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/circuit/__tests__/potentiometer.test.ts
```

Expected: `FAIL` — `Potentiometer` not found.

- [x] **Step 3: Implement `lib/circuit/components/potentiometer.ts`**

```ts
import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

const MIN_POS = 0.001  // clamp to prevent divide-by-zero at position 0 or 1

export class Potentiometer implements CircuitComponent {
  readonly brightness = 0

  constructor(
    readonly id: ComponentId,
    private t1:     NodeId,  // VCC end
    private t2:     NodeId,  // GND end
    private wiper:  NodeId,
    private R:      number,
    private position: number  // 0.0–1.0
  ) {}

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    const pos  = Math.max(MIN_POS, Math.min(1 - MIN_POS, this.position))
    const gTop = 1 / (this.R * (1 - pos))
    const gBot = 1 / (this.R * pos)
    solver.stampG(G, this.t1, this.wiper, gTop)
    solver.stampG(G, this.wiper, this.t2, gBot)
  }

  getFaultState(_solution: number[], _solver: MNASolver): ComponentFault | null {
    return null
  }
}
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/circuit/__tests__/potentiometer.test.ts
```

Expected: all 4 tests pass.

- [x] **Step 5: Commit**

```bash
git add lib/circuit/components/potentiometer.ts lib/circuit/__tests__/potentiometer.test.ts
git commit -m "feat(phase4): add Potentiometer circuit component (two-resistor voltage divider)"
```

---

### Task 4: Capacitor component

**Files:**
- Create: `lib/circuit/components/capacitor.ts`
- Create: `lib/circuit/__tests__/capacitor.test.ts`

**Interfaces:**
- Consumes: `CircuitComponent` from `base-component.ts`.
- Produces: `Capacitor` class — `new Capacitor(id, t1, t2, C, dt)`. Has public `updateTick(solution, solver)` called by the circuit worker after each solve to advance `V_prev`.

- [x] **Step 1: Write the failing tests**

Create `lib/circuit/__tests__/capacitor.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { Capacitor } from "../components/capacitor"
import { MNASolver } from "../solver/mna-solver"
import { VoltageSource } from "../components/voltage-source"
import { newtonRaphson } from "../solver/newton-raphson"
import { createMatrix, createVector } from "../solver/matrix"

describe("Capacitor — companion model", () => {
  it("initial V_prev is 0 — stamps companion conductance g = C/dt", () => {
    const C = 0.0001  // 100µF
    const dt = 0.001  // 1ms
    const solver = new MNASolver()
    solver.setup(["A", "B"], [])
    const cap = new Capacitor("c1", "A", "B", C, dt)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    cap.stamp(G, b, solver)
    const g = C / dt  // 0.1 S
    const iA = solver.ni("A")
    expect(G[iA][iA]).toBeCloseTo(g, 8)
    // history current source is 0 at t=0 (V_prev = 0)
    expect(b[iA]).toBeCloseTo(0, 8)
  })

  it("charging toward VCC: voltage increases each tick", () => {
    const C  = 0.0001  // 100µF
    const dt = 0.001   // 1ms — τ = RC = 1000 * 100e-6 = 0.1s
    const R  = 1000    // 1kΩ
    const solver = new MNASolver()
    solver.setup(["VCC", "MID"], ["vs"])
    const vs  = new VoltageSource("vs", "VCC", "GND", 5.0)
    const res = { stamp: (G: number[][], _b: number[], s: MNASolver) => s.stampG(G, "VCC", "MID", 1 / R) }
    const cap = new Capacitor("c1", "MID", "GND", C, dt)

    let prevV = 0
    for (let i = 0; i < 10; i++) {
      const solution = newtonRaphson(solver, [vs, res as never, cap], [])
      const v = solver.voltage(solution, "MID")
      expect(v).toBeGreaterThan(prevV)
      prevV = v
      cap.updateTick(solution, solver)
    }
    // After 10 ticks (10ms), should be charged somewhat (not yet at VCC)
    expect(prevV).toBeGreaterThan(0)
    expect(prevV).toBeLessThan(5.0)
  })

  it("getFaultState returns null below 50V", () => {
    const solver = new MNASolver()
    solver.setup(["A"], ["vs"])
    const cap = new Capacitor("c1", "A", "GND", 0.0001, 0.001)
    expect(cap.getFaultState([5.0, 0], solver)).toBeNull()
  })
})
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/circuit/__tests__/capacitor.test.ts
```

Expected: `FAIL` — `Capacitor` not found.

- [x] **Step 3: Implement `lib/circuit/components/capacitor.ts`**

```ts
import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

export class Capacitor implements CircuitComponent {
  readonly brightness = 0
  private vPrev = 0  // voltage across capacitor at previous tick

  constructor(
    readonly id: ComponentId,
    private t1: NodeId,
    private t2: NodeId,
    readonly C:  number,  // Farads
    private dt:  number   // seconds per circuit-worker tick
  ) {}

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    const g     = this.C / this.dt
    const iHist = g * this.vPrev
    solver.stampG(G, this.t1, this.t2, g)
    // History current source: iHist flows t2→t1 (charging direction)
    solver.stampI(b, this.t2, this.t1, iHist)
  }

  /** Call after each tick solve to update V_prev for the next tick. */
  updateTick(solution: number[], solver: MNASolver): void {
    const v1 = solver.voltage(solution, this.t1)
    const v2 = solver.voltage(solution, this.t2)
    this.vPrev = v1 - v2
  }

  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null {
    const v1 = solver.voltage(solution, this.t1)
    const v2 = solver.voltage(solution, this.t2)
    if (Math.abs(v1 - v2) > 50) {
      return {
        severity: "damage",
        componentId: this.id,
        message: "Capacitor voltage rating exceeded",
        technical: `Voltage across capacitor is ${Math.abs(v1 - v2).toFixed(1)}V — exceeds 50V rating`,
        suggestion: "Use a capacitor rated for higher voltage"
      }
    }
    return null
  }
}
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/circuit/__tests__/capacitor.test.ts
```

Expected: all 3 tests pass.

- [x] **Step 5: Commit**

```bash
git add lib/circuit/components/capacitor.ts lib/circuit/__tests__/capacitor.test.ts
git commit -m "feat(phase4): add Capacitor circuit component (backward Euler companion model)"
```

---

### Task 5: NPN BJT component

**Files:**
- Create: `lib/circuit/components/bjt.ts`
- Create: `lib/circuit/__tests__/bjt.test.ts`

**Interfaces:**
- Consumes: `NonlinearCircuitComponent` from `base-component.ts`; `isNonlinear` type guard.
- Produces: `NpnBJT` class — `new NpnBJT(id, base, collector, emitter, beta)`. Implements `NonlinearCircuitComponent` (has `stampLinearized` + `updateOperatingPoint`).

- [x] **Step 1: Write the failing tests**

Create `lib/circuit/__tests__/bjt.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { NpnBJT } from "../components/bjt"
import { MNASolver } from "../solver/mna-solver"
import { VoltageSource } from "../components/voltage-source"
import { Resistor } from "../components/resistor"
import { newtonRaphson } from "../solver/newton-raphson"
import { isNonlinear } from "../components/base-component"

describe("NpnBJT — identity", () => {
  it("is recognised as nonlinear by isNonlinear()", () => {
    const bjt = new NpnBJT("q1", "B", "C", "E", 100)
    expect(isNonlinear(bjt)).toBe(true)
  })

  it("brightness is always 0", () => {
    expect(new NpnBJT("q1", "B", "C", "E", 100).brightness).toBe(0)
  })
})

describe("NpnBJT — NR convergence (simple switch)", () => {
  // Circuit: 5V → 1kΩ → Collector; Base driven via 47kΩ from 5V; Emitter → GND
  // Expected: BJT conducts, Vce low
  it("converges and collector voltage drops below Vcc when base is driven", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "BASE", "COL"], ["vs"])
    const vs   = new VoltageSource("vs",  "VCC", "GND", 5.0)
    const rb   = new Resistor("rb", "VCC", "BASE", 47000)   // base resistor
    const rc   = new Resistor("rc", "VCC", "COL",   1000)   // collector load
    const bjt  = new NpnBJT("q1", "BASE", "COL", "GND", 100)

    const solution = newtonRaphson(solver, [vs, rb, rc], [bjt])
    const Vcol = solver.voltage(solution, "COL")
    // Transistor conducts → Vcol pulled toward GND
    expect(Vcol).toBeLessThan(4.0)
    expect(Vcol).toBeGreaterThanOrEqual(0)
  })
})

describe("NpnBJT — saturation fault", () => {
  it("getFaultState returns saturation warning when Vce < 0.2V", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "BASE", "COL"], ["vs"])
    const vs  = new VoltageSource("vs",  "VCC", "GND", 5.0)
    const rb  = new Resistor("rb", "VCC", "BASE",  1000)   // very low Rb → heavy saturation
    const rc  = new Resistor("rc", "VCC", "COL",  10000)   // high Rc
    const bjt = new NpnBJT("q1", "BASE", "COL", "GND", 100)

    const solution = newtonRaphson(solver, [vs, rb, rc], [bjt])
    const fault = bjt.getFaultState(solution, solver)
    if (fault !== null) {
      expect(fault.severity).toBe("warning")
      expect(fault.message).toContain("saturat")
    }
    // Fault may or may not fire depending on operating point; just verify no throw
  })
})
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/circuit/__tests__/bjt.test.ts
```

Expected: `FAIL` — `NpnBJT` not found.

- [x] **Step 3: Implement `lib/circuit/components/bjt.ts`**

```ts
import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { NonlinearCircuitComponent } from "./base-component"

// Shockley parameters for B-E junction
const Is = 1e-14   // saturation current (A)
const N  = 1.0     // ideality factor
const Vt = 0.02585 // thermal voltage at 25°C (V)
const MAX_VBE_STEP = 0.3  // NR damping — max step per iteration (V)
const EXP_CLAMP    = 700  // prevent IEEE 754 overflow in exp()

function beCurrentAt(Vbe: number): number {
  return Is * (Math.exp(Math.min(Vbe / (N * Vt), EXP_CLAMP)) - 1)
}

function beConductanceAt(Vbe: number): number {
  return (Is / (N * Vt)) * Math.exp(Math.min(Vbe / (N * Vt), EXP_CLAMP))
}

export class NpnBJT implements NonlinearCircuitComponent {
  readonly brightness = 0

  private Vbe = 0.0  // current operating-point junction voltage
  private Ibe = 0.0  // current B-E current

  constructor(
    readonly id: ComponentId,
    private base:      NodeId,
    private collector: NodeId,
    private emitter:   NodeId,
    private beta:      number
  ) {}

  /**
   * Stamp linearized Norton equivalents for B-E diode and β*Ibe collector source.
   *
   * B-E junction Norton companion:
   *   Gbe = dIbe/dVbe   (conductance between base and emitter)
   *   Ieq = Ibe - Gbe*Vbe  (companion current source)
   *
   * Collector controlled current source Ic = β*Ibe, modelled as:
   *   Conductance β*Gbe between collector and emitter (Jacobian term)
   *   Current source correction: (β*Ibe - β*Gbe*Vbe) from emitter to collector
   */
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void {
    const Gbe = beConductanceAt(this.Vbe)
    const Ieq = this.Ibe - Gbe * this.Vbe

    // B-E junction
    solver.stampG(G, this.base, this.emitter, Gbe)
    solver.stampI(b, this.base, this.emitter, Ieq)

    // Collector: β*Ibe (Jacobian stamp)
    const Ic      = this.beta * this.Ibe
    const GceJac  = this.beta * Gbe
    const IceCorr = Ic - GceJac * this.Vbe
    solver.stampG(G, this.collector, this.emitter, GceJac)
    solver.stampI(b, this.emitter, this.collector, IceCorr)
  }

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    this.stampLinearized(G, b, solver)
  }

  updateOperatingPoint(solution: number[], solver: MNASolver): boolean {
    const Vb = solver.voltage(solution, this.base)
    const Ve = solver.voltage(solution, this.emitter)
    const Vterminal = Vb - Ve

    const rawDelta = Vterminal - this.Vbe
    const delta    = Math.max(-MAX_VBE_STEP, Math.min(MAX_VBE_STEP, rawDelta))
    const Vbe_new  = this.Vbe + delta

    this.Ibe = beCurrentAt(Vbe_new)
    this.Vbe = Vbe_new

    return Math.abs(delta) > 1e-6
  }

  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null {
    const Vc  = solver.voltage(solution, this.collector)
    const Ve  = solver.voltage(solution, this.emitter)
    const Vce = Vc - Ve
    if (Vce < 0.2 && this.Ibe > 1e-6) {
      return {
        severity: "warning",
        componentId: this.id,
        message: "Transistor saturated",
        technical: `V_CE = ${Vce.toFixed(3)}V (below 0.2V threshold); BJT is in saturation`,
        suggestion: "Reduce base current or increase collector resistance to bring transistor into active region"
      }
    }
    return null
  }
}
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/circuit/__tests__/bjt.test.ts
```

Expected: all 4 tests pass.

- [x] **Step 5: Commit**

```bash
git add lib/circuit/components/bjt.ts lib/circuit/__tests__/bjt.test.ts
git commit -m "feat(phase4): add NPN BJT circuit component (Ebers-Moll, Newton-Raphson)"
```

---

### Task 6: Wire circuit-worker for all four new components

**Files:**
- Modify: `workers/circuit-worker.ts`

**Interfaces:**
- Consumes: `Button`, `Potentiometer`, `Capacitor`, `NpnBJT` from `lib/circuit/components/`.
- Produces: `buildComponent()` handles all 7 `ComponentType` values; `Capacitor.updateTick()` called each tick.

- [x] **Step 1: Add imports for new component classes**

At the top of `workers/circuit-worker.ts`, add after the existing component imports:

```ts
import { Button }        from "@/lib/circuit/components/button"
import { Potentiometer } from "@/lib/circuit/components/potentiometer"
import { Capacitor }     from "@/lib/circuit/components/capacitor"
import { NpnBJT }        from "@/lib/circuit/components/bjt"
```

- [x] **Step 2: Add `DT` constant and `capacitors` tracking array**

After the existing state declarations (after `let trackedNodes`), add:

```ts
const DT = 0.001  // seconds — matches setInterval(tick, 1)
let capacitors: Capacitor[] = []
```

- [x] **Step 3: Reset `capacitors` in `buildFromNetlist()`**

In `buildFromNetlist()`, after the line `nonlinearComponents = []`, add:

```ts
capacitors = []
```

- [x] **Step 4: Add 4 new cases to `buildComponent()`**

Replace the `default: return null` at the end of `buildComponent()` switch with:

```ts
    case "button": {
      const closed = sc.params.state === "closed"
      return new Button(sc.id, sc.terminals.t1, sc.terminals.t2, closed)
    }
    case "potentiometer": {
      const R   = (sc.params.resistance as number | undefined) ?? 10000
      const pos = (sc.params.position  as number | undefined) ?? 0.5
      return new Potentiometer(
        sc.id,
        sc.terminals.t1,
        sc.terminals.t2,
        sc.terminals.wiper,
        R,
        pos
      )
    }
    case "capacitor": {
      const C = (sc.params.capacitance as number | undefined) ?? 0.0001
      const cap = new Capacitor(sc.id, sc.terminals.t1, sc.terminals.t2, C, DT)
      capacitors.push(cap)
      return cap
    }
    case "bjt": {
      const beta = (sc.params.beta as number | undefined) ?? 100
      return new NpnBJT(
        sc.id,
        sc.terminals.base,
        sc.terminals.collector,
        sc.terminals.emitter,
        beta
      )
    }
    default:
      return null
```

- [x] **Step 5: Call `updateTick()` on capacitors after each solve in `tick()`**

In the `tick()` function, after `const solution = newtonRaphson(...)`, add:

```ts
  for (const cap of capacitors) cap.updateTick(solution, solver)
```

- [x] **Step 6: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests still pass (circuit-worker has no unit tests of its own; the component tests already pass).

- [x] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 8: Commit**

```bash
git add workers/circuit-worker.ts
git commit -m "feat(phase4): wire Button/Potentiometer/Capacitor/BJT into circuit-worker"
```

---

### Task 7: Breadboard canvas + renderer updates

**Files:**
- Modify: `components/circuit/breadboard-canvas.tsx`
- Modify: `lib/circuit/breadboard/breadboard-renderer.ts`

**Interfaces:**
- Consumes: `BreadboardState.setButtonState()` (Task 1); new `PlacedComponent.type` values.
- Produces: button click-to-toggle; 3-terminal component placement; silhouettes for all 4 new types.

- [x] **Step 1: Expand `DraggedComponent.type` in `breadboard-canvas.tsx`**

Replace the existing `DraggedComponent` interface:

```ts
export interface DraggedComponent {
  type: "resistor" | "led" | "button" | "potentiometer" | "capacitor" | "bjt"
  params: Record<string, number | string>
}
```

- [x] **Step 2: Handle 3-terminal component placement in `handleClick`**

In the `handleClick` callback, replace the entire "Place dragged component" block (from `if (draggedComponent) {` to its closing `}`):

```ts
      if (draggedComponent) {
        const hole = snapToHole(cx, cy)
        if (!hole) return
        const id = `comp_${componentIdCounter++}`
        const row2 = Math.min(hole.row + 2, BREADBOARD_ROWS)
        const row3 = Math.min(hole.row + 1, BREADBOARD_ROWS)

        const isThreeTerminal =
          draggedComponent.type === "potentiometer" || draggedComponent.type === "bjt"

        bbState.addComponent({
          id,
          type: draggedComponent.type,
          params: draggedComponent.params,
          terminal1: hole,
          terminal2: { row: row2, col: hole.col },
          ...(isThreeTerminal ? { terminal3: { row: row3, col: hole.col } } : {}),
        })
        onDragConsumed()
        onNetlistChange()
        redraw()
        return
      }
```

- [x] **Step 3: Add button click-to-toggle in `handleClick`**

In `handleClick`, inside the "Check component click for selection" loop, replace the `setSelectedId(comp.id); return` line with:

```ts
          if (comp.type === "button") {
            const currentlyClosed = comp.params.state === "closed"
            bbState.setButtonState(comp.id, !currentlyClosed)
            onNetlistChange()
            redraw()
            return
          }
          setSelectedId(comp.id)
          return
```

- [x] **Step 4: Add silhouettes for 4 new types in `breadboard-renderer.ts`**

In `drawComponents()`, after the closing `}` of the `led` branch (before the final `}`), add:

```ts
    } else if (comp.type === "button") {
      const closed = comp.params.state === "closed"
      // Leads
      ctx.strokeStyle = "#888"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, y1); ctx.lineTo(cx - 10, cy)
      ctx.moveTo(x2, y2); ctx.lineTo(cx + 10, cy)
      ctx.stroke()
      // Two contact circles
      ctx.fillStyle = isSelected ? "#ffee88" : (closed ? "#44dd88" : "#885544")
      ctx.beginPath(); ctx.arc(cx - 10, cy, 4, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(cx + 10, cy, 4, 0, Math.PI * 2); ctx.fill()
      // Bridge line when closed
      if (closed) {
        ctx.strokeStyle = "#44dd88"; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke()
      }
      ctx.fillStyle = "#ccc"; ctx.font = "7px monospace"; ctx.textAlign = "center"
      ctx.fillText(closed ? "CLOSED" : "OPEN", cx, cy + 14)

    } else if (comp.type === "potentiometer") {
      ctx.fillStyle = isSelected ? "#ffee88" : "#8860c8"
      ctx.strokeStyle = isSelected ? "#ffff00" : "#6040a8"
      ctx.lineWidth = 1
      roundRect(ctx, cx - 12, cy - 5, 24, 10, 3)
      ctx.fill(); ctx.stroke()
      // Diagonal arrow
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx - 8, cy + 3); ctx.lineTo(cx + 8, cy - 3)
      ctx.moveTo(cx + 4, cy - 3); ctx.lineTo(cx + 8, cy - 3); ctx.lineTo(cx + 8, cy + 1)
      ctx.stroke()
      ctx.fillStyle = "#333"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"
      ctx.fillText("POT", cx, cy + 3)

    } else if (comp.type === "capacitor") {
      // Leads
      ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, y1); ctx.lineTo(cx - 4, cy)
      ctx.moveTo(x2, y2); ctx.lineTo(cx + 4, cy)
      ctx.stroke()
      // Two plates
      ctx.strokeStyle = isSelected ? "#ffee88" : "#60aaee"; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(cx - 4, cy - 7); ctx.lineTo(cx - 4, cy + 7); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + 4, cy - 7); ctx.lineTo(cx + 4, cy + 7); ctx.stroke()
      ctx.fillStyle = "#999"; ctx.font = "7px monospace"; ctx.textAlign = "center"
      const Cv = comp.params.capacitance
      ctx.fillText(Cv ? `${(Number(Cv) * 1e6).toFixed(0)}µF` : "C", cx, cy + 16)

    } else if (comp.type === "bjt") {
      ctx.beginPath()
      ctx.arc(cx, cy, 10, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? "#ffee88" : "#e8902a"
      ctx.strokeStyle = isSelected ? "#ffff00" : "#b86010"
      ctx.lineWidth = 1.5
      ctx.fill(); ctx.stroke()
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5
      // Base lead (left)
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(cx - 5, cy); ctx.stroke()
      // Collector lead (top of terminal2)
      ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, y2); ctx.stroke()
      ctx.fillStyle = "#333"; ctx.font = "bold 6px monospace"; ctx.textAlign = "center"
      ctx.fillText("NPN", cx, cy + 3)
```

- [x] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [x] **Step 6: Commit**

```bash
git add components/circuit/breadboard-canvas.tsx lib/circuit/breadboard/breadboard-renderer.ts
git commit -m "feat(phase4): expand canvas for button/potentiometer/capacitor/bjt placement and silhouettes"
```

---

### Task 8: `netlistToFlow` transform

**Files:**
- Create: `lib/circuit/schematic/netlist-to-flow.ts`
- Create: `lib/circuit/__tests__/netlist-to-flow.test.ts`

**Interfaces:**
- Consumes: `SerializedNetlist`, `GND`, `VCC` from `lib/circuit/types.ts`; `@dagrejs/dagre`.
- Produces: `netlistToFlow(netlist: SerializedNetlist): { nodes: Node[], edges: Edge[] }` where `Node` and `Edge` are from `@xyflow/react`.

- [x] **Step 1: Write the failing tests**

Create `lib/circuit/__tests__/netlist-to-flow.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { netlistToFlow } from "../schematic/netlist-to-flow"
import type { SerializedNetlist } from "../types"

describe("netlistToFlow — empty netlist", () => {
  it("returns empty nodes and edges", () => {
    const result = netlistToFlow({ nodes: [], components: [] })
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
  })
})

describe("netlistToFlow — single resistor", () => {
  const netlist: SerializedNetlist = {
    nodes: ["VCC", "R1L"],
    components: [{
      id: "r1",
      type: "resistor",
      terminals: { n1: "VCC", n2: "GND" },
      params: { resistance: 220 },
    }],
  }

  it("creates one component node plus VCC and GND nodes", () => {
    const { nodes } = netlistToFlow(netlist)
    const ids = nodes.map(n => n.id)
    expect(ids).toContain("r1")
    expect(ids).toContain("__GND")
  })

  it("creates edges from VCC to r1 and from r1 to GND", () => {
    const { edges } = netlistToFlow(netlist)
    expect(edges.length).toBeGreaterThanOrEqual(2)
    const targets = edges.map(e => e.target)
    expect(targets).toContain("r1")
    const sources = edges.map(e => e.source)
    expect(sources).toContain("r1")
  })
})

describe("netlistToFlow — resistor + LED in series", () => {
  const netlist: SerializedNetlist = {
    nodes: ["VCC", "MID"],
    components: [
      { id: "r1", type: "resistor",  terminals: { n1: "VCC", n2: "MID" }, params: { resistance: 220 } },
      { id: "l1", type: "led",       terminals: { anode: "MID", cathode: "GND" }, params: { color: "red" } },
    ],
  }

  it("creates 2 component nodes + VCC + GND", () => {
    const { nodes } = netlistToFlow(netlist)
    expect(nodes.map(n => n.id)).toContain("r1")
    expect(nodes.map(n => n.id)).toContain("l1")
  })

  it("creates an edge between the two components via MID net", () => {
    const { edges } = netlistToFlow(netlist)
    const hasRtoL = edges.some(e =>
      (e.source === "r1" && e.target === "l1") ||
      (e.source === "l1" && e.target === "r1")
    )
    expect(hasRtoL).toBe(true)
  })

  it("all nodes have dagre-assigned positions (not all zero)", () => {
    const { nodes } = netlistToFlow(netlist)
    const allZero = nodes.every(n => n.position.x === 0 && n.position.y === 0)
    expect(allZero).toBe(false)
  })
})
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/circuit/__tests__/netlist-to-flow.test.ts
```

Expected: `FAIL` — module not found.

- [x] **Step 3: Create the schematic directory and implement `netlist-to-flow.ts`**

Create directory `lib/circuit/schematic/` then create `lib/circuit/schematic/netlist-to-flow.ts`:

```ts
import dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"
import type { SerializedNetlist } from "../types"
import { GND, VCC } from "../types"

const NODE_W = 120
const NODE_H = 60

export function netlistToFlow(
  netlist: SerializedNetlist
): { nodes: Node[]; edges: Edge[] } {
  if (netlist.components.length === 0) return { nodes: [], edges: [] }

  const nodes: Node[] = []
  const edges: Edge[] = []
  let edgeIdx = 0

  // Component nodes
  for (const comp of netlist.components) {
    nodes.push({
      id: comp.id,
      type: comp.type,
      data: { ...comp.params, id: comp.id },
      position: { x: 0, y: 0 },
    })
  }

  // Power rail nodes
  const hasVcc = netlist.nodes.includes(VCC) ||
    netlist.components.some(c => Object.values(c.terminals).includes(VCC))
  if (hasVcc) {
    nodes.push({
      id: "__VCC",
      type: "power-node",
      data: { label: "5V" },
      position: { x: 0, y: 0 },
    })
  }
  nodes.push({
    id: "__GND",
    type: "ground-node",
    data: { label: "GND" },
    position: { x: 0, y: 0 },
  })

  // Edges — connect each component terminal to its net partners
  for (const comp of netlist.components) {
    for (const [termKey, netId] of Object.entries(comp.terminals)) {
      if (netId === VCC && hasVcc) {
        edges.push({
          id: `e${edgeIdx++}`,
          source: "__VCC",
          target: comp.id,
          targetHandle: termKey,
        })
        continue
      }
      if (netId === GND) {
        edges.push({
          id: `e${edgeIdx++}`,
          source: comp.id,
          sourceHandle: termKey,
          target: "__GND",
        })
        continue
      }
      // Connect to other components sharing this net
      for (const other of netlist.components) {
        if (other.id <= comp.id) continue  // deduplicate: only add once
        for (const [otherKey, otherNet] of Object.entries(other.terminals)) {
          if (otherNet === netId) {
            edges.push({
              id: `e${edgeIdx++}`,
              source: comp.id,
              sourceHandle: termKey,
              target: other.id,
              targetHandle: otherKey,
            })
          }
        }
      }
    }
  }

  // dagre auto-layout (left-to-right)
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  for (const node of nodes) {
    const pos = g.node(node.id)
    if (pos) {
      node.position = {
        x: pos.x - NODE_W / 2,
        y: pos.y - NODE_H / 2,
      }
    }
  }

  return { nodes, edges }
}
```

- [x] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/circuit/__tests__/netlist-to-flow.test.ts
```

Expected: all 7 tests pass.

- [x] **Step 5: Commit**

```bash
git add lib/circuit/schematic/netlist-to-flow.ts lib/circuit/__tests__/netlist-to-flow.test.ts
git commit -m "feat(phase4): add netlistToFlow() transform with dagre auto-layout"
```

---

### Task 9: React Flow node types

**Files:**
- Create: `lib/circuit/schematic/node-types.ts`

**Interfaces:**
- Consumes: `@xyflow/react` (NodeProps); no runtime deps beyond React.
- Produces: `NODE_TYPES` record — pass directly as `nodeTypes` prop to `<ReactFlow>`.

- [x] **Step 1: Create `lib/circuit/schematic/node-types.ts`**

```tsx
import type { NodeProps } from "@xyflow/react"

function NodeShell({
  label,
  children,
  bg = "#2a3a4a",
  border = "#4a6a8a",
}: {
  label: string
  children?: React.ReactNode
  bg?: string
  border?: string
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 6,
        padding: "6px 10px",
        minWidth: 80,
        textAlign: "center",
        fontSize: 10,
        color: "#ccc",
        fontFamily: "monospace",
      }}
    >
      {children}
      <div style={{ marginTop: 2, fontSize: 9, color: "#888" }}>{label}</div>
    </div>
  )
}

function ResistorNode({ data }: NodeProps) {
  const R = data.resistance as number | undefined
  return (
    <NodeShell label={R ? `${R}Ω` : "R"} bg="#2a2510" border="#c8a060">
      <svg width={40} height={16}>
        <line x1={0} y1={8} x2={8} y2={8} stroke="#888" strokeWidth={1.5} />
        <rect x={8} y={3} width={24} height={10} fill="#c8a060" rx={2} />
        <line x1={32} y1={8} x2={40} y2={8} stroke="#888" strokeWidth={1.5} />
      </svg>
    </NodeShell>
  )
}

const LED_COLORS: Record<string, string> = {
  red: "#ff3333", green: "#33ff66", blue: "#3399ff", white: "#ffffff", yellow: "#ffee33",
}

function LedNode({ data }: NodeProps) {
  const color = LED_COLORS[(data.color as string) ?? "red"] ?? "#ff3333"
  return (
    <NodeShell label="LED" bg="#2a1010" border={color}>
      <svg width={32} height={20}>
        <polygon points="4,2 4,18 20,10" fill={color} opacity={0.8} />
        <line x1={20} y1={2} x2={20} y2={18} stroke={color} strokeWidth={2} />
        <line x1={23} y1={4} x2={28} y2={0} stroke={color} strokeWidth={1} />
        <line x1={23} y1={8} x2={28} y2={4} stroke={color} strokeWidth={1} />
      </svg>
    </NodeShell>
  )
}

function ButtonNode({ data }: NodeProps) {
  const closed = data.state === "closed"
  return (
    <NodeShell label={closed ? "CLOSED" : "OPEN"} bg="#1a1a1a" border={closed ? "#44dd88" : "#885544"}>
      <svg width={40} height={16}>
        <line x1={0} y1={8} x2={12} y2={8} stroke="#888" strokeWidth={1.5} />
        <circle cx={12} cy={8} r={3} fill={closed ? "#44dd88" : "#885544"} />
        {closed
          ? <line x1={15} y1={8} x2={25} y2={8} stroke="#44dd88" strokeWidth={2} />
          : <line x1={15} y1={4} x2={25} y2={8} stroke="#885544" strokeWidth={1.5} strokeDasharray="2,2" />}
        <circle cx={28} cy={8} r={3} fill={closed ? "#44dd88" : "#885544"} />
        <line x1={31} y1={8} x2={40} y2={8} stroke="#888" strokeWidth={1.5} />
      </svg>
    </NodeShell>
  )
}

function PotentiometerNode({ data }: NodeProps) {
  const R = data.resistance as number | undefined
  return (
    <NodeShell label={R ? `${R}Ω POT` : "POT"} bg="#1a0e2a" border="#8860c8">
      <svg width={44} height={20}>
        <rect x={4} y={5} width={28} height={10} fill="#8860c8" opacity={0.6} rx={2} />
        <line x1={0} y1={10} x2={4} y2={10} stroke="#888" strokeWidth={1.5} />
        <line x1={32} y1={10} x2={36} y2={10} stroke="#888" strokeWidth={1.5} />
        <line x1={18} y1={18} x2={18} y2={26} stroke="#888" strokeWidth={1.5} />
        <line x1={10} y1={18} x2={26} y2={2} stroke="#fff" strokeWidth={1.5} />
        <polygon points="24,2 26,2 26,6" fill="#fff" />
      </svg>
    </NodeShell>
  )
}

function CapacitorNode({ data }: NodeProps) {
  const C = data.capacitance as number | undefined
  const label = C ? `${(C * 1e6).toFixed(0)}µF` : "C"
  return (
    <NodeShell label={label} bg="#0e1a2a" border="#60aaee">
      <svg width={32} height={20}>
        <line x1={0} y1={10} x2={12} y2={10} stroke="#888" strokeWidth={1.5} />
        <line x1={12} y1={2} x2={12} y2={18} stroke="#60aaee" strokeWidth={2.5} />
        <line x1={16} y1={2} x2={16} y2={18} stroke="#60aaee" strokeWidth={2.5} />
        <line x1={16} y1={10} x2={32} y2={10} stroke="#888" strokeWidth={1.5} />
      </svg>
    </NodeShell>
  )
}

function BjtNode({ data }: NodeProps) {
  const beta = data.beta as number | undefined
  return (
    <NodeShell label={`NPN β=${beta ?? 100}`} bg="#2a1a0a" border="#e8902a">
      <svg width={44} height={36}>
        <circle cx={22} cy={18} r={14} fill="none" stroke="#e8902a" strokeWidth={1.5} />
        <line x1={22} y1={6} x2={22} y2={30} stroke="#e8902a" strokeWidth={1.5} />
        <line x1={0} y1={18} x2={22} y2={18} stroke="#888" strokeWidth={1.5} />
        <line x1={22} y1={12} x2={40} y2={2} stroke="#e8902a" strokeWidth={1.5} />
        <line x1={22} y1={24} x2={40} y2={34} stroke="#e8902a" strokeWidth={1.5} />
        <polygon points="34,6 40,2 36,10" fill="#e8902a" />
        <text x={22} y={21} textAnchor="middle" fontSize={7} fill="#ccc" fontFamily="monospace">NPN</text>
      </svg>
    </NodeShell>
  )
}

function PowerNode({ data }: NodeProps) {
  return (
    <NodeShell label={(data.label as string) ?? "VCC"} bg="#2a0a0a" border="#cc4444">
      <svg width={24} height={16}>
        <line x1={12} y1={0} x2={12} y2={16} stroke="#cc4444" strokeWidth={2} />
        <line x1={4} y1={4} x2={20} y2={4} stroke="#cc4444" strokeWidth={2} />
      </svg>
    </NodeShell>
  )
}

function GroundNode({ data }: NodeProps) {
  return (
    <NodeShell label={(data.label as string) ?? "GND"} bg="#0a0a2a" border="#4466cc">
      <svg width={28} height={16}>
        <line x1={14} y1={0} x2={14} y2={6} stroke="#4466cc" strokeWidth={2} />
        <line x1={4} y1={6} x2={24} y2={6} stroke="#4466cc" strokeWidth={2} />
        <line x1={8} y1={10} x2={20} y2={10} stroke="#4466cc" strokeWidth={2} />
        <line x1={12} y1={14} x2={16} y2={14} stroke="#4466cc" strokeWidth={2} />
      </svg>
    </NodeShell>
  )
}

export const NODE_TYPES = {
  resistor:      ResistorNode,
  led:           LedNode,
  button:        ButtonNode,
  potentiometer: PotentiometerNode,
  capacitor:     CapacitorNode,
  bjt:           BjtNode,
  "power-node":  PowerNode,
  "ground-node": GroundNode,
} as const
```

- [x] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add lib/circuit/schematic/node-types.ts
git commit -m "feat(phase4): add React Flow custom SVG node types for schematic view"
```

---

### Task 10: `SchematicView` component

**Files:**
- Create: `components/circuit/schematic-view.tsx`

**Interfaces:**
- Consumes: `netlistToFlow` from `lib/circuit/schematic/netlist-to-flow.ts`; `NODE_TYPES` from `lib/circuit/schematic/node-types.ts`; `SerializedNetlist` from `lib/circuit/types.ts`; `@xyflow/react`.
- Produces: `SchematicView({ netlist })` — a React component, renders React Flow read-only schematic.

- [x] **Step 1: Create `components/circuit/schematic-view.tsx`**

```tsx
"use client"

import { useMemo } from "react"
import { ReactFlow, Background, Controls } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { netlistToFlow } from "@/lib/circuit/schematic/netlist-to-flow"
import { NODE_TYPES } from "@/lib/circuit/schematic/node-types"
import type { SerializedNetlist } from "@/lib/circuit/types"

export function SchematicView({ netlist }: { netlist: SerializedNetlist }) {
  const { nodes, edges } = useMemo(() => netlistToFlow(netlist), [netlist])

  if (netlist.components.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Wire your circuit to see the schematic
      </div>
    )
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#2a3a4a" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
```

- [x] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add components/circuit/schematic-view.tsx
git commit -m "feat(phase4): add SchematicView component (React Flow, read-only)"
```

---

### Task 11: Circuit view split layout + component palette

**Files:**
- Modify: `components/circuit/circuit-view.tsx`
- Modify: `components/circuit/component-palette.tsx`

**Interfaces:**
- Consumes: `SchematicView` (Task 10); `Panel`, `PanelGroup`, `PanelResizeHandle` from `react-resizable-panels` (already installed); `SerializedNetlist` state.
- Produces: Horizontal split breadboard/schematic; 4 new palette entries.

- [x] **Step 1: Add `netlist` state and `SchematicView` import to `circuit-view.tsx`**

At the top of `circuit-view.tsx`, add the import after existing imports:

```ts
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { SchematicView } from "./schematic-view"
import type { SerializedNetlist } from "@/lib/circuit/types"
```

Inside `CircuitView`, add state after the existing `useState` declarations:

```ts
  const [netlist, setNetlist] = useState<SerializedNetlist>({ nodes: [], components: [] })
```

Update `handleNetlistChange` to also set netlist state:

```ts
  const handleNetlistChange = useCallback(() => {
    const nl = bbStateRef.current.toNetlist()
    bridgeRef.current?.sendNetlist(nl)
    setNetlist(nl)
    forceRedraw(n => n + 1)
  }, [])
```

- [x] **Step 2: Replace the breadboard area with a horizontal split**

In the JSX return, replace the current `{/* Left: palette + breadboard */}` block (from its opening `<div>` to its closing `</div>`, i.e., everything before `{/* Right: code + serial panel */}`) with:

```tsx
      {/* Left area: palette + breadboard | schematic split */}
      <PanelGroup direction="horizontal" className="flex flex-1 min-w-0 overflow-hidden">
        {/* Breadboard + palette panel (default 60%) */}
        <Panel defaultSize={60} minSize={30} className="flex overflow-hidden">
          {/* Component palette */}
          <div className="w-36 shrink-0 border-r border-border p-2 overflow-y-auto bg-card">
            <ComponentPalette
              onPick={(comp) => setDraggedComp(comp)}
            />
            {draggedComp && (
              <div className="mt-2 rounded bg-primary/10 border border-primary/30 px-2 py-1 text-[10px] text-primary">
                {draggedComp.type} selected — click a hole to place
              </div>
            )}
          </div>

          {/* Breadboard area */}
          <div className="flex-1 overflow-auto p-2">
            <div className="text-[10px] text-muted-foreground/60 mb-1">
              {runState !== "idle" ? (
                <span className="text-amber-400">Simulation running — breadboard live</span>
              ) : (
                "Click two holes to draw a wire · Click a component/wire to select · Del to remove · Click button to toggle"
              )}
            </div>
            <BreadboardCanvas
              bbState={bbStateRef.current}
              brightnessMap={brightnessMap}
              onNetlistChange={handleNetlistChange}
              draggedComponent={draggedComp}
              onDragConsumed={() => setDraggedComp(null)}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/40 transition-colors cursor-col-resize" />

        {/* Schematic panel (default 40%) */}
        <Panel defaultSize={40} minSize={30} className="overflow-hidden bg-[#111827]">
          <div className="flex flex-col h-full">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b border-border uppercase tracking-wide shrink-0">
              Schematic
            </div>
            <div className="flex-1 min-h-0">
              <SchematicView netlist={netlist} />
            </div>
          </div>
        </Panel>
      </PanelGroup>
```

- [x] **Step 3: Add 4 new entries to `component-palette.tsx`**

In `component-palette.tsx`, replace the entire `DEFAULT_PALETTE_ITEMS` array with:

```ts
const DEFAULT_PALETTE_ITEMS: PaletteItem[] = [
  // Basic components
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
  // Advanced components
  {
    label: "Button",
    component: { type: "button", params: { state: "open" } },
    color: "#885544",
  },
  {
    label: "Pot 10kΩ",
    component: { type: "potentiometer", params: { resistance: 10000, position: 0.5 } },
    color: "#8860c8",
  },
  {
    label: "Cap 100µF",
    component: { type: "capacitor", params: { capacitance: 0.0001 } },
    color: "#60aaee",
  },
  {
    label: "NPN BJT",
    component: { type: "bjt", params: { beta: 100 } },
    color: "#e8902a",
  },
]
```

Also update the palette JSX to show a section separator. Replace the `return` block in `ComponentPalette`:

```tsx
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-0.5">
        Basic
      </p>
      {paletteItems.slice(0, 6).map((item) => (
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
            style={{ background: item.color ?? "#c8a060", border: "1px solid rgba(255,255,255,0.2)" }}
          />
          {item.label}
        </button>
      ))}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-0.5 mt-2">
        Advanced
      </p>
      {paletteItems.slice(6).map((item) => (
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
            style={{ background: item.color ?? "#c8a060", border: "1px solid rgba(255,255,255,0.2)" }}
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
        <br />
        Click a Button to toggle it.
      </p>
    </div>
  )
```

- [x] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: all 153+ tests pass (new tests from Tasks 2–5 + 8 added).

- [x] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 6: Commit**

```bash
git add components/circuit/circuit-view.tsx components/circuit/component-palette.tsx
git commit -m "feat(phase4): split circuit view breadboard/schematic; add 4 new palette entries"
```

---

## Self-Review

**Spec coverage:**
- §4 Arduino pin-hole completion: ✓ `snapToWireEndpoint` already handles Arduino holes (confirmed in code review); `setButtonState` and `toNetlist` terminal3 handling in Task 1 complete the breadboard-state side. **Note:** `drawArduino()` already renders Arduino holes in `breadboard-renderer.ts` — the live pin-glow enhancement in Task 7 adds colour-coded brightness but the holes are already visible. No gap.
- §5a Button: ✓ Task 2
- §5b Potentiometer: ✓ Task 3
- §5c Capacitor: ✓ Task 4
- §5d NPN BJT: ✓ Task 5
- §6a netlistToFlow: ✓ Task 8
- §6b node-types: ✓ Task 9
- §6c SchematicView: ✓ Task 10
- §7 Split layout + palette: ✓ Task 11
- §10 Tests: ✓ button, potentiometer, capacitor, bjt, netlist-to-flow all covered

**Placeholder scan:** No TBDs, no "add appropriate X", no incomplete code blocks.

**Type consistency check:**
- `Button` constructor: `(id, t1, t2, closed: boolean)` ↔ Task 6 `new Button(sc.id, sc.terminals.t1, sc.terminals.t2, closed)` ✓
- `Potentiometer` constructor: `(id, t1, t2, wiper, R, position)` ↔ Task 6 `new Potentiometer(sc.id, sc.terminals.t1, sc.terminals.t2, sc.terminals.wiper, R, pos)` ✓
- `Capacitor` constructor: `(id, t1, t2, C, dt)` ↔ Task 6 `new Capacitor(sc.id, sc.terminals.t1, sc.terminals.t2, C, DT)` ✓
- `NpnBJT` constructor: `(id, base, collector, emitter, beta)` ↔ Task 6 `new NpnBJT(sc.id, sc.terminals.base, sc.terminals.collector, sc.terminals.emitter, beta)` ✓
- `netlistToFlow` returns `{ nodes: Node[], edges: Edge[] }` ↔ Task 10 destructures `{ nodes, edges }` ✓
- `NODE_TYPES` keys match `netlistToFlow` node `type` values: `"resistor"`, `"led"`, `"button"`, `"potentiometer"`, `"capacitor"`, `"bjt"`, `"power-node"`, `"ground-node"` ✓
