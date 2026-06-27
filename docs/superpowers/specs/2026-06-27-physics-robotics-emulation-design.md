# Physics & Robotics Emulation Overhaul — Design Spec
**Date:** 2026-06-27  
**Status:** Approved  
**Goal:** Elevate the Xylo simulator from binary on/off toy to a realistic, child-friendly robotics emulator — accurate motor speed, real sensor feedback, servo support, and LED brightness — all in-browser.

---

## Context

The existing architecture has three correct layers: avr8js (instruction-level ATmega328P), a custom MNA circuit solver, and Matter.js physics. All three are working, but the connections between them are stubs:

- PWM detection is hardcoded `isPWM: false` in `workers/avr-worker.ts` — motors are binary regardless of `analogWrite()`
- Distance sensor `castRay()` exists in `lib/simulator/robot.ts` but is never called in `getState()` — always returns 0
- Line-following sensors are unimplemented stubs — always return `false`
- MNA calculates real LED brightness (0.0–1.0 via Shockley model) but it never reaches the canvas — displayed as ON/OFF
- Matter.js cannot model wheel friction or servo joints accurately enough for realistic robot behavior

Target robot types (user-selected): line-following robots, LED/button circuits, servo/arm projects.

---

## Architecture

### End-to-End Data Flow

```
User code (Blockly / Monaco C++)
  → /api/compile → arduino-cli → .hex
  → avr-worker.ts [avr8js @ 16MHz]
      reads Timer OCR registers → isPWM:true, dutyCycle:0–255
      emits pinChange with real duty cycles
  → chassis-physics-bridge.ts
      motor pins: dutyCycle/255 × maxSpeed → wheel target velocity
      servo pins: pulse-width timing (µs) → angle 0°–180°
  → circuit-bridge.ts (unchanged)
      digital outputs → circuit node voltages
      circuit voltages → ADC inputs
  → circuit-worker.ts / MNA (unchanged)
      emits brightnessMap { nodeId → 0.0–1.0 }
  → rapier-robot.ts
      RevoluteJointMotor.configureMotorVelocity(left, right)
      RevoluteJoint.configureMotorPosition(servoAngle)
      physics tick → world-space robot position + angle
  → sensor-simulation.ts
      distance: Rapier raycast → ADC value → setADCInput
      line: canvas pixel sample → digital → setDigitalInput
      bump: Rapier contact event → digital → setDigitalInput
  → Canvas renderer (workspace-simulator-view.tsx)
      robot body from Rapier position
      LED glow from brightnessMap opacity
      sensor ray visualizations
```

### Physics Engine: Rapier2D

Replace Matter.js with `@dimforge/rapier2d-compat` (WebAssembly, ~300KB). Key advantages over Matter.js for this use case:

- **`configureMotorVelocity(target, damping)`** — realistic wheel motor behavior with inertia
- **`configureMotorPosition(angle, stiffness, damping)`** — servo joint with spring-damper model
- **Real friction** — floor friction prevents the robot from sliding when motors stop
- **Raycasting API** — built-in `world.castRay()`, no manual line-segment iteration needed

Rapier WASM must initialize asynchronously. The simulator component awaits `RAPIER.init()` before creating the physics world. Until init resolves, the canvas shows a loading state.

---

## Module Specifications

### 1. PWM Detection — `workers/avr-worker.ts`

**What changes:** The pin listener (lines 69–88) currently hardcodes `isPWM: false`. Add a lookup table mapping each PWM-capable pin to its timer OCR register address and TCCR address. On each pin change:

1. Check the timer's TCCRnA register: if WGM bits indicate Fast PWM (mode 3) or Phase-Correct PWM (mode 1 or 2), the pin is in PWM mode.
2. Read the OCRnx byte from `cpu.data[ocrAddress]` as the duty cycle (0–255).
3. Emit `{ isPWM: true, dutyCycle: ocrValue }` instead of the current stub.

**PWM pin → register map:**

| Arduino Pin | Timer | OCR Register | CPU data address | TCCR address |
|-------------|-------|--------------|-----------------|--------------|
| D3  | Timer2 | OCR2B | 0xB4 | TCCR2A: 0xB0 |
| D5  | Timer0 | OCR0B | 0x48 | TCCR0A: 0x44 |
| D6  | Timer0 | OCR0A | 0x47 | TCCR0A: 0x44 |
| D9  | Timer1 | OCR1AL | 0x88 | TCCR1A: 0x80 |
| D10 | Timer1 | OCR1BL | 0x8A | TCCR1A: 0x80 |
| D11 | Timer2 | OCR2A  | 0xB3 | TCCR2A: 0xB0 |

Non-PWM pins: unchanged behavior (`isPWM: false, dutyCycle: high ? 255 : 0`).

**Files touched:** `workers/avr-worker.ts` only.

---

### 2. Rapier Physics World — `lib/simulator/rapier-physics.ts` *(new)*

Replaces `lib/simulator/physics.ts`.

```typescript
export async function createPhysicsWorld(): Promise<RAPIER.World>
export function createArenaBodies(world: RAPIER.World, arena: ArenaConfig): void
export function createObstacleBody(world: RAPIER.World, obs: ObstacleConfig): RAPIER.RigidBody
```

- `createPhysicsWorld()`: Awaits `RAPIER.init()`, creates world with `gravity: { x:0, y:0 }` (top-down), returns world.
- `createArenaBodies()`: Converts existing `ArenaConfig` wall segments (from `lib/simulator/arena.ts`, which is untouched) into static Rapier colliders.
- `createObstacleBody()`: Creates a static box or circle collider for each arena obstacle.

Existing `lib/simulator/physics.ts` and `lib/simulator/arena.ts` are not deleted; `physics.ts` is superseded but kept for reference. Arena definitions remain authoritative in `arena.ts`.

---

### 3. Rapier Robot — `lib/simulator/rapier-robot.ts` *(new)*

Replaces `lib/simulator/robot.ts` (kept for reference, not deleted).

```typescript
export class VirtualRobot {
  constructor(world: RAPIER.World, x: number, y: number, config: RobotConfig)
  
  setMotors(leftDuty: number, rightDuty: number): void  // 0–255 each
  setServoAngle(jointIndex: number, angleDeg: number): void  // 0–180°
  update(): void  // called each render frame; reads Rapier state
  getState(): RobotState
  destroy(): void
}
```

**Robot body:** Rectangular `RigidBody` (dynamic) with a `Cuboid` collider. Mass derived from config. Floor friction set to 0.8 so inertia-based stopping feels real.

**Wheel motors:** Two `RevoluteJoint` constraints anchored at ±(width/2) offset from robot centroid. Each joint uses `configureMotorVelocity(targetVel, damping: 10)`. `setMotors()` maps `duty/255 × maxAngularVel` to the left and right joint targets.

**Servo joint:** One optional `RevoluteJoint` anchored at a configurable attachment point. `configureMotorPosition(targetAngle, stiffness: 100, damping: 10)`. `setServoAngle()` converts degrees to radians and calls this.

**`getState()`:** Reads `rigidBody.translation()` and `rigidBody.rotation()` from Rapier — no longer returns hardcoded sensor zeros (sensor values come from `sensor-simulation.ts`).

---

### 4. Sensor Simulation — `lib/simulator/sensor-simulation.ts` *(new)*

```typescript
export class SensorSimulation {
  constructor(
    world: RAPIER.World,
    robot: VirtualRobot,
    arenaCanvas: HTMLCanvasElement,
    bridge: GpioBridge,
  )
  
  tick(): void  // call each physics frame
}
```

**Distance sensor (HC-SR04 analog model):**
- Raycast from a point 25px in front of the robot centroid, along the robot's heading angle.
- Max range: 400cm (mapped to sensor range in pixels via a configurable px-per-cm scale).
- Rapier `world.castRay(ray, maxToi, solid)` returns time-of-impact.
- Maps distance to 0–1023 ADC range: `adcValue = (1 - dist/maxDist) * 1023`.
- Feeds to AVR via `bridge.setADCInput(A0_PIN, adcValue)`.

**Line sensors (IR model — 3 sensors: left, center, right):**
- Each sensor is a point offset from the robot centroid: `[-15, 0]`, `[0, 0]`, `[+15, 0]` in robot-local space. Transforms to world space using robot position + angle.
- Samples a 4px-radius circle on `arenaCanvas` at the sensor world position. If the average luminance of sampled pixels is below threshold (50/255 — darker than grey → line detected) → digital LOW.
- Feeds to AVR via `bridge.setDigitalInput(pin, !onLine)` (standard IR sensor: LOW when over line).

**Bump sensor:**
- Register a Rapier `EventQueue` collision event listener on the robot's collider.
- On contact start → `bridge.setDigitalInput(BUMP_PIN, false)` for 50ms.
- On contact end → `bridge.setDigitalInput(BUMP_PIN, true)`.

---

### 5. Chassis Physics Bridge — `lib/workspace/chassis-physics-bridge.ts`

**Motor fix:** The existing `isPWM: false` check is replaced. `pinChange` events already carry `dutyCycle` (0–255). Map motor pins by checking `store.getFlashed().components` for which component is on which pin.

**Servo fix:** Add a `cycles: number` field to the existing `pinChange` event payload in `avr-worker.ts` (`cpu.cycles` is readable after each tick). Track rising-edge cycle count per servo pin in the bridge. On falling edge: `pulseWidthUs = (fallingCycles - risingCycles) / 16` (16 cycles per µs at 16MHz). Map `1000µs → 0°`, `2000µs → 180°` (standard RC servo protocol), clamped. Call `robot.setServoAngle(jointIndex, angle)`.

**LED brightness:** The `brightnessMap` from `circuit-bridge.ts` callback is already available in the simulator component. Route it to a React `useState` setter in `workspace-simulator-view.tsx`. The canvas LED draw call uses `ctx.globalAlpha = brightness` instead of a binary check.

---

## Component Rendering (Canvas)

`workspace-simulator-view.tsx` manages one `<canvas>` element for the arena + robot. Each animation frame:

1. Clear canvas, draw arena (walls, line track, goal zones).
2. Get robot position + angle from Rapier → draw robot body with heading arrow.
3. For each placed LED component: draw a circle with `globalAlpha = brightnessMap[componentId] ?? 0`, using the LED's color from `component-types.ts`. Add a soft radial glow (`shadowBlur: 12, shadowColor`) at full brightness.
4. Draw distance sensor ray (thin line from robot front, length proportional to measured distance).
5. Draw line sensor dots (colored: red = over line, white = off line).
6. For each servo: draw a line segment from the servo's attachment point at the current angle (0°–180°), length 20px, representing the servo horn/arm. This gives children immediate visual feedback that the servo is moving.

---

## Error Handling

| Failure Mode | Behavior |
|---|---|
| Rapier WASM fails to load | Catch in `createPhysicsWorld()`; show "Physics engine unavailable" in simulator banner; allow code editing to continue |
| Timer register read on non-PWM timer mode | WGM check gates the OCR read; falls back to binary `dutyCycle: high ? 255 : 0` |
| Canvas context null (headless or tab hidden) | Line sensor returns `false` (not on line); simulator recovers on next frame |
| Rapier raycast returns no hit | Distance = maxRange; ADC = 0 |
| Servo pulse width out of 1000–2000µs range | Clamp to 0° or 180° |

---

## Testing Plan

**Unit tests (Vitest):**
- `pwm-detection.test.ts`: Verify that OCR register reads on known timer configurations return correct duty cycles. Mock `cpu.data[]` directly.
- `sensor-simulation.test.ts`: Mock Rapier world and canvas context; verify distance → ADC mapping, line luminance threshold, bump event timing.
- `servo-model.test.ts`: Feed synthetic rising/falling edge timestamps; verify angle output at 1000µs, 1500µs, 2000µs.

**Integration (manual):**
1. Load a `blink` sketch (`digitalWrite(13, HIGH); delay(500); ...`): LED should pulse at 1Hz, brightness proportional to `analogWrite` value if changed.
2. Load a motor sketch (`analogWrite(9, 128)`): Robot should move at ~50% max speed, not full speed.
3. Load a line-following sketch: Robot placed at start of the Line Following Track arena should follow the line without modification to arena code.
4. Load a servo sketch (`myServo.write(90)`): Servo arm should rotate to 90°.
5. Verify Serial Monitor output still works throughout all above.

---

## Files Created / Modified

| File | Action |
|---|---|
| `workers/avr-worker.ts` | Modify — add PWM register map + OCR read in pin listener; add `cycles` field to `pinChange` event |
| `lib/avr/types.ts` | Modify — add `cycles?: number` to `PinChangeEvent` type |
| `lib/simulator/rapier-physics.ts` | Create — Rapier world + arena body builders |
| `lib/simulator/rapier-robot.ts` | Create — VirtualRobot backed by Rapier |
| `lib/simulator/sensor-simulation.ts` | Create — distance, line, bump sensor logic |
| `lib/workspace/chassis-physics-bridge.ts` | Modify — real PWM → motor/servo, route brightnessMap |
| `components/workspace/workspace-simulator-view.tsx` | Modify — Rapier render loop, LED brightness draw |
| `package.json` | Modify — add `@dimforge/rapier2d-compat` |

**Unchanged:** `lib/simulator/robot.ts`, `lib/simulator/physics.ts`, `lib/simulator/arena.ts`, `workers/circuit-worker.ts`, `lib/circuit/**`, `lib/avr/**`, `lib/blockly/**`, all workspace builder code.

---

## Dependencies

```json
"@dimforge/rapier2d-compat": "^0.14.0"
```

No other new dependencies. All existing dependencies (avr8js, Matter.js, MNA solver) are retained.

---

## Out of Scope (Explicit Deferrals)

- Breadboard visual renderer (state exists in `breadboard-state.ts`; UI not in this spec)
- Circuit component library expansion (capacitors, transistors, relays)
- Obstacle-avoidance robot type (deferred; distance sensor works but arena + challenge system for it is Phase 3)
- Step-through AVR debugger / register viewer
- Multi-board support (Nano, Mega)
- Real hardware flashing (Phase 5)
