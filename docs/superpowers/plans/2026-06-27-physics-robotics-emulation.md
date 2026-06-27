# Physics & Robotics Emulation Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Xylo simulator from binary on/off stubs to a realistic robotics emulator: real PWM duty cycles, Rapier2D physics, line/distance/bump sensors, servo angle, and LED brightness — all browser-side.

**Architecture:** Fix PWM detection in `avr-worker.ts` by reading ATmega328P timer COM/OCR registers; replace Matter.js with Rapier2D (WASM) for robot physics and built-in raycasting; wire MNA brightness and sensor readings to a new canvas renderer in the workspace simulator view.

**Tech Stack:** `@dimforge/rapier2d-compat ^0.14` (new), `@wokwi/avr8js ^0.21` (existing), Next.js 16, React 19, TypeScript strict, Vitest/jsdom.

## Global Constraints

- All new `lib/` files: TypeScript strict mode, no `any`.
- Test files: `lib/<area>/__tests__/<name>.test.ts` or `workers/__tests__/<name>.test.ts`.
- Run all tests: `npx vitest run`. Run one file: `npx vitest run <path>`.
- **Never touch:** `lib/simulator/robot.ts`, `lib/simulator/physics.ts`, `lib/simulator/arena.ts`, `workers/circuit-worker.ts`, `lib/circuit/**`, any builder-tab code.
- `lib/simulator/arena.ts` exports used here: `ArenaConfig`, `ARENAS`, `isPointOnLine`, `LineSegment`.
- `lib/avr/gpio-bridge.ts` exports: `GPIOBridge`, `PinChangePayload`, `GPIOBridgeOptions`.
- Pin numbering: D0–D13 = Arduino pins 0–13; A0–A5 = pins 14–19.
- Rapier world units = canvas pixels. Arena canvas = 800 × 600 (matches `ArenaConfig.width/height`).
- PWM-capable pins: D3, D5, D6, D9, D10, D11 only.
- `analogWrite()` on ATmega328P sets COMnx bits ≠ 0b00; `digitalWrite()` sets them to 0b00. That COM bit check is the definitive "is this PWM?" test.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add Rapier2D dep + test script |
| `lib/avr/types.ts` | Modify | Add `cycles?: number` to `pinChange` event |
| `lib/avr/gpio-bridge.ts` | Modify | Pass `cycles` through `PinChangePayload` |
| `workers/avr-worker.ts` | Modify | COM-bit PWM detection + OCR duty cycle + emit `cycles` |
| `lib/simulator/rapier-physics.ts` | Create | Rapier world factory + arena/obstacle body builders |
| `lib/simulator/rapier-robot.ts` | Create | `VirtualRobot` (velocity-controlled differential drive + servo angle) |
| `lib/simulator/sensor-simulation.ts` | Create | Line/distance/bump sensors → `GPIOBridge` feedback |
| `lib/workspace/component-types.ts` | Modify | Add `servo` component type |
| `lib/workspace/chassis-physics-bridge.ts` | Modify | Motor duty → `onMotorsChange`; servo pulse → `onServoChange` |
| `components/workspace/workspace-simulator-view.tsx` | Modify | Canvas + Rapier render loop + LED brightness |

---

### Task 1: Install Rapier2D and add test script

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `@dimforge/rapier2d-compat` importable in all subsequent tasks; `npx vitest run` works.

- [ ] **Step 1: Install the package**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform"
npm install @dimforge/rapier2d-compat@^0.14.0
```

Expected: `package.json` dependencies now includes `"@dimforge/rapier2d-compat": "^0.14.0"`.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, inside `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Verify tests still pass**

```bash
npx vitest run
```

Expected: all existing tests pass (no new failures).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add rapier2d-compat + test script"
```

---

### Task 2: Add `cycles` to pinChange event

**Files:**
- Modify: `lib/avr/types.ts`
- Modify: `lib/avr/gpio-bridge.ts`
- Test: `lib/avr/__tests__/gpio-bridge.test.ts`

**Interfaces:**
- Produces: `AVREvent` pinChange variant has `cycles?: number`; `PinChangePayload` has `cycles?: number`.
- Consumed by Task 3 (avr-worker emits cycles) and Task 7 (bridge reads cycles for servo).

- [ ] **Step 1: Write failing test**

Add to `lib/avr/__tests__/gpio-bridge.test.ts`:

```typescript
it("passes cycles field through pinChange payload", () => {
  const received: PinChangePayload[] = []
  const bridge = new GPIOBridge({
    avrWorker: { postMessage: vi.fn() } as unknown as Worker,
    onPinChange: (p) => received.push(p),
  })
  bridge.handleAVREvent({ type: "pinChange", pin: 9, high: true, isPWM: true, dutyCycle: 128, cycles: 320000 })
  expect(received[0].cycles).toBe(320000)
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run lib/avr/__tests__/gpio-bridge.test.ts
```

Expected: TypeScript error or runtime failure — `cycles` does not exist yet.

- [ ] **Step 3: Update `lib/avr/types.ts`**

Change the `pinChange` line in `AVREvent`:

```typescript
// Before:
| { type: "pinChange"; pin: number; high: boolean; isPWM: boolean; dutyCycle: number }

// After:
| { type: "pinChange"; pin: number; high: boolean; isPWM: boolean; dutyCycle: number; cycles?: number }
```

- [ ] **Step 4: Update `lib/avr/gpio-bridge.ts`**

Add `cycles?: number` to `PinChangePayload`:

```typescript
export interface PinChangePayload {
  pin: number
  high: boolean
  isPWM: boolean
  dutyCycle: number
  cycles?: number
}
```

Update the `handleAVREvent` switch case for `pinChange`:

```typescript
case "pinChange":
  this.onPinChange({
    pin: event.pin,
    high: event.high,
    isPWM: event.isPWM,
    dutyCycle: event.dutyCycle,
    cycles: event.cycles,
  })
  break
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx vitest run lib/avr/__tests__/gpio-bridge.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/avr/types.ts lib/avr/gpio-bridge.ts lib/avr/__tests__/gpio-bridge.test.ts
git commit -m "feat(avr): add cycles field to pinChange event for servo pulse detection"
```

---

### Task 3: PWM duty-cycle detection in avr-worker

**Files:**
- Modify: `workers/avr-worker.ts`
- Test: `workers/__tests__/avr-pwm-detection.test.ts` (new)

**Interfaces:**
- Produces: `pinChange` events for D3/D5/D6/D9/D10/D11 emit `isPWM: true` and real `dutyCycle` (0–255) when `analogWrite()` is active; all other pins remain `isPWM: false`.
- Consumed by Task 7 (chassis-physics-bridge reads `dutyCycle`).

- [ ] **Step 1: Create test file**

Create `workers/__tests__/avr-pwm-detection.test.ts`:

```typescript
import { describe, it, expect } from "vitest"

// The PWM detection logic is pure: given cpu.data[], return { isPWM, dutyCycle }.
// We extract it as a testable pure function by duplicating the lookup table here.

interface PwmPinDef { ocrAddr: number; tccrAddr: number; comShift: number }

const PWM_PINS: Record<number, PwmPinDef> = {
  3:  { ocrAddr: 0xB4, tccrAddr: 0xB0, comShift: 4 },
  5:  { ocrAddr: 0x48, tccrAddr: 0x44, comShift: 4 },
  6:  { ocrAddr: 0x47, tccrAddr: 0x44, comShift: 6 },
  9:  { ocrAddr: 0x88, tccrAddr: 0x80, comShift: 6 },
  10: { ocrAddr: 0x8A, tccrAddr: 0x80, comShift: 4 },
  11: { ocrAddr: 0xB3, tccrAddr: 0xB0, comShift: 6 },
}

function readPWM(pin: number, high: boolean, data: Uint8Array): { isPWM: boolean; dutyCycle: number } {
  const cfg = PWM_PINS[pin]
  if (!cfg) return { isPWM: false, dutyCycle: high ? 255 : 0 }
  const comBits = (data[cfg.tccrAddr] >> cfg.comShift) & 0x03
  if (comBits === 0) return { isPWM: false, dutyCycle: high ? 255 : 0 }
  return { isPWM: true, dutyCycle: data[cfg.ocrAddr] }
}

describe("PWM detection", () => {
  it("returns isPWM:false for non-PWM pin (D2)", () => {
    const data = new Uint8Array(0x200)
    expect(readPWM(2, true, data)).toEqual({ isPWM: false, dutyCycle: 255 })
  })

  it("returns isPWM:false when COM bits are 0 (pin used as digitalWrite)", () => {
    const data = new Uint8Array(0x200)
    // Pin 9: TCCR1A at 0x80, comShift=6; set COM bits to 0b00
    data[0x80] = 0b00000001 // WGM bits set but COM=0b00
    data[0x88] = 200 // OCR1AL = 200
    expect(readPWM(9, true, data)).toEqual({ isPWM: false, dutyCycle: 255 })
  })

  it("returns isPWM:true and real dutyCycle when analogWrite() is active on pin 9", () => {
    const data = new Uint8Array(0x200)
    // analogWrite sets COM1A bits to 0b10 (non-inverting) at TCCR1A bits 7:6
    data[0x80] = 0b10000001 // COM1A1=1, COM1A0=0 (non-inverting PWM)
    data[0x88] = 128         // OCR1AL = 128 → 50% duty cycle
    expect(readPWM(9, true, data)).toEqual({ isPWM: true, dutyCycle: 128 })
  })

  it("returns dutyCycle=0 for analogWrite(pin, 0) on pin 6", () => {
    const data = new Uint8Array(0x200)
    // Pin 6: TCCR0A at 0x44, comShift=6 (COM0A bits 7:6)
    data[0x44] = 0b10000011 // COM0A = 0b10, WGM = 0b11 (Fast PWM)
    data[0x47] = 0           // OCR0A = 0
    expect(readPWM(6, false, data)).toEqual({ isPWM: true, dutyCycle: 0 })
  })

  it("returns dutyCycle=255 for analogWrite(pin, 255) on pin 11", () => {
    const data = new Uint8Array(0x200)
    // Pin 11: TCCR2A at 0xB0, comShift=6
    data[0xB0] = 0b10000011
    data[0xB3] = 255
    expect(readPWM(11, true, data)).toEqual({ isPWM: true, dutyCycle: 255 })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run workers/__tests__/avr-pwm-detection.test.ts
```

Expected: FAIL (function only in test, not yet in worker).

- [ ] **Step 3: Update `workers/avr-worker.ts`**

After the imports and before the state declarations, add the PWM lookup table and helper:

```typescript
// ── PWM detection ─────────────────────────────────────────────────────────────
// COMnx bits in TCCRnA: if ≠ 0b00, pin is connected to timer output (analogWrite active).
// ocrAddr: CPU data address of OCR register (duty cycle, 0–255)
// tccrAddr: CPU data address of TCCRnA
// comShift: bit position of the COMnx1 bit pair within TCCRnA

interface PwmPinDef { ocrAddr: number; tccrAddr: number; comShift: number }

const PWM_PIN_MAP: Record<number, PwmPinDef> = {
  3:  { ocrAddr: 0xB4, tccrAddr: 0xB0, comShift: 4 }, // Timer2B OCR2B, TCCR2A
  5:  { ocrAddr: 0x48, tccrAddr: 0x44, comShift: 4 }, // Timer0B OCR0B, TCCR0A
  6:  { ocrAddr: 0x47, tccrAddr: 0x44, comShift: 6 }, // Timer0A OCR0A, TCCR0A
  9:  { ocrAddr: 0x88, tccrAddr: 0x80, comShift: 6 }, // Timer1A OCR1AL, TCCR1A
  10: { ocrAddr: 0x8A, tccrAddr: 0x80, comShift: 4 }, // Timer1B OCR1BL, TCCR1A
  11: { ocrAddr: 0xB3, tccrAddr: 0xB0, comShift: 6 }, // Timer2A OCR2A, TCCR2A
}

function readPWMDutyCycle(pin: number, high: boolean): { isPWM: boolean; dutyCycle: number } {
  const cfg = PWM_PIN_MAP[pin]
  if (!cfg || !cpu) return { isPWM: false, dutyCycle: high ? 255 : 0 }
  const comBits = (cpu.data[cfg.tccrAddr] >> cfg.comShift) & 0x03
  if (comBits === 0) return { isPWM: false, dutyCycle: high ? 255 : 0 }
  return { isPWM: true, dutyCycle: cpu.data[cfg.ocrAddr] }
}
```

Replace the existing pin listener body (lines 69–88 of avr-worker.ts) with:

```typescript
function attachPinListeners() {
  for (let pin = 0; pin <= 19; pin++) {
    const pinNum = pin
    const pp = getPortPin(pinNum)
    if (!pp) continue

    pp.port.addListener((_value: number, _oldValue: number) => {
      if (!pp.port) return
      const state = pp.port.pinState(pp.bit)
      const high = state === PinState.High

      if (prevPinHigh[pinNum] !== high) {
        prevPinHigh[pinNum] = high
        const { isPWM, dutyCycle } = readPWMDutyCycle(pinNum, high)
        postEvent({
          type: "pinChange",
          pin: pinNum,
          high,
          isPWM,
          dutyCycle,
          cycles: cpu?.cycles ?? 0,
        })
      }
    })
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run workers/__tests__/avr-pwm-detection.test.ts
npx vitest run
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add workers/avr-worker.ts workers/__tests__/avr-pwm-detection.test.ts
git commit -m "feat(avr): detect real PWM duty cycle from timer COM/OCR registers"
```

---

### Task 4: Rapier physics world

**Files:**
- Create: `lib/simulator/rapier-physics.ts`
- Test: `lib/simulator/__tests__/rapier-physics.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export async function createPhysicsWorld(): Promise<RAPIER.World>
  export function addArenaBodies(world: RAPIER.World, arenaId: string): void
  ```
- Consumed by Task 5 (robot creation) and Task 8 (simulator view setup).

- [ ] **Step 1: Write failing test**

Create `lib/simulator/__tests__/rapier-physics.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { createPhysicsWorld, addArenaBodies } from "../rapier-physics"

describe("createPhysicsWorld", () => {
  it("creates a world with zero gravity", async () => {
    const world = await createPhysicsWorld()
    expect(world.gravity.x).toBe(0)
    expect(world.gravity.y).toBe(0)
    world.free()
  })
})

describe("addArenaBodies", () => {
  it("adds static bodies for open-arena walls", async () => {
    const world = await createPhysicsWorld()
    addArenaBodies(world, "open-arena")
    // 4 walls added as fixed rigid bodies
    let bodyCount = 0
    world.forEachRigidBody(() => { bodyCount++ })
    expect(bodyCount).toBe(4)
    world.free()
  })

  it("adds obstacle bodies for obstacle-course", async () => {
    const world = await createPhysicsWorld()
    addArenaBodies(world, "obstacle-course")
    // 4 walls + 5 obstacles = 9
    let bodyCount = 0
    world.forEachRigidBody(() => { bodyCount++ })
    expect(bodyCount).toBe(9)
    world.free()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run lib/simulator/__tests__/rapier-physics.test.ts
```

Expected: module not found.

- [ ] **Step 3: Create `lib/simulator/rapier-physics.ts`**

```typescript
import RAPIER from "@dimforge/rapier2d-compat"

let rapierReady = false

export async function createPhysicsWorld(): Promise<RAPIER.World> {
  if (!rapierReady) {
    await RAPIER.init()
    rapierReady = true
  }
  const world = new RAPIER.World({ x: 0, y: 0 })
  world.timestep = 1 / 60
  return world
}

function addStaticBox(world: RAPIER.World, cx: number, cy: number, hw: number, hh: number): void {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy))
  world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hh), body)
}

function addStaticCircle(world: RAPIER.World, cx: number, cy: number, r: number): void {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy))
  world.createCollider(RAPIER.ColliderDesc.ball(r), body)
}

// Wall thickness in pixels
const WALL = 10

export function addArenaBodies(world: RAPIER.World, arenaId: string): void {
  const W = 800
  const H = 600

  // 4 arena boundary walls
  addStaticBox(world, W / 2, -WALL / 2, W / 2, WALL / 2)       // top
  addStaticBox(world, W / 2, H + WALL / 2, W / 2, WALL / 2)    // bottom
  addStaticBox(world, -WALL / 2, H / 2, WALL / 2, H / 2)       // left
  addStaticBox(world, W + WALL / 2, H / 2, WALL / 2, H / 2)    // right

  switch (arenaId) {
    case "obstacle-course":
      addStaticBox(world, 250, 200, 40, 40)
      addStaticBox(world, 400, 400, 50, 30)
      addStaticCircle(world, 550, 250, 40)
      addStaticBox(world, 300, 500, 60, 20)
      addStaticCircle(world, 600, 450, 35)
      break

    case "maze":
      // Horizontal walls (cx, cy, hw, hh) — matching arena.ts createObstacle args / 2
      addStaticBox(world, 200, 120, 140, 10)
      addStaticBox(world, 500, 120, 100, 10)
      addStaticBox(world, 150, 240,  90, 10)
      addStaticBox(world, 450, 240, 150, 10)
      addStaticBox(world, 250, 360, 140, 10)
      addStaticBox(world, 650, 360,  50, 10)
      addStaticBox(world, 100, 480,  40, 10)
      addStaticBox(world, 350, 480, 150, 10)
      // Vertical walls
      addStaticBox(world, 340,  60, 10,  50)
      addStaticBox(world, 600, 180, 10,  50)
      addStaticBox(world, 240, 180, 10,  50)
      addStaticBox(world, 110, 300, 10,  50)
      addStaticBox(world, 390, 300, 10,  50)
      addStaticBox(world, 500, 420, 10,  50)
      addStaticBox(world, 200, 420, 10,  50)
      addStaticBox(world, 600, 540, 10,  50)
      break

    // open-arena and line-follow: walls only, no obstacles
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run lib/simulator/__tests__/rapier-physics.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/simulator/rapier-physics.ts lib/simulator/__tests__/rapier-physics.test.ts
git commit -m "feat(simulator): add Rapier2D physics world factory + arena body builders"
```

---

### Task 5: Rapier robot

**Files:**
- Create: `lib/simulator/rapier-robot.ts`
- Test: `lib/simulator/__tests__/rapier-robot.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface RobotState { x: number; y: number; angle: number; leftDuty: number; rightDuty: number; servoAngle: number }
  export class VirtualRobot {
    constructor(world: RAPIER.World, x: number, y: number)
    setMotors(leftDuty: number, rightDuty: number): void   // 0–255
    setServoAngle(angleDeg: number): void                   // 0–180
    update(): void
    getState(): RobotState
    destroy(): void
  }
  ```
- Consumed by Task 6 (sensor-simulation gets robot state) and Task 8 (render loop).

- [ ] **Step 1: Write failing test**

Create `lib/simulator/__tests__/rapier-robot.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import RAPIER from "@dimforge/rapier2d-compat"
import { createPhysicsWorld } from "../rapier-physics"
import { VirtualRobot } from "../rapier-robot"

let world: RAPIER.World
let robot: VirtualRobot

beforeEach(async () => {
  world = await createPhysicsWorld()
  robot = new VirtualRobot(world, 100, 300)
})

afterEach(() => {
  robot.destroy()
  world.free()
})

describe("VirtualRobot", () => {
  it("initialises at the given position", () => {
    const s = robot.getState()
    expect(s.x).toBeCloseTo(100, 0)
    expect(s.y).toBeCloseTo(300, 0)
    expect(s.angle).toBeCloseTo(0, 3)
  })

  it("stores motor duty cycles", () => {
    robot.setMotors(128, 200)
    const s = robot.getState()
    expect(s.leftDuty).toBe(128)
    expect(s.rightDuty).toBe(200)
  })

  it("moves forward when both motors at full duty", () => {
    robot.setMotors(255, 255)
    robot.update()
    world.step()
    const s = robot.getState()
    // Should have moved in +x direction (angle=0)
    expect(s.x).toBeGreaterThan(100)
  })

  it("stays near start when motors are zero", () => {
    robot.setMotors(0, 0)
    robot.update()
    world.step()
    const s = robot.getState()
    expect(s.x).toBeCloseTo(100, 0)
  })

  it("clamps servoAngle to 0–180", () => {
    robot.setServoAngle(270)
    expect(robot.getState().servoAngle).toBe(180)
    robot.setServoAngle(-10)
    expect(robot.getState().servoAngle).toBe(0)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run lib/simulator/__tests__/rapier-robot.test.ts
```

Expected: module not found.

- [ ] **Step 3: Create `lib/simulator/rapier-robot.ts`**

```typescript
import RAPIER from "@dimforge/rapier2d-compat"

// Max linear speed in px/s at 100% duty (255)
const MAX_LINEAR_SPEED = 200
// Wheel base in px (distance between left and right wheels)
const WHEEL_BASE = 50
// Half-extents of robot body (px)
const HALF_W = 30
const HALF_H = 25

export interface RobotState {
  x: number
  y: number
  angle: number
  leftDuty: number
  rightDuty: number
  servoAngle: number
}

export class VirtualRobot {
  private body: RAPIER.RigidBody
  private world: RAPIER.World
  private leftDuty = 0
  private rightDuty = 0
  private servoAngleDeg = 90

  constructor(world: RAPIER.World, x: number, y: number) {
    this.world = world
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      .setLinearDamping(8)
      .setAngularDamping(5)
    this.body = world.createRigidBody(bodyDesc)
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(HALF_W, HALF_H)
        .setFriction(0.8)
        .setRestitution(0.1)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.body,
    )
  }

  setMotors(leftDuty: number, rightDuty: number): void {
    this.leftDuty = Math.max(0, Math.min(255, leftDuty))
    this.rightDuty = Math.max(0, Math.min(255, rightDuty))
  }

  setServoAngle(angleDeg: number): void {
    this.servoAngleDeg = Math.max(0, Math.min(180, angleDeg))
  }

  update(): void {
    const leftSpeed  = (this.leftDuty  / 255) * MAX_LINEAR_SPEED
    const rightSpeed = (this.rightDuty / 255) * MAX_LINEAR_SPEED

    const linearVel  = (leftSpeed + rightSpeed) / 2
    const angularVel = (rightSpeed - leftSpeed) / WHEEL_BASE

    const angle = this.body.rotation()
    this.body.setLinvel({ x: Math.cos(angle) * linearVel, y: Math.sin(angle) * linearVel }, true)
    this.body.setAngvel(angularVel, true)
  }

  getState(): RobotState {
    const pos = this.body.translation()
    return {
      x: pos.x,
      y: pos.y,
      angle: this.body.rotation(),
      leftDuty: this.leftDuty,
      rightDuty: this.rightDuty,
      servoAngle: this.servoAngleDeg,
    }
  }

  destroy(): void {
    this.world.removeRigidBody(this.body)
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run lib/simulator/__tests__/rapier-robot.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/simulator/rapier-robot.ts lib/simulator/__tests__/rapier-robot.test.ts
git commit -m "feat(simulator): add Rapier2D VirtualRobot with differential drive + servo angle"
```

---

### Task 6: Sensor simulation

**Files:**
- Create: `lib/simulator/sensor-simulation.ts`
- Test: `lib/simulator/__tests__/sensor-simulation.test.ts`

**Interfaces:**
- Consumes: `RAPIER.World`, `VirtualRobot` (getState), `ArenaConfig` (lineTrack via `isPointOnLine`), `GPIOBridge` (setADCInput, setDigitalInput).
- Produces:
  ```typescript
  export interface SensorPinConfig {
    distanceSensorPin: number | null
    lineSensorLeftPin: number | null
    lineSensorCenterPin: number | null
    lineSensorRightPin: number | null
    bumpPin: number | null
  }
  export class SensorSimulation {
    constructor(world: RAPIER.World, robot: VirtualRobot, arena: ArenaConfig, bridge: GPIOBridge, pins: SensorPinConfig)
    tick(): void
    handleCollisionEvent(handle1: number, handle2: number, started: boolean): void
  }
  ```

- [ ] **Step 1: Write failing tests**

Create `lib/simulator/__tests__/sensor-simulation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import RAPIER from "@dimforge/rapier2d-compat"
import { createPhysicsWorld } from "../rapier-physics"
import { VirtualRobot } from "../rapier-robot"
import { SensorSimulation, type SensorPinConfig } from "../sensor-simulation"
import { ARENAS } from "../arena"
import type { GPIOBridge } from "../../avr/gpio-bridge"

function makeBridge() {
  return { setADCInput: vi.fn(), setDigitalInput: vi.fn() } as unknown as GPIOBridge
}

const ALL_NULL: SensorPinConfig = {
  distanceSensorPin: null, lineSensorLeftPin: null,
  lineSensorCenterPin: null, lineSensorRightPin: null, bumpPin: null,
}

let world: RAPIER.World
let robot: VirtualRobot

beforeEach(async () => {
  world = await createPhysicsWorld()
  robot = new VirtualRobot(world, 100, 300)
})

afterEach(() => {
  robot.destroy()
  world.free()
})

describe("distance sensor", () => {
  it("calls setADCInput on distanceSensorPin", () => {
    const bridge = makeBridge()
    const arena = ARENAS.find(a => a.id === "open-arena")!
    const sim = new SensorSimulation(world, robot, arena, bridge, { ...ALL_NULL, distanceSensorPin: 14 })
    sim.tick()
    expect(bridge.setADCInput).toHaveBeenCalledWith(14, expect.any(Number))
  })

  it("skips setADCInput when distanceSensorPin is null", () => {
    const bridge = makeBridge()
    const arena = ARENAS[0]
    const sim = new SensorSimulation(world, robot, arena, bridge, ALL_NULL)
    sim.tick()
    expect(bridge.setADCInput).not.toHaveBeenCalled()
  })
})

describe("line sensor", () => {
  it("sends LOW (false) for left sensor when robot is on line-track start", () => {
    const bridge = makeBridge()
    const arena = ARENAS.find(a => a.id === "line-follow")!
    // Robot starts at (100, 500) which is exactly on the line track start
    robot.destroy()
    robot = new VirtualRobot(world, 100, 500)
    const sim = new SensorSimulation(world, robot, arena, bridge, { ...ALL_NULL, lineSensorLeftPin: 15 })
    sim.tick()
    // IR sensor LOW = on line; pin set to false
    expect(bridge.setDigitalInput).toHaveBeenCalledWith(15, false)
  })

  it("sends HIGH (true) for sensor when far from any line", () => {
    const bridge = makeBridge()
    const arena = ARENAS.find(a => a.id === "line-follow")!
    // Robot at (700, 550) — off any line segment
    robot.destroy()
    robot = new VirtualRobot(world, 700, 550)
    const sim = new SensorSimulation(world, robot, arena, bridge, { ...ALL_NULL, lineSensorCenterPin: 16 })
    sim.tick()
    expect(bridge.setDigitalInput).toHaveBeenCalledWith(16, true)
  })
})

describe("bump sensor", () => {
  it("sets bump pin LOW on collision start, HIGH on end", () => {
    const bridge = makeBridge()
    const arena = ARENAS[0]
    const sim = new SensorSimulation(world, robot, arena, bridge, { ...ALL_NULL, bumpPin: 4 })
    sim.handleCollisionEvent(0, 1, true)
    expect(bridge.setDigitalInput).toHaveBeenCalledWith(4, false)
    sim.handleCollisionEvent(0, 1, false)
    expect(bridge.setDigitalInput).toHaveBeenCalledWith(4, true)
  })

  it("skips bump when bumpPin is null", () => {
    const bridge = makeBridge()
    const arena = ARENAS[0]
    const sim = new SensorSimulation(world, robot, arena, bridge, ALL_NULL)
    sim.handleCollisionEvent(0, 1, true)
    expect(bridge.setDigitalInput).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run lib/simulator/__tests__/sensor-simulation.test.ts
```

- [ ] **Step 3: Create `lib/simulator/sensor-simulation.ts`**

```typescript
import RAPIER from "@dimforge/rapier2d-compat"
import type { VirtualRobot } from "./rapier-robot"
import type { ArenaConfig } from "./arena"
import { isPointOnLine } from "./arena"
import type { GPIOBridge } from "../avr/gpio-bridge"

export interface SensorPinConfig {
  distanceSensorPin: number | null
  lineSensorLeftPin: number | null
  lineSensorCenterPin: number | null
  lineSensorRightPin: number | null
  bumpPin: number | null
}

// Sensor offsets in robot-local space (pixels, robot faces +x at angle 0)
const DIST_OFFSET = 35        // distance sensor: in front of robot centroid
const LINE_OFFSETS = [-15, 0, 15] as const  // left, center, right lateral offsets
const LINE_FORWARD = -20      // all line sensors are 20px behind front edge

const MAX_DIST_PX = 400
const PX_PER_CM = 2           // 2 pixels = 1 cm → 400px = 200cm range

function rotateOffset(ox: number, oy: number, angle: number): { x: number; y: number } {
  return {
    x: ox * Math.cos(angle) - oy * Math.sin(angle),
    y: ox * Math.sin(angle) + oy * Math.cos(angle),
  }
}

export class SensorSimulation {
  private world: RAPIER.World
  private robot: VirtualRobot
  private arena: ArenaConfig
  private bridge: GPIOBridge
  private pins: SensorPinConfig

  constructor(
    world: RAPIER.World,
    robot: VirtualRobot,
    arena: ArenaConfig,
    bridge: GPIOBridge,
    pins: SensorPinConfig,
  ) {
    this.world = world
    this.robot = robot
    this.arena = arena
    this.bridge = bridge
    this.pins = pins
  }

  tick(): void {
    const state = this.robot.getState()
    this.tickDistance(state.x, state.y, state.angle)
    this.tickLineSensors(state.x, state.y, state.angle)
  }

  private tickDistance(rx: number, ry: number, angle: number): void {
    const { distanceSensorPin } = this.pins
    if (distanceSensorPin === null) return

    const off = rotateOffset(DIST_OFFSET, 0, angle)
    const origin = { x: rx + off.x, y: ry + off.y }
    const dir = { x: Math.cos(angle), y: Math.sin(angle) }

    const ray = new RAPIER.Ray(origin, dir)
    const hit = this.world.castRay(ray, MAX_DIST_PX, true)
    const distPx = hit ? hit.toi : MAX_DIST_PX
    // Map distance to ADC: closer = higher ADC value (like HC-SR04 in reverse voltage map)
    const adcValue = Math.round((1 - distPx / MAX_DIST_PX) * 1023)
    this.bridge.setADCInput(distanceSensorPin, adcValue)
  }

  private tickLineSensors(rx: number, ry: number, angle: number): void {
    const linePins = [
      this.pins.lineSensorLeftPin,
      this.pins.lineSensorCenterPin,
      this.pins.lineSensorRightPin,
    ]
    const lineTrack = this.arena.lineTrack

    LINE_OFFSETS.forEach((lateralOffset, i) => {
      const pin = linePins[i]
      if (pin === null) return

      const off = rotateOffset(LINE_FORWARD, lateralOffset, angle)
      const wx = rx + off.x
      const wy = ry + off.y

      const onLine = lineTrack ? isPointOnLine(wx, wy, lineTrack) : false
      // IR sensor convention: LOW (false) when over line, HIGH (true) when off line
      this.bridge.setDigitalInput(pin, !onLine)
    })
  }

  handleCollisionEvent(_handle1: number, _handle2: number, started: boolean): void {
    if (this.pins.bumpPin === null) return
    // LOW = bumped (active low, like a physical push-button)
    this.bridge.setDigitalInput(this.pins.bumpPin, !started)
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run lib/simulator/__tests__/sensor-simulation.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/simulator/sensor-simulation.ts lib/simulator/__tests__/sensor-simulation.test.ts
git commit -m "feat(simulator): add SensorSimulation (distance, line-follow, bump)"
```

---

### Task 7: Update chassis-physics-bridge + add servo component

**Files:**
- Modify: `lib/workspace/component-types.ts`
- Modify: `lib/workspace/chassis-physics-bridge.ts`
- Test: `lib/workspace/__tests__/chassis-physics-bridge.test.ts`

**Interfaces:**
- Consumes: `PinChangePayload` (now has `cycles?`); `RobotProjectComponent` (now includes `type: "servo"`).
- Produces updated `ChassisPhysicsBridgeOptions`:
  ```typescript
  export interface ChassisPhysicsBridgeOptions {
    components: RobotProjectComponent[]
    onComponentStateChange: (id: string, active: boolean, dutyCycle: number) => void
    onMotorsChange: (leftDuty: number, rightDuty: number) => void
    onServoChange: (angleDeg: number) => void
  }
  ```

- [ ] **Step 1: Add servo to component catalog**

In `lib/workspace/component-types.ts`, update `WorkspaceComponentType` and catalog:

```typescript
export type WorkspaceComponentType = "motor" | "led" | "button" | "sensor" | "servo"

export const WORKSPACE_COMPONENT_CATALOG: WorkspaceComponentDef[] = [
  { type: "motor",  label: "Motor",       pinKind: "pwm",     width: 60, height: 40, color: "#2196F3" },
  { type: "servo",  label: "Servo",       pinKind: "pwm",     width: 40, height: 40, color: "#FF5722" },
  { type: "led",    label: "LED",         pinKind: "digital", width: 24, height: 24, color: "#FFC107" },
  { type: "button", label: "Button",      pinKind: "digital", width: 30, height: 30, color: "#9C27B0" },
  { type: "sensor", label: "Light Sensor",pinKind: "analog",  width: 30, height: 30, color: "#4CAF50" },
]
```

- [ ] **Step 2: Write failing tests for the new bridge**

Replace the contents of `lib/workspace/__tests__/chassis-physics-bridge.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest"
import { ChassisPhysicsBridge } from "../chassis-physics-bridge"
import type { RobotProjectComponent } from "../robot-project-store"

function makeComp(overrides: Partial<RobotProjectComponent>): RobotProjectComponent {
  return { id: "c1", type: "led", name: "LED", x: 0, y: 0, rotation: 0, pin: 2, ...overrides }
}

function makeBridge(components: RobotProjectComponent[]) {
  const onComponentStateChange = vi.fn()
  const onMotorsChange = vi.fn()
  const onServoChange = vi.fn()
  const bridge = new ChassisPhysicsBridge({ components, onComponentStateChange, onMotorsChange, onServoChange })
  return { bridge, onComponentStateChange, onMotorsChange, onServoChange }
}

describe("LED/button routing", () => {
  it("calls onComponentStateChange with id, active, dutyCycle", () => {
    const led = makeComp({ id: "led-1", type: "led", pin: 2 })
    const { bridge, onComponentStateChange } = makeBridge([led])
    bridge.handlePinChange({ pin: 2, high: true, isPWM: false, dutyCycle: 255 })
    expect(onComponentStateChange).toHaveBeenCalledWith("led-1", true, 255)
  })

  it("does nothing for unknown pin", () => {
    const { bridge, onComponentStateChange } = makeBridge([])
    bridge.handlePinChange({ pin: 13, high: true, isPWM: false, dutyCycle: 255 })
    expect(onComponentStateChange).not.toHaveBeenCalled()
  })
})

describe("motor routing", () => {
  it("calls onMotorsChange with leftDuty from first motor, 0 for missing second", () => {
    const motor = makeComp({ id: "motor-1", type: "motor", pin: 9 })
    const { bridge, onMotorsChange } = makeBridge([motor])
    bridge.handlePinChange({ pin: 9, high: true, isPWM: true, dutyCycle: 128 })
    expect(onMotorsChange).toHaveBeenCalledWith(128, 0)
  })

  it("assigns first motor=left, second motor=right", () => {
    const m1 = makeComp({ id: "m1", type: "motor", pin: 9 })
    const m2 = makeComp({ id: "m2", type: "motor", pin: 10 })
    const { bridge, onMotorsChange } = makeBridge([m1, m2])
    bridge.handlePinChange({ pin: 10, high: true, isPWM: true, dutyCycle: 200 })
    expect(onMotorsChange).toHaveBeenCalledWith(0, 200)
  })
})

describe("servo routing", () => {
  it("calls onServoChange with 90° for a 1500µs pulse on pin 9", () => {
    const servo = makeComp({ id: "s1", type: "servo", pin: 9 })
    const { bridge, onServoChange } = makeBridge([servo])
    const risingCycles = 0
    const fallingCycles = 1500 * 16  // 1500µs × 16 cycles/µs = 24000
    bridge.handlePinChange({ pin: 9, high: true,  isPWM: true, dutyCycle: 200, cycles: risingCycles })
    bridge.handlePinChange({ pin: 9, high: false, isPWM: true, dutyCycle: 0,   cycles: fallingCycles })
    expect(onServoChange).toHaveBeenCalledWith(90)
  })

  it("clamps servo to 0° for pulse < 1000µs", () => {
    const servo = makeComp({ id: "s1", type: "servo", pin: 9 })
    const { bridge, onServoChange } = makeBridge([servo])
    bridge.handlePinChange({ pin: 9, high: true,  isPWM: true, dutyCycle: 200, cycles: 0 })
    bridge.handlePinChange({ pin: 9, high: false, isPWM: true, dutyCycle: 0,   cycles: 500 * 16 }) // 500µs
    expect(onServoChange).toHaveBeenCalledWith(0)
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npx vitest run lib/workspace/__tests__/chassis-physics-bridge.test.ts
```

- [ ] **Step 4: Rewrite `lib/workspace/chassis-physics-bridge.ts`**

```typescript
import type { RobotProjectComponent } from "./robot-project-store"
import type { PinChangePayload } from "../avr/gpio-bridge"

export interface ChassisPhysicsBridgeOptions {
  components: RobotProjectComponent[]
  onComponentStateChange: (componentId: string, active: boolean, dutyCycle: number) => void
  onMotorsChange: (leftDuty: number, rightDuty: number) => void
  onServoChange: (angleDeg: number) => void
}

const CYCLES_PER_US = 16  // ATmega328P @ 16MHz

export class ChassisPhysicsBridge {
  private options: ChassisPhysicsBridgeOptions
  private motorDuties: Record<string, number> = {}
  private servoRisingCycles: Map<number, number> = new Map()

  constructor(options: ChassisPhysicsBridgeOptions) {
    this.options = options
  }

  handlePinChange(payload: PinChangePayload): void {
    const component = this.options.components.find((c) => c.pin === payload.pin)
    if (!component) return

    if (component.type === "motor") {
      this.motorDuties[component.id] = payload.dutyCycle
      this.flushMotors()
    } else if (component.type === "servo") {
      this.handleServoPulse(payload)
    } else {
      // led, button, sensor
      this.options.onComponentStateChange(component.id, payload.high, payload.dutyCycle)
    }
  }

  private flushMotors(): void {
    const motors = this.options.components.filter((c) => c.type === "motor")
    const leftDuty  = motors[0] ? (this.motorDuties[motors[0].id] ?? 0) : 0
    const rightDuty = motors[1] ? (this.motorDuties[motors[1].id] ?? 0) : 0
    this.options.onMotorsChange(leftDuty, rightDuty)
  }

  private handleServoPulse(payload: PinChangePayload): void {
    if (payload.cycles === undefined) return
    if (payload.high) {
      this.servoRisingCycles.set(payload.pin, payload.cycles)
    } else {
      const rising = this.servoRisingCycles.get(payload.pin)
      if (rising === undefined) return
      this.servoRisingCycles.delete(payload.pin)
      const pulseWidthUs = (payload.cycles - rising) / CYCLES_PER_US
      const angle = Math.max(0, Math.min(180, (pulseWidthUs - 1000) / 1000 * 180))
      this.options.onServoChange(Math.round(angle))
    }
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run lib/workspace/__tests__/chassis-physics-bridge.test.ts
npx vitest run
```

Expected: all tests pass including the old gpio-bridge tests.

- [ ] **Step 6: Commit**

```bash
git add lib/workspace/component-types.ts lib/workspace/chassis-physics-bridge.ts lib/workspace/__tests__/chassis-physics-bridge.test.ts
git commit -m "feat(workspace): add servo component type + real motor/servo routing in bridge"
```

---

### Task 8: Update workspace simulator view — canvas, Rapier render loop, LED brightness

**Files:**
- Modify: `components/workspace/workspace-simulator-view.tsx`

**Interfaces:**
- Consumes: `createPhysicsWorld`, `addArenaBodies` (Task 4); `VirtualRobot` (Task 5); `SensorSimulation` (Task 6); `ChassisPhysicsBridge` (Task 7, updated); `GPIOBridge`; `ARENAS`, `ArenaConfig` from `arena.ts`.
- Produces: a canvas-based simulator replacing the div-based ON/OFF display.

No unit test for this component (it requires a real DOM + WASM + Worker). Verified manually per the testing plan in the spec.

- [ ] **Step 1: Replace `workspace-simulator-view.tsx`**

```typescript
"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import RAPIER from "@dimforge/rapier2d-compat"
import type { RobotProjectStore, WorkspaceSnapshot } from "@/lib/workspace/robot-project-store"
import { ChassisPhysicsBridge } from "@/lib/workspace/chassis-physics-bridge"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { compileSketch } from "@/lib/avr/compiler"
import { createPhysicsWorld, addArenaBodies } from "@/lib/simulator/rapier-physics"
import { VirtualRobot } from "@/lib/simulator/rapier-robot"
import { SensorSimulation, type SensorPinConfig } from "@/lib/simulator/sensor-simulation"
import { ARENAS, type ArenaConfig } from "@/lib/simulator/arena"
import type { AVREvent } from "@/lib/avr/types"
import { getComponentDef } from "@/lib/workspace/component-types"

const CANVAS_W = 800
const CANVAS_H = 600

function deriveSensorPins(snapshot: WorkspaceSnapshot): SensorPinConfig {
  const sensors = snapshot.components.filter((c) => c.type === "sensor")
  return {
    distanceSensorPin:    sensors[0]?.pin ?? null,
    lineSensorLeftPin:    sensors[1]?.pin ?? null,
    lineSensorCenterPin:  sensors[2]?.pin ?? null,
    lineSensorRightPin:   sensors[3]?.pin ?? null,
    bumpPin: null,
  }
}

function drawArena(ctx: CanvasRenderingContext2D, arena: ArenaConfig): void {
  ctx.fillStyle = "#f8f8f8"
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Arena border
  ctx.strokeStyle = "#333"
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2)

  // Line track
  if (arena.lineTrack) {
    ctx.strokeStyle = "#111"
    ctx.lineWidth = 20
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    for (const seg of arena.lineTrack) {
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
    }
    ctx.stroke()
  }

  // Goals
  if (arena.goals) {
    for (const goal of arena.goals) {
      ctx.beginPath()
      ctx.arc(goal.x, goal.y, goal.radius, 0, Math.PI * 2)
      ctx.fillStyle = goal.color + "44"
      ctx.fill()
      ctx.strokeStyle = goal.color
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = goal.color
      ctx.font = "12px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(goal.label, goal.x, goal.y + 4)
    }
  }
}

function drawRobot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number,
  servoAngle: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  // Robot body
  ctx.fillStyle = "#22c55e"
  ctx.strokeStyle = "#16a34a"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.rect(-30, -25, 60, 50)
  ctx.fill()
  ctx.stroke()

  // Heading arrow
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(25, 0)
  ctx.stroke()

  // Servo arm (orange line from center)
  const servoRad = ((servoAngle - 90) * Math.PI) / 180
  ctx.strokeStyle = "#FF5722"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(servoRad) * 20, Math.sin(servoRad) * 20)
  ctx.stroke()

  ctx.restore()
}

function drawLEDs(
  ctx: CanvasRenderingContext2D,
  snapshot: WorkspaceSnapshot,
  brightnessMap: Record<string, number>,
): void {
  let ledIndex = 0
  for (const comp of snapshot.components) {
    if (comp.type !== "led") continue
    const def = getComponentDef(comp.type)
    const brightness = brightnessMap[comp.id] ?? 0
    const x = 20 + ledIndex * 40
    const y = CANVAS_H - 30

    ctx.save()
    if (brightness > 0.1) {
      ctx.shadowBlur = 12
      ctx.shadowColor = def.color
    }
    ctx.globalAlpha = Math.max(0.15, brightness)
    ctx.fillStyle = def.color
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.fillStyle = "#555"
    ctx.font = "10px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(comp.name, x, y + 18)
    ledIndex++
  }
}

export function WorkspaceSimulatorView({ store }: { store: RobotProjectStore }) {
  const subscribe = useCallback((l: () => void) => store.subscribe(l), [store])
  const getFlashedSnapshot = useCallback(() => store.getFlashed(), [store])
  const getOutOfSyncSnapshot = useCallback(() => store.isOutOfSync(), [store])
  const flashed = useSyncExternalStore(subscribe, getFlashedSnapshot)
  const outOfSync = useSyncExternalStore(subscribe, getOutOfSyncSnapshot)

  const [running, setRunning] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [selectedArenaId, setSelectedArenaId] = useState("line-follow")

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const avrWorkerRef = useRef<Worker | null>(null)
  const rapierRef = useRef<{ world: RAPIER.World; robot: VirtualRobot; sensors: SensorSimulation } | null>(null)
  const animFrameRef = useRef<number>(0)
  const brightnessMapRef = useRef<Record<string, number>>({})
  const flashedRef = useRef<WorkspaceSnapshot | null>(null)

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const selectedArena = ARENAS.find((a) => a.id === selectedArenaId) ?? ARENAS[0]

    function loop() {
      if (!ctx) return
      const r = rapierRef.current
      if (r) {
        r.robot.update()
        r.world.step()
        r.sensors.tick()
      }

      drawArena(ctx, selectedArena)
      if (r) {
        const state = r.robot.getState()
        drawRobot(ctx, state.x, state.y, state.angle, state.servoAngle)
      }
      if (flashedRef.current) {
        drawLEDs(ctx, flashedRef.current, brightnessMapRef.current)
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [selectedArenaId])

  // AVR + Rapier bootstrap — re-runs when the flashed snapshot hash changes
  useEffect(() => {
    if (!flashed) return
    flashedRef.current = flashed
    setRunning(false)
    setCompileError(null)
    setRuntimeError(null)
    brightnessMapRef.current = {}

    // Tear down previous Rapier world
    if (rapierRef.current) {
      rapierRef.current.robot.destroy()
      rapierRef.current.world.free()
      rapierRef.current = null
    }

    const selectedArena = ARENAS.find((a) => a.id === selectedArenaId) ?? ARENAS[0]
    const sensorPins = deriveSensorPins(flashed)

    const avrWorker = new Worker(new URL("@/workers/avr-worker.ts", import.meta.url))
    avrWorkerRef.current = avrWorker

    const physicsBridge = new ChassisPhysicsBridge({
      components: flashed.components,
      onComponentStateChange: (id, _active, dutyCycle) => {
        brightnessMapRef.current = { ...brightnessMapRef.current, [id]: dutyCycle / 255 }
      },
      onMotorsChange: (leftDuty, rightDuty) => {
        rapierRef.current?.robot.setMotors(leftDuty, rightDuty)
      },
      onServoChange: (angleDeg) => {
        rapierRef.current?.robot.setServoAngle(angleDeg)
      },
    })

    const gpioBridge = new GPIOBridge({
      avrWorker,
      onPinChange: (payload) => physicsBridge.handlePinChange(payload),
      onAVRError: (msg) => { setRuntimeError(msg); setRunning(false) },
      onAVRStopped: () => setRunning(false),
    })

    avrWorker.onmessage = (e: MessageEvent<AVREvent>) => {
      const ev = e.data
      if (ev.type === "running") { setRunning(true); return }
      if (ev.type === "stopped") { setRunning(false); return }
      gpioBridge.handleAVREvent(ev)
    }

    // Initialise Rapier world asynchronously, then compile + run
    createPhysicsWorld()
      .then((world) => {
        addArenaBodies(world, selectedArena.id)
        const robot = new VirtualRobot(world, selectedArena.robotStartX, selectedArena.robotStartY)
        const sensors = new SensorSimulation(world, robot, selectedArena, gpioBridge, sensorPins)
        rapierRef.current = { world, robot, sensors }

        return compileSketch({ code: flashed.code.generatedCode, board: "arduino-uno" })
      })
      .then((result) => {
        if (!result) return
        if (result.success) {
          avrWorker.postMessage({ type: "load", hex: result.hex, board: "arduino-uno" })
          avrWorker.postMessage({ type: "run" })
        } else {
          setCompileError(result.errors.map((e) => e.message).join("\n") || "Compile failed")
        }
      })
      .catch((err: unknown) => {
        setCompileError(err instanceof Error ? err.message : "Compile failed")
      })

    return () => {
      avrWorker.terminate()
      avrWorkerRef.current = null
      if (rapierRef.current) {
        rapierRef.current.robot.destroy()
        rapierRef.current.world.free()
        rapierRef.current = null
      }
      setRunning(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashed?.hash, selectedArenaId])

  if (!flashed) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Nothing flashed yet — flash from the Builder tab first.
      </div>
    )
  }

  if (outOfSync) {
    return (
      <div className="p-4 text-sm text-amber-500">
        Out of sync with the Builder — reflash to run the latest build.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{running ? "▶ Running" : "⏹ Stopped"}</span>
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={selectedArenaId}
          onChange={(e) => setSelectedArenaId(e.target.value)}
        >
          {ARENAS.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      {compileError && (
        <div data-testid="sim-compile-error" className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Compile error: {compileError}
        </div>
      )}
      {runtimeError && (
        <div data-testid="sim-runtime-error" className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Runtime error: {runtimeError}
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded border border-border"
        style={{ maxWidth: "100%", aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Start dev server and manually verify**

```bash
npm run dev
```

Manual checks:
1. Open any workspace project → Builder tab → place 2 motors + 1 LED → click Flash.
2. Switch to Simulator tab → canvas should appear with the line-follow track.
3. Write `analogWrite(MOTOR_1_PIN, 128);` → Flash → Simulator → robot should move at ~half speed.
4. Change to `analogWrite(MOTOR_1_PIN, 255);` → robot moves faster.
5. Place a LED + resistor concept: `analogWrite(LED_1_PIN, 64)` → LED glow should be dim (~25%), not full ON.
6. Switch arena selector to "Obstacle Course" → obstacles appear.

- [ ] **Step 4: Commit**

```bash
git add components/workspace/workspace-simulator-view.tsx
git commit -m "feat(workspace): replace ON/OFF div sim with Rapier2D canvas simulator + LED brightness"
```

---

## Manual Integration Tests (post all tasks)

These match the spec's Testing Plan exactly:

| Test | Expected behaviour |
|---|---|
| `blink` sketch on LED pin | LED glow pulses at 1Hz; `analogWrite(pin,64)` shows 25% brightness |
| `analogWrite(9, 128)` on motor | Robot moves at ~50% speed, not full |
| Line-following sketch | Robot placed at line-follow track start follows the black line |
| `myServo.write(90)` | Orange servo arm snaps to 90° (horizontal) |
| Serial Monitor | `Serial.print("hello")` still appears in Serial Monitor panel |
