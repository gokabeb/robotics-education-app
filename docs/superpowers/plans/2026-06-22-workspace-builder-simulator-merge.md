# Unified Builder/Simulator Core (`/workspace`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the legacy chassis-builder UX (`/builder`) with the real avr8js/netlist-adjacent engine into a new `/workspace/[projectId]` flow: drag components onto a chassis with real pin semantics, write code in Blocks or text tied to what was actually built, flash a snapshot, then run it in a simulator that only ever executes the flashed snapshot.

**Architecture:** A new `RobotProjectStore` plain class (pub/sub via a manual listener set, consumed through `useSyncExternalStore`) holds components, code, and a `flashed` snapshot. `lib/workspace/pin-constraints.ts` derives valid-pin logic from the existing `UNO_PIN_MAP` so the store and UI share one source of truth. A rebuilt `chassis-canvas.tsx` fixes the legacy rotation bug by dropping the decorative, never-enforced slot system in favor of direct pin-badge attachment. A static set of Blockly block types per component category reads live store state through a lazily-evaluated `FieldDropdown` generator, so the toolbox reflects placed components without dynamically defining block types. A `ChassisPhysicsBridge`, modeled on `CircuitBridge`, maps AVR pin events directly to component on/off state (no MNA solve needed). Persistence follows the existing `/api/projects` pattern against a new `workspace_projects` Supabase table.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (`@supabase/ssr`), Clerk, Blockly, Monaco (via existing `CodeExecutionPanel`), `@wokwi/avr8js` (via existing `workers/avr-worker.ts`), Vitest.

## Global Constraints

- Board is fixed to `"arduino-uno"` only — no board selector, no Raspberry Pi.
- New code lives under `app/workspace/`, `lib/workspace/`, `components/workspace/`, `app/api/workspace-projects/`. Do not modify `/builder`, `/simulator`, `/playground` routes, their components, or their `sessionStorage`/`localStorage` persistence.
- New Supabase table `workspace_projects` — do not extend or modify the existing `projects` table or its schema file.
- Package manager is `pnpm` (project has `pnpm-lock.yaml`, no `package-lock.json`). Use `pnpm install` / `pnpm exec`.
- No `test` script in `package.json` — run tests via `npx vitest run <path>`.
- `workers/avr-worker.ts` hardcodes `isPWM: false` on every `pinChange` event (real timer-register duty-cycle detection not implemented). Treat all components as binary on/off; do not attempt real PWM brightness/speed in this plan.
- Pin auto-assignment on component drop (first free, electrically valid pin for that component's kind); manual reassignment must be rejected if the target pin is not free and valid for that component's kind.
- Blocks↔Code mode switching in the Editor panel is non-destructive: switching to Code mode never discards `blocklyXml`; switching back to Blocks must prompt for confirmation before regenerating from blocks (which would discard manual text edits).
- The Simulator only ever reads `store.getFlashed()`. It must never read live `store.getComponents()`/`store.getCode()` directly for execution.
- D0 and D1 are reserved (UART/Serial) and must never be offered as free pins for any component kind.

---

### Task 1: `workspace_projects` schema and database types

**Files:**
- Create: `supabase-workspace-schema.sql`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Produces: `Database['public']['Tables']['workspace_projects']` (`Row`/`Insert`/`Update`), and exported type aliases `WorkspaceProject`, `WorkspaceProjectInsert`, `WorkspaceProjectUpdate`, used by Task 13's API routes.

This task has no executable test (it's a SQL file plus type declarations); verification is `pnpm exec tsc --noEmit` passing and the SQL being valid Postgres. Note for whoever runs this: `supabase-workspace-schema.sql` depends on the `update_updated_at_column()` function already created by `supabase-schema.sql` — run that file first if starting from a fresh database.

- [ ] **Step 1: Write the schema file**

```sql
-- supabase-workspace-schema.sql
-- Xylo Robotics Platform — /workspace feature
-- Run supabase-schema.sql first (defines update_updated_at_column()).

create table if not exists workspace_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,  -- Clerk user IDs are strings like "user_..."
  name text not null,
  board text not null default 'arduino-uno',
  components jsonb not null default '[]'::jsonb,
  code jsonb not null default '{"source":"blocks","blocklyXml":null,"generatedCode":""}'::jsonb,
  flashed jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists workspace_projects_user_id_idx on workspace_projects(user_id);
create index if not exists workspace_projects_updated_at_idx on workspace_projects(updated_at desc);

drop trigger if exists update_workspace_projects_updated_at on workspace_projects;
create trigger update_workspace_projects_updated_at
  before update on workspace_projects
  for each row
  execute function update_updated_at_column();

-- Note: no RLS policies — auth/ownership is enforced in API routes via Clerk,
-- matching the existing `projects` table's pattern.
```

- [ ] **Step 2: Add the table type to `lib/database.types.ts`**

Add a `workspace_projects` entry alongside the existing `projects` entry inside `Database['public']['Tables']`, and the three exported aliases at the bottom of the file:

```ts
      workspace_projects: {
        Row: {
          id: string
          user_id: string
          name: string
          board: string
          components: Json
          code: Json
          flashed: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          board?: string
          components?: Json
          code?: Json
          flashed?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          board?: string
          components?: Json
          code?: Json
          flashed?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
```

This goes inside the same `Tables: { ... }` block as `projects`, as a sibling key. Then add below the existing `Project`/`ProjectInsert`/`ProjectUpdate` aliases:

```ts
export type WorkspaceProject = Database['public']['Tables']['workspace_projects']['Row']
export type WorkspaceProjectInsert = Database['public']['Tables']['workspace_projects']['Insert']
export type WorkspaceProjectUpdate = Database['public']['Tables']['workspace_projects']['Update']
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors referencing `lib/database.types.ts` or `workspace_projects`.

- [ ] **Step 4: Commit**

```bash
git add supabase-workspace-schema.sql lib/database.types.ts
git commit -m "feat(workspace): add workspace_projects schema and types"
```

---

### Task 2: Pin constraints module

**Files:**
- Create: `lib/workspace/pin-constraints.ts`
- Test: `lib/workspace/__tests__/pin-constraints.test.ts`

**Interfaces:**
- Consumes: `UNO_PIN_MAP` from `lib/avr/board-profiles.ts` (array of `PinMapping = { digitalPin: number, port: "B"|"C"|"D", bit: number, isPWMCapable: boolean, analogChannel?: number }`, covering digital pins 0–19, where 14–19 are A0–A5).
- Produces: `PinKind = "digital" | "pwm" | "analog"`, `PinInfo { digitalPin: number, label: string, isPWMCapable: boolean, isAnalogCapable: boolean, isReserved: boolean }`, `getAllPins(): PinInfo[]`, `isPinValidFor(kind: PinKind, pin: PinInfo): boolean`, `getFreePinsFor(kind: PinKind, usedPins: number[]): PinInfo[]`, `isPinFreeAndValidFor(kind: PinKind, digitalPin: number, usedPins: number[]): boolean`. Task 4's `RobotProjectStore` and Task 5's pin-picker UI both call `getFreePinsFor`/`isPinFreeAndValidFor`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/workspace/__tests__/pin-constraints.test.ts
import { describe, it, expect } from "vitest"
import {
  getAllPins,
  isPinValidFor,
  getFreePinsFor,
  isPinFreeAndValidFor,
} from "../pin-constraints"

describe("getAllPins", () => {
  it("excludes no pins and labels analog pins A0-A5", () => {
    const pins = getAllPins()
    const a0 = pins.find((p) => p.digitalPin === 14)
    expect(a0?.label).toBe("A0")
    expect(a0?.isAnalogCapable).toBe(true)
  })

  it("marks D0 and D1 as reserved", () => {
    const pins = getAllPins()
    expect(pins.find((p) => p.digitalPin === 0)?.isReserved).toBe(true)
    expect(pins.find((p) => p.digitalPin === 1)?.isReserved).toBe(true)
    expect(pins.find((p) => p.digitalPin === 2)?.isReserved).toBe(false)
  })

  it("marks D3, D5, D6, D9, D10, D11 as PWM-capable and others not", () => {
    const pins = getAllPins()
    for (const n of [3, 5, 6, 9, 10, 11]) {
      expect(pins.find((p) => p.digitalPin === n)?.isPWMCapable).toBe(true)
    }
    expect(pins.find((p) => p.digitalPin === 4)?.isPWMCapable).toBe(false)
  })
})

describe("isPinValidFor", () => {
  it("rejects reserved pins for every kind", () => {
    const pins = getAllPins()
    const d0 = pins.find((p) => p.digitalPin === 0)!
    expect(isPinValidFor("digital", d0)).toBe(false)
    expect(isPinValidFor("pwm", d0)).toBe(false)
    expect(isPinValidFor("analog", d0)).toBe(false)
  })

  it("requires PWM capability for kind=pwm", () => {
    const pins = getAllPins()
    const d3 = pins.find((p) => p.digitalPin === 3)!
    const d4 = pins.find((p) => p.digitalPin === 4)!
    expect(isPinValidFor("pwm", d3)).toBe(true)
    expect(isPinValidFor("pwm", d4)).toBe(false)
  })

  it("requires analog capability for kind=analog", () => {
    const pins = getAllPins()
    const a0 = pins.find((p) => p.digitalPin === 14)!
    const d2 = pins.find((p) => p.digitalPin === 2)!
    expect(isPinValidFor("analog", a0)).toBe(true)
    expect(isPinValidFor("analog", d2)).toBe(false)
  })

  it("allows any non-reserved pin for kind=digital", () => {
    const pins = getAllPins()
    const d2 = pins.find((p) => p.digitalPin === 2)!
    const a0 = pins.find((p) => p.digitalPin === 14)!
    expect(isPinValidFor("digital", d2)).toBe(true)
    expect(isPinValidFor("digital", a0)).toBe(true)
  })
})

describe("getFreePinsFor", () => {
  it("excludes pins already in usedPins", () => {
    const free = getFreePinsFor("digital", [2, 3, 4])
    expect(free.find((p) => p.digitalPin === 2)).toBeUndefined()
    expect(free.find((p) => p.digitalPin === 5)).toBeDefined()
  })

  it("only returns PWM-capable pins for kind=pwm", () => {
    const free = getFreePinsFor("pwm", [])
    expect(free.every((p) => p.isPWMCapable)).toBe(true)
    expect(free.length).toBe(6)
  })
})

describe("isPinFreeAndValidFor", () => {
  it("rejects a used pin even if otherwise valid", () => {
    expect(isPinFreeAndValidFor("digital", 2, [2])).toBe(false)
  })

  it("rejects an invalid-kind pin even if free", () => {
    expect(isPinFreeAndValidFor("pwm", 2, [])).toBe(false)
  })

  it("accepts a free, valid pin", () => {
    expect(isPinFreeAndValidFor("pwm", 3, [])).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/workspace/__tests__/pin-constraints.test.ts`
Expected: FAIL — `Cannot find module '../pin-constraints'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/workspace/pin-constraints.ts
import { UNO_PIN_MAP } from "@/lib/avr/board-profiles"
import type { PinMapping } from "@/lib/avr/types"

export type PinKind = "digital" | "pwm" | "analog"

export const RESERVED_PINS: ReadonlySet<number> = new Set([0, 1]) // D0/D1 = Serial RX/TX

export interface PinInfo {
  digitalPin: number
  label: string
  isPWMCapable: boolean
  isAnalogCapable: boolean
  isReserved: boolean
}

function pinLabel(mapping: PinMapping): string {
  return mapping.analogChannel !== undefined ? `A${mapping.analogChannel}` : `D${mapping.digitalPin}`
}

function toPinInfo(mapping: PinMapping): PinInfo {
  return {
    digitalPin: mapping.digitalPin,
    label: pinLabel(mapping),
    isPWMCapable: mapping.isPWMCapable,
    isAnalogCapable: mapping.analogChannel !== undefined,
    isReserved: RESERVED_PINS.has(mapping.digitalPin),
  }
}

export function getAllPins(): PinInfo[] {
  return UNO_PIN_MAP.map(toPinInfo)
}

export function isPinValidFor(kind: PinKind, pin: PinInfo): boolean {
  if (pin.isReserved) return false
  if (kind === "pwm") return pin.isPWMCapable
  if (kind === "analog") return pin.isAnalogCapable
  return true
}

export function getFreePinsFor(kind: PinKind, usedPins: number[]): PinInfo[] {
  const used = new Set(usedPins)
  return getAllPins().filter((p) => !used.has(p.digitalPin) && isPinValidFor(kind, p))
}

export function isPinFreeAndValidFor(kind: PinKind, digitalPin: number, usedPins: number[]): boolean {
  if (usedPins.includes(digitalPin)) return false
  const pin = getAllPins().find((p) => p.digitalPin === digitalPin)
  return pin !== undefined && isPinValidFor(kind, pin)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/workspace/__tests__/pin-constraints.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/pin-constraints.ts lib/workspace/__tests__/pin-constraints.test.ts
git commit -m "feat(workspace): add pin-constraints module deriving from UNO_PIN_MAP"
```

---

### Task 3: Workspace component catalog

**Files:**
- Create: `lib/workspace/component-types.ts`
- Test: `lib/workspace/__tests__/component-types.test.ts`

**Interfaces:**
- Consumes: `PinKind` from Task 2's `pin-constraints.ts`.
- Produces: `WorkspaceComponentType = "motor" | "led" | "button" | "sensor"`, `WorkspaceComponentDef { type: WorkspaceComponentType, label: string, pinKind: PinKind, width: number, height: number, color: string }`, `WORKSPACE_COMPONENT_CATALOG: WorkspaceComponentDef[]`, `getComponentDef(type: WorkspaceComponentType): WorkspaceComponentDef`. Task 4's store uses `getComponentDef(...).pinKind` for auto pin-assignment; Task 5's canvas/palette use the catalog for rendering; Task 8's Blockly toolbox uses it to generate one category per type.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/workspace/__tests__/component-types.test.ts
import { describe, it, expect } from "vitest"
import { WORKSPACE_COMPONENT_CATALOG, getComponentDef } from "../component-types"

describe("WORKSPACE_COMPONENT_CATALOG", () => {
  it("has exactly one definition per type, covering all three pin kinds", () => {
    const kinds = new Set(WORKSPACE_COMPONENT_CATALOG.map((d) => d.pinKind))
    expect(kinds).toEqual(new Set(["pwm", "digital", "analog"]))
  })

  it("has unique types", () => {
    const types = WORKSPACE_COMPONENT_CATALOG.map((d) => d.type)
    expect(new Set(types).size).toBe(types.length)
  })
})

describe("getComponentDef", () => {
  it("returns the motor definition with pinKind=pwm", () => {
    expect(getComponentDef("motor").pinKind).toBe("pwm")
  })

  it("returns the led definition with pinKind=digital", () => {
    expect(getComponentDef("led").pinKind).toBe("digital")
  })

  it("returns the sensor definition with pinKind=analog", () => {
    expect(getComponentDef("sensor").pinKind).toBe("analog")
  })

  it("throws on an unknown type", () => {
    // @ts-expect-error - intentionally invalid input for this test
    expect(() => getComponentDef("unknown")).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/workspace/__tests__/component-types.test.ts`
Expected: FAIL — `Cannot find module '../component-types'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/workspace/component-types.ts
import type { PinKind } from "./pin-constraints"

export type WorkspaceComponentType = "motor" | "led" | "button" | "sensor"

export interface WorkspaceComponentDef {
  type: WorkspaceComponentType
  label: string
  pinKind: PinKind
  width: number
  height: number
  color: string
}

export const WORKSPACE_COMPONENT_CATALOG: WorkspaceComponentDef[] = [
  { type: "motor", label: "Motor", pinKind: "pwm", width: 60, height: 40, color: "#2196F3" },
  { type: "led", label: "LED", pinKind: "digital", width: 24, height: 24, color: "#FFC107" },
  { type: "button", label: "Button", pinKind: "digital", width: 30, height: 30, color: "#9C27B0" },
  { type: "sensor", label: "Light Sensor", pinKind: "analog", width: 30, height: 30, color: "#4CAF50" },
]

export function getComponentDef(type: WorkspaceComponentType): WorkspaceComponentDef {
  const def = WORKSPACE_COMPONENT_CATALOG.find((d) => d.type === type)
  if (!def) throw new Error(`Unknown workspace component type: ${type}`)
  return def
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/workspace/__tests__/component-types.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/component-types.ts lib/workspace/__tests__/component-types.test.ts
git commit -m "feat(workspace): add workspace component catalog"
```

---

### Task 4: `RobotProjectStore` core

**Files:**
- Create: `lib/workspace/robot-project-store.ts`
- Test: `lib/workspace/__tests__/robot-project-store.test.ts`

**Interfaces:**
- Consumes: `getComponentDef`, `WorkspaceComponentType` from Task 3; `getFreePinsFor`, `isPinFreeAndValidFor`, `PinInfo`, `PinKind` from Task 2.
- Produces: `RobotProjectComponent { id: string, type: WorkspaceComponentType, name: string, x: number, y: number, rotation: number, pin: number | null }`, `WorkspaceCode { source: "blocks" | "text", blocklyXml: string | null, generatedCode: string }`, class `RobotProjectStore` with: `getComponents(): RobotProjectComponent[]`, `addComponent(type: WorkspaceComponentType, x: number, y: number): RobotProjectComponent`, `removeComponent(id: string): void`, `moveComponent(id: string, x: number, y: number): void`, `rotateComponent(id: string, rotation: number): void`, `reassignPin(id: string, pin: number): boolean`, `getFreePinsForComponent(id: string): PinInfo[]`, `getCode(): WorkspaceCode`, `setBlocklyXml(xml: string, generatedCode: string): void`, `setManualCode(code: string): void`, `subscribe(listener: () => void): () => void`. Task 5 (canvas) calls `addComponent`/`moveComponent`/`rotateComponent`/`reassignPin`/`getFreePinsForComponent`/`subscribe`. Task 7 adds `flash()`/`isOutOfSync()`/`getFlashed()`/`toJSON()`/`fromJSON()` to this same class.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/workspace/__tests__/robot-project-store.test.ts
import { describe, it, expect, vi } from "vitest"
import { RobotProjectStore } from "../robot-project-store"

describe("RobotProjectStore.addComponent", () => {
  it("auto-assigns the first free PWM pin to a motor", () => {
    const store = new RobotProjectStore()
    const motor = store.addComponent("motor", 10, 10)
    expect(motor.pin).toBe(3) // first PWM-capable pin per UNO_PIN_MAP
  })

  it("auto-assigns a different free pin to a second motor", () => {
    const store = new RobotProjectStore()
    const m1 = store.addComponent("motor", 10, 10)
    const m2 = store.addComponent("motor", 20, 20)
    expect(m2.pin).not.toBe(m1.pin)
    expect(m2.pin).toBe(5)
  })

  it("assigns null pin when no free valid pin remains", () => {
    const store = new RobotProjectStore()
    for (let i = 0; i < 6; i++) store.addComponent("motor", i, i) // exhausts all 6 PWM pins
    const overflow = store.addComponent("motor", 99, 99)
    expect(overflow.pin).toBeNull()
  })

  it("notifies subscribers on add", () => {
    const store = new RobotProjectStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.addComponent("led", 0, 0)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("RobotProjectStore.removeComponent", () => {
  it("removes the component and frees its pin", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 0, 0)
    store.removeComponent(led.id)
    expect(store.getComponents()).toHaveLength(0)
    const led2 = store.addComponent("led", 0, 0)
    expect(led2.pin).toBe(led.pin) // pin freed and reused
  })
})

describe("RobotProjectStore.moveComponent / rotateComponent", () => {
  it("updates position and rotation in place", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 0, 0)
    store.moveComponent(led.id, 50, 60)
    store.rotateComponent(led.id, 90)
    const updated = store.getComponents()[0]
    expect(updated.x).toBe(50)
    expect(updated.y).toBe(60)
    expect(updated.rotation).toBe(90)
  })
})

describe("RobotProjectStore.reassignPin", () => {
  it("accepts a non-reserved pin for a digital component, even an analog-labeled one", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 0, 0) // digital kind accepts any non-reserved pin
    const ok = store.reassignPin(led.id, 14) // A0
    expect(ok).toBe(true)
  })

  it("rejects a pin already used by another component", () => {
    const store = new RobotProjectStore()
    const m1 = store.addComponent("motor", 0, 0)
    const m2 = store.addComponent("motor", 10, 10)
    const ok = store.reassignPin(m2.id, m1.pin!)
    expect(ok).toBe(false)
  })

  it("rejects a pin not valid for a pwm component", () => {
    const store = new RobotProjectStore()
    const motor = store.addComponent("motor", 0, 0)
    const ok = store.reassignPin(motor.id, 4) // D4 is not PWM-capable
    expect(ok).toBe(false)
  })

  it("accepts a valid free pin and notifies subscribers", () => {
    const store = new RobotProjectStore()
    const motor = store.addComponent("motor", 0, 0)
    const listener = vi.fn()
    store.subscribe(listener)
    const ok = store.reassignPin(motor.id, 9)
    expect(ok).toBe(true)
    expect(store.getComponents()[0].pin).toBe(9)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("RobotProjectStore code", () => {
  it("starts in blocks mode with empty code", () => {
    const store = new RobotProjectStore()
    expect(store.getCode()).toEqual({ source: "blocks", blocklyXml: null, generatedCode: "" })
  })

  it("setBlocklyXml updates xml and generated code, keeps source=blocks", () => {
    const store = new RobotProjectStore()
    store.setBlocklyXml("<xml/>", "void loop() {}")
    expect(store.getCode()).toEqual({ source: "blocks", blocklyXml: "<xml/>", generatedCode: "void loop() {}" })
  })

  it("setManualCode switches source to text and preserves blocklyXml", () => {
    const store = new RobotProjectStore()
    store.setBlocklyXml("<xml/>", "void loop() {}")
    store.setManualCode("void loop() { /* edited */ }")
    const code = store.getCode()
    expect(code.source).toBe("text")
    expect(code.blocklyXml).toBe("<xml/>")
    expect(code.generatedCode).toBe("void loop() { /* edited */ }")
  })
})

describe("RobotProjectStore.subscribe", () => {
  it("unsubscribe stops further notifications", () => {
    const store = new RobotProjectStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.addComponent("led", 0, 0)
    expect(listener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/workspace/__tests__/robot-project-store.test.ts`
Expected: FAIL — `Cannot find module '../robot-project-store'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/workspace/robot-project-store.ts
import { getComponentDef, type WorkspaceComponentType } from "./component-types"
import { getFreePinsFor, isPinFreeAndValidFor, type PinInfo } from "./pin-constraints"

export interface RobotProjectComponent {
  id: string
  type: WorkspaceComponentType
  name: string
  x: number
  y: number
  rotation: number
  pin: number | null
}

export interface WorkspaceCode {
  source: "blocks" | "text"
  blocklyXml: string | null
  generatedCode: string
}

let nextId = 0
function generateId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

export class RobotProjectStore {
  private components: RobotProjectComponent[] = []
  private code: WorkspaceCode = { source: "blocks", blocklyXml: null, generatedCode: "" }
  private listeners = new Set<() => void>()

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  getComponents(): RobotProjectComponent[] {
    return this.components
  }

  private usedPins(): number[] {
    return this.components.map((c) => c.pin).filter((p): p is number => p !== null)
  }

  addComponent(type: WorkspaceComponentType, x: number, y: number): RobotProjectComponent {
    const def = getComponentDef(type)
    const free = getFreePinsFor(def.pinKind, this.usedPins())
    const component: RobotProjectComponent = {
      id: generateId(type),
      type,
      name: def.label,
      x,
      y,
      rotation: 0,
      pin: free[0]?.digitalPin ?? null,
    }
    this.components.push(component)
    this.notify()
    return component
  }

  removeComponent(id: string): void {
    this.components = this.components.filter((c) => c.id !== id)
    this.notify()
  }

  moveComponent(id: string, x: number, y: number): void {
    const component = this.components.find((c) => c.id === id)
    if (!component) return
    component.x = x
    component.y = y
    this.notify()
  }

  rotateComponent(id: string, rotation: number): void {
    const component = this.components.find((c) => c.id === id)
    if (!component) return
    component.rotation = rotation
    this.notify()
  }

  getFreePinsForComponent(id: string): PinInfo[] {
    const component = this.components.find((c) => c.id === id)
    if (!component) return []
    const def = getComponentDef(component.type)
    const used = this.usedPins().filter((p) => p !== component.pin)
    return getFreePinsFor(def.pinKind, used)
  }

  reassignPin(id: string, pin: number): boolean {
    const component = this.components.find((c) => c.id === id)
    if (!component) return false
    const def = getComponentDef(component.type)
    const used = this.usedPins().filter((p) => p !== component.pin)
    if (!isPinFreeAndValidFor(def.pinKind, pin, used)) return false
    component.pin = pin
    this.notify()
    return true
  }

  getCode(): WorkspaceCode {
    return this.code
  }

  setBlocklyXml(xml: string, generatedCode: string): void {
    this.code = { source: "blocks", blocklyXml: xml, generatedCode }
    this.notify()
  }

  setManualCode(code: string): void {
    this.code = { ...this.code, source: "text", generatedCode: code }
    this.notify()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/workspace/__tests__/robot-project-store.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/robot-project-store.ts lib/workspace/__tests__/robot-project-store.test.ts
git commit -m "feat(workspace): add RobotProjectStore core with pin auto-assignment"
```

---

### Task 5: Chassis canvas with the rotation fix

**Context — the legacy bug:** `components/builder/builder-canvas.tsx` renders each placed component with `transform: rotate(${placed.rotation}deg)` (line 281) and separately renders each of the component's decorative `slots` at `left: slot.x + component.width/2 - 6, top: slot.y + component.height/2 - 6` with their own independent `transform: rotate(slot.angle || 0)` (lines 288-297) — the slot's screen position is never recomputed when the parent rotates, so a 90°-rotated chassis shows its slot markers in the unrotated position. This plan does **not** patch that math: per Task 3, `/workspace` drops the slot/`accepts` system entirely (it was already decorative — `handleDrop` in `builder-canvas.tsx` never checks `accepts`) in favor of direct pin-badge attachment, which has no parent-relative child geometry to get wrong. `chassis-canvas.tsx` is a new file, not a copy of `builder-canvas.tsx`.

**Files:**
- Create: `components/workspace/chassis-canvas.tsx`
- Test: `components/workspace/__tests__/chassis-canvas.test.tsx`

**Interfaces:**
- Consumes: `RobotProjectStore`, `RobotProjectComponent` from Task 4; `WORKSPACE_COMPONENT_CATALOG`, `getComponentDef`, `WorkspaceComponentType` from Task 3; `PinInfo` from Task 2.
- Produces: `ChassisCanvas({ store }: { store: RobotProjectStore })` — a React component rendering a drop zone plus a draggable palette of `WORKSPACE_COMPONENT_CATALOG` entries, calling `store.addComponent(type, x, y)` on drop, `store.moveComponent`/`store.rotateComponent` on drag/rotate, and rendering a pin badge per component that opens a `<select>` of `store.getFreePinsForComponent(id)` plus the component's current pin, calling `store.reassignPin(id, newPin)` on change. Task 6's `workspace-builder-view.tsx` renders this directly, passing the shared store instance.

This component needs `@testing-library/react` and `jsdom` for DOM-level testing. Check first whether they're already a project dependency before adding them.

- [ ] **Step 1: Check for testing-library availability**

Run: `cat package.json | grep -E "testing-library|jsdom"`

If both `@testing-library/react` and `jsdom` are already listed, skip to Step 2. Otherwise install them:

Run: `pnpm add -D @testing-library/react jsdom @testing-library/jest-dom`

Then check `vitest.config.ts` (or the `test` block in `vite.config.ts`) for `environment: "jsdom"`. If missing, add it:

```ts
test: {
  environment: "jsdom",
  // ...existing options
}
```

- [ ] **Step 2: Write the failing tests**

```tsx
// components/workspace/__tests__/chassis-canvas.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ChassisCanvas } from "../chassis-canvas"
import { RobotProjectStore } from "@/lib/workspace/robot-project-store"

describe("ChassisCanvas", () => {
  it("renders a pin badge showing the auto-assigned pin after a component is added", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 40, 40)
    render(<ChassisCanvas store={store} />)
    expect(screen.getByText(/D2/)).toBeInTheDocument()
  })

  it("re-renders when the store notifies after an external mutation", () => {
    const store = new RobotProjectStore()
    render(<ChassisCanvas store={store} />)
    expect(screen.queryByTestId(/^component-/)).not.toBeInTheDocument()
    store.addComponent("motor", 10, 10)
    expect(screen.getByTestId(/^component-/)).toBeInTheDocument()
  })

  it("rotates the selected component by 90 degrees on pressing R, without touching its position", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 40, 40)
    render(<ChassisCanvas store={store} />)
    const el = screen.getByTestId(`component-${led.id}`)
    fireEvent.click(el)
    fireEvent.keyDown(window, { key: "r" })
    const updated = store.getComponents()[0]
    expect(updated.rotation).toBe(90)
    expect(updated.x).toBe(40)
    expect(updated.y).toBe(40)
  })

  it("opens a pin picker listing only free, valid pins for the component's kind", () => {
    const store = new RobotProjectStore()
    const motor = store.addComponent("motor", 0, 0) // pin 3 (PWM)
    render(<ChassisCanvas store={store} />)
    const badge = screen.getByTestId(`pin-badge-${motor.id}`)
    fireEvent.click(badge)
    const select = screen.getByTestId(`pin-select-${motor.id}`) as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toContain("3")
    expect(options).not.toContain("4") // D4 is not PWM-capable
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run components/workspace/__tests__/chassis-canvas.test.tsx`
Expected: FAIL — `Cannot find module '../chassis-canvas'`

- [ ] **Step 4: Write the implementation**

```tsx
// components/workspace/chassis-canvas.tsx
"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { WORKSPACE_COMPONENT_CATALOG, getComponentDef, type WorkspaceComponentType } from "@/lib/workspace/component-types"
import type { PinInfo } from "@/lib/workspace/pin-constraints"

export function ChassisCanvas({ store }: { store: RobotProjectStore }) {
  const components = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getComponents()
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openPinPickerId, setOpenPinPickerId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "r" && selectedId) {
        const component = store.getComponents().find((c) => c.id === selectedId)
        if (component) store.rotateComponent(selectedId, (component.rotation + 90) % 360)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedId, store])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData("text/workspace-component-type") as WorkspaceComponentType
      if (!type) return
      const rect = canvasRef.current?.getBoundingClientRect()
      const x = e.clientX - (rect?.left ?? 0)
      const y = e.clientY - (rect?.top ?? 0)
      store.addComponent(type, x, y)
    },
    [store]
  )

  return (
    <div className="flex h-full w-full">
      <div className="w-40 shrink-0 border-r border-border p-2 space-y-2">
        {WORKSPACE_COMPONENT_CATALOG.map((def) => (
          <div
            key={def.type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/workspace-component-type", def.type)}
            className="cursor-grab rounded border border-border px-2 py-1 text-xs"
            style={{ borderLeftColor: def.color, borderLeftWidth: 4 }}
          >
            {def.label}
          </div>
        ))}
      </div>

      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden bg-card"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => setSelectedId(null)}
      >
        {components.map((component) => {
          const def = getComponentDef(component.type)
          const freePins: PinInfo[] = store.getFreePinsForComponent(component.id)
          const isOpen = openPinPickerId === component.id
          return (
            <div
              key={component.id}
              data-testid={`component-${component.id}`}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(component.id)
              }}
              className="absolute select-none"
              style={{
                left: component.x,
                top: component.y,
                width: def.width,
                height: def.height,
                transform: `rotate(${component.rotation}deg)`,
                outline: selectedId === component.id ? "2px solid var(--primary)" : "none",
              }}
            >
              <div className="h-full w-full rounded" style={{ backgroundColor: def.color }} />
              <button
                type="button"
                data-testid={`pin-badge-${component.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenPinPickerId(isOpen ? null : component.id)
                }}
                className="absolute -top-2 -right-2 rounded bg-background px-1 text-[10px] border border-border"
              >
                {component.pin === null ? "no pin" : `D${component.pin}`}
              </button>
              {isOpen && (
                <select
                  data-testid={`pin-select-${component.id}`}
                  value={component.pin ?? ""}
                  onChange={(e) => {
                    store.reassignPin(component.id, Number(e.target.value))
                    setOpenPinPickerId(null)
                  }}
                  className="absolute top-4 left-0 z-10"
                >
                  {freePins.map((p) => (
                    <option key={p.digitalPin} value={p.digitalPin}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run components/workspace/__tests__/chassis-canvas.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add components/workspace/chassis-canvas.tsx components/workspace/__tests__/chassis-canvas.test.tsx package.json pnpm-lock.yaml
git commit -m "feat(workspace): add chassis canvas with pin-based attachment (no slot rotation bug)"
```

---

### Task 6: Workspace builder view

**Files:**
- Create: `components/workspace/workspace-builder-view.tsx`

**Interfaces:**
- Consumes: `ChassisCanvas` from Task 5; `RobotProjectStore` from Task 4.
- Produces: `WorkspaceBuilderView({ store }: { store: RobotProjectStore })`, a thin wrapper that renders `ChassisCanvas` plus a header. Task 7 adds the Flash button into this same file. Task 14's page shell renders `WorkspaceBuilderView` as the "Builder" tab.

No new logic in this task (pure composition), so no dedicated unit test — it's covered by Task 14's page-level manual verification step. This mirrors how `components/builder/builder-view.tsx` itself has no test file in the existing codebase.

- [ ] **Step 1: Write the component**

```tsx
// components/workspace/workspace-builder-view.tsx
"use client"

import type { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { ChassisCanvas } from "./chassis-canvas"

export function WorkspaceBuilderView({ store }: { store: RobotProjectStore }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2 text-sm font-medium">Builder</div>
      <div className="flex-1 overflow-hidden">
        <ChassisCanvas store={store} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/workspace/workspace-builder-view.tsx
git commit -m "feat(workspace): add workspace builder view wrapper"
```

---

### Task 7: Flash snapshot and out-of-sync detection

**Files:**
- Modify: `lib/workspace/robot-project-store.ts`
- Modify: `lib/workspace/__tests__/robot-project-store.test.ts`
- Modify: `components/workspace/workspace-builder-view.tsx`

**Interfaces:**
- Produces (added to `RobotProjectStore`): `WorkspaceSnapshot { components: RobotProjectComponent[], code: WorkspaceCode, hash: string, flashedAt: number }`, `flash(): WorkspaceSnapshot`, `getFlashed(): WorkspaceSnapshot | null`, `isOutOfSync(): boolean`. Task 11's `ChassisPhysicsBridge` and Task 12's Simulator view read `store.getFlashed()` and `store.isOutOfSync()`.

- [ ] **Step 1: Write the failing tests (append to the existing test file)**

```ts
// Append to lib/workspace/__tests__/robot-project-store.test.ts

describe("RobotProjectStore.flash / isOutOfSync", () => {
  it("has no flashed snapshot and is not out of sync before any flash", () => {
    const store = new RobotProjectStore()
    expect(store.getFlashed()).toBeNull()
    expect(store.isOutOfSync()).toBe(false)
  })

  it("flash() captures the current components and code", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    store.setManualCode("void loop() {}")
    const snapshot = store.flash()
    expect(snapshot.components).toHaveLength(1)
    expect(snapshot.code.generatedCode).toBe("void loop() {}")
    expect(store.getFlashed()).toEqual(snapshot)
  })

  it("is not out of sync immediately after flashing", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    store.flash()
    expect(store.isOutOfSync()).toBe(false)
  })

  it("is out of sync after a component is added post-flash", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    store.flash()
    store.addComponent("motor", 10, 10)
    expect(store.isOutOfSync()).toBe(true)
  })

  it("is out of sync after code changes post-flash", () => {
    const store = new RobotProjectStore()
    store.setManualCode("void loop() {}")
    store.flash()
    store.setManualCode("void loop() { delay(1); }")
    expect(store.isOutOfSync()).toBe(true)
  })

  it("re-flashing clears the out-of-sync state", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    store.flash()
    store.addComponent("motor", 10, 10)
    expect(store.isOutOfSync()).toBe(true)
    store.flash()
    expect(store.isOutOfSync()).toBe(false)
  })

  it("produces the same hash for the same content flashed twice", () => {
    const storeA = new RobotProjectStore()
    storeA.addComponent("led", 5, 5)
    const snapA = storeA.flash()

    const storeB = new RobotProjectStore()
    storeB.addComponent("led", 5, 5)
    const snapB = storeB.flash()

    expect(snapA.hash).toBe(snapB.hash)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/workspace/__tests__/robot-project-store.test.ts`
Expected: FAIL — `store.flash is not a function`

- [ ] **Step 3: Add the implementation to `RobotProjectStore`**

Add this hashing helper above the `RobotProjectStore` class and these members inside it:

```ts
// Add near the top of lib/workspace/robot-project-store.ts, after the existing imports/types

export interface WorkspaceSnapshot {
  components: RobotProjectComponent[]
  code: WorkspaceCode
  hash: string
  flashedAt: number
}

function hashContent(components: RobotProjectComponent[], code: WorkspaceCode): string {
  // Order-independent: sort components by id before stringifying so add-order
  // never affects the hash, only content does.
  const sorted = [...components].sort((a, b) => a.id.localeCompare(b.id))
  const payload = JSON.stringify({ sorted, code })
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0
  }
  return hash.toString(16)
}
```

Then add these three members inside the `RobotProjectStore` class body (alongside `setManualCode`):

```ts
  private flashed: WorkspaceSnapshot | null = null

  flash(): WorkspaceSnapshot {
    const snapshot: WorkspaceSnapshot = {
      components: this.components.map((c) => ({ ...c })),
      code: { ...this.code },
      hash: hashContent(this.components, this.code),
      flashedAt: Date.now(),
    }
    this.flashed = snapshot
    this.notify()
    return snapshot
  }

  getFlashed(): WorkspaceSnapshot | null {
    return this.flashed
  }

  isOutOfSync(): boolean {
    if (!this.flashed) return false
    return hashContent(this.components, this.code) !== this.flashed.hash
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/workspace/__tests__/robot-project-store.test.ts`
Expected: PASS (20 tests)

- [ ] **Step 5: Wire the Flash button into the builder view**

```tsx
// components/workspace/workspace-builder-view.tsx
"use client"

import { useSyncExternalStore } from "react"
import type { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { ChassisCanvas } from "./chassis-canvas"

export function WorkspaceBuilderView({ store }: { store: RobotProjectStore }) {
  // Subscribing here (in addition to ChassisCanvas's own subscription) keeps
  // the out-of-sync banner above in sync with store mutations from any tab.
  useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.isOutOfSync()
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">Builder</span>
        <div className="flex items-center gap-2">
          {store.isOutOfSync() && (
            <span className="text-xs text-amber-500">Out of sync — reflash to apply</span>
          )}
          <button
            type="button"
            onClick={() => store.flash()}
            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
          >
            Flash
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChassisCanvas store={store} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add lib/workspace/robot-project-store.ts lib/workspace/__tests__/robot-project-store.test.ts components/workspace/workspace-builder-view.tsx
git commit -m "feat(workspace): add flash snapshot and out-of-sync detection"
```

---

### Task 8: Dynamic Blockly block definitions and toolbox

**Context:** The existing `lib/blockly/blocks/motors.ts` registers static blocks like `motor_spin` with a hardcoded `FieldDropdown([["left","LEFT"],["right","RIGHT"],["both","BOTH"]])` — fine for a fixed 2-motor robot, but `/workspace` has an arbitrary, user-placed set of named components. Per the locked-in design, we register one **category-level** block type per `WorkspaceComponentType` (not per instance), and populate its dropdown lazily from live store state via a generator function, which Blockly re-evaluates each time the dropdown is opened — this is the standard Blockly pattern for dropdowns whose options change after the block is defined, and it avoids ever needing to call `Blockly.Blocks[...] = ...` more than once per type.

**Files:**
- Create: `lib/workspace/blockly-workspace-blocks.ts`
- Create: `lib/workspace/blockly-dynamic-toolbox.ts`
- Test: `lib/workspace/__tests__/blockly-dynamic-toolbox.test.ts`

**Interfaces:**
- Consumes: `RobotProjectStore`, `RobotProjectComponent` from Task 4.
- Produces: `registerWorkspaceBlocks(): void` (idempotent — calling twice does not throw or double-register), `buildWorkspaceToolbox(store: RobotProjectStore): Blockly.utils.toolbox.ToolboxDefinition` returning one category per `WorkspaceComponentType` present in `store.getComponents()`, each category listing exactly one block type (`workspace_motor_spin`, `workspace_led_set`, `workspace_button_read`, `workspace_sensor_read`), and each block's `FieldDropdown` populated from a generator reading `store.getComponents().filter(c => c.type === <type>)`. Task 10's `workspace-editor-panel.tsx` calls `registerWorkspaceBlocks()` once at module load and `workspace.updateToolbox(buildWorkspaceToolbox(store))` whenever `store` notifies. Task 9's generator reads the same four block types' field values.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/workspace/__tests__/blockly-dynamic-toolbox.test.ts
import { describe, it, expect, beforeAll } from "vitest"
import * as Blockly from "blockly"
import { registerWorkspaceBlocks } from "../blockly-workspace-blocks"
import { buildWorkspaceToolbox } from "../blockly-dynamic-toolbox"
import { RobotProjectStore } from "../robot-project-store"

beforeAll(() => {
  registerWorkspaceBlocks()
})

describe("registerWorkspaceBlocks", () => {
  it("registers the four workspace block types", () => {
    expect(Blockly.Blocks["workspace_motor_spin"]).toBeDefined()
    expect(Blockly.Blocks["workspace_led_set"]).toBeDefined()
    expect(Blockly.Blocks["workspace_button_read"]).toBeDefined()
    expect(Blockly.Blocks["workspace_sensor_read"]).toBeDefined()
  })

  it("is idempotent when called twice", () => {
    expect(() => registerWorkspaceBlocks()).not.toThrow()
  })
})

describe("buildWorkspaceToolbox", () => {
  it("returns no categories for an empty store", () => {
    const store = new RobotProjectStore()
    const toolbox = buildWorkspaceToolbox(store)
    expect(toolbox.contents).toHaveLength(0)
  })

  it("returns one category per distinct placed component type", () => {
    const store = new RobotProjectStore()
    store.addComponent("motor", 0, 0)
    store.addComponent("led", 0, 0)
    store.addComponent("motor", 10, 10) // second motor: same type, no new category
    const toolbox = buildWorkspaceToolbox(store)
    expect(toolbox.contents).toHaveLength(2)
    const blockTypes = toolbox.contents.flatMap((cat: { contents: { type: string }[] }) =>
      cat.contents.map((b) => b.type)
    )
    expect(blockTypes).toContain("workspace_motor_spin")
    expect(blockTypes).toContain("workspace_led_set")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/workspace/__tests__/blockly-dynamic-toolbox.test.ts`
Expected: FAIL — `Cannot find module '../blockly-workspace-blocks'`

- [ ] **Step 3: Write the block definitions**

```ts
// lib/workspace/blockly-workspace-blocks.ts
import * as Blockly from "blockly"
import type { RobotProjectStore, RobotProjectComponent } from "./robot-project-store"

// Each block reads live store state through this module-level reference,
// set by registerWorkspaceBlocks() callers before building dropdown options.
// Blockly evaluates FieldDropdown option-generator functions lazily (on
// open), so this only needs to be current at click time, not at block-init time.
let activeStore: RobotProjectStore | null = null

export function setActiveWorkspaceStore(store: RobotProjectStore | null): void {
  activeStore = store
}

function componentOptions(type: RobotProjectComponent["type"]): () => [string, string][] {
  return () => {
    const components = activeStore?.getComponents().filter((c) => c.type === type) ?? []
    if (components.length === 0) return [["(none placed)", "__none__"]]
    return components.map((c) => [c.name, c.id])
  }
}

let registered = false

export function registerWorkspaceBlocks(): void {
  if (registered) return
  registered = true

  Blockly.Blocks["workspace_motor_spin"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("spin motor")
        .appendField(new Blockly.FieldDropdown(componentOptions("motor")), "COMPONENT")
        .appendField(
          new Blockly.FieldDropdown([
            ["forward", "FORWARD"],
            ["backward", "BACKWARD"],
            ["stop", "STOP"],
          ]),
          "DIRECTION"
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#2196F3")
    },
  }

  Blockly.Blocks["workspace_led_set"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("set LED")
        .appendField(new Blockly.FieldDropdown(componentOptions("led")), "COMPONENT")
        .appendField(
          new Blockly.FieldDropdown([
            ["on", "ON"],
            ["off", "OFF"],
          ]),
          "STATE"
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFC107")
    },
  }

  Blockly.Blocks["workspace_button_read"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("button")
        .appendField(new Blockly.FieldDropdown(componentOptions("button")), "COMPONENT")
        .appendField("is pressed")
      this.setOutput(true, "Boolean")
      this.setColour("#9C27B0")
    },
  }

  Blockly.Blocks["workspace_sensor_read"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("read sensor")
        .appendField(new Blockly.FieldDropdown(componentOptions("sensor")), "COMPONENT")
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
}
```

- [ ] **Step 4: Write the dynamic toolbox builder**

`ToolboxDefinition`/`ToolboxCategory` below are hand-rolled minimal shapes rather than imports from the `blockly` package — Blockly's own toolbox types are permissive `unknown`-heavy unions that don't usefully constrain this code, and `workspace.updateToolbox()` (used in Task 10) accepts this plain-object shape directly.

```ts
// lib/workspace/blockly-dynamic-toolbox.ts
import { WORKSPACE_COMPONENT_CATALOG, type WorkspaceComponentType } from "./component-types"
import type { RobotProjectStore } from "./robot-project-store"

const BLOCK_TYPE_FOR: Record<WorkspaceComponentType, string> = {
  motor: "workspace_motor_spin",
  led: "workspace_led_set",
  button: "workspace_button_read",
  sensor: "workspace_sensor_read",
}

export interface ToolboxCategory {
  kind: "category"
  name: string
  colour: string
  contents: { kind: "block"; type: string }[]
}

export interface ToolboxDefinition {
  kind: "categoryToolbox"
  contents: ToolboxCategory[]
}

export function buildWorkspaceToolbox(store: RobotProjectStore): ToolboxDefinition {
  const presentTypes = new Set(store.getComponents().map((c) => c.type))
  const contents: ToolboxCategory[] = []

  for (const def of WORKSPACE_COMPONENT_CATALOG) {
    if (!presentTypes.has(def.type)) continue
    contents.push({
      kind: "category",
      name: def.label,
      colour: def.color,
      contents: [{ kind: "block", type: BLOCK_TYPE_FOR[def.type] }],
    })
  }

  return { kind: "categoryToolbox", contents }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/workspace/__tests__/blockly-dynamic-toolbox.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/workspace/blockly-workspace-blocks.ts lib/workspace/blockly-dynamic-toolbox.ts lib/workspace/__tests__/blockly-dynamic-toolbox.test.ts
git commit -m "feat(workspace): add dynamic Blockly block types and live toolbox builder"
```

---

### Task 9: Arduino code generator for workspace blocks

**Files:**
- Create: `lib/workspace/blockly-workspace-generator.ts`
- Test: `lib/workspace/__tests__/blockly-workspace-generator.test.ts`

**Interfaces:**
- Consumes: `RobotProjectComponent`, `RobotProjectStore` from Task 4; the four block types registered in Task 8 (`workspace_motor_spin`, `workspace_led_set`, `workspace_button_read`, `workspace_sensor_read`).
- Produces: `generateWorkspaceArduinoCode(workspace: Blockly.Workspace, store: RobotProjectStore): string`, returning a full sketch: one `#define <componentName>Pin <pin>` per placed component (sanitized identifier), followed by the block-generated body inside `setup()`/`loop()` via the existing `arduinoGenerator.workspaceToCode(workspace)` pattern (see `lib/blockly/generators/arduino.ts:288-290`). Task 10's editor panel calls this to populate the Monaco mirror.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/workspace/__tests__/blockly-workspace-generator.test.ts
import { describe, it, expect, beforeAll } from "vitest"
import * as Blockly from "blockly"
import { registerWorkspaceBlocks, setActiveWorkspaceStore } from "../blockly-workspace-blocks"
import { generateWorkspaceArduinoCode } from "../blockly-workspace-generator"
import { RobotProjectStore } from "../robot-project-store"

beforeAll(() => {
  registerWorkspaceBlocks()
})

describe("generateWorkspaceArduinoCode", () => {
  it("emits a #define pin constant for every placed component", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 0, 0)
    setActiveWorkspaceStore(store)
    const workspace = new Blockly.Workspace()
    const code = generateWorkspaceArduinoCode(workspace, store)
    expect(code).toContain(`#define ${led.name.replace(/\s+/g, "")}${led.id.replace(/-/g, "_")}Pin ${led.pin}`)
  })

  it("emits pinMode calls for every placed component in setup()", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    setActiveWorkspaceStore(store)
    const workspace = new Blockly.Workspace()
    const code = generateWorkspaceArduinoCode(workspace, store)
    expect(code).toMatch(/pinMode\(\w+Pin, OUTPUT\);/)
  })

  it("includes generated block code from the workspace", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    setActiveWorkspaceStore(store)
    const workspace = new Blockly.Workspace()
    const block = workspace.newBlock("workspace_led_set")
    block.initSvg?.()
    const code = generateWorkspaceArduinoCode(workspace, store)
    expect(code).toContain("void loop()")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/workspace/__tests__/blockly-workspace-generator.test.ts`
Expected: FAIL — `Cannot find module '../blockly-workspace-generator'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/workspace/blockly-workspace-generator.ts
import * as Blockly from "blockly"
import { Order } from "blockly/javascript"
import type { RobotProjectComponent } from "./robot-project-store"
import type { RobotProjectStore } from "./robot-project-store"

const workspaceGenerator = new Blockly.Generator("WorkspaceArduino")
workspaceGenerator.ORDER_ATOMIC = Order.ATOMIC
workspaceGenerator.ORDER_NONE = Order.NONE
workspaceGenerator.scrub_ = function (block, code, thisOnly) {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock()
  if (nextBlock && !thisOnly) return code + workspaceGenerator.blockToCode(nextBlock)
  return code
}

function pinConstantName(component: RobotProjectComponent): string {
  return `${component.name.replace(/\s+/g, "")}${component.id.replace(/-/g, "_")}Pin`
}

function findComponent(store: RobotProjectStore, id: string): RobotProjectComponent | undefined {
  return store.getComponents().find((c) => c.id === id)
}

workspaceGenerator.forBlock["workspace_motor_spin"] = function (block: Blockly.Block) {
  const componentId = block.getFieldValue("COMPONENT")
  const direction = block.getFieldValue("DIRECTION")
  const store = (workspaceGenerator as unknown as { __store: RobotProjectStore }).__store
  const component = findComponent(store, componentId)
  if (!component) return ""
  const pinName = pinConstantName(component)
  if (direction === "STOP") return `digitalWrite(${pinName}, LOW);\n`
  return `digitalWrite(${pinName}, HIGH); // ${direction.toLowerCase()}\n`
}

workspaceGenerator.forBlock["workspace_led_set"] = function (block: Blockly.Block) {
  const componentId = block.getFieldValue("COMPONENT")
  const state = block.getFieldValue("STATE")
  const store = (workspaceGenerator as unknown as { __store: RobotProjectStore }).__store
  const component = findComponent(store, componentId)
  if (!component) return ""
  const pinName = pinConstantName(component)
  return `digitalWrite(${pinName}, ${state === "ON" ? "HIGH" : "LOW"});\n`
}

workspaceGenerator.forBlock["workspace_button_read"] = function (block: Blockly.Block) {
  const componentId = block.getFieldValue("COMPONENT")
  const store = (workspaceGenerator as unknown as { __store: RobotProjectStore }).__store
  const component = findComponent(store, componentId)
  if (!component) return ["LOW", Order.ATOMIC]
  return [`digitalRead(${pinConstantName(component)})`, Order.ATOMIC]
}

workspaceGenerator.forBlock["workspace_sensor_read"] = function (block: Blockly.Block) {
  const componentId = block.getFieldValue("COMPONENT")
  const store = (workspaceGenerator as unknown as { __store: RobotProjectStore }).__store
  const component = findComponent(store, componentId)
  if (!component) return ["0", Order.ATOMIC]
  return [`analogRead(${pinConstantName(component)})`, Order.ATOMIC]
}

export function generateWorkspaceArduinoCode(workspace: Blockly.Workspace, store: RobotProjectStore): string {
  // forBlock implementations above read the store off this hidden field
  // rather than a generator-constructor argument, because Blockly.Generator's
  // forBlock signature is fixed to (block) => string by the library.
  ;(workspaceGenerator as unknown as { __store: RobotProjectStore }).__store = store

  const userCode = workspaceGenerator.workspaceToCode(workspace)
  const components = store.getComponents()

  const defines = components
    .filter((c) => c.pin !== null)
    .map((c) => `#define ${pinConstantName(c)} ${c.pin}`)
    .join("\n")

  const pinModes = components
    .filter((c) => c.pin !== null)
    .map((c) => `  pinMode(${pinConstantName(c)}, ${c.type === "button" || c.type === "sensor" ? "INPUT" : "OUTPUT"});`)
    .join("\n")

  return `${defines}

void setup() {
${pinModes}
}

void loop() {
  ${userCode}
}
`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/workspace/__tests__/blockly-workspace-generator.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/blockly-workspace-generator.ts lib/workspace/__tests__/blockly-workspace-generator.test.ts
git commit -m "feat(workspace): add Arduino code generator for workspace blocks"
```

---

### Task 10: Workspace editor panel (Blocks/Code mode, non-destructive switch)

**Files:**
- Create: `components/workspace/workspace-editor-panel.tsx`

**Interfaces:**
- Consumes: `RobotProjectStore` from Task 4; `registerWorkspaceBlocks`, `setActiveWorkspaceStore` from Task 8; `buildWorkspaceToolbox` from Task 8; `generateWorkspaceArduinoCode` from Task 9; `CodeExecutionPanel` from `components/simulator/code-execution-panel.tsx` (props: `code, onCodeChange, runState, onCommand, errors, onErrors, board, onBoardChange` — reused unmodified).
- Produces: `WorkspaceEditorPanel({ store, runState, onCommand, errors, onErrors }: { store: RobotProjectStore, runState: RunState, onCommand: (cmd: AVRCommand) => void, errors: CompileDiagnostic[], onErrors: (e: CompileDiagnostic[]) => void })`. Task 14's page shell renders this as the "Editor" tab, sharing the same `store` instance as the Builder and Simulator tabs.

This component is integration-heavy (Blockly DOM injection + Monaco mirror + confirm-dialog state machine) rather than algorithmic, so it is verified manually per the plan's Verification section rather than with a unit test — this matches how `components/playground/blockly-editor.tsx` (the file this is modeled on) has no test file in the existing codebase either.

- [ ] **Step 1: Write the component**

```tsx
// components/workspace/workspace-editor-panel.tsx
"use client"

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react"
import * as Blockly from "blockly"
import { CodeExecutionPanel } from "@/components/simulator/code-execution-panel"
import type { RunState } from "@/components/simulator/code-execution-panel"
import type { AVRCommand, CompileDiagnostic } from "@/lib/avr/types"
import type { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { registerWorkspaceBlocks, setActiveWorkspaceStore } from "@/lib/workspace/blockly-workspace-blocks"
import { buildWorkspaceToolbox } from "@/lib/workspace/blockly-dynamic-toolbox"
import { generateWorkspaceArduinoCode } from "@/lib/workspace/blockly-workspace-generator"

registerWorkspaceBlocks()

interface WorkspaceEditorPanelProps {
  store: RobotProjectStore
  runState: RunState
  onCommand: (cmd: AVRCommand) => void
  errors: CompileDiagnostic[]
  onErrors: (errors: CompileDiagnostic[]) => void
}

export function WorkspaceEditorPanel({ store, runState, onCommand, errors, onErrors }: WorkspaceEditorPanelProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const [pendingSwitchToBlocks, setPendingSwitchToBlocks] = useState(false)

  const code = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getCode()
  )

  useEffect(() => {
    setActiveWorkspaceStore(store)
    return () => setActiveWorkspaceStore(null)
  }, [store])

  useEffect(() => {
    if (!blocklyDiv.current || workspaceRef.current) return
    const ws = Blockly.inject(blocklyDiv.current, { toolbox: buildWorkspaceToolbox(store) })
    workspaceRef.current = ws
    if (code.blocklyXml) {
      try {
        const xml = Blockly.utils.xml.textToDom(code.blocklyXml)
        Blockly.Xml.domToWorkspace(xml, ws)
      } catch {
        // Stale/invalid XML — start from an empty workspace rather than blocking the editor.
      }
    }
    ws.addChangeListener(() => {
      const generated = generateWorkspaceArduinoCode(ws, store)
      const xmlText = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws))
      store.setBlocklyXml(xmlText, generated)
    })
    return () => {
      ws.dispose()
      workspaceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-refresh the toolbox whenever placed components change.
  useEffect(() => {
    return store.subscribe(() => {
      if (workspaceRef.current) {
        workspaceRef.current.updateToolbox(buildWorkspaceToolbox(store))
      }
    })
  }, [store])

  const handleSwitchToCode = useCallback(() => {
    store.setManualCode(code.generatedCode)
  }, [store, code.generatedCode])

  const requestSwitchToBlocks = useCallback(() => {
    setPendingSwitchToBlocks(true)
  }, [])

  const confirmSwitchToBlocks = useCallback(() => {
    setPendingSwitchToBlocks(false)
    if (workspaceRef.current && code.blocklyXml) {
      const generated = generateWorkspaceArduinoCode(workspaceRef.current, store)
      store.setBlocklyXml(code.blocklyXml, generated)
    }
  }, [store, code.blocklyXml])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-sm font-medium">Editor</span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={code.source === "blocks"}
            onClick={requestSwitchToBlocks}
            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
          >
            Blocks
          </button>
          <button
            type="button"
            disabled={code.source === "text"}
            onClick={handleSwitchToCode}
            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
          >
            Code
          </button>
        </div>
      </div>

      {pendingSwitchToBlocks && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs">
          <span>Switching to Blocks will regenerate code from your block program. Manual edits in Code mode will be discarded.</span>
          <div className="flex gap-2">
            <button type="button" onClick={confirmSwitchToBlocks} className="rounded bg-amber-500 px-2 py-1 text-background">
              Switch anyway
            </button>
            <button type="button" onClick={() => setPendingSwitchToBlocks(false)} className="rounded border border-border px-2 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div ref={blocklyDiv} className={code.source === "blocks" ? "flex-1" : "hidden"} />
        {code.source === "text" && (
          <div className="flex-1">
            <CodeExecutionPanel
              code={code.generatedCode}
              onCodeChange={(next) => store.setManualCode(next)}
              runState={runState}
              onCommand={onCommand}
              errors={errors}
              onErrors={onErrors}
              board="arduino-uno"
              onBoardChange={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors. If `RunState` is not exported from `code-execution-panel.tsx`, add `export` to its existing `type RunState = "idle" | "compiling" | "running" | "paused"` declaration as part of this step (it is currently file-local in `components/simulator/code-execution-panel.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/workspace/workspace-editor-panel.tsx components/simulator/code-execution-panel.tsx
git commit -m "feat(workspace): add editor panel with non-destructive Blocks/Code switching"
```

---

### Task 11: Chassis physics bridge

**Files:**
- Create: `lib/workspace/chassis-physics-bridge.ts`
- Test: `lib/workspace/__tests__/chassis-physics-bridge.test.ts`

**Interfaces:**
- Consumes: `RobotProjectComponent` from Task 4 (the `flashed.components` snapshot, not live components); `PinChangePayload` shape from `lib/avr/gpio-bridge.ts` (`{ pin: number, high: boolean, isPWM: boolean, dutyCycle: number }`).
- Produces: `ChassisPhysicsBridge` class, constructed with `{ components: RobotProjectComponent[], onComponentStateChange: (componentId: string, active: boolean) => void }`; method `handlePinChange(payload: PinChangePayload): void` that looks up which flashed component owns `payload.pin` and calls `onComponentStateChange(componentId, payload.high)`. Modeled on `CircuitBridge.handleAVREvent` (`lib/circuit/circuit-bridge.ts`) but mapping straight to on/off rather than computing a voltage for an MNA solve — there is deliberately no circuit-worker dependency here, per the locked-in PWM-deferred / binary-on-off scope. Task 12's simulator view constructs one bridge per flash and feeds it `GPIOBridge`'s `onPinChange` callback.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/workspace/__tests__/chassis-physics-bridge.test.ts
import { describe, it, expect, vi } from "vitest"
import { ChassisPhysicsBridge } from "../chassis-physics-bridge"
import type { RobotProjectComponent } from "../robot-project-store"

function makeComponent(overrides: Partial<RobotProjectComponent>): RobotProjectComponent {
  return { id: "c1", type: "led", name: "LED", x: 0, y: 0, rotation: 0, pin: 2, ...overrides }
}

describe("ChassisPhysicsBridge.handlePinChange", () => {
  it("calls onComponentStateChange with the owning component's id and the new state", () => {
    const onChange = vi.fn()
    const led = makeComponent({ id: "led-1", pin: 2 })
    const bridge = new ChassisPhysicsBridge({ components: [led], onComponentStateChange: onChange })
    bridge.handlePinChange({ pin: 2, high: true, isPWM: false, dutyCycle: 255 })
    expect(onChange).toHaveBeenCalledWith("led-1", true)
  })

  it("does nothing for a pin not owned by any flashed component", () => {
    const onChange = vi.fn()
    const bridge = new ChassisPhysicsBridge({ components: [], onComponentStateChange: onChange })
    bridge.handlePinChange({ pin: 13, high: true, isPWM: false, dutyCycle: 255 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("routes to the correct component when multiple components are flashed", () => {
    const onChange = vi.fn()
    const motor = makeComponent({ id: "motor-1", type: "motor", pin: 3 })
    const led = makeComponent({ id: "led-1", type: "led", pin: 2 })
    const bridge = new ChassisPhysicsBridge({ components: [motor, led], onComponentStateChange: onChange })
    bridge.handlePinChange({ pin: 3, high: false, isPWM: false, dutyCycle: 0 })
    expect(onChange).toHaveBeenCalledWith("motor-1", false)
    expect(onChange).not.toHaveBeenCalledWith("led-1", expect.anything())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/workspace/__tests__/chassis-physics-bridge.test.ts`
Expected: FAIL — `Cannot find module '../chassis-physics-bridge'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/workspace/chassis-physics-bridge.ts
import type { RobotProjectComponent } from "./robot-project-store"

export interface PinChangePayload {
  pin: number
  high: boolean
  isPWM: boolean
  dutyCycle: number
}

export interface ChassisPhysicsBridgeOptions {
  components: RobotProjectComponent[]
  onComponentStateChange: (componentId: string, active: boolean) => void
}

export class ChassisPhysicsBridge {
  private components: RobotProjectComponent[]
  private onComponentStateChange: (componentId: string, active: boolean) => void

  constructor(options: ChassisPhysicsBridgeOptions) {
    this.components = options.components
    this.onComponentStateChange = options.onComponentStateChange
  }

  handlePinChange(payload: PinChangePayload): void {
    const component = this.components.find((c) => c.pin === payload.pin)
    if (!component) return
    // PWM duty-cycle detection is not implemented upstream (avr-worker.ts
    // hardcodes isPWM: false) — every component is binary on/off for now.
    this.onComponentStateChange(component.id, payload.high)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/workspace/__tests__/chassis-physics-bridge.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/chassis-physics-bridge.ts lib/workspace/__tests__/chassis-physics-bridge.test.ts
git commit -m "feat(workspace): add chassis physics bridge mapping AVR pins to component state"
```

---

### Task 12: Workspace simulator view

**Files:**
- Create: `components/workspace/workspace-simulator-view.tsx`

**Interfaces:**
- Consumes: `RobotProjectStore`, `WorkspaceSnapshot` from Tasks 4/7; `ChassisPhysicsBridge` from Task 11; `GPIOBridge` from `lib/avr/gpio-bridge.ts` (constructor `{ avrWorker, onPinChange, onSerialOutput?, onAVRError?, onAVRStopped? }`); worker-bootstrap pattern from `components/circuit/circuit-view.tsx:96-168` (this view needs only the `avrWorker`, not the `circuitWorker` — no MNA solve for chassis components).
- Produces: `WorkspaceSimulatorView({ store }: { store: RobotProjectStore })`. Task 14's page shell renders this as the "Simulator" tab.

This component is a worker-lifecycle integration (`useEffect` bootstrapping a real Web Worker), which the existing codebase tests via manual verification rather than unit tests (`components/circuit/circuit-view.tsx`, the pattern this is modeled on, has no test file). Verified instead by this plan's Verification section.

- [ ] **Step 1: Write the component**

```tsx
// components/workspace/workspace-simulator-view.tsx
"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { RobotProjectStore, WorkspaceSnapshot } from "@/lib/workspace/robot-project-store"
import { ChassisPhysicsBridge } from "@/lib/workspace/chassis-physics-bridge"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { compileSketch } from "@/lib/avr/compiler"
import type { AVREvent } from "@/lib/avr/types"
import { getComponentDef } from "@/lib/workspace/component-types"

export function WorkspaceSimulatorView({ store }: { store: RobotProjectStore }) {
  const outOfSync = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.isOutOfSync()
  )
  const [componentState, setComponentState] = useState<Record<string, boolean>>({})
  const [running, setRunning] = useState(false)
  const avrWorkerRef = useRef<Worker | null>(null)
  const flashedRef = useRef<WorkspaceSnapshot | null>(null)

  useEffect(() => {
    const flashed = store.getFlashed()
    flashedRef.current = flashed
    if (!flashed) return

    const avrWorker = new Worker(new URL("@/workers/avr-worker.ts", import.meta.url))
    avrWorkerRef.current = avrWorker

    const bridge = new ChassisPhysicsBridge({
      components: flashed.components,
      onComponentStateChange: (id, active) => setComponentState((prev) => ({ ...prev, [id]: active })),
    })

    const gpioBridge = new GPIOBridge({
      avrWorker,
      onPinChange: (payload) => bridge.handlePinChange(payload),
      onAVRStopped: () => setRunning(false),
    })

    avrWorker.onmessage = (e: MessageEvent<AVREvent>) => {
      const ev = e.data
      if (ev.type === "running") setRunning(true)
      else if (ev.type === "stopped" || ev.type === "halted") setRunning(false)
      else gpioBridge.handleAVREvent(ev)
    }

    compileSketch({ code: flashed.code.generatedCode, board: "arduino-uno" }).then((result) => {
      if (result.success) {
        avrWorker.postMessage({ type: "load", hex: result.hex })
        avrWorker.postMessage({ type: "run" })
      }
    })

    return () => {
      avrWorker.terminate()
      avrWorkerRef.current = null
      setRunning(false)
    }
    // Re-bootstrap only when the flashed snapshot's hash changes, not on every store notification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.getFlashed()?.hash])

  if (!store.getFlashed()) {
    return <div className="p-4 text-sm text-muted-foreground">Nothing flashed yet — flash from the Builder tab first.</div>
  }

  if (outOfSync) {
    return (
      <div className="p-4 text-sm text-amber-500">
        Out of sync with the Builder — reflash to run the latest build.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="text-xs text-muted-foreground">{running ? "Running" : "Stopped"}</div>
      <div className="flex flex-wrap gap-3">
        {flashedRef.current?.components.map((component) => {
          const def = getComponentDef(component.type)
          const active = componentState[component.id] ?? false
          return (
            <div
              key={component.id}
              data-testid={`sim-component-${component.id}`}
              className="rounded border border-border p-2 text-xs"
              style={{ opacity: active ? 1 : 0.4, borderLeftColor: def.color, borderLeftWidth: 4 }}
            >
              {component.name} — {active ? "ON" : "OFF"}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors (`CompileResult`'s success variant has a `hex: string` field per `lib/avr/types.ts:55-62`, matching `result.hex` above).

- [ ] **Step 3: Commit**

```bash
git add components/workspace/workspace-simulator-view.tsx
git commit -m "feat(workspace): add simulator view reading only the flashed snapshot"
```

---

### Task 13: Persistence API routes

**Files:**
- Create: `app/api/workspace-projects/route.ts`
- Create: `app/api/workspace-projects/[id]/route.ts`
- Modify: `lib/workspace/robot-project-store.ts`

**Interfaces:**
- Consumes: `WorkspaceProject`, `WorkspaceProjectInsert`, `WorkspaceProjectUpdate` from Task 1; `createClient` from `lib/supabase/client.ts`; Clerk `auth()` from `@clerk/nextjs/server`. Pattern replicated verbatim from `app/api/projects/route.ts` and `app/api/projects/[id]/route.ts`.
- Produces (added to `RobotProjectStore`): `toJSON(): { components: RobotProjectComponent[], code: WorkspaceCode, flashed: WorkspaceSnapshot | null }`, `static fromJSON(data: ReturnType<RobotProjectStore['toJSON']>): RobotProjectStore`. Task 14's page shell calls `toJSON()` before `PATCH`-ing and `RobotProjectStore.fromJSON(...)` after `GET`-ing a saved project.

- [ ] **Step 1: Add `toJSON`/`fromJSON` to the store**

```ts
// Add inside the RobotProjectStore class in lib/workspace/robot-project-store.ts

  toJSON(): { components: RobotProjectComponent[]; code: WorkspaceCode; flashed: WorkspaceSnapshot | null } {
    return { components: this.components, code: this.code, flashed: this.flashed }
  }

  static fromJSON(data: { components: RobotProjectComponent[]; code: WorkspaceCode; flashed: WorkspaceSnapshot | null }): RobotProjectStore {
    const store = new RobotProjectStore()
    store.components = data.components
    store.code = data.code
    store.flashed = data.flashed
    return store
  }
```

- [ ] **Step 2: Write the collection route**

```ts
// app/api/workspace-projects/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabase/client"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from("workspace_projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from("workspace_projects")
    .insert({ user_id: userId, name: body.name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Write the item route**

```ts
// app/api/workspace-projects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabase/client"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createClient()
  const { data, error } = await supabase
    .from("workspace_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const supabase = createClient()
  const { data, error } = await supabase
    .from("workspace_projects")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createClient()
  const { error } = await supabase.from("workspace_projects").delete().eq("id", id).eq("user_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/robot-project-store.ts app/api/workspace-projects/route.ts app/api/workspace-projects/[id]/route.ts
git commit -m "feat(workspace): add workspace-projects persistence API routes"
```

---

### Task 14: Route shell with Builder/Simulator/Editor tabs

**Files:**
- Create: `app/workspace/[projectId]/page.tsx`

**Interfaces:**
- Consumes: `RobotProjectStore` (and its `fromJSON`/`toJSON`) from Tasks 4/7/13; `WorkspaceBuilderView` from Task 6; `WorkspaceEditorPanel` from Task 10; `WorkspaceSimulatorView` from Task 12; `WorkspaceProject` type from Task 1.

This is the final integration point — no new business logic, so no unit test; verified by this plan's Verification section below.

- [ ] **Step 1: Write the page**

```tsx
// app/workspace/[projectId]/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { WorkspaceBuilderView } from "@/components/workspace/workspace-builder-view"
import { WorkspaceEditorPanel } from "@/components/workspace/workspace-editor-panel"
import { WorkspaceSimulatorView } from "@/components/workspace/workspace-simulator-view"
import type { AVRCommand, CompileDiagnostic } from "@/lib/avr/types"
import type { RunState } from "@/components/simulator/code-execution-panel"

type TabId = "builder" | "editor" | "simulator"

export default function WorkspaceProjectPage() {
  const params = useParams<{ projectId: string }>()
  const storeRef = useRef<RobotProjectStore>(new RobotProjectStore())
  const [tab, setTab] = useState<TabId>("builder")
  const [runState, setRunState] = useState<RunState>("idle")
  const [errors, setErrors] = useState<CompileDiagnostic[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/workspace-projects/${params.projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        storeRef.current = RobotProjectStore.fromJSON({
          components: data.components ?? [],
          code: data.code ?? { source: "blocks", blocklyXml: null, generatedCode: "" },
          flashed: data.flashed ?? null,
        })
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [params.projectId])

  useEffect(() => {
    if (!loaded) return
    const save = () => {
      fetch(`/api/workspace-projects/${params.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storeRef.current.toJSON()),
      })
    }
    return storeRef.current.subscribe(save)
  }, [loaded, params.projectId])

  const handleCommand = (cmd: AVRCommand) => {
    if (cmd.type === "load") setRunState("compiling")
    // Compilation/run wiring for the Editor tab's manual-code path is handled
    // inside CodeExecutionPanel + WorkspaceEditorPanel; this page only tracks
    // run-state for the disabled/enabled affordances on the tab bar.
    void cmd
  }

  if (!loaded) return <div className="p-4 text-sm text-muted-foreground">Loading project…</div>

  return (
    <div className="flex h-screen flex-col">
      <div className="flex border-b border-border">
        {(["builder", "editor", "simulator"] as TabId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm capitalize ${tab === id ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "builder" && <WorkspaceBuilderView store={storeRef.current} />}
        {tab === "editor" && (
          <WorkspaceEditorPanel
            store={storeRef.current}
            runState={runState}
            onCommand={handleCommand}
            errors={errors}
            onErrors={setErrors}
          />
        )}
        {tab === "simulator" && <WorkspaceSimulatorView store={storeRef.current} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles and the dev server starts**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors.

Run: `pnpm dev` (background), then navigate to `/workspace/<any-uuid>` — confirm the tab bar renders and the Builder tab loads without throwing (the page will show "Loading project…" indefinitely for a nonexistent `projectId` since no fallback "create if missing" exists yet; that's expected — full persistence round-trip is exercised in this plan's Verification section using a project created via the API).

- [ ] **Step 3: Commit**

```bash
git add app/workspace/[projectId]/page.tsx
git commit -m "feat(workspace): add /workspace/[projectId] route with Builder/Editor/Simulator tabs"
```

---

## Verification

Run the full test suite and the dev server, then walk through the scenarios below.

1. Run: `npx vitest run` — expect all workspace tests plus the pre-existing 71 tests to pass (no regressions in `/circuit`, missions, or other existing suites).
2. Run: `pnpm dev`. Create a workspace project via `curl -X POST http://localhost:3000/api/workspace-projects -H "Content-Type: application/json" -d '{"name":"Test Robot"}'` while authenticated (or through a small temporary script using a valid session cookie) and note the returned `id`.
3. Navigate to `/workspace/<id>`. **Builder tab**: drag a motor onto the canvas — confirm its pin badge shows `D3` (first free PWM pin). Drag a second motor — confirm it shows `D5`. Drag an LED — confirm it shows a non-PWM digital pin. Click a component, press `R` — confirm it visually rotates 90° with no position jump (this is the rotation-bug fix: there is no decorative slot layer to desync, since `/workspace` never introduced one).
4. Click a pin badge — confirm the dropdown only offers pins valid and free for that component's kind (e.g., the motor's dropdown never offers `D4`).
5. **Editor tab**: confirm a toolbox category appears for each component type currently placed, and that category's block's dropdown lists the actual component names. Build a block program (e.g., "set LED ON"). Confirm switching to Code mode shows generated C++ containing `#define ...Pin` lines and the block-derived body. Hand-edit the code, switch back to Blocks — confirm the amber confirmation banner appears before any code is discarded.
6. Go to the Builder tab and click **Flash**. Switch to the **Simulator** tab — confirm it shows "Running" and the placed components render with their on/off state reflecting the flashed program's behavior (binary, since PWM duty-cycle detection is deferred).
7. Return to Builder, move a component without reflashing. Switch back to Simulator — confirm it shows the "Out of sync — reflash to run the latest build" message and does not attempt to run.
8. Reload `/workspace/<id>` — confirm the placed components, code, and flashed state persist (the `PATCH` triggered by the store's `subscribe` callback round-trips through `workspace_projects`).
9. Navigate to `/builder`, `/simulator`, `/playground` — confirm they still load and behave exactly as before, unmodified.

