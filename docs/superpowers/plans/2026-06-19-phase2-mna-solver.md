# Xylo Platform — Phase 2: MNA Circuit Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time MNA circuit solver running in a Web Worker, with a visual breadboard canvas, so that Arduino GPIO pin changes drive circuit simulation and LED brightness reflects actual forward current.

**Architecture:** A `circuit-worker` Web Worker runs Modified Nodal Analysis at ~1kHz. The `CircuitBridge` (main thread, message-router only) routes `pinChange` events from `avr-worker` → `circuit-worker` as voltage sources, and routes solved node voltages back → ADC values → `avr-worker`. The breadboard canvas (HTML5 Canvas) renders holes, components, and LED glow; it converts its placed-component state into a `SerializedNetlist` on every edit.

**Tech Stack:** TypeScript, `vitest`, HTML5 Canvas, Next.js 16 App Router, existing `lib/avr/` types

**Design spec:** `docs/superpowers/specs/2026-06-19-xylo-robotics-platform-design.md` §5

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `lib/circuit/types.ts` | All shared circuit types: Netlist, NodeId, ComponentFault, CircuitCommand, CircuitEvent |
| `lib/circuit/solver/matrix.ts` | Dense matrix: create, LU factorize (Doolittle + partial pivot), LU solve |
| `lib/circuit/solver/mna-solver.ts` | MNASolver class: setup from node lists, stamp helpers (G, V, I), solve |
| `lib/circuit/solver/newton-raphson.ts` | NR iteration loop: stamp → solve → update nonlinear → converge |
| `lib/circuit/components/base-component.ts` | Component interface: stamp(), updateNonlinear(), getFaultState(), brightness |
| `lib/circuit/components/resistor.ts` | Linear conductance stamp |
| `lib/circuit/components/voltage-source.ts` | Branch-current augmented stamp for fixed/variable voltage |
| `lib/circuit/components/led.ts` | Shockley diode + series Rs, Newton linearization, fault detection, brightness |
| `workers/circuit-worker.ts` | Web Worker: builds components from netlist, runs NR at 1kHz, posts tick events |
| `lib/circuit/circuit-bridge.ts` | Main-thread bridge: AVR pinChange → circuit setPinVoltage; circuit tick → AVR setADC |
| `lib/circuit/breadboard/breadboard-layout.ts` | Hole-to-net connectivity, Arduino Uno pin-hole positions |
| `lib/circuit/breadboard/breadboard-state.ts` | Mutable placed-components + wires → SerializedNetlist via union-find |
| `lib/circuit/breadboard/breadboard-renderer.ts` | Pure Canvas drawing: holes, wires, component silhouettes, LED glow |
| `components/circuit/breadboard-canvas.tsx` | React: Canvas ref, mouse events (place, wire), calls renderer |
| `components/circuit/component-palette.tsx` | Drag palette: Resistor, LED, Wire |
| `components/circuit/circuit-view.tsx` | Full-page layout: breadboard + code panel + serial monitor |
| `app/circuit/page.tsx` | Next.js `/circuit` route |

### Modified Files

| File | Change |
|---|---|
| `lib/circuit/__tests__/matrix.test.ts` | New: LU, solve, singular detection |
| `lib/circuit/__tests__/mna-solver.test.ts` | New: voltage divider, series circuit, node voltage extraction |
| `lib/circuit/__tests__/led.test.ts` | New: forward bias convergence, fault threshold, reverse bias |
| `lib/circuit/__tests__/breadboard-layout.test.ts` | New: tie-strip connectivity, Arduino pin mapping |

---

## Task 1: Circuit Types

**Files:**
- Create: `lib/circuit/types.ts`

- [ ] **Step 1: Create `lib/circuit/types.ts`**

```typescript
// lib/circuit/types.ts

export type NodeId = string   // "GND", "VCC", "D13", "NET_R5L", etc.
export type ComponentId = string

export interface ComponentFault {
  severity: "warning" | "damage" | "destroyed"
  componentId: ComponentId
  message: string
  technical: string
  suggestion: string
}

export type ComponentType = "resistor" | "led" | "voltage-source"

export interface ComponentParams {
  resistance?: number            // Ω — for resistor
  voltage?: number               // V — for voltage-source
  color?: "red" | "green" | "blue" | "white" | "yellow"  // for LED
}

// Serialized form safe for postMessage (no Maps)
export interface SerializedComponent {
  id: ComponentId
  type: ComponentType
  terminals: Record<string, NodeId>  // e.g. { n1: "NET_R5L", n2: "NET_R6L" }
  params: ComponentParams
}

export interface SerializedNetlist {
  /** All non-ground nodes. Ground ("GND") is implicit — do not include it here. */
  nodes: NodeId[]
  components: SerializedComponent[]
}

// ── Circuit Worker Protocol ──────────────────────────────────────────────────

export type CircuitCommand =
  | { type: "setNetlist"; netlist: SerializedNetlist }
  | { type: "setPinVoltage"; nodeId: NodeId; voltage: number }
  | { type: "start" }
  | { type: "stop" }
  | { type: "reset" }

export type CircuitEvent =
  | { type: "ready" }
  | { type: "tick"
      nodeVoltages: Record<NodeId, number>
      faults: ComponentFault[]
      brightnessMap: Record<ComponentId, number>  // 0–1
    }
  | { type: "error"; message: string }

// ── Constants ────────────────────────────────────────────────────────────────

export const GND: NodeId = "GND"
export const VCC: NodeId = "VCC"
export const VCC_VOLTAGE = 5.0  // V
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "circuit/types" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/circuit/types.ts
git commit -m "feat(circuit): add circuit types — NodeId, ComponentFault, SerializedNetlist, worker protocol"
```

---

## Task 2: Dense Matrix Utilities

**Files:**
- Create: `lib/circuit/solver/matrix.ts`
- Create: `lib/circuit/__tests__/matrix.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/circuit/__tests__/matrix.test.ts
import { describe, it, expect } from "vitest"
import { createMatrix, createVector, luFactorize, luSolve } from "../solver/matrix"

describe("createMatrix", () => {
  it("creates n×n zero matrix", () => {
    const M = createMatrix(3)
    expect(M.length).toBe(3)
    expect(M[0].length).toBe(3)
    expect(M[1][2]).toBe(0)
  })
})

describe("luFactorize + luSolve", () => {
  it("solves 2×2 system: 2x + y = 5, x + 3y = 10", () => {
    // [2  1] [x]   [5]
    // [1  3] [y] = [10]
    // Solution: x=1, y=3
    const A = [[2, 1], [1, 3]]
    const b = [5, 10]
    const piv = luFactorize(A, 2)
    const x = luSolve(A, piv, b)
    expect(x[0]).toBeCloseTo(1, 8)
    expect(x[1]).toBeCloseTo(3, 8)
  })

  it("solves 3×3 system", () => {
    // x + y + z = 6
    // 2y + 5z = -4
    // 2x + 5y - z = 27
    // Solution: x=5, y=3, z=-2
    const A = [[1,1,1],[0,2,5],[2,5,-1]]
    const b = [6, -4, 27]
    const piv = luFactorize(A, 3)
    const x = luSolve(A, piv, b)
    expect(x[0]).toBeCloseTo(5, 8)
    expect(x[1]).toBeCloseTo(3, 8)
    expect(x[2]).toBeCloseTo(-2, 8)
  })

  it("handles pivot swap (needs partial pivoting)", () => {
    // Matrix where first pivot is 0 without swapping
    const A = [[0, 1], [1, 0]]
    const b = [3, 7]
    const piv = luFactorize(A, 2)
    const x = luSolve(A, piv, b)
    expect(x[0]).toBeCloseTo(7, 8)
    expect(x[1]).toBeCloseTo(3, 8)
  })

  it("throws on singular matrix", () => {
    const A = [[1, 2], [2, 4]]  // rows are linearly dependent
    expect(() => luFactorize(A, 2)).toThrow("Singular")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/matrix.test.ts 2>&1 | tail -10
```

Expected: FAIL (cannot find module `../solver/matrix`).

- [ ] **Step 3: Implement `lib/circuit/solver/matrix.ts`**

```typescript
// lib/circuit/solver/matrix.ts

/** Creates n×n matrix of zeros */
export function createMatrix(n: number): number[][] {
  return Array.from({ length: n }, () => new Array(n).fill(0))
}

/** Creates n-element vector of zeros */
export function createVector(n: number): number[] {
  return new Array(n).fill(0)
}

/**
 * In-place LU factorization with partial pivoting (Doolittle).
 * A is modified in place: L occupies below-diagonal, U occupies diagonal+above.
 * L has implicit unit diagonal (1s not stored).
 * Returns pivot permutation array piv where piv[i] = original row index now at row i.
 * Throws if matrix is singular (|pivot| < 1e-12).
 */
export function luFactorize(A: number[][], n: number): number[] {
  const piv = Array.from({ length: n }, (_, i) => i)

  for (let k = 0; k < n; k++) {
    // Partial pivot: find row with largest |A[i][k]| for i >= k
    let maxVal = Math.abs(A[k][k])
    let maxRow = k
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(A[i][k]) > maxVal) {
        maxVal = Math.abs(A[i][k])
        maxRow = i
      }
    }

    if (maxRow !== k) {
      ;[A[k], A[maxRow]] = [A[maxRow], A[k]]
      ;[piv[k], piv[maxRow]] = [piv[maxRow], piv[k]]
    }

    if (Math.abs(A[k][k]) < 1e-12) {
      throw new Error(`Singular matrix at pivot ${k} — check circuit for open nets or short circuits`)
    }

    for (let i = k + 1; i < n; i++) {
      A[i][k] /= A[k][k]                  // store L multiplier
      for (let j = k + 1; j < n; j++) {
        A[i][j] -= A[i][k] * A[k][j]      // eliminate
      }
    }
  }

  return piv
}

/**
 * Solve LUx = Pb using the factored A (from luFactorize) and pivot array.
 * b is not modified. Returns solution vector x.
 */
export function luSolve(LU: number[][], piv: number[], b: number[]): number[] {
  const n = b.length
  const x = piv.map(i => b[i])  // apply row permutation to b

  // Forward substitution: Ly = Pb  (L has unit diagonal — skip it)
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      x[i] -= LU[i][j] * x[j]
    }
  }

  // Back substitution: Ux = y
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) {
      x[i] -= LU[i][j] * x[j]
    }
    x[i] /= LU[i][i]
  }

  return x
}
```

- [ ] **Step 4: Run tests**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/matrix.test.ts 2>&1 | tail -10
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/circuit/solver/matrix.ts lib/circuit/__tests__/matrix.test.ts
git commit -m "feat(circuit): add dense matrix LU factorize and solve with partial pivoting"
```

---

## Task 3: MNA Solver

**Files:**
- Create: `lib/circuit/solver/mna-solver.ts`
- Create: `lib/circuit/__tests__/mna-solver.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/circuit/__tests__/mna-solver.test.ts
import { describe, it, expect } from "vitest"
import { MNASolver } from "../solver/mna-solver"
import { createMatrix, createVector } from "../solver/matrix"

describe("MNASolver — voltage divider", () => {
  it("5V → 1kΩ → 1kΩ → GND gives Vmid = 2.5V", () => {
    // Nodes: "VCC" (5V fixed), "MID" (unknown)
    // Voltage sources: vs_vcc (VCC to GND = 5V)
    // Resistors: R1 (VCC→MID, 1000Ω), R2 (MID→GND, 1000Ω)
    const solver = new MNASolver()
    solver.setup(["VCC", "MID"], ["vs_vcc"])

    const G = createMatrix(solver.size)
    const b = createVector(solver.size)

    // Stamp voltage source: VCC = 5V (VCC node, minus = GND, source index 0)
    solver.stampV(G, b, "VCC", "GND", "vs_vcc", 5.0)
    // Stamp R1 = 1kΩ between VCC and MID
    solver.stampG(G, "VCC", "MID", 1 / 1000)
    // Stamp R2 = 1kΩ between MID and GND
    solver.stampG(G, "MID", "GND", 1 / 1000)

    const x = solver.solve(G, b)

    expect(solver.voltage(x, "VCC")).toBeCloseTo(5.0, 6)
    expect(solver.voltage(x, "MID")).toBeCloseTo(2.5, 6)
    // Branch current through vs_vcc: 5V / (1kΩ + 1kΩ) = 2.5mA
    expect(solver.current(x, "vs_vcc")).toBeCloseTo(0.0025, 6)
  })
})

describe("MNASolver — single resistor", () => {
  it("5V → 100Ω → GND gives I = 50mA", () => {
    const solver = new MNASolver()
    solver.setup(["VCC"], ["vs_vcc"])

    const G = createMatrix(solver.size)
    const b = createVector(solver.size)

    solver.stampV(G, b, "VCC", "GND", "vs_vcc", 5.0)
    solver.stampG(G, "VCC", "GND", 1 / 100)

    const x = solver.solve(G, b)

    expect(solver.voltage(x, "VCC")).toBeCloseTo(5.0, 6)
    expect(solver.current(x, "vs_vcc")).toBeCloseTo(0.05, 6)
  })
})

describe("MNASolver — stampI", () => {
  it("1mA current source into 1kΩ to GND gives V = 1V", () => {
    const solver = new MNASolver()
    solver.setup(["NET1"], [])

    const G = createMatrix(solver.size)
    const b = createVector(solver.size)

    // Current source: 1mA flowing into NET1 (from GND to NET1 externally)
    solver.stampI(b, "GND", "NET1", 0.001)
    // Resistor: NET1 to GND, 1kΩ
    solver.stampG(G, "NET1", "GND", 1 / 1000)

    const x = solver.solve(G, b)
    expect(solver.voltage(x, "NET1")).toBeCloseTo(1.0, 6)
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/mna-solver.test.ts 2>&1 | tail -5
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/circuit/solver/mna-solver.ts`**

```typescript
// lib/circuit/solver/mna-solver.ts

import { luFactorize, luSolve } from "./matrix"
import type { NodeId } from "../types"

export type VSourceId = string

/**
 * Assembles and solves the MNA system Gx = b.
 *
 * Node voltages occupy indices 0..n-1 in the solution.
 * Voltage source branch currents occupy indices n..n+m-1.
 * Ground ("GND") is never in the unknowns — its voltage is 0 by definition.
 *
 * Usage:
 *   1. solver.setup(nonGroundNodeIds, voltageSourceIds)
 *   2. For each circuit solve:
 *        const G = createMatrix(solver.size), b = createVector(solver.size)
 *        solver.stampG(G, ...) / stampV(G, b, ...) / stampI(b, ...)
 *        const x = solver.solve(G, b)
 *        solver.voltage(x, nodeId) / solver.current(x, vsId)
 */
export class MNASolver {
  private n = 0   // number of non-ground nodes
  private m = 0   // number of voltage source branches
  private nodeMap = new Map<NodeId, number>()    // nodeId → row/col index 0..n-1
  private vsMap   = new Map<VSourceId, number>() // vsId   → branch index 0..m-1

  /**
   * Set up indexing. Must be called before any stamp/solve.
   * groundId ("GND") must NOT be in nodeIds.
   */
  setup(nodeIds: NodeId[], voltageSourceIds: VSourceId[]): void {
    this.n = nodeIds.length
    this.m = voltageSourceIds.length
    this.nodeMap = new Map(nodeIds.map((id, i) => [id, i]))
    this.vsMap   = new Map(voltageSourceIds.map((id, i) => [id, i]))
  }

  /** Total matrix dimension: n (node voltages) + m (branch currents) */
  get size(): number { return this.n + this.m }

  /** Matrix index for a node, or -1 if it is ground (not in unknowns) */
  ni(nodeId: NodeId): number { return this.nodeMap.get(nodeId) ?? -1 }

  /** Matrix index for a voltage source branch (offset by n) */
  vi(vsId: VSourceId): number {
    const i = this.vsMap.get(vsId)
    return i !== undefined ? this.n + i : -1
  }

  /**
   * Stamp a conductance g (= 1/R) between nodes n1 and n2.
   * Either node may be "GND" (skip that row/col).
   */
  stampG(G: number[][], n1: NodeId, n2: NodeId, g: number): void {
    const i1 = this.ni(n1), i2 = this.ni(n2)
    if (i1 >= 0) G[i1][i1] += g
    if (i2 >= 0) G[i2][i2] += g
    if (i1 >= 0 && i2 >= 0) { G[i1][i2] -= g; G[i2][i1] -= g }
  }

  /**
   * Stamp a current source I flowing from srcNode to dstNode (conventional current
   * enters dstNode from the external source).
   */
  stampI(b: number[], srcNode: NodeId, dstNode: NodeId, I: number): void {
    const is = this.ni(srcNode), id = this.ni(dstNode)
    if (is >= 0) b[is] -= I
    if (id >= 0) b[id] += I
  }

  /**
   * Stamp a voltage source V volts from nPlus to nMinus, with branch current
   * tracked under vsId. The branch current flows from nMinus through the source
   * to nPlus (into nPlus).
   */
  stampV(
    G: number[][],
    b: number[],
    nPlus: NodeId,
    nMinus: NodeId,
    vsId: VSourceId,
    V: number
  ): void {
    const ip = this.ni(nPlus), im = this.ni(nMinus), k = this.vi(vsId)
    if (k < 0) return
    if (ip >= 0) { G[ip][k] += 1; G[k][ip] += 1 }
    if (im >= 0) { G[im][k] -= 1; G[k][im] -= 1 }
    b[k] = V
  }

  /**
   * Solve Gx = b. Makes a copy of G for factorization (G is preserved).
   * Returns solution vector x = [V1..Vn, I1..Im].
   * Throws if circuit is singular (disconnected node, short circuit).
   */
  solve(G: number[][], b: number[]): number[] {
    if (this.size === 0) return []
    const LU = G.map(row => [...row])   // copy before in-place factorization
    const piv = luFactorize(LU, this.size)
    return luSolve(LU, piv, b)
  }

  /** Extract a node voltage from the solution vector (0 for GND) */
  voltage(solution: number[], nodeId: NodeId): number {
    const i = this.ni(nodeId)
    return i >= 0 ? (solution[i] ?? 0) : 0
  }

  /** Extract a branch current from the solution vector */
  current(solution: number[], vsId: VSourceId): number {
    const i = this.vi(vsId)
    return i >= 0 ? (solution[i] ?? 0) : 0
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/mna-solver.test.ts 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/circuit/solver/mna-solver.ts lib/circuit/__tests__/mna-solver.test.ts
git commit -m "feat(circuit): add MNA solver with conductance/voltage/current stamping and LU solve"
```

---

## Task 4: Newton-Raphson Iteration

**Files:**
- Create: `lib/circuit/solver/newton-raphson.ts`

No separate test file needed — NR is tested implicitly via the LED tests in Task 7.

- [ ] **Step 1: Create `lib/circuit/solver/newton-raphson.ts`**

```typescript
// lib/circuit/solver/newton-raphson.ts
//
// Newton-Raphson loop for circuits with nonlinear components (LEDs, diodes).
// Linear components stamp once; nonlinear components re-stamp each iteration
// with a linearized model at the current operating point.

import { createMatrix, createVector } from "./matrix"
import { MNASolver } from "./mna-solver"

export interface LinearComponent {
  stamp(G: number[][], b: number[], solver: MNASolver): void
}

export interface NonlinearComponent {
  /** Stamp linearized Norton equivalent at current operating point */
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void
  /**
   * Update operating point from new solution.
   * Returns true if the component's state changed by more than tolerance
   * (used to detect whether another NR iteration is needed).
   */
  updateOperatingPoint(solution: number[], solver: MNASolver): boolean
}

/**
 * Run Newton-Raphson until convergence or maxIter.
 * Returns final solution vector [V1..Vn, I1..Im].
 *
 * Convergence criterion: all node voltage changes < tol AND
 * no nonlinear component reports a state change.
 */
export function newtonRaphson(
  solver: MNASolver,
  linear: LinearComponent[],
  nonlinear: NonlinearComponent[],
  maxIter = 50,
  tol = 1e-6
): number[] {
  if (solver.size === 0) return []

  let solution = createVector(solver.size)

  for (let iter = 0; iter < maxIter; iter++) {
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)

    for (const comp of linear)    comp.stamp(G, b, solver)
    for (const comp of nonlinear) comp.stampLinearized(G, b, solver)

    let newSolution: number[]
    try {
      newSolution = solver.solve(G, b)
    } catch {
      // Singular matrix — circuit is disconnected or shorted; return last good solution
      break
    }

    // Check node voltage convergence (ignore branch current rows)
    let voltageConverged = true
    for (let i = 0; i < solver["n"]; i++) {
      if (Math.abs((newSolution[i] ?? 0) - (solution[i] ?? 0)) > tol) {
        voltageConverged = false
        break
      }
    }

    solution = newSolution

    // Update nonlinear operating points; check if any changed
    let anyChanged = false
    for (const comp of nonlinear) {
      if (comp.updateOperatingPoint(solution, solver)) anyChanged = true
    }

    if (voltageConverged && !anyChanged) break
  }

  return solution
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "newton-raphson" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/circuit/solver/newton-raphson.ts
git commit -m "feat(circuit): add Newton-Raphson iteration loop for nonlinear circuit components"
```

---

## Task 5: Resistor + Base Component Interface

**Files:**
- Create: `lib/circuit/components/base-component.ts`
- Create: `lib/circuit/components/resistor.ts`

- [ ] **Step 1: Create `lib/circuit/components/base-component.ts`**

```typescript
// lib/circuit/components/base-component.ts

import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId } from "../types"

/** Marker interface for all circuit components */
export interface CircuitComponent {
  readonly id: ComponentId
  /** Stamp this component into G and b matrices */
  stamp(G: number[][], b: number[], solver: MNASolver): void
  /** Return current fault state (null = healthy) */
  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null
  /** Luminous brightness 0–1 (only meaningful for LEDs; 0 for others) */
  readonly brightness: number
}

/** Components that participate in Newton-Raphson iteration */
export interface NonlinearCircuitComponent extends CircuitComponent {
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void
  updateOperatingPoint(solution: number[], solver: MNASolver): boolean
}

export function isNonlinear(c: CircuitComponent): c is NonlinearCircuitComponent {
  return "stampLinearized" in c && "updateOperatingPoint" in c
}
```

- [ ] **Step 2: Create `lib/circuit/components/resistor.ts`**

```typescript
// lib/circuit/components/resistor.ts

import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

const MAX_POWER_W = 0.25  // 1/4W resistor (standard)

export class Resistor implements CircuitComponent {
  readonly brightness = 0

  constructor(
    readonly id: ComponentId,
    private n1: NodeId,
    private n2: NodeId,
    private R: number   // Ω — must be > 0
  ) {
    if (R <= 0) throw new Error(`Resistor ${id}: resistance must be positive, got ${R}`)
  }

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    solver.stampG(G, this.n1, this.n2, 1 / this.R)
  }

  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null {
    const V1 = solver.voltage(solution, this.n1)
    const V2 = solver.voltage(solution, this.n2)
    const Vr = V1 - V2
    const P = (Vr * Vr) / this.R
    if (P > MAX_POWER_W * 2) {
      return {
        severity: "damage",
        componentId: this.id,
        message: "Resistor overloaded",
        technical: `Power dissipation ${(P * 1000).toFixed(0)}mW exceeds 1/4W (250mW) rating`,
        suggestion: "Use a higher-wattage resistor or increase the resistance value"
      }
    }
    return null
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep -E "resistor|base-component" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/circuit/components/base-component.ts lib/circuit/components/resistor.ts
git commit -m "feat(circuit): add CircuitComponent interface and Resistor linear stamp"
```

---

## Task 6: Voltage Source Component

**Files:**
- Create: `lib/circuit/components/voltage-source.ts`

This is used for VCC (5V supply), GND (0V reference), and Arduino output pins (variable 0/5V).

- [ ] **Step 1: Create `lib/circuit/components/voltage-source.ts`**

```typescript
// lib/circuit/components/voltage-source.ts

import type { MNASolver, VSourceId } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

export class VoltageSource implements CircuitComponent {
  readonly brightness = 0
  private vsId: VSourceId

  constructor(
    readonly id: ComponentId,
    private nPlus: NodeId,   // positive terminal node
    private nMinus: NodeId,  // negative terminal node (often "GND")
    public voltage: number   // V — mutable for Arduino pin updates
  ) {
    // Voltage source branch ID is the same as the component ID
    this.vsId = id
  }

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    solver.stampV(G, b, this.nPlus, this.nMinus, this.vsId, this.voltage)
  }

  getFaultState(_solution: number[], _solver: MNASolver): ComponentFault | null {
    return null  // voltage sources don't fault in Phase 2
  }

  /** Returns the voltage source ID used for MNASolver setup */
  get voltageSourceId(): VSourceId { return this.vsId }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "voltage-source" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/circuit/components/voltage-source.ts
git commit -m "feat(circuit): add VoltageSource component — stamps branch current augmentation into MNA"
```

---

## Task 7: LED Component with Fault Model

**Files:**
- Create: `lib/circuit/components/led.ts`
- Create: `lib/circuit/__tests__/led.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/circuit/__tests__/led.test.ts
import { describe, it, expect } from "vitest"
import { LED } from "../components/led"
import { Resistor } from "../components/resistor"
import { VoltageSource } from "../components/voltage-source"
import { MNASolver } from "../solver/mna-solver"
import { newtonRaphson } from "../solver/newton-raphson"
import { isNonlinear } from "../components/base-component"

function solveLEDCircuit(supplyV: number, seriesR: number) {
  // Circuit: VCC → Resistor(seriesR) → LED → GND
  // Nodes: "VCC", "ANODE"  (cathode = GND = not in unknowns)
  const vs = new VoltageSource("vs_vcc", "VCC", "GND", supplyV)
  const r  = new Resistor("r1", "VCC", "ANODE", seriesR)
  const led = new LED("led1", "ANODE", "GND", "red")

  const solver = new MNASolver()
  solver.setup(["VCC", "ANODE"], [vs.voltageSourceId])

  const linear    = [vs, r]
  const nonlinear = [led]

  const solution = newtonRaphson(solver, linear, nonlinear)

  return {
    Vanode: solver.voltage(solution, "ANODE"),
    Ivcc:   solver.current(solution, vs.voltageSourceId),
    led,
    solver,
    solution,
  }
}

describe("LED forward bias — 5V, 220Ω", () => {
  it("converges to forward current ~20mA", () => {
    const { Ivcc } = solveLEDCircuit(5.0, 220)
    // Expected: I ≈ (5V - ~2.4V) / 220Ω ≈ 12mA (Vf ≈ 2.4V at 12mA)
    expect(Math.abs(Ivcc)).toBeGreaterThan(0.005)    // at least 5mA
    expect(Math.abs(Ivcc)).toBeLessThan(0.03)         // at most 30mA
  })

  it("LED anode voltage is between 1.5V and 3.5V (forward bias range)", () => {
    const { Vanode } = solveLEDCircuit(5.0, 220)
    expect(Vanode).toBeGreaterThan(1.5)
    expect(Vanode).toBeLessThan(3.5)
  })

  it("brightness is between 0.1 and 1.0", () => {
    const { led } = solveLEDCircuit(5.0, 220)
    expect(led.brightness).toBeGreaterThan(0.1)
    expect(led.brightness).toBeLessThanOrEqual(1.0)
  })

  it("no fault at 220Ω (safe current)", () => {
    const { led, solution, solver } = solveLEDCircuit(5.0, 220)
    const fault = led.getFaultState(solution, solver)
    expect(fault).toBeNull()
  })
})

describe("LED fault — direct connection (no resistor)", () => {
  it("reports damage fault when current exceeds 20mA", () => {
    // 5V directly to LED (1Ω tiny resistance to avoid singular matrix)
    const { led, solution, solver } = solveLEDCircuit(5.0, 1)
    const fault = led.getFaultState(solution, solver)
    expect(fault).not.toBeNull()
    expect(fault!.severity).toMatch(/damage|destroyed/)
    expect(fault!.suggestion).toContain("resistor")
  })
})

describe("LED reverse bias", () => {
  it("passes negligible reverse current (< 1µA)", () => {
    // Polarity reversed: anode at 0V, cathode at 5V — supply is reversed
    const vs = new VoltageSource("vs_vcc", "CATHODE", "GND", 5.0)
    const r  = new Resistor("r1", "CATHODE", "ANODE", 220)
    const led = new LED("led1", "ANODE", "GND", "red")

    const solver = new MNASolver()
    solver.setup(["CATHODE", "ANODE"], [vs.voltageSourceId])

    const solution = newtonRaphson(solver, [vs, r], [led])
    const Ivcc = solver.current(solution, vs.voltageSourceId)
    // Reverse current should be essentially 0 (only Is ≈ 1e-20 A)
    expect(Math.abs(Ivcc)).toBeLessThan(1e-6)
  })
})

describe("LED isNonlinear type guard", () => {
  it("LED implements NonlinearCircuitComponent", () => {
    const led = new LED("l", "A", "GND", "red")
    expect(isNonlinear(led)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/led.test.ts 2>&1 | tail -5
```

Expected: FAIL (cannot find module `../components/led`).

- [ ] **Step 3: Create `lib/circuit/components/led.ts`**

```typescript
// lib/circuit/components/led.ts

import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent, NonlinearCircuitComponent } from "./base-component"

// Shockley diode parameters tuned for educational LED behavior
// Is=1e-20 A, n=2.0 → Vf ≈ 2.0V at 1mA, ≈ 2.4V at 20mA (realistic for red LED)
const Is = 1e-20         // saturation current (A)
const N  = 2.0           // ideality factor
const Vt = 0.02585       // thermal voltage at 25°C (V)
const Rs = 10            // series lead resistance (Ω)
const Imax = 0.020       // 20mA absolute maximum forward current

// Clamp voltage step per NR iteration to prevent exp() overflow
const MAX_VD_STEP = 0.5  // V

export type LEDColor = "red" | "green" | "blue" | "white" | "yellow"

export class LED implements NonlinearCircuitComponent {
  // Current Newton-Raphson operating point
  private Vd = 0.0   // voltage across diode (V)
  private Id = 0.0   // diode current (A)
  private _burned = false

  constructor(
    readonly id: ComponentId,
    private anodeNode: NodeId,
    private cathodeNode: NodeId,
    readonly color: LEDColor = "red"
  ) {}

  /** Stamp linearized Norton equivalent of diode + series Rs */
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void {
    // Series resistance (always linear)
    solver.stampG(G, this.anodeNode, this.cathodeNode, 1 / Rs)

    // Shockley linearized at operating point (Vd, Id):
    // Geq = dI/dV = Is * exp(Vd/(N*Vt)) / (N*Vt)  — clamped to prevent overflow
    const expArg  = Math.min(this.Vd / (N * Vt), 34)   // exp(34) ≈ 5.8e14 — safe
    const expTerm = Math.exp(expArg)
    const Geq = Is * expTerm / (N * Vt)
    const Ieq = this.Id - Geq * this.Vd   // Norton equivalent current source

    solver.stampG(G, this.anodeNode, this.cathodeNode, Geq)
    // Norton current source: Ieq flows from anode to cathode through the external path
    solver.stampI(b, this.anodeNode, this.cathodeNode, Ieq)
  }

  // Linear stamp delegates to linearized (LED is always nonlinear)
  stamp(G: number[][], b: number[], solver: MNASolver): void {
    this.stampLinearized(G, b, solver)
  }

  updateOperatingPoint(solution: number[], solver: MNASolver): boolean {
    const Va = solver.voltage(solution, this.anodeNode)
    const Vc = solver.voltage(solution, this.cathodeNode)

    // Total voltage across the component (diode + Rs in series)
    // Approximate: Vd ≈ Va - Vc - Id * Rs, but for convergence use Va - Vc as proxy
    const Vtotal = Va - Vc

    // Damped update: limit step to MAX_VD_STEP per iteration
    const rawDelta = Vtotal - this.Vd
    const delta = Math.max(-MAX_VD_STEP, Math.min(MAX_VD_STEP, rawDelta))
    const Vd_new = this.Vd + delta

    const Id_new = Is * (Math.exp(Math.min(Vd_new / (N * Vt), 34)) - 1)
    const changed = Math.abs(delta) > 1e-6

    this.Vd = Vd_new
    this.Id = Id_new

    return changed
  }

  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null {
    if (this.Id > Imax * 1.1) {
      this._burned = true
      return {
        severity: this.Id > Imax * 3 ? "destroyed" : "damage",
        componentId: this.id,
        message: this.Id > Imax * 3 ? "LED has burned out!" : "LED is overloaded",
        technical: `Forward current ${(this.Id * 1000).toFixed(1)}mA exceeds maximum ${(Imax * 1000).toFixed(0)}mA`,
        suggestion: "Add a current-limiting resistor (220Ω is a safe choice) in series with the LED anode"
      }
    }
    if (this.Id > 0 && this.Id < 0.0005 && this.Vd > 0.5) {
      return {
        severity: "warning",
        componentId: this.id,
        message: "LED is barely lit",
        technical: `Forward current ${(this.Id * 1000).toFixed(2)}mA is very low`,
        suggestion: "Reduce the series resistor to increase brightness"
      }
    }
    return null
  }

  /** Normalised brightness 0–1 (for canvas glow rendering) */
  get brightness(): number {
    return this._burned ? 0 : Math.min(1, Math.max(0, this.Id / Imax))
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/led.test.ts 2>&1 | tail -15
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/circuit/components/led.ts lib/circuit/__tests__/led.test.ts
git commit -m "feat(circuit): add LED Shockley diode with Newton-Raphson linearization and fault detection"
```

---

## Task 8: Circuit Web Worker

**Files:**
- Create: `workers/circuit-worker.ts`

The worker:
1. Receives `setNetlist` → builds component objects; sets up MNASolver and tracks voltage sources
2. Receives `setPinVoltage` → updates the target VoltageSource voltage
3. On `start` → runs `setInterval(tick, 1)` at 1kHz
4. Each tick → calls `newtonRaphson` → posts `tick` event with voltages + faults + brightness map

- [ ] **Step 1: Create `workers/circuit-worker.ts`**

```typescript
// workers/circuit-worker.ts
// Circuit simulation Web Worker — runs MNA at ~1kHz

import { MNASolver } from "@/lib/circuit/solver/mna-solver"
import { newtonRaphson } from "@/lib/circuit/solver/newton-raphson"
import { Resistor } from "@/lib/circuit/components/resistor"
import { VoltageSource } from "@/lib/circuit/components/voltage-source"
import { LED } from "@/lib/circuit/components/led"
import { isNonlinear } from "@/lib/circuit/components/base-component"
import type {
  CircuitCommand, CircuitEvent, SerializedNetlist, SerializedComponent,
  ComponentFault, NodeId, GND as GND_CONST
} from "@/lib/circuit/types"
import { GND, VCC, VCC_VOLTAGE } from "@/lib/circuit/types"
import type { LinearComponent, NonlinearComponent } from "@/lib/circuit/solver/newton-raphson"
import type { CircuitComponent } from "@/lib/circuit/components/base-component"

function post(event: CircuitEvent) {
  self.postMessage(event)
}

// ── State ────────────────────────────────────────────────────────────────────

let solver = new MNASolver()
let linearComponents:    LinearComponent[]    = []
let nonlinearComponents: NonlinearComponent[] = []
let allComponents:       CircuitComponent[]   = []
// Map nodeId → VoltageSource for nodes that are externally driven (Arduino pins, VCC)
let controlledSources = new Map<NodeId, VoltageSource>()
let tickTimer: ReturnType<typeof setInterval> | null = null

// ── Netlist compilation ──────────────────────────────────────────────────────

function buildFromNetlist(netlist: SerializedNetlist): void {
  allComponents = []
  linearComponents = []
  nonlinearComponents = []
  controlledSources = new Map()

  // Always add VCC voltage source (5V supply)
  const vccSource = new VoltageSource("__vs_VCC", VCC, GND, VCC_VOLTAGE)
  allComponents.push(vccSource)
  linearComponents.push(vccSource)
  controlledSources.set(VCC, vccSource)

  // Collect all voltage source IDs (VCC + user voltage sources in netlist)
  const vsourceIds: string[] = [vccSource.voltageSourceId]

  // First pass: identify voltage sources so we can size the solver
  for (const sc of netlist.components) {
    if (sc.type === "voltage-source") vsourceIds.push(sc.id)
  }

  // Setup solver with nodes from netlist + VCC, excluding GND
  const nodeIds = [VCC, ...netlist.nodes.filter(n => n !== GND && n !== VCC)]
  solver = new MNASolver()
  solver.setup(nodeIds, vsourceIds)

  // Second pass: build components
  for (const sc of netlist.components) {
    const comp = buildComponent(sc)
    if (!comp) continue
    allComponents.push(comp)
    if (isNonlinear(comp)) {
      nonlinearComponents.push(comp)
    } else {
      linearComponents.push(comp)
    }
  }
}

function buildComponent(sc: SerializedComponent): CircuitComponent | null {
  switch (sc.type) {
    case "resistor": {
      const R = sc.params.resistance
      if (!R || R <= 0) return null
      return new Resistor(sc.id, sc.terminals.n1, sc.terminals.n2, R)
    }
    case "led": {
      return new LED(sc.id, sc.terminals.anode, sc.terminals.cathode, sc.params.color ?? "red")
    }
    case "voltage-source": {
      const V = sc.params.voltage ?? 0
      const vs = new VoltageSource(sc.id, sc.terminals.plus, sc.terminals.minus, V)
      controlledSources.set(sc.terminals.plus, vs)
      linearComponents.push(vs)
      return vs
    }
    default:
      return null
  }
}

// ── Tick ─────────────────────────────────────────────────────────────────────

function tick(): void {
  if (solver.size === 0) return

  const solution = newtonRaphson(solver, linearComponents, nonlinearComponents)

  const nodeVoltages: Record<NodeId, number> = {}
  // Extract all node voltages
  for (const nodeId of Object.keys(solver["nodeMap" as keyof typeof solver] as Map<string,number>)) {
    nodeVoltages[nodeId] = solver.voltage(solution, nodeId)
  }
  nodeVoltages[GND] = 0

  const faults: ComponentFault[] = []
  const brightnessMap: Record<string, number> = {}

  for (const comp of allComponents) {
    const fault = comp.getFaultState(solution, solver)
    if (fault) faults.push(fault)
    if (comp.brightness > 0) brightnessMap[comp.id] = comp.brightness
  }

  post({ type: "tick", nodeVoltages, faults, brightnessMap })
}

// ── Message handler ──────────────────────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent<CircuitCommand>) => {
  const cmd = e.data
  switch (cmd.type) {
    case "setNetlist":
      buildFromNetlist(cmd.netlist)
      break
    case "setPinVoltage": {
      const vs = controlledSources.get(cmd.nodeId)
      if (vs) vs.voltage = cmd.voltage
      break
    }
    case "start":
      if (!tickTimer) tickTimer = setInterval(tick, 1)
      break
    case "stop":
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
      break
    case "reset":
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
      buildFromNetlist({ nodes: [], components: [] })
      break
  }
})

post({ type: "ready" })
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "circuit-worker" | head -10
```

Expected: no errors (or only pre-existing issues in other files).

- [ ] **Step 3: Commit**

```bash
git add workers/circuit-worker.ts
git commit -m "feat(circuit): add circuit Web Worker running MNA at 1kHz with component registry"
```

---

## Task 9: Circuit Bridge

**Files:**
- Create: `lib/circuit/circuit-bridge.ts`

The bridge runs on the **main thread** only. It:
1. Receives AVR `pinChange` events → converts to `setPinVoltage` for the circuit worker
2. Receives circuit worker `tick` events → converts node voltages to ADC values → sends to AVR worker

- [ ] **Step 1: Create `lib/circuit/circuit-bridge.ts`**

```typescript
// lib/circuit/circuit-bridge.ts
// Main-thread message router: connects avr-worker ↔ circuit-worker.
// Holds no simulation state — only translates and forwards messages.

import type { AVRCommand, AVREvent } from "@/lib/avr/types"
import type { CircuitCommand, CircuitEvent, NodeId, ComponentFault } from "./types"
import { GND } from "./types"

export interface PinNodeMap {
  /** Maps Arduino digital pin number → circuit node ID */
  digitalPins: Map<number, NodeId>
  /** Maps Arduino analog pin number (0=A0..5=A5) → circuit node ID to read voltage from */
  analogPins: Map<number, NodeId>
}

export interface CircuitBridgeOptions {
  avrWorker: Worker
  circuitWorker: Worker
  pinNodeMap: PinNodeMap
  onFault?: (faults: ComponentFault[]) => void
  onBrightnessUpdate?: (brightnessMap: Record<string, number>) => void
  onNodeVoltages?: (voltages: Record<NodeId, number>) => void
}

export class CircuitBridge {
  private avrWorker: Worker
  private circuitWorker: Worker
  private pinNodeMap: PinNodeMap
  private onFault?: (faults: ComponentFault[]) => void
  private onBrightnessUpdate?: (brightnessMap: Record<string, number>) => void
  private onNodeVoltages?: (voltages: Record<NodeId, number>) => void

  constructor(options: CircuitBridgeOptions) {
    this.avrWorker = options.avrWorker
    this.circuitWorker = options.circuitWorker
    this.pinNodeMap = options.pinNodeMap
    this.onFault = options.onFault
    this.onBrightnessUpdate = options.onBrightnessUpdate
    this.onNodeVoltages = options.onNodeVoltages
  }

  /** Call this from the AVR worker message handler for pin-related events */
  handleAVREvent(event: AVREvent): void {
    if (event.type !== "pinChange") return

    const { pin, high, isPWM, dutyCycle } = event
    const nodeId = this.pinNodeMap.digitalPins.get(pin)
    if (!nodeId) return

    // Phase 2: use averaged DC voltage for PWM (correct for resistive loads like LEDs)
    const voltage = isPWM ? (dutyCycle / 255) * 5.0 : (high ? 5.0 : 0.0)

    const cmd: CircuitCommand = { type: "setPinVoltage", nodeId, voltage }
    this.circuitWorker.postMessage(cmd)
  }

  /** Call this from the circuit worker message handler */
  handleCircuitEvent(event: CircuitEvent): void {
    if (event.type !== "tick") return

    const { nodeVoltages, faults, brightnessMap } = event

    // Route node voltages → ADC register values in AVR worker
    for (const [analogChannel, nodeId] of this.pinNodeMap.analogPins) {
      const V = nodeVoltages[nodeId] ?? 0
      const adcValue = Math.max(0, Math.min(1023, Math.round((V / 5.0) * 1023)))
      const cmd: AVRCommand = { type: "setADCInput", pin: analogChannel, value: adcValue }
      this.avrWorker.postMessage(cmd)
    }

    if (faults.length > 0) this.onFault?.(faults)
    if (Object.keys(brightnessMap).length > 0) this.onBrightnessUpdate?.(brightnessMap)
    this.onNodeVoltages?.(nodeVoltages)
  }

  /** Send a new netlist to the circuit worker */
  sendNetlist(netlist: import("./types").SerializedNetlist): void {
    const cmd: CircuitCommand = { type: "setNetlist", netlist }
    this.circuitWorker.postMessage(cmd)
  }

  startCircuit(): void {
    this.circuitWorker.postMessage({ type: "start" } satisfies CircuitCommand)
  }

  stopCircuit(): void {
    this.circuitWorker.postMessage({ type: "stop" } satisfies CircuitCommand)
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep "circuit-bridge" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/circuit/circuit-bridge.ts
git commit -m "feat(circuit): add CircuitBridge — main-thread router for AVR ↔ circuit worker pin/ADC messages"
```

---

## Task 10: Breadboard Layout

**Files:**
- Create: `lib/circuit/breadboard/breadboard-layout.ts`
- Create: `lib/circuit/__tests__/breadboard-layout.test.ts`

The layout encodes which holes are electrically connected (before any user wires are placed).

- [ ] **Step 1: Write failing tests**

```typescript
// lib/circuit/__tests__/breadboard-layout.test.ts
import { describe, it, expect } from "vitest"
import {
  holeNet, ARDUINO_HOLES, BREADBOARD_ROWS, BB_COLS_LEFT, BB_COLS_RIGHT
} from "../breadboard/breadboard-layout"

describe("holeNet — tie-strip connectivity", () => {
  it("same row, left side (a-e) → same net", () => {
    expect(holeNet(5, "a")).toBe(holeNet(5, "e"))
    expect(holeNet(5, "b")).toBe(holeNet(5, "c"))
  })

  it("same row, right side (f-j) → same net", () => {
    expect(holeNet(10, "f")).toBe(holeNet(10, "j"))
  })

  it("left and right sides of same row → DIFFERENT nets", () => {
    expect(holeNet(5, "e")).not.toBe(holeNet(5, "f"))
  })

  it("different rows, same column → DIFFERENT nets", () => {
    expect(holeNet(1, "a")).not.toBe(holeNet(2, "a"))
  })

  it("top power rail + → VCC", () => {
    expect(holeNet(1, "TOP_PLUS")).toBe("VCC")
  })

  it("top power rail − → GND", () => {
    expect(holeNet(1, "TOP_MINUS")).toBe("GND")
  })

  it("bottom power rail + → VCC", () => {
    expect(holeNet(1, "BOT_PLUS")).toBe("VCC")
  })

  it("bottom power rail − → GND", () => {
    expect(holeNet(1, "BOT_MINUS")).toBe("GND")
  })
})

describe("Arduino pin holes", () => {
  it("Arduino D13 has a defined hole position", () => {
    const d13 = ARDUINO_HOLES.get("D13")
    expect(d13).toBeDefined()
    expect(d13!.nodeId).toBe("D13")
  })

  it("Arduino GND hole maps to GND node", () => {
    const gndHole = Array.from(ARDUINO_HOLES.values()).find(h => h.nodeId === "GND")
    expect(gndHole).toBeDefined()
  })

  it("Arduino 5V hole maps to VCC node", () => {
    const vccHole = Array.from(ARDUINO_HOLES.values()).find(h => h.nodeId === "VCC")
    expect(vccHole).toBeDefined()
  })
})

describe("layout constants", () => {
  it("has 63 rows", () => {
    expect(BREADBOARD_ROWS).toBe(63)
  })

  it("left columns are a-e", () => {
    expect(BB_COLS_LEFT).toEqual(["a", "b", "c", "d", "e"])
  })

  it("right columns are f-j", () => {
    expect(BB_COLS_RIGHT).toEqual(["f", "g", "h", "i", "j"])
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/breadboard-layout.test.ts 2>&1 | tail -5
```

Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/circuit/breadboard/breadboard-layout.ts`**

```typescript
// lib/circuit/breadboard/breadboard-layout.ts
// Physical breadboard model: 63-row × 10-column (a-j) + 4 power rails.
// Maps hole coordinates to net IDs (connectivity before user wires).

import type { NodeId } from "../types"
import { GND, VCC } from "../types"

export const BREADBOARD_ROWS = 63
export const BB_COLS_LEFT  = ["a", "b", "c", "d", "e"] as const
export const BB_COLS_RIGHT = ["f", "g", "h", "i", "j"] as const
export type BBColumn = "a"|"b"|"c"|"d"|"e"|"f"|"g"|"h"|"i"|"j"|"TOP_PLUS"|"TOP_MINUS"|"BOT_PLUS"|"BOT_MINUS"

/**
 * Returns the base net ID for a hole position (connectivity from tie-strips only,
 * before any user wires are placed). Wires merge nets via union-find in BreadboardState.
 *
 * left (a-e) → "R{row}L"
 * right (f-j) → "R{row}R"
 * power rails → "VCC" or "GND"
 */
export function holeNet(row: number, col: BBColumn): NodeId {
  switch (col) {
    case "TOP_PLUS":  return VCC
    case "BOT_PLUS":  return VCC
    case "TOP_MINUS": return GND
    case "BOT_MINUS": return GND
    default:
      if ((BB_COLS_LEFT as readonly string[]).includes(col)) return `R${row}L`
      if ((BB_COLS_RIGHT as readonly string[]).includes(col)) return `R${row}R`
      return "FLOATING"
  }
}

/** A special Arduino-pin "hole" rendered next to the breadboard */
export interface ArduinoHole {
  label: string       // "D13", "GND", "5V", etc.
  nodeId: NodeId      // net ID this pin drives/reads
  x: number          // canvas x position (relative to Arduino rect origin)
  y: number          // canvas y position
}

/**
 * Arduino Uno pin holes mapped to their circuit node IDs.
 * Digital output pins get node IDs "D0".."D13".
 * Analog input pins get node IDs "A0".."A5".
 * Power pins map to "VCC" or "GND".
 *
 * Layout: pins on the right edge of the Arduino silhouette, evenly spaced.
 * Y positions are relative to the Arduino rectangle's top-left corner.
 * The Arduino rect is drawn at x=0..ARDUINO_WIDTH in the canvas.
 */
export const ARDUINO_HOLE_PITCH = 14   // px between pins
export const ARDUINO_WIDTH      = 120  // px width of Arduino silhouette
export const ARDUINO_HEIGHT     = 28 * ARDUINO_HOLE_PITCH  // fits all pins

// Right-edge pins (digital 0–13, then power pins)
const RIGHT_PINS: Array<{ label: string; nodeId: NodeId }> = [
  { label: "D0",    nodeId: "D0"  },
  { label: "D1",    nodeId: "D1"  },
  { label: "D2",    nodeId: "D2"  },
  { label: "D3",    nodeId: "D3"  },
  { label: "D4",    nodeId: "D4"  },
  { label: "D5",    nodeId: "D5"  },
  { label: "D6",    nodeId: "D6"  },
  { label: "D7",    nodeId: "D7"  },
  { label: "D8",    nodeId: "D8"  },
  { label: "D9",    nodeId: "D9"  },
  { label: "D10",   nodeId: "D10" },
  { label: "D11",   nodeId: "D11" },
  { label: "D12",   nodeId: "D12" },
  { label: "D13",   nodeId: "D13" },
  { label: "GND",   nodeId: GND   },
  { label: "AREF",  nodeId: "AREF"},
  { label: "3.3V",  nodeId: "V33" },
  { label: "5V",    nodeId: VCC   },
  { label: "GND",   nodeId: GND   },
  { label: "GND",   nodeId: GND   },
  { label: "VIN",   nodeId: "VIN" },
  { label: "A0",    nodeId: "A0"  },
  { label: "A1",    nodeId: "A1"  },
  { label: "A2",    nodeId: "A2"  },
  { label: "A3",    nodeId: "A3"  },
  { label: "A4",    nodeId: "A4"  },
  { label: "A5",    nodeId: "A5"  },
]

export const ARDUINO_HOLES: Map<string, ArduinoHole> = new Map(
  RIGHT_PINS.map((pin, i) => [
    pin.label === "GND" ? `GND_${i}` : pin.label,   // deduplicate GND keys
    {
      label:  pin.label,
      nodeId: pin.nodeId,
      x: ARDUINO_WIDTH - 4,               // right edge of Arduino silhouette
      y: 20 + i * ARDUINO_HOLE_PITCH,
    }
  ])
)
```

- [ ] **Step 4: Run tests**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run lib/circuit/__tests__/breadboard-layout.test.ts 2>&1 | tail -10
```

Expected: 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/circuit/breadboard/breadboard-layout.ts lib/circuit/__tests__/breadboard-layout.test.ts
git commit -m "feat(circuit): add breadboard layout — hole-to-net mapping, Arduino Uno pin positions"
```

---

## Task 11: Breadboard State + Renderer

**Files:**
- Create: `lib/circuit/breadboard/breadboard-state.ts`
- Create: `lib/circuit/breadboard/breadboard-renderer.ts`

### 11A: Breadboard State

BreadboardState tracks placed components and user-drawn wires, then converts them to a `SerializedNetlist` using union-find to merge connected nets.

- [ ] **Step 1: Create `lib/circuit/breadboard/breadboard-state.ts`**

```typescript
// lib/circuit/breadboard/breadboard-state.ts
// Mutable state for the breadboard editor.
// Placed components + wires → SerializedNetlist via union-find net merging.

import { holeNet, BBColumn } from "./breadboard-layout"
import type { SerializedNetlist, SerializedComponent, ComponentId, NodeId } from "../types"
import { GND, VCC } from "../types"

export interface HolePosition {
  row: number
  col: BBColumn
}

export interface PlacedComponent {
  id: ComponentId
  type: "resistor" | "led" | "voltage-source"
  params: Record<string, number | string>
  terminal1: HolePosition   // e.g. resistor pin 1
  terminal2: HolePosition   // e.g. resistor pin 2
  /** For LEDs: terminal1 = anode, terminal2 = cathode */
}

export interface UserWire {
  id: string
  from: HolePosition
  to: HolePosition
}

// ── Union-Find for net merging ───────────────────────────────────────────────

function makeUnionFind(nodes: string[]): { parent: Map<string, string>; find: (x: string) => string; union: (a: string, b: string) => void } {
  const parent = new Map<string, string>(nodes.map(n => [n, n]))
  const rank   = new Map<string, number>(nodes.map(n => [n, 0]))

  function find(x: string): string {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const root = find(p)
    parent.set(x, root)   // path compression
    return root
  }

  function union(a: string, b: string): void {
    const ra = find(a), rb = find(b)
    if (ra === rb) return
    const rankA = rank.get(ra) ?? 0, rankB = rank.get(rb) ?? 0
    // GND and VCC must always be their own root (never merged into another net)
    if (rb === GND || rb === VCC) { parent.set(ra, rb); return }
    if (ra === GND || ra === VCC) { parent.set(rb, ra); return }
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

  addWire(from: HolePosition, to: HolePosition): string {
    const id = `wire_${this.nextWireId++}`
    this.wires.push({ id, from, to })
    return id
  }

  removeWire(id: string): void {
    this.wires = this.wires.filter(w => w.id !== id)
  }

  getComponents(): readonly PlacedComponent[] { return this.components }
  getWires():      readonly UserWire[]        { return this.wires }

  /**
   * Convert current state to a SerializedNetlist.
   * Wires merge nets; the final net name for a hole is find(baseNet).
   */
  toNetlist(): SerializedNetlist {
    // Collect all base nets
    const allBaseNets = new Set<NodeId>([GND, VCC])
    for (const comp of this.components) {
      allBaseNets.add(holeNet(comp.terminal1.row, comp.terminal1.col))
      allBaseNets.add(holeNet(comp.terminal2.row, comp.terminal2.col))
    }
    for (const wire of this.wires) {
      allBaseNets.add(holeNet(wire.from.row, wire.from.col))
      allBaseNets.add(holeNet(wire.to.row, wire.to.col))
    }

    const uf = makeUnionFind([...allBaseNets])

    // Merge nets connected by wires
    for (const wire of this.wires) {
      const netFrom = holeNet(wire.from.row, wire.from.col)
      const netTo   = holeNet(wire.to.row,   wire.to.col)
      uf.union(netFrom, netTo)
    }

    // Resolve hole position → final net name
    const resolve = (pos: HolePosition): NodeId => uf.find(holeNet(pos.row, pos.col))

    // Collect all unique non-ground nets
    const netSet = new Set<NodeId>()
    for (const net of allBaseNets) {
      const root = uf.find(net)
      if (root !== GND) netSet.add(root)
    }

    const serializedComponents: SerializedComponent[] = this.components.map(comp => {
      const net1 = resolve(comp.terminal1)
      const net2 = resolve(comp.terminal2)
      switch (comp.type) {
        case "resistor":
          return { id: comp.id, type: "resistor", terminals: { n1: net1, n2: net2 }, params: comp.params }
        case "led":
          return { id: comp.id, type: "led", terminals: { anode: net1, cathode: net2 }, params: comp.params }
        case "voltage-source":
          return { id: comp.id, type: "voltage-source", terminals: { plus: net1, minus: net2 }, params: comp.params }
      }
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

### 11B: Breadboard Renderer

- [ ] **Step 2: Create `lib/circuit/breadboard/breadboard-renderer.ts`**

```typescript
// lib/circuit/breadboard/breadboard-renderer.ts
// Pure canvas drawing — no React, no DOM side effects beyond the provided ctx.

import {
  BREADBOARD_ROWS, BB_COLS_LEFT, BB_COLS_RIGHT,
  ARDUINO_HOLES, ARDUINO_WIDTH, ARDUINO_HEIGHT, ARDUINO_HOLE_PITCH,
  holeNet, type BBColumn, type ArduinoHole
} from "./breadboard-layout"
import type { PlacedComponent, UserWire, HolePosition } from "./breadboard-state"
import type { NodeId } from "../types"
import { GND, VCC } from "../types"

// ── Canvas layout constants ──────────────────────────────────────────────────
export const HOLE_PITCH  = 14      // px between adjacent holes
export const HOLE_RADIUS = 3       // px hole dot radius
export const RAIL_HEIGHT = 22      // px top/bottom power rail height
export const GAP_HEIGHT  = 24      // px center gap between left and right halves
export const ARDUINO_OFFSET_X = 8  // px left margin before Arduino silhouette
export const BB_OFFSET_X = ARDUINO_OFFSET_X + ARDUINO_WIDTH + 16  // breadboard starts here
export const BB_HEIGHT = RAIL_HEIGHT + 5 * HOLE_PITCH + GAP_HEIGHT + 5 * HOLE_PITCH + RAIL_HEIGHT
export const CANVAS_WIDTH  = BB_OFFSET_X + BREADBOARD_ROWS * HOLE_PITCH + 16
export const CANVAS_HEIGHT = Math.max(BB_HEIGHT + 32, ARDUINO_HEIGHT + 32)

// Row → canvas x; col → canvas y (breadboard is horizontal)
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

// ── Drawing helpers ──────────────────────────────────────────────────────────

const LED_COLORS: Record<string, string> = {
  red: "#ff3333", green: "#33ff66", blue: "#3399ff",
  white: "#ffffff", yellow: "#ffee33"
}

export interface RenderState {
  components:      PlacedComponent[]
  wires:           UserWire[]
  brightnessMap:   Record<string, number>  // componentId → 0..1
  hoveredNet:      NodeId | null
  netMap:          Map<string, NodeId>     // holeKey → resolved net (from BreadboardState)
  pendingWireFrom: HolePosition | null
  selectedId:      string | null
}

export function renderBreadboard(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const dpr = window.devicePixelRatio || 1
  ctx.save()
  ctx.scale(dpr, dpr)

  // Background
  ctx.fillStyle = "#1a1a2e"
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  drawArduino(ctx)
  drawPowerRails(ctx)
  drawTieStrips(ctx, state)
  drawWires(ctx, state)
  drawComponents(ctx, state)
  drawPendingWire(ctx, state)

  ctx.restore()
}

function drawArduino(ctx: CanvasRenderingContext2D): void {
  // Arduino Uno silhouette
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

  // Draw Arduino pin holes
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
  // Red rail (VCC)
  ctx.fillStyle = "rgba(200, 50, 50, 0.25)"
  ctx.fillRect(BB_OFFSET_X - 4, 4, BREADBOARD_ROWS * HOLE_PITCH + 8, RAIL_HEIGHT - 2)
  ctx.fillRect(BB_OFFSET_X - 4, BB_HEIGHT - RAIL_HEIGHT, BREADBOARD_ROWS * HOLE_PITCH + 8, RAIL_HEIGHT - 2)

  // Blue rail (GND)
  ctx.fillStyle = "rgba(50, 80, 200, 0.2)"
  ctx.fillRect(BB_OFFSET_X - 4, HOLE_PITCH + 2, BREADBOARD_ROWS * HOLE_PITCH + 8, RAIL_HEIGHT - HOLE_PITCH - 2)
  ctx.fillRect(BB_OFFSET_X - 4, BB_HEIGHT - RAIL_HEIGHT + 2, BREADBOARD_ROWS * HOLE_PITCH + 8, HOLE_PITCH)

  // Draw power rail holes
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
  // Board background for tie-strip area
  ctx.fillStyle = "#2a3a4a"
  ctx.fillRect(BB_OFFSET_X - 4, RAIL_HEIGHT + 2, BREADBOARD_ROWS * HOLE_PITCH + 8, 5 * HOLE_PITCH - 2)
  ctx.fillRect(BB_OFFSET_X - 4, RAIL_HEIGHT + 5 * HOLE_PITCH + GAP_HEIGHT, BREADBOARD_ROWS * HOLE_PITCH + 8, 5 * HOLE_PITCH - 2)

  // Center gap label
  ctx.fillStyle = "#888"
  ctx.font = "8px monospace"
  ctx.textAlign = "center"
  ctx.fillText("DIP", BB_OFFSET_X + 8, RAIL_HEIGHT + 5 * HOLE_PITCH + GAP_HEIGHT / 2 + 3)

  // Draw tie-strip holes
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
    const x1 = holeX(wire.from.row), y1 = holeY(wire.from.col)
    const x2 = holeX(wire.to.row),   y2 = holeY(wire.to.col)

    const fromNet = holeNet(wire.from.row, wire.from.col)
    const color = fromNet === GND ? "#4466ff" : fromNet === VCC ? "#ff4444" : "#44ddaa"

    ctx.beginPath()
    ctx.strokeStyle = state.selectedId === wire.id ? "#ffff00" : color
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    // L-shaped routing
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
      // Draw body
      ctx.fillStyle = isSelected ? "#ffee88" : "#c8a060"
      ctx.strokeStyle = isSelected ? "#ffff00" : "#a07840"
      ctx.lineWidth = 1
      roundRect(ctx, cx - 14, cy - 5, 28, 10, 3)
      ctx.fill(); ctx.stroke()
      // Leads
      ctx.strokeStyle = "#888"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, y1); ctx.lineTo(cx - 14, cy)
      ctx.moveTo(x2, y2); ctx.lineTo(cx + 14, cy)
      ctx.stroke()
      // Label
      ctx.fillStyle = "#333"
      ctx.font = "bold 7px monospace"
      ctx.textAlign = "center"
      const R = comp.params.resistance
      ctx.fillText(R ? `${R}Ω` : "R", cx, cy + 3)

    } else if (comp.type === "led") {
      const brightness = state.brightnessMap[comp.id] ?? 0
      const color = LED_COLORS[comp.params.color as string] ?? "#ff3333"

      // Leads
      ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, y1); ctx.lineTo(cx - 6, cy)
      ctx.moveTo(x2, y2); ctx.lineTo(cx + 6, cy)
      ctx.stroke()

      // Glow (if lit)
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

      // LED body
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

function drawPendingWire(ctx: CanvasRenderingContext2D, state: RenderState): void {
  // Drawn by the canvas component with mouse position — placeholder here
}

// ── Utility ──────────────────────────────────────────────────────────────────

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

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep -E "breadboard-state|breadboard-renderer" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/circuit/breadboard/breadboard-state.ts lib/circuit/breadboard/breadboard-renderer.ts
git commit -m "feat(circuit): add BreadboardState (union-find netlist) and Canvas renderer (holes, wires, LED glow)"
```

---

## Task 12: Circuit Page — Canvas Component + View + Route

**Files:**
- Create: `components/circuit/breadboard-canvas.tsx`
- Create: `components/circuit/component-palette.tsx`
- Create: `components/circuit/circuit-view.tsx`
- Create: `app/circuit/page.tsx`

- [ ] **Step 1: Create `components/circuit/breadboard-canvas.tsx`**

```typescript
// components/circuit/breadboard-canvas.tsx
"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import {
  renderBreadboard,
  CANVAS_WIDTH, CANVAS_HEIGHT, HOLE_PITCH,
  holeX, holeY, arduinoHoleXY, type RenderState
} from "@/lib/circuit/breadboard/breadboard-renderer"
import { BreadboardState, type HolePosition } from "@/lib/circuit/breadboard/breadboard-state"
import { ARDUINO_HOLES, type BBColumn, BREADBOARD_ROWS } from "@/lib/circuit/breadboard/breadboard-layout"
import type { ComponentId } from "@/lib/circuit/types"

const ALL_COLS: BBColumn[] = ["a","b","c","d","e","f","g","h","i","j","TOP_PLUS","TOP_MINUS","BOT_PLUS","BOT_MINUS"]

/** Find the nearest hole to a canvas (x,y) coordinate. Returns null if far from any hole. */
function snapToHole(cx: number, cy: number): HolePosition | null {
  let best: HolePosition | null = null
  let bestDist = HOLE_PITCH * 0.6   // snap radius

  for (let row = 1; row <= BREADBOARD_ROWS; row++) {
    const hx = holeX(row)
    for (const col of ALL_COLS) {
      const hy = holeY(col)
      const d = Math.hypot(cx - hx, cy - hy)
      if (d < bestDist) { bestDist = d; best = { row, col } }
    }
  }
  // Check Arduino pin holes
  for (const hole of ARDUINO_HOLES.values()) {
    const { x, y } = arduinoHoleXY(hole)
    const d = Math.hypot(cx - x, cy - y)
    if (d < bestDist) { bestDist = d; best = { row: -1, col: "a" } }
    // Arduino pins are handled separately — for Phase 2 we skip wiring to them
  }

  return best
}

export interface DraggedComponent {
  type: "resistor" | "led"
  params: Record<string, number | string>
}

interface BreadboardCanvasProps {
  bbState: BreadboardState
  brightnessMap: Record<string, number>
  onNetlistChange: () => void
  draggedComponent: DraggedComponent | null
  onDragConsumed: () => void
  className?: string
}

export function BreadboardCanvas({
  bbState, brightnessMap, onNetlistChange, draggedComponent, onDragConsumed, className
}: BreadboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pendingWireFrom, setPendingWireFrom] = useState<HolePosition | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const nextCompId = useRef(1)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const renderState: RenderState = {
      components:      [...bbState.getComponents()],
      wires:           [...bbState.getWires()],
      brightnessMap,
      hoveredNet:      null,
      netMap:          new Map(),
      pendingWireFrom,
      selectedId,
    }
    renderBreadboard(ctx, renderState)
  }, [bbState, brightnessMap, pendingWireFrom, selectedId])

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = CANVAS_WIDTH  * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    canvas.style.width  = `${CANVAS_WIDTH}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`
    redraw()
  }, [redraw])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr  = window.devicePixelRatio || 1
    const cx   = (e.clientX - rect.left) * (canvas.width  / rect.width  / dpr)
    const cy   = (e.clientY - rect.top)  * (canvas.height / rect.height / dpr)

    // If we have a component being dragged from palette, place it
    if (draggedComponent) {
      const hole = snapToHole(cx, cy)
      if (!hole) return
      // Place component spanning 2 rows on same side
      const t1: HolePosition = hole
      const t2: HolePosition = { row: Math.min(hole.row + 2, BREADBOARD_ROWS), col: hole.col }
      const id: ComponentId = `${draggedComponent.type}_${nextCompId.current++}`
      bbState.addComponent({ id, type: draggedComponent.type, params: draggedComponent.params, terminal1: t1, terminal2: t2 })
      onDragConsumed()
      onNetlistChange()
      redraw()
      return
    }

    // Wire-drawing mode: first click = start, second click = end
    const hole = snapToHole(cx, cy)
    if (!hole) { setPendingWireFrom(null); return }

    if (!pendingWireFrom) {
      setPendingWireFrom(hole)
    } else {
      bbState.addWire(pendingWireFrom, hole)
      setPendingWireFrom(null)
      onNetlistChange()
      redraw()
    }
  }, [bbState, draggedComponent, onDragConsumed, onNetlistChange, pendingWireFrom, redraw])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
      bbState.removeComponent(selectedId)
      bbState.removeWire(selectedId)
      setSelectedId(null)
      onNetlistChange()
      redraw()
    }
    if (e.key === "Escape") {
      setPendingWireFrom(null)
      redraw()
    }
  }, [selectedId, bbState, onNetlistChange, redraw])

  return (
    <canvas
      ref={canvasRef}
      className={`cursor-crosshair focus:outline-none ${className ?? ""}`}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    />
  )
}
```

- [ ] **Step 2: Create `components/circuit/component-palette.tsx`**

```typescript
// components/circuit/component-palette.tsx
"use client"

import { useState } from "react"
import type { DraggedComponent } from "./breadboard-canvas"

interface PaletteItem {
  label: string
  type: DraggedComponent["type"]
  params: DraggedComponent["params"]
  color: string
  description: string
}

const PALETTE_ITEMS: PaletteItem[] = [
  { label: "Resistor 220Ω", type: "resistor", params: { resistance: 220 },   color: "#c8a060", description: "Current limiting" },
  { label: "Resistor 1kΩ",  type: "resistor", params: { resistance: 1000 },  color: "#c8a060", description: "Pull-up / divider"  },
  { label: "Resistor 10kΩ", type: "resistor", params: { resistance: 10000 }, color: "#c8a060", description: "Pull-up" },
  { label: "LED (red)",    type: "led",      params: { color: "red"   },     color: "#ff4444", description: "Red LED" },
  { label: "LED (green)",  type: "led",      params: { color: "green" },     color: "#44ff66", description: "Green LED" },
  { label: "LED (blue)",   type: "led",      params: { color: "blue"  },     color: "#4499ff", description: "Blue LED" },
]

interface ComponentPaletteProps {
  onPick: (comp: DraggedComponent) => void
}

export function ComponentPalette({ onPick }: ComponentPaletteProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Components</p>
      {PALETTE_ITEMS.map((item) => (
        <button
          key={item.label}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
            hovered === item.label ? "bg-accent" : "hover:bg-accent/50"
          }`}
          onClick={() => onPick({ type: item.type, params: item.params })}
          onMouseEnter={() => setHovered(item.label)}
          onMouseLeave={() => setHovered(null)}
          title={item.description}
        >
          <span
            className="h-3 w-3 rounded-full shrink-0 border border-border/50"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </button>
      ))}
      <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
        Click a component then click the breadboard to place it.
        Click two holes to draw a wire. Delete key removes selected item.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/circuit/circuit-view.tsx`**

```typescript
// components/circuit/circuit-view.tsx
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { BreadboardCanvas, type DraggedComponent } from "./breadboard-canvas"
import { ComponentPalette } from "./component-palette"
import { CodeExecutionPanel } from "@/components/simulator/code-execution-panel"
import { SerialMonitor, makeSerialLine } from "@/components/simulator/serial-monitor"
import { BreadboardState } from "@/lib/circuit/breadboard/breadboard-state"
import { CircuitBridge } from "@/lib/circuit/circuit-bridge"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { ARDUINO_HOLES } from "@/lib/circuit/breadboard/breadboard-layout"
import type { AVRCommand, AVREvent, BoardId, CompileDiagnostic } from "@/lib/avr/types"
import type { CircuitEvent, ComponentFault, NodeId } from "@/lib/circuit/types"
import { toast } from "sonner"
import { Cpu, Zap } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type RunState = "idle" | "compiling" | "running" | "paused"

const DEFAULT_CODE = `void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
  Serial.println("Blink!");
}`

// Build pin→nodeId map from Arduino hole definitions
function buildPinNodeMap() {
  const digitalPins = new Map<number, NodeId>()
  const analogPins  = new Map<number, NodeId>()
  for (const hole of ARDUINO_HOLES.values()) {
    const dm = hole.label.match(/^D(\d+)$/)
    if (dm) digitalPins.set(parseInt(dm[1]), hole.nodeId)
    const am = hole.label.match(/^A(\d+)$/)
    if (am) analogPins.set(parseInt(am[1]), hole.nodeId)
  }
  return { digitalPins, analogPins }
}

export function CircuitView() {
  const [code, setCode]               = useState(DEFAULT_CODE)
  const [board, setBoard]             = useState<BoardId>("arduino-uno")
  const [runState, setRunState]       = useState<RunState>("idle")
  const [compileErrors, setCompileErrors] = useState<CompileDiagnostic[]>([])
  const [serialLines, setSerialLines] = useState<ReturnType<typeof makeSerialLine>[]>([])
  const [faults, setFaults]           = useState<ComponentFault[]>([])
  const [brightnessMap, setBrightnessMap] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab]     = useState<"code" | "serial">("code")
  const [draggedComp, setDraggedComp] = useState<DraggedComponent | null>(null)

  const bbStateRef      = useRef(new BreadboardState())
  const avrWorkerRef    = useRef<Worker | null>(null)
  const circuitWorkerRef = useRef<Worker | null>(null)
  const circuitBridgeRef = useRef<CircuitBridge | null>(null)
  const gpioBridgeRef   = useRef<GPIOBridge | null>(null)
  const [, forceRedraw] = useState(0)

  // ── Worker setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const avrWorker     = new Worker(new URL("../../workers/avr-worker.ts", import.meta.url))
    const circuitWorker = new Worker(new URL("../../workers/circuit-worker.ts", import.meta.url))
    avrWorkerRef.current     = avrWorker
    circuitWorkerRef.current = circuitWorker

    const bridge = new CircuitBridge({
      avrWorker,
      circuitWorker,
      pinNodeMap: buildPinNodeMap(),
      onFault:  (f) => setFaults(f),
      onBrightnessUpdate: (bm) => setBrightnessMap(bm),
    })
    circuitBridgeRef.current = bridge

    const gpioBridge = new GPIOBridge({
      avrWorker,
      onPinChange: (payload) => bridge.handleAVREvent({ type: "pinChange", ...payload }),
      onSerialOutput: (text) => setSerialLines(prev => [...prev.slice(-499), makeSerialLine(text)]),
      onAVRError: (msg) => { toast.error(`AVR error: ${msg}`); setRunState("idle") },
      onAVRStopped: () => { setRunState("idle") },
    })
    gpioBridgeRef.current = gpioBridge

    avrWorker.addEventListener("message", (e: MessageEvent<AVREvent>) => {
      const ev = e.data
      if (ev.type === "running") { setRunState("running") }
      else if (ev.type === "paused") { setRunState("paused") }
      else if (ev.type === "stopped") { setRunState("idle") }
      else gpioBridge.handleAVREvent(ev)
    })

    circuitWorker.addEventListener("message", (e: MessageEvent<CircuitEvent>) => {
      bridge.handleCircuitEvent(e.data)
    })

    circuitWorker.postMessage({ type: "start" })

    return () => {
      avrWorker.terminate()
      circuitWorker.terminate()
    }
  }, [])

  // Send updated netlist to circuit worker whenever breadboard changes
  const handleNetlistChange = useCallback(() => {
    const netlist = bbStateRef.current.toNetlist()
    circuitBridgeRef.current?.sendNetlist(netlist)
    forceRedraw(n => n + 1)
  }, [])

  const handleErrors = useCallback((errors: CompileDiagnostic[]) => {
    setCompileErrors(errors)
    setRunState("idle")
  }, [])

  const handleAVRCommand = useCallback((cmd: AVRCommand) => {
    if (!avrWorkerRef.current) return
    if (cmd.type === "load" && cmd.hex === "") {
      setRunState("compiling")
      setCompileErrors([])
      return
    }
    avrWorkerRef.current.postMessage(cmd)
  }, [])

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left: Breadboard */}
      <div className="flex flex-col flex-1 min-w-0 gap-3 p-4 overflow-auto">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Circuit Builder</h2>
          {faults.length > 0 && (
            <span className="ml-auto text-xs text-destructive font-medium">
              ⚠ {faults.length} fault{faults.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <ComponentPalette onPick={setDraggedComp} />
          <div className="flex-1 overflow-auto rounded-xl border border-border bg-card p-2">
            {draggedComp && (
              <p className="mb-1 text-xs text-primary text-center">
                Click the board to place {draggedComp.params.color ?? ""} {draggedComp.type}. Press Esc to cancel.
              </p>
            )}
            <BreadboardCanvas
              bbState={bbStateRef.current}
              brightnessMap={brightnessMap}
              onNetlistChange={handleNetlistChange}
              draggedComponent={draggedComp}
              onDragConsumed={() => setDraggedComp(null)}
            />
          </div>
        </div>

        {faults.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs space-y-0.5">
            {faults.map((f, i) => (
              <div key={i} className="text-destructive">
                <span className="font-semibold">{f.message}</span> — {f.suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Code + Serial */}
      <div className="w-[340px] shrink-0 border-l border-border flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Arduino Code</span>
        </div>
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)} className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid grid-cols-2 m-2 mb-0">
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="serial">Serial</TabsTrigger>
          </TabsList>
          <TabsContent value="code" className="flex-1 min-h-0 m-0">
            <CodeExecutionPanel
              code={code}
              onCodeChange={setCode}
              runState={runState}
              onCommand={handleAVRCommand}
              onErrors={handleErrors}
              errors={compileErrors}
              board={board}
              onBoardChange={setBoard}
            />
          </TabsContent>
          <TabsContent value="serial" className="m-2">
            <SerialMonitor
              lines={serialLines}
              onSend={data => gpioBridgeRef.current?.sendSerial(data)}
              onClear={() => setSerialLines([])}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/circuit/page.tsx`**

```typescript
// app/circuit/page.tsx
import { Suspense } from "react"
import { CircuitView } from "@/components/circuit/circuit-view"

export const metadata = { title: "Circuit Builder — Xylo" }

export default function CircuitPage() {
  return (
    <Suspense>
      <CircuitView />
    </Suspense>
  )
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm tsc --noEmit 2>&1 | grep -E "circuit-view|breadboard-canvas|component-palette|circuit/page" | head -15
```

Resolve any errors. Common fixes:
- If `GPIOBridge` constructor args differ, check `lib/avr/gpio-bridge.ts` for the current signature
- If `CodeExecutionPanel` is missing an `onErrors` prop, confirm Task 8 of Phase 1 added it

- [ ] **Step 6: Run all tests**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform" && pnpm vitest run 2>&1 | tail -20
```

Expected: all 25 tests pass (15 Phase 1 + 10 new Phase 2).

- [ ] **Step 7: Commit**

```bash
git add components/circuit/ app/circuit/
git commit -m "feat(circuit): add BreadboardCanvas, ComponentPalette, CircuitView, and /circuit route"
```

---

## Smoke Test Checklist (Manual)

Run `pnpm dev` and open `http://localhost:3000/circuit`.

- [ ] Breadboard renders with holes, Arduino Uno silhouette, power rails
- [ ] Click "LED (red)" in palette → click a breadboard hole → LED placed
- [ ] Click "Resistor 220Ω" → place on adjacent holes
- [ ] Click a hole then another to draw a wire
- [ ] Place: wire from D13 Arduino pin row to resistor, resistor to LED anode, LED cathode to GND
- [ ] In Code tab: click Run → "Compiling…" → "Compiled" toast
- [ ] LED on breadboard glows red when `digitalWrite(13, HIGH)` and goes dark on LOW
- [ ] Remove the resistor — LED fault warning appears: "Add a current-limiting resistor"
- [ ] Serial tab shows "Blink!" every second

---

## Build Sequence Summary

| Task | Deliverable | Tests |
|---|---|---|
| 1 | `lib/circuit/types.ts` | TS only |
| 2 | `lib/circuit/solver/matrix.ts` | 4 matrix tests |
| 3 | `lib/circuit/solver/mna-solver.ts` | 3 MNA tests |
| 4 | `lib/circuit/solver/newton-raphson.ts` | implicit via Task 7 |
| 5 | `resistor.ts` + `base-component.ts` | TS only |
| 6 | `voltage-source.ts` | TS only |
| 7 | `led.ts` | 5 LED tests |
| 8 | `workers/circuit-worker.ts` | manual |
| 9 | `lib/circuit/circuit-bridge.ts` | TS only |
| 10 | `breadboard-layout.ts` | 10 layout tests |
| 11 | `breadboard-state.ts` + `breadboard-renderer.ts` | TS only |
| 12 | Canvas + View + Route | manual browser test |
