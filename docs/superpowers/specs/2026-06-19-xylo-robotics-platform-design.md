# Xylo Robotics Platform — Full Product Design Spec
**Date:** 2026-06-19
**Status:** Approved for implementation planning
**Scope:** Complete platform redesign around AVR emulation, MNA circuit simulation, synchronized circuit editor, mission-based learning, in-context AI mentor, and direct hardware flashing

---

## 1. Executive Summary

Xylo is a browser-based robotics education platform for students aged 8–16. Its core promise is that a student can **wire a circuit, write Arduino code, simulate it with physics-accurate behavior, and flash it directly to a real Arduino** — all without leaving the browser and without any gap between what the simulator shows and what the hardware does.

The existing codebase has strong foundations: curriculum infrastructure, authentication, payments, educator tools, a Blockly block editor, a basic 2D physics simulator, and a partial Arduino transpiler. This spec defines the complete redesign of the simulation and learning engines to deliver on the full promise.

**The four pillars being designed:**
1. **Lessons** — Mission-based structured curriculum embedded in interactive sandboxes
2. **Circuit + Robot Builder** — Synchronized breadboard/schematic editor with real MNA electronics simulation
3. **Code Editor** — Monaco (Arduino C++) + Blockly (visual blocks) with an embedded AI mentor tutor
4. **Flash to Hardware** — One-click in-browser compilation and direct Arduino upload via Web Serial + avrdude WASM

---

## 2. Design Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Electronics fidelity | MNA circuit solver (custom TypeScript) | Full Ohm's law, fault models, educational errors. SPICE WASM rejected due to convergence UX issues for children |
| MCU emulation | avr8js (ATmega328P) | Proven, MIT licensed, true instruction-level fidelity. `millis()`, interrupts, I2C, SPI, PWM all work |
| Circuit editor | Breadboard + schematic, synchronized via shared netlist | Mirrors the physical experience while teaching schematic literacy |
| Physics engine | Matter.js (existing, upgraded) | Retained. Sensor feedback loop connects physics world → MNA → AVR ADC |
| Learning model | Mission-based sandbox (not separate lesson + tool pages) | Eliminates context switching, keeps 8-year-olds focused |
| AI mentor | Claude claude-sonnet-4-6, nudge-only, context-aware | Better technical reasoning than GPT-4o-mini; never gives direct answers |
| Target platform | Arduino Uno (ATmega328P) first; Nano/Mega secondary | Most common in K-12 settings |
| Age range | 8–16, two tiers: 8–12 (Blockly-first) and 12–16 (code-first) |
| Flasher | avr-gcc WASM + avrdude WASM + Web Serial | Eliminates Arduino Web Editor dependency |

---

## 3. Overall Architecture

### 3.1 Technology Stack (unchanged foundations)

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Database:** Supabase (PostgreSQL + JSONB)
- **Auth:** Clerk
- **Payments:** Stripe
- **UI:** Radix UI + shadcn/ui + Tailwind CSS v4
- **Animations:** Framer Motion
- **Forms:** React Hook Form + Zod

### 3.2 New Core Engines (all client-side)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Mission Sandbox (UI Layer)                        │
│                                                                          │
│  ┌─────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
│  │  Circuit Editor │  │    Code Editor        │  │  Robot Physics     │  │
│  │                 │  │                       │  │  Canvas            │  │
│  │  Breadboard     │  │  Monaco (Arduino C++) │  │                    │  │
│  │  ────────────── │  │  or                   │  │  Matter.js 2D      │  │
│  │  Schematic      │  │  Blockly (visual)     │  │  top-down          │  │
│  │  (React Flow)   │  │                       │  │                    │  │
│  │                 │  │  AI Mentor Chat       │  │  Arena selector    │  │
│  └────────┬────────┘  └──────────┬────────────┘  └─────────┬──────────┘  │
│           │                      │                          │            │
│  ┌────────▼──────────────────────▼──────────────────────────▼──────────┐  │
│  │                     Simulation Bridge                                │  │
│  │                                                                      │  │
│  │  AVR GPIO pins ↔ MNA circuit nodes ↔ Matter.js physics world        │  │
│  │  Pin output voltage → circuit source | Node voltage → ADC register   │  │
│  │  Sensor position in physics world → sensor component voltage output  │  │
│  └──────────────────────┬────────────────────────────────────────────── ┘  │
│                         │                                                │
│  ┌──────────────────────▼──────────────────────────────────────────────┐ │
│  │                      Engine Layer (Web Workers)                      │ │
│  │                                                                      │ │
│  │  ┌─────────────────────┐    ┌──────────────────────────────────┐    │ │
│  │  │ avr8js              │    │ MNA Circuit Solver               │    │ │
│  │  │ ATmega328P emulator │    │                                  │    │ │
│  │  │                     │    │ Resistors, LEDs, capacitors,     │    │ │
│  │  │ avr-gcc WASM        │    │ transistors, motors, servos,     │    │ │
│  │  │ compiles .ino → .hex│    │ sensors, buzzers, displays       │    │ │
│  │  │                     │    │                                  │    │ │
│  │  │ Runs in Web Worker  │    │ Runs at ~1kHz, adaptive timestep │    │ │
│  │  └─────────────────────┘    └──────────────────────────────────┘    │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Route Structure

**New routes:**
- `/missions/[missionId]` — Primary learning environment. Replaces `/simulator` as the main interactive surface.
- `/circuit` — Freeplay circuit editor + simulator (no mission constraints). For open exploration.

**Upgraded routes:**
- `/learn/[courseId]/lesson/[lessonId]` — Lesson viewer now embeds mission sandboxes inline via `"mission"` content block type
- `/flasher` — Same URL, completely new internals (avr-gcc WASM + avrdude WASM)
- `/playground` — Blockly editor retained; generates real Arduino C++ fed into avr8js

**Retired/replaced:**
- `lib/simulator/arduino-transpiler.ts` — Deleted. avr8js replaces it entirely.
- `lib/simulator/executor.ts` — Deleted. avr8js replaces it entirely.
- `app/simulator/` — Redirects to `/circuit` for freeplay or `/missions/[id]` for structured learning

**Unchanged routes:**
- `/builder` (robot body layout, retained for component configuration)
- `/generator` (AI code generator, retained as standalone tool, `/api/generate` upgraded)
- `/dashboard`, `/educator`, `/challenges`, `/pricing`, `/profile` — all unchanged

---

## 4. AVR Emulation Layer

### 4.1 Library: avr8js

- **Package:** `@wokwi/avr8js` (MIT license)
- **What it emulates:** Full ATmega328P — 32KB flash, 2KB SRAM, all I/O registers, timers 0/1/2, UART, SPI, I2C (TWI), ADC, external interrupts, pin-change interrupts
- **Compilation:** `avr-gcc` + `avr-libc` compiled to WebAssembly via Emscripten (~4MB, loaded once, cached in `Cache API`)
- **Execution:** Runs in a dedicated **Web Worker** (`workers/avr-worker.ts`) at configurable speed

### 4.2 Compilation Pipeline

```
Student's .ino file (string)
        │
        ▼
avr-gcc WASM (Web Worker)
  flags: -mmcu=atmega328p -DF_CPU=16000000UL -Os
  includes: Arduino.h, Wire.h, SPI.h, Servo.h, avr/io.h
        │
        ▼
ELF binary → objcopy → Intel HEX format (.hex)
        │
        ├──→ Stored in memory for avr8js execution (simulation)
        └──→ Stored as Uint8Array for avrdude upload (flashing)
```

Compilation errors are parsed from `stderr` and surfaced as inline Monaco editor markers with line numbers and human-readable messages. Common errors get enhanced messages:
- `'pinMode' was not declared` → "Did you forget `#include <Arduino.h>`? It's added automatically in the real Arduino IDE."
- `expected ';' before '}'` → Points to the exact line with a red underline.

### 4.3 Execution Architecture

```typescript
// workers/avr-worker.ts
interface AVRWorkerMessage {
  type: "compile" | "run" | "stop" | "pause" | "resume" | "setSpeed"
  payload?: CompilePayload | RunPayload | SpeedPayload
}

interface AVRWorkerEvent {
  type: "compiled" | "pinChange" | "serialOutput" | "error" | "halted"
  payload?: HexPayload | PinChangePayload | SerialPayload | ErrorPayload
}
```

The AVR CPU loop runs at **emulated 16MHz** in `workers/avr-worker.ts`, posting `pinChange` messages to the main thread whenever a GPIO pin's output state changes (digital high/low, PWM duty cycle). The GPIO bridge on the main thread receives these messages and forwards voltage updates to `workers/circuit-worker.ts` via a second `postMessage`. ADC values flow in reverse: the circuit worker posts solved node voltages to the main thread, which the bridge converts to 0–1023 ADC register values and sends to the AVR worker. The main thread acts purely as a message router — it holds no simulation state itself, keeping the UI thread free for 60fps rendering.

**Speed control:** A speed multiplier (0.1x – 1000x) scales the `setInterval` tick rate. At 1000x, a `delay(1000)` completes in 1ms of real time — crucial for testing robot navigation loops without waiting.

### 4.4 Supported Arduino APIs

| API | Implementation | Notes |
|---|---|---|
| `pinMode()`, `digitalWrite()`, `digitalRead()` | Native AVR registers | Full fidelity |
| `analogWrite()` | Timer PWM registers | Correct duty cycle, frequency |
| `analogRead()` | ADC register + GPIO bridge | Reads MNA node voltage, maps 0–5V → 0–1023 |
| `delay()`, `delayMicroseconds()` | Timer0 emulation | Accurate to µs |
| `millis()`, `micros()` | Timer0 overflow counter | Correct rollover at 49 days |
| `Serial.begin()`, `Serial.print()`, `Serial.println()` | UART emulation | Output appears in Serial Monitor panel |
| `Serial.available()`, `Serial.read()` | UART RX buffer | Serial monitor input feeds into RX |
| `attachInterrupt()`, `detachInterrupt()` | External interrupt registers | INT0 (D2), INT1 (D3) |
| `Wire.begin()`, `Wire.write()`, `Wire.read()` | I2C protocol emulation | Supported for LCD1602, MPU6050, SSD1306 |
| `SPI.begin()`, `SPI.transfer()` | SPI protocol emulation | Supported for MAX7219 |
| `Servo.attach()`, `Servo.write()` | PWM → angle mapping | Drives physics canvas servo arm |
| `pulseIn()` | Pin interrupt timing | Used by HC-SR04 echo measurement |
| `tone()`, `noTone()` | Timer1 square wave | Plays audio in browser at correct frequency |
| `EEPROM.read()`, `EEPROM.write()` | Emulated 1KB EEPROM | Persists across simulation resets in session |
| `map()`, `constrain()`, `abs()`, etc. | Standard Arduino math | Pure AVR implementations |

### 4.5 Educational Guardrails

- **Pin current limit:** If the MNA solver calculates >40mA sourced from any single output pin, simulation pauses and shows: *"Pin [X] is trying to source [Xma] — the ATmega328P's maximum is 40mA. This would damage your Arduino. Add a current-limiting resistor."*
- **Total port current limit:** >200mA across all pins triggers a similar warning (real ATmega limit).
- **Undefined behavior detection:** Reading a pin configured as OUTPUT, or writing to a pin configured as INPUT, shows a warning matching what would happen on real hardware.

---

## 5. MNA Circuit Solver

### 5.1 Mathematical Foundation

Modified Nodal Analysis assembles a system **Gx = b** where:
- **G** is the conductance/stamp matrix (n+m × n+m, where n = nodes, m = voltage sources)
- **x** is the unknown vector [node voltages V₁..Vₙ, branch currents I₁..Iₘ]
- **b** is the source vector

For nonlinear components (diodes, transistors), Newton-Raphson iteration linearizes the I-V curve at the current operating point and solves repeatedly until ‖Δx‖ < ε (convergence tolerance).

Capacitors use the **trapezoidal rule** for time-domain integration:
```
I_cap(t) = (2C/Δt) * (V(t) - V(t-Δt)) - I_cap(t-Δt)
```

### 5.2 Solver Architecture

```
lib/circuit/
├── solver/
│   ├── mna-solver.ts          — Matrix assembly, LU decomposition (Doolittle), back substitution
│   ├── newton-raphson.ts      — Nonlinear iteration, convergence detection, damped updates
│   ├── timestep.ts            — Adaptive timestep: shrinks on convergence failure, grows during steady state
│   └── matrix.ts              — Sparse matrix operations, pivot selection for numerical stability
├── components/
│   ├── base-component.ts      — Abstract Component: stamp(), updateNonlinear(), getFaultState()
│   ├── resistor.ts            — Linear stamp: G[n1][n1]+=1/R, G[n2][n2]+=1/R, G[n1][n2]-=1/R
│   ├── led.ts                 — Shockley diode model: Is=1e-12, n=1.8, Vf~2.0V + series Rs=10Ω
│   ├── capacitor.ts           — Trapezoidal stamp, stores previous voltage for time integration
│   ├── voltage-source.ts      — Stamps into conductance matrix as modified nodal branch
│   ├── current-source.ts      — Stamps into b vector
│   ├── diode.ts               — Shockley model (general purpose: 1N4148, 1N4007)
│   ├── transistor-npn.ts      — Ebers-Moll simplified: β=100, Vbe=0.65V, saturation at Vce<0.2V
│   ├── transistor-pnp.ts      — Same, mirrored polarity
│   ├── motor-dc.ts            — Back-EMF voltage source in series with winding resistance (Ra=5Ω)
│   ├── servo.ts               — PWM period detector → angle → physics world update
│   ├── buzzer.ts              — Frequency detection from square wave → Web Audio API tone
│   └── sensors/
│       ├── hcsr04.ts          — TRIG pulse detector → physics ray-cast → ECHO pulse generator
│       ├── ir-sensor.ts       — Canvas pixel reader at sensor world position → analog voltage
│       ├── ldr.ts             — Scene light level → resistance (100Ω bright, 10MΩ dark)
│       ├── thermistor.ts      — Fixed temperature model (20°C default, configurable per mission)
│       ├── potentiometer.ts   — Three-terminal voltage divider, wiper position from UI slider
│       └── push-button.ts     — Ideal switch + optional bounce model (50ms, configurable)
├── netlist/
│   ├── netlist.ts             — Graph: nodes (Map<id, voltage>) + components + connections
│   ├── netlist-validator.ts   — ERC: floating pins, short circuits, missing GND
│   ├── breadboard-to-netlist.ts — Hole coordinates → electrical connectivity
│   └── schematic-to-netlist.ts  — React Flow graph → netlist
└── gpio-bridge.ts             — AVR pin state ↔ MNA voltage source / node reader
```

### 5.3 Component Models In Detail

**LED (most educationally important component):**
```
Forward voltage: Vf = n*Vt*ln(If/Is + 1)  [Shockley]
Series resistance: Rs = 10Ω (lead resistance)
Luminous intensity: proportional to If (linear above threshold)
Color: determined by component config (red/green/blue/white/yellow)
Fault: If If > Imax (20mA typical), component enters "burned" state
```

**DC Motor:**
```
Model: V = I*Ra + Vemf
Vemf = k*ω  (back-EMF proportional to angular velocity)
Torque: τ = k*I
Mechanical: J*dω/dt = τ - b*ω - τ_load
τ_load comes from Matter.js body inertia and collision forces
Motor direction: controlled by H-bridge polarity
Stall condition: ω=0, Vemf=0, I = V/Ra (high stall current — can trigger overcurrent warning)
```

**HC-SR04 Ultrasonic Sensor:**
```
TRIG: AVR pulses HIGH for ≥10µs
Sensor: fires ray-cast from sensor position in Matter.js world at current robot heading
Distance: d = ray-cast hit distance (cm)
ECHO: sensor holds HIGH for duration = 2*d/34300 seconds (speed of sound at 20°C)
Resolution: 1cm, range 2cm–400cm
Timeout: >400cm → no echo (ECHO stays LOW)
```

**IR Line Sensor:**
```
Position: mounted at robot's underside, offset from center in mission config
Canvas read: ImageData pixel at sensor world coordinates
Reflectance: white → high voltage (4.5V), black → low voltage (0.3V)
Output: analog voltage → AVR analogRead() returns 0–1023
Optional: digital threshold output (configurable via onboard potentiometer in schematic)
```

### 5.4 Fault Models

Every fault produces a structured error object with a user-facing message, a technical explanation, and a suggestion:

```typescript
interface ComponentFault {
  severity: "warning" | "damage" | "destroyed"
  component: ComponentId
  message: string           // "Your LED has no current-limiting resistor"
  technical: string         // "Forward current 87mA exceeds Imax 20mA"
  suggestion: string        // "Add a 220Ω resistor in series between pin 13 and the LED anode"
  highlightNodes: string[]  // nets to highlight in circuit editor
}
```

Fault severity:
- **Warning** — Simulation continues but suboptimally (e.g., LED dim due to high resistor value)
- **Damage** — Component enters degraded state, simulation continues with reduced performance
- **Destroyed** — Component stops functioning, must be replaced to continue (student can click "Repair" to reset)

### 5.5 GPIO Bridge

The bridge is the most critical integration point. It runs as a coordinator on the main thread, routing `postMessage` events between `avr-worker` and `circuit-worker`. It holds no simulation state — it only translates message formats and enforces the pin-mode contract (an output pin becomes a voltage source in the MNA; an input pin becomes a voltage reader):

```typescript
class GPIOBridge {
  private pinModes: Map<number, "input" | "output"> = new Map()
  private pwmDutyCycles: Map<number, number> = new Map()

  // Called when avr8js fires a pin change event
  onAVRPinChange(pin: number, voltage: number, isPWM: boolean, dutyCycle: number): void {
    if (isPWM) {
      // For LEDs/motors: inject averaged DC voltage = dutyCycle/255 * 5V
      // For servo/HC-SR04: inject time-domain pulse sequence
      this.solver.setPinSource(pin, {
        type: isPWM ? "pwm" : "dc",
        voltage,
        dutyCycle,
        frequency: this.getTimerFrequency(pin)  // from AVR timer registers
      })
    } else {
      this.solver.setPinSource(pin, { type: "dc", voltage })
    }
  }

  // Called each solver tick to update AVR ADC registers
  updateAVRInputs(): void {
    for (const [pin, node] of this.inputPinNodes) {
      const voltage = this.solver.getNodeVoltage(node)
      const adcValue = Math.round((voltage / 5.0) * 1023)
      this.avrWorker.postMessage({ type: "setADC", pin, value: adcValue })
    }
  }
}
```

PWM handling deserves special attention: for components that respond to **average** voltage (LEDs, simple DC motors), the bridge injects the averaged DC equivalent. For components that respond to the **pulse shape** (servos, HC-SR04), the bridge generates the actual pulse sequence with correct timing derived from the AVR timer registers.

### 5.6 Performance Targets

| Metric | Target |
|---|---|
| Solver tick rate | 1kHz (1ms per step) for circuits with <20 components |
| Newton-Raphson convergence | <5 iterations for typical K-12 circuits |
| AVR compilation time | <3 seconds for typical .ino files |
| GPIO bridge latency | <2ms (AVR pin change → circuit update) |
| Physics-to-sensor latency | <16ms (one animation frame) |
| UI frame rate | 60fps (solver in circuit-worker, AVR in avr-worker, bridge is message-only on main thread) |

---

## 6. Synchronized Circuit Editor

### 6.1 Shared Netlist (Source of Truth)

```typescript
interface Netlist {
  nodes: Map<string, NetNode>
  components: Map<string, ComponentInstance>
  connections: Connection[]
  groundNode: string    // always "GND"
  supplyNode: string    // always "VCC" (5V)
}

interface NetNode {
  id: string
  label: string         // auto-generated ("NET001") or named ("VCC", "GND")
  voltage?: number      // filled in by solver after each tick
}

interface ComponentInstance {
  id: string
  type: ComponentType
  params: Record<string, number | string>  // e.g. { resistance: 220, unit: "Ω" }
  breadboardPosition?: BreadboardPosition
  schematicPosition?: SchematicPosition
  faultState?: ComponentFault
}

interface Connection {
  componentId: string
  terminal: string      // "anode", "cathode", "pin1", "pin2", etc.
  nodeId: string
}
```

### 6.2 Breadboard View

**Implementation:** Custom HTML5 Canvas (not DOM/React). The canvas renders at 2× device pixel ratio for crisp display on retina screens.

**Physical layout:**
- Standard 830-hole half+half breadboard
- 63 rows × 10 columns (a–j) for tie-strips, plus 4 power rails
- Arduino Uno rendered as a physical PCB to the left, pins labeled D0–D13, A0–A5, GND, 5V, 3.3V, AREF, RESET, VIN
- Holes are 2.54mm pitch in the model, scaled to canvas pixels

**Interaction model:**
- **Place component:** Drag from palette → snap to valid hole positions (DIP components span the gap, passive components span adjacent holes)
- **Draw wire:** Click a hole → click destination hole → wire routes automatically using A* pathfinding on the hole grid to avoid existing components
- **Wire color:** Auto-assigned by net (VCC=red, GND=black, user nets get distinct colors from a palette)
- **Select:** Click component or wire to select; shows properties panel with parameter editing (resistance value, LED color, etc.)
- **Delete:** Backspace/Delete key on selection
- **Pan/zoom:** Two-finger trackpad, scroll wheel, or pinch gesture

**Visual feedback:**
- Hovering any hole highlights the full connected net in yellow across both breadboard and schematic simultaneously
- Fault components flash red with a tooltip showing the fault message
- Real-time node voltage labels appear on wires during simulation (toggleable — off by default for beginners)
- Current flow arrows on wires during simulation (toggleable)

### 6.3 Schematic View

**Implementation:** React Flow with custom node types for each component symbol.

**Component symbols:** Standard IEEE/ANSI schematic symbols:
- Resistor: rectangular body (US) with value label
- Capacitor: two parallel lines, polarity marker for electrolytics
- LED: diode triangle + arrow rays
- Transistor: NPN/PNP standard symbols with B/C/E labels
- Voltage source: circle with +/- terminals
- Ground: three-line symbol (chassis ground)
- Sensor symbols: custom educational icons that look friendly for children

**Auto-layout:** When a student switches to schematic view for the first time after building on the breadboard, the schematic is auto-laid-out using a hierarchical layout algorithm (Sugiyama method) that places power sources left, outputs right, and signal flow left-to-right. Students can then reposition nodes manually.

**ERC (Electrical Rules Check) — runs continuously:**

```typescript
interface ERCViolation {
  type: "floating-pin" | "short-circuit" | "no-ground" | "no-power" | "pin-overcurrent" | "missing-resistor"
  severity: "error" | "warning"
  componentIds: string[]
  message: string
}
```

ERC violations appear as colored badges on affected components and in a collapsible panel at the bottom of the schematic view. Errors (short circuits, no ground) prevent simulation from starting. Warnings (missing resistor for LED) allow simulation but show fault models in action.

### 6.4 Synchronization Flow

```
User action on breadboard             User action on schematic
        │                                       │
        ▼                                       ▼
BreadboardEngine.handleInteraction()    SchematicEngine.handleInteraction()
        │                                       │
        ▼                                       ▼
NetlistBuilder.updateFromBreadboard()   NetlistBuilder.updateFromSchematic()
        │                                       │
        └──────────────┬────────────────────────┘
                       ▼
              Netlist (single source of truth)
                       │
          ┌────────────┼─────────────────┐
          ▼            ▼                 ▼
  BreadboardRenderer  SchematicRenderer  MNASolver.recompile()
  .reconcile()        .reconcile()
  (Canvas redraw)     (React Flow update)
```

React's reconciliation handles the schematic view efficiently. The Canvas breadboard view uses a dirty-flag system — only redraws the segments that changed.

---

## 7. Mission System

### 7.1 Mission Config Schema

```typescript
interface Mission {
  id: string
  title: string
  subtitle: string                         // one-line description
  difficulty: 1 | 2 | 3 | 4 | 5
  ageRange: [number, number]               // inclusive, e.g. [10, 14]
  estimatedMinutes: number
  tags: string[]                           // ["LED", "digital-output", "resistor"]
  curriculumMapping: {
    courseId: string
    moduleId: string
    lessonId: string
  }

  layout: {
    circuit: boolean                       // show circuit editor?
    codeEditor: boolean                    // show code editor?
    physics: boolean                       // show robot physics canvas?
    serialMonitor: boolean                 // show serial output panel?
    defaultCodeMode: "blockly" | "monaco"  // which editor starts active
  }

  initial: {
    circuit: SerializedNetlist             // pre-placed locked + unlocked components
    code: string                           // starter code (may be empty)
    arena: ArenaId                         // which physics arena
    lockedComponentIds: string[]           // student cannot move/delete these
    lockedWireIds: string[]
  }

  palette: ComponentSpec[]                 // what components student can add

  completionCriteria: CompletionCriterion[]
  passCriteria: "all" | "any" | { minOf: number }

  hints: Hint[]

  narrative: {
    briefing: string                       // markdown, shown on mission start
    context: string                        // markdown, "why does this matter?"
    successMessage: string
    failureMessage?: string
  }

  aiMentorConfig: {
    assistanceLevel: "full" | "nudge" | "circuit-only" | "disabled"
    neverReveal: string[]                  // criterion IDs the AI must not solve directly
    customSystemPromptAdditions?: string   // teacher overrides
  }
}
```

### 7.2 Completion Criteria

```typescript
type CompletionCriterion =
  // Circuit criteria
  | { type: "net-connected"; from: PinRef; to: PinRef; label?: string }
  | { type: "component-present"; componentType: ComponentType; minCount?: number }
  | { type: "component-param"; componentId: string; param: string; min: number; max: number }
  | { type: "node-voltage"; nodeLabel: string; min: number; max: number; durationMs?: number }
  | { type: "node-current"; nodeLabel: string; min: number; max: number }
  | { type: "erc-pass" }                  // no ERC violations

  // Code execution criteria
  | { type: "pin-toggled"; pin: number; minFreqHz?: number; maxFreqHz?: number; durationMs?: number }
  | { type: "pwm-duty"; pin: number; min: number; max: number }
  | { type: "serial-output-contains"; substring: string; caseSensitive?: boolean }
  | { type: "serial-output-matches"; pattern: string }    // regex
  | { type: "analog-read-pin"; pin: number; minValue: number; maxValue: number }
  | { type: "function-called"; functionName: string }     // static analysis of code
  | { type: "code-contains"; pattern: string }            // regex on source

  // Physics criteria
  | { type: "robot-reached-goal"; goalId: string; within?: number }  // within = cm tolerance
  | { type: "robot-avoided-collisions"; maxCollisions: number }
  | { type: "robot-traveled-distance"; minCm: number }
  | { type: "robot-completed-path"; waypointIds: string[] }
```

The mission runtime evaluates all criteria every 100ms. Criteria that depend on duration (`durationMs`) must be true continuously for that long — a blinking LED criterion requires the pin to toggle at the right frequency for at least 2 seconds before it's considered passing.

### 7.3 Mission Sandbox Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ← Back   Mission: "Make an LED Blink"  ●●○○○  [?] Hint  00:03:42       │
├─────────────────────────┬─────────────────────────┬───────────────────────┤
│                         │                         │                       │
│  Circuit Editor         │  Code Editor            │  Goal Panel           │
│                         │                         │                       │
│  [Breadboard]           │  [Blockly] [C++]        │  Wire the circuit:    │
│  [Schematic]            │                         │  ✓ Resistor placed    │
│                         │  // Starter code        │  ✗ LED connected      │
│  [ERC ▼ 1 warning]      │  void setup() {         │  ✗ Code blinks pin13  │
│                         │    pinMode(13, OUTPUT); │                       │
│                         │  }                      │  [Robot Canvas]       │
│                         │  void loop() {          │  (if layout.physics)  │
│                         │    // TODO              │                       │
│                         │  }                      │  [Serial Monitor]     │
│                         │                         │  (if layout.serial)   │
│                         │  [▶ Run] [■ Stop]       │                       │
│                         │  [Flash to Arduino →]   │  [AI Mentor Chat ▲]  │
└─────────────────────────┴─────────────────────────┴───────────────────────┘
```

Layout is driven by the mission config. For circuit-only missions (no robot navigation), the right panel is entirely Goal + Serial Monitor. For robot missions, the right panel is entirely the physics canvas with goal overlay. The three-pane layout uses `react-resizable-panels` (already in `package.json`).

### 7.4 Hint System

Hints are layered in specificity and time-gated:

```typescript
interface Hint {
  id: string
  afterSeconds: number        // show hint trigger after this long without progress
  unmetCriterionId?: string   // only show if this specific criterion is still unmet
  tier: 1 | 2 | 3            // 1=vague, 2=specific, 3=near-solution
  content: string             // markdown, may include images/diagrams
  audioUrl?: string           // optional TTS for younger students
}
```

Hint presentation:
- Tier 1 after 90s of stagnation: Pulsing lightbulb icon in header. Click to reveal.
- Tier 2 after 3min: Automatic gentle popup (non-blocking). Dismissible.
- Tier 3 after 6min: Full hint panel slides in from right, showing step-by-step with circuit diagram snippet.

All hint usage is logged per-student in the `submissions` table for educator review.

### 7.5 Mission Progression

Missions are grouped in the existing curriculum schema:

```
Course: Arduino Fundamentals (ages 10–14)
├── Module 1: Digital Output
│   ├── Mission 1.1: Blink an LED (difficulty 1)
│   ├── Mission 1.2: Traffic Light (difficulty 2)
│   └── Mission 1.3: Morse Code Sender (difficulty 3)
├── Module 2: Digital Input
│   ├── Mission 2.1: Button-Controlled LED (difficulty 2)
│   ├── Mission 2.2: Debounced Button Counter (difficulty 3)
│   └── Mission 2.3: Toggle Lock (difficulty 3)
├── Module 3: Analog I/O
│   ├── Mission 3.1: LED Brightness with Potentiometer (difficulty 2)
│   ├── Mission 3.2: Light-Sensitive Night Light (difficulty 3)
│   └── Mission 3.3: Analog Gauge Display (difficulty 4)
├── Module 4: Motors & Motion
│   ├── Mission 4.1: Spin a DC Motor (difficulty 2)
│   ├── Mission 4.2: H-Bridge Direction Control (difficulty 3)
│   └── Mission 4.3: Speed Controller (difficulty 4)
├── Module 5: Sensors & Robotics
│   ├── Mission 5.1: Distance Alarm (HC-SR04) (difficulty 3)
│   ├── Mission 5.2: Obstacle Avoider Robot (difficulty 4)
│   └── Mission 5.3: Line Follower Robot (difficulty 5)
└── Module 6: Communication
    ├── Mission 6.1: Serial Hello World (difficulty 2)
    ├── Mission 6.2: Serial Remote Control (difficulty 3)
    └── Mission 6.3: Two-Arduino Communication (difficulty 4)

Course: Robotics Challenges (ages 12–16)
├── Freeform missions with minimal scaffolding
└── Educator-authored missions (teacher creates custom mission JSON)
```

### 7.6 Teacher-Authored Missions

Educators can create custom missions through a mission builder UI in `/educator`. The builder is a form-based interface that produces a valid `Mission` JSON:
- Select layout panels
- Upload or select a starting circuit from a template library
- Write or paste starter code
- Add completion criteria via dropdowns (no JSON editing required)
- Write hints in a rich text editor
- Preview the mission in a sandbox before publishing to their classroom

Published missions appear in the classroom's assignment list and link to `/missions/[id]` with classroom context for progress tracking.

---

## 8. AI Mentor

### 8.1 Architecture

The AI mentor is not a standalone page — it's an embedded panel within the mission sandbox. It has full context about the student's current state at all times.

**Context payload sent to `/api/mentor`:**

```typescript
interface MentorContext {
  missionId: string
  studentAgeRange: [number, number]          // from user profile
  unmetCriteria: CompletionCriterion[]       // what's still failing
  metCriteria: CompletionCriterion[]         // what already passed
  currentNetlist: SerializedNetlist          // exact circuit state
  currentCode: string                        // exact code in editor
  simulationState: {
    nodeVoltages: Record<string, number>     // from MNA solver
    pinStates: Record<number, number>        // from AVR
    serialOutput: string[]                   // last 50 lines
    activeFaults: ComponentFault[]           // current fault list
  }
  hintsAlreadyShown: string[]               // don't repeat hints
  conversationHistory: Message[]            // last 10 turns for context
  assistanceLevel: MissionAIConfig["assistanceLevel"]
}
```

**API routes (two separate routes, both coexist):**
- `POST /api/mentor` — in-mission contextual tutoring. Accepts full `MentorContext` payload, streams nudge-only responses. Never gives direct solutions to restricted criteria.
- `POST /api/generate` — **retained** for the standalone `/generator` page. General-purpose code generation from a prompt, no mission context. Upgraded from GPT-4o-mini to Claude claude-sonnet-4-6 but without nudge constraints.

**Model for both:** Claude claude-sonnet-4-6. Reasons:
- Better technical reasoning about circuit behavior than GPT-4o-mini
- More reliable age-appropriate explanation calibration
- Native support for tool use (JSON tool calls for highlighting specific netlist nodes in the circuit editor)

### 8.2 System Prompt Design

```
You are Xylo, a patient robotics tutor helping a [age]-year-old student.

RULES:
1. NEVER give the complete solution to any criterion listed in RESTRICTED_CRITERIA.
2. Always give the smallest nudge that moves the student forward.
3. Match vocabulary to age: simple analogies for under-12, technical terms for 12+.
4. When referring to a circuit component, use its COMPONENT_ID so the UI can highlight it.
5. When you identify a bug, describe what the symptom is before what the cause is.
6. Limit responses to 3 sentences unless the student asks for more detail.

STUDENT CONTEXT:
- Currently failing: [list of unmet criteria with plain-English descriptions]
- Circuit faults: [list of active faults]
- Serial output: [last 10 lines]
- Node voltages: [key nodes with values]

RESTRICTED_CRITERIA (never solve directly): [list from mission.aiMentorConfig.neverReveal]
```

### 8.3 Interaction Modes

**Passive analysis (no student input required):**
- Runs after each simulation tick where faults exist
- If `activeFaults` contains a fault that matches a common pattern, the mentor panel shows a single-sentence observation: *"I notice your LED has no current-limiting resistor — it's drawing 87mA, which could damage it."*
- Uses a cooldown (30s) to avoid spamming observations

**Pin/code mismatch detection:**
- Compares `currentNetlist` component positions with `currentCode` pin references
- If potentiometer is on A0 in circuit but code reads `A1`, suggests the mismatch unprompted

**Student-initiated chat:**
- Full conversation interface in the AI mentor panel
- History persists within the mission session (not across sessions)
- Tool calls allow the mentor to highlight specific nodes in the circuit editor: `{ "highlight_nodes": ["net-003", "net-007"] }`

**Inline code suggestions:**
- Monaco `inlineCompletionsProvider` integration
- Suggestions are scoped to components present in the netlist (won't suggest `Servo` if no servo in circuit)
- Ghost text appears; Tab accepts; Escape dismisses
- Disabled for beginner missions in Blockly mode

### 8.4 Assistance Levels

| Level | Chat | Passive Analysis | Code Suggestions | Direct Solutions |
|---|---|---|---|---|
| `full` | ✓ | ✓ | ✓ | ✓ (on explicit ask) |
| `nudge` | ✓ | ✓ | ✓ | ✗ |
| `circuit-only` | ✓ | ✓ | ✗ | ✗ |
| `disabled` | ✗ | ✗ | ✗ | ✗ |

Teachers set the level per assignment in the educator dashboard. Default is `nudge` for missions, `full` for freeplay `/circuit`.

---

## 9. Flasher Upgrade

### 9.1 Compilation (avr-gcc WASM)

The same avr-gcc WASM instance used by the simulator compiles the student's code on demand. The `.hex` output is stored in memory as a `Uint8Array`.

**Board profiles:**

```typescript
const BOARD_PROFILES = {
  "arduino-uno": {
    mcu: "atmega328p",
    fcpu: 16000000,
    maxFlash: 32256,       // bytes (512 reserved for bootloader)
    maxSRAM: 2048,
    bootloaderProtocol: "stk500v1",
    bootloaderBaud: 115200,
    resetBeforeFlash: true,
  },
  "arduino-nano": {
    mcu: "atmega328p",
    fcpu: 16000000,
    maxFlash: 30720,
    maxSRAM: 2048,
    bootloaderProtocol: "stk500v1",
    bootloaderBaud: 57600,  // older Nano bootloaders
    resetBeforeFlash: true,
  },
  "arduino-mega": {
    mcu: "atmega2560",
    fcpu: 16000000,
    maxFlash: 253952,
    maxSRAM: 8192,
    bootloaderProtocol: "stk500v2",
    bootloaderBaud: 115200,
    resetBeforeFlash: true,
  },
}
```

After compilation, the flasher shows:
- Flash usage (e.g., "3,824 bytes / 32,256 bytes — 11% used")
- SRAM usage
- Compilation warnings (unused variables, deprecated functions) as non-blocking notices

### 9.2 Upload (avrdude WASM + Web Serial)

`avrdude` compiled to WASM handles the STK500v1/v2 bootloader protocol directly over the Web Serial connection.

**Flash sequence:**

```
1. User clicks "Flash to Arduino"
2. If not already connected: Web Serial requestPort() → user selects COM port
3. Assert DTR/RTS to trigger hardware reset → ATmega enters bootloader
4. avrdude WASM: send STK500 SYNC command, wait for bootloader response
5. Board auto-detected from bootloader signature bytes
   → If mismatch with selected board: warn user, allow override
6. Diff view shown: summarizes what the code does + circuit sanity check
7. User confirms → avrdude pages flash memory with .hex data
8. Progress bar: page-by-page write progress (typically 3–8 seconds for Uno)
9. Verify pass: avrdude reads flash back and confirms it matches .hex
10. Reset: AVR exits bootloader, starts running student's code
11. Serial monitor auto-connects at code's Serial.begin() baud rate
```

**Circuit sanity check (pre-flash diff view):**

Before flashing, the platform cross-references the compiled code with the current circuit netlist:
- Pin numbers referenced in code vs. components in the circuit
- `pinMode(13, OUTPUT)` + LED on pin 13 → ✓ "Pin 13 is set as output — your LED is connected here"
- `analogRead(A0)` but nothing on A0 in circuit → ⚠ "Your code reads A0 but nothing is connected there in your circuit"
- `delay(1000)` in loop + motor on pin 9 → ℹ "Motor will alternate every 1 second"

This check is educational, not a blocker. Students can dismiss and flash anyway.

### 9.3 Raspberry Pi (Future Phase)

The flasher architecture is designed to accept additional `BoardProfile` entries. Raspberry Pi support (using the `rpi-imager` Web API or a local agent) is a documented extension point but not in scope for v1.

---

## 10. Database Schema Changes

### 10.1 New Tables

```sql
-- Mission definitions (can be seeded or teacher-authored)
CREATE TABLE missions (
  id TEXT PRIMARY KEY,           -- e.g. "blink-led", "obstacle-avoider"
  lesson_id UUID REFERENCES lessons(id),
  title TEXT NOT NULL,
  subtitle TEXT,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  age_range_min INTEGER DEFAULT 8,
  age_range_max INTEGER DEFAULT 16,
  estimated_minutes INTEGER,
  tags TEXT[] DEFAULT '{}',
  config JSONB NOT NULL,         -- full Mission JSON
  is_published BOOLEAN DEFAULT false,
  author_id TEXT,                -- Clerk user ID (null = system mission)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student mission attempts (replaces the generic lesson progress for missions)
CREATE TABLE mission_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id TEXT REFERENCES missions(id),
  student_id TEXT NOT NULL,      -- Clerk user ID
  classroom_id UUID REFERENCES classrooms(id),
  assignment_id UUID REFERENCES assignments(id),
  status TEXT CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_seconds INTEGER,
  hints_used INTEGER DEFAULT 0,
  hint_ids_used TEXT[] DEFAULT '{}',
  criteria_met TEXT[] DEFAULT '{}',    -- criterion IDs that passed
  final_circuit JSONB,                 -- serialized netlist at completion
  final_code TEXT,                     -- final .ino code at completion
  final_hex TEXT,                      -- compiled .hex if they flashed
  flashed_to_hardware BOOLEAN DEFAULT false,
  score INTEGER,                       -- 0–100, computed from time + hints
  ai_interactions INTEGER DEFAULT 0   -- count of mentor chat messages
);

-- Circuit saves (freeplay /circuit saves + mission checkpoint saves)
CREATE TABLE saved_circuits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  netlist JSONB NOT NULL,
  code TEXT,
  board TEXT DEFAULT 'arduino-uno',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teacher-authored mission templates
CREATE TABLE mission_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id TEXT NOT NULL,
  classroom_id UUID REFERENCES classrooms(id),
  title TEXT NOT NULL,
  config JSONB NOT NULL,
  is_shared BOOLEAN DEFAULT false,   -- share with all educators?
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 10.2 Existing Table Changes

```sql
-- Add "mission" block type to lesson_content
-- (no schema change needed — type is stored in content_json JSONB)
-- New content_json shape:
-- { "type": "mission", "missionId": "blink-led", "order": 3 }

-- Add mission_id FK to existing assignments table
ALTER TABLE assignments
  ADD COLUMN mission_id TEXT REFERENCES missions(id),
  ADD COLUMN ai_assistance_level TEXT
    CHECK (ai_assistance_level IN ('full', 'nudge', 'circuit-only', 'disabled'))
    DEFAULT 'nudge';
```

### 10.3 Scoring Formula

```
score = 100
  - (hints_used * 10)          -- -10 per hint used (min 0)
  - max(0, (time_seconds - estimated_seconds) / estimated_seconds * 20)  -- -20 if 2× over time
  + (flashed_to_hardware ? 10 : 0)  -- +10 bonus for flashing to real hardware
clamped to [0, 110]
```

---

## 11. New File Structure

```
lib/
├── circuit/                          (all new)
│   ├── solver/
│   │   ├── mna-solver.ts
│   │   ├── newton-raphson.ts
│   │   ├── timestep.ts
│   │   └── matrix.ts
│   ├── components/
│   │   ├── base-component.ts
│   │   ├── resistor.ts
│   │   ├── led.ts
│   │   ├── capacitor.ts
│   │   ├── voltage-source.ts
│   │   ├── current-source.ts
│   │   ├── diode.ts
│   │   ├── transistor-npn.ts
│   │   ├── transistor-pnp.ts
│   │   ├── motor-dc.ts
│   │   ├── servo.ts
│   │   ├── buzzer.ts
│   │   └── sensors/
│   │       ├── hcsr04.ts
│   │       ├── ir-sensor.ts
│   │       ├── ldr.ts
│   │       ├── thermistor.ts
│   │       ├── potentiometer.ts
│   │       └── push-button.ts
│   ├── netlist/
│   │   ├── netlist.ts
│   │   ├── netlist-validator.ts
│   │   ├── breadboard-to-netlist.ts
│   │   └── schematic-to-netlist.ts
│   └── gpio-bridge.ts
├── avr/                              (all new)
│   ├── compiler.ts                   — avr-gcc WASM wrapper
│   ├── board-profiles.ts             — Uno, Nano, Mega configs
│   └── flasher.ts                    — avrdude WASM + Web Serial upload
├── missions/                         (all new)
│   ├── types.ts                      — Mission, CompletionCriterion, Hint interfaces
│   ├── runtime.ts                    — MissionRuntime class: evaluates criteria, manages hints
│   ├── seed/                         — JSON files for all system missions
│   │   ├── 01-blink-led.json
│   │   ├── 02-traffic-light.json
│   │   └── ...
│   └── scoring.ts                    — Score computation
├── simulator/                        (mostly replaced)
│   ├── physics.ts                    — KEPT (Matter.js world setup)
│   ├── robot.ts                      — KEPT + extended (servo arm, physics-to-sensor bridge)
│   ├── arena.ts                      — KEPT + extended
│   ├── components.ts                 — KEPT (robot body components)
│   ├── arduino-transpiler.ts         — DELETED (replaced by avr8js)
│   └── executor.ts                   — DELETED (replaced by avr8js)
└── mentor/                           (new — for /api/mentor in-mission tutor; /api/generate is retained separately for /generator page)
    ├── context-builder.ts            — Assembles MentorContext from all simulation state
    └── prompt-builder.ts             — System prompt construction with mission constraints

workers/
├── avr-worker.ts                     — Web Worker: avr8js CPU loop + avr-gcc compilation
└── circuit-worker.ts                 — Web Worker: MNA solver main loop

components/
├── mission/                          (all new)
│   ├── mission-sandbox.tsx           — Three-pane layout coordinator
│   ├── mission-goal-panel.tsx        — Criteria checklist + progress
│   ├── mission-briefing.tsx          — Markdown briefing + narrative
│   └── mission-hint.tsx             — Hint trigger + layered hint display
├── circuit-editor/                   (all new)
│   ├── circuit-editor.tsx            — Breadboard/schematic tab container
│   ├── breadboard/
│   │   ├── breadboard-canvas.tsx     — HTML5 Canvas component
│   │   ├── breadboard-engine.ts      — Interaction logic (place, wire, select)
│   │   └── component-renderer.ts    — Draws each component type on canvas
│   └── schematic/
│       ├── schematic-view.tsx        — React Flow wrapper
│       ├── schematic-nodes.tsx       — Custom node types (IEEE symbols)
│       └── auto-layout.ts           — Sugiyama hierarchical layout
├── code-editor/                      (upgrades /playground)
│   ├── monaco-arduino.tsx            — Monaco + Arduino language config + AI suggestions
│   ├── blockly-arduino.tsx           — Blockly editor (existing, moved)
│   └── editor-toolbar.tsx           — Run/Stop/Flash buttons + mode toggle
├── ai-mentor/                        (replaces /generator)
│   ├── mentor-panel.tsx             — Chat UI + passive analysis display
│   ├── mentor-suggestions.tsx       — Inline Monaco ghost text provider
│   └── node-highlighter.tsx         — Highlights netlist nodes from mentor tool calls
└── flasher/                          (upgrades existing)
    ├── flasher-interface.tsx         — UPGRADED: avrdude upload + diff view
    └── upload-progress.tsx          — Page-by-page flash progress bar

app/
├── missions/
│   └── [missionId]/
│       ├── page.tsx
│       └── layout.tsx
├── circuit/
│   ├── page.tsx                      — Freeplay circuit editor
│   └── layout.tsx
└── api/
    ├── mentor/
    │   └── route.ts                  — Replaces /api/generate (Claude claude-sonnet-4-6 streaming)
    ├── missions/
    │   ├── route.ts                  — List/create missions
    │   └── [id]/
    │       ├── route.ts              — Get mission config
    │       └── attempt/
    │           └── route.ts         — Save attempt progress + completion
    └── circuits/
        └── route.ts                  — Save/load circuit netlists
```

---

## 12. Key Open Questions (for implementation)

1. **avr-gcc WASM binary size:** The full avr-gcc toolchain is ~50–80MB. We need to evaluate whether to self-host or use a build service (e.g., a Vercel serverless function that compiles and returns the .hex). If compilation latency over the network is <3s, server-side compilation is simpler than shipping 80MB WASM.

2. **MNA sparse matrix library:** Evaluate whether to use a JS linear algebra library (math.js, numeric.js) for LU decomposition or implement a purpose-built sparse solver. math.js is ~500KB gzipped and covers what we need.

3. **Breadboard canvas performance:** For complex circuits (>30 components, >50 wires), Canvas 2D may need to be supplemented with WebGL for the wire routing visualization. Benchmark at 30 and 50 components before committing.

4. **avrdude WASM availability:** The best maintained avrdude WASM port is from the Arduino Web Editor team (not officially published as npm package). May need to build from source or use the Arduino Create Agent as a local proxy for upload. Evaluate both paths.

5. **Mission JSON authoring tool:** Teacher-authored missions need a visual builder. This is a significant UI effort — consider making v1 a JSON editor with schema validation and live preview, and shipping the visual form builder in v2.

6. **I2C device emulation depth:** LCD1602 (extremely common in K-12) must work for v1. MPU6050 and SSD1306 OLED are v2. The I2C protocol frame format is well-documented but the register maps of each device need individual implementation.

---

## 13. Build Sequence (for implementation planning)

The implementation should be phased so that each phase ships something teachable:

**Phase 1 — AVR Core (most important, enables everything else)**
- avr-gcc WASM compilation pipeline
- avr8js integration in Web Worker
- Basic GPIO bridge (digital only)
- Serial monitor
- Replace existing transpiler/executor

**Phase 2 — MNA Circuit Solver**
- Core solver (resistor, LED, voltage source, ground)
- Breadboard view (canvas, snapping, wiring)
- GPIO bridge extended (PWM, ADC)
- Fault models for LED + resistor

**Phase 3 — Mission System**
- Mission runtime (criteria evaluation, hint system)
- Mission sandbox layout (three-pane)
- First 6 system missions (Module 1 + 2 of Arduino Fundamentals)
- Mission progress persistence in Supabase

**Phase 4 — Schematic + Full Component Library**
- Schematic view (React Flow, auto-layout, ERC)
- Sync with breadboard
- Remaining component models (motor, servo, sensors)
- Physics-to-sensor bridge

**Phase 5 — AI Mentor + Flasher Upgrade**
- `/api/mentor` route (Claude claude-sonnet-4-6)
- Mentor panel UI + passive analysis
- Monaco inline suggestions
- avrdude WASM + one-click flash
- Pre-flash diff view

**Phase 6 — Teacher Tools + Remaining Missions**
- Mission builder for educators
- All 18 system missions
- Classroom mission assignment + progress tracking
- Educator dashboard mission analytics
