# Xylo Platform — Phase 1: AVR Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing toy transpiler/executor with real ATmega328P emulation via avr8js, enabling true Arduino C++ to execute inside the browser simulator with real pin behavior, `millis()`, PWM, and Serial output.

**Architecture:** Arduino C++ is compiled server-side via `arduino-cli` (Next.js API route at `/api/compile`), producing an Intel HEX file. The hex is loaded into `@wokwi/avr8js` running in a dedicated Web Worker (`workers/avr-worker.ts`). A GPIO bridge on the main thread routes pin-change events from the AVR worker into the existing Matter.js physics world. Serial output from `Serial.print()` appears in a new Serial Monitor panel. The old `arduino-transpiler.ts` and `executor.ts` are deleted once the new engine is wired in.

**Tech Stack:** `@wokwi/avr8js`, `arduino-cli` (server binary), `@monaco-editor/react`, Web Workers, Next.js API routes, `vitest`

**Design spec:** `docs/superpowers/specs/2026-06-19-xylo-robotics-platform-design.md` §4

**Prerequisites:**
- Install `arduino-cli`: `brew install arduino-cli` (macOS) or download from https://arduino.github.io/arduino-cli/
- After install, run: `arduino-cli core install arduino:avr`
- Verify: `arduino-cli version` and `arduino-cli board listall | grep Uno`

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `lib/avr/types.ts` | All shared TypeScript interfaces for AVR worker protocol, board profiles, compile results |
| `lib/avr/board-profiles.ts` | ATmega328P board definitions (Uno, Nano, Mega) with pin mappings |
| `lib/avr/compiler.ts` | Client-side fetch wrapper for `/api/compile` |
| `lib/avr/gpio-bridge.ts` | Main thread: routes AVR `pinChange` events → Matter.js robot forces |
| `workers/avr-worker.ts` | Web Worker: avr8js CPU loop, pin listeners, UART listener |
| `app/api/compile/route.ts` | Server: shells out to `arduino-cli`, returns hex + diagnostics |
| `components/simulator/serial-monitor.tsx` | Serial output log + input send field |
| `components/simulator/avr-code-panel.tsx` | Monaco editor + Compile/Run/Stop/Speed controls |
| `lib/avr/__tests__/board-profiles.test.ts` | Unit tests for pin mapping helpers |
| `lib/avr/__tests__/gpio-bridge.test.ts` | Unit tests for bridge message routing |

### Modified Files
| File | Change |
|---|---|
| `package.json` | Add `@wokwi/avr8js`, `@monaco-editor/react` |
| `next.config.mjs` | Add `webpack` config to handle `.wasm` and Web Worker files |
| `components/simulator/simulator-view.tsx` | Replace `RobotExecutor` + `transpileArduino` with AVR engine + GPIO bridge |
| `components/simulator/code-execution-panel.tsx` | Replace with `avr-code-panel.tsx` (keep filename, rewrite component) |

### Deleted Files (Task 10 — after integration confirmed working)
| File | Reason |
|---|---|
| `lib/simulator/arduino-transpiler.ts` | Replaced by avr8js |
| `lib/simulator/executor.ts` | Replaced by avr8js |

---

## Task 1: Install Dependencies and Configure Webpack

**Files:**
- Modify: `package.json`
- Modify: `next.config.mjs`

- [ ] **Step 1: Install npm packages**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform"
pnpm add @wokwi/avr8js @monaco-editor/react
```

Expected output: packages added to `node_modules`, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Read current next.config.mjs**

```bash
cat "/Users/karangupta/Projects/Xylo Robotics Platform/next.config.mjs"
```

- [ ] **Step 3: Update next.config.mjs to support Web Workers and WASM**

Replace the contents of `next.config.mjs` with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.output.globalObject = 'self'
    }

    // Handle Web Workers
    config.module.rules.push({
      test: /\.worker\.(ts|js)$/,
      use: { loader: 'worker-loader', options: { filename: 'static/[hash].worker.js' } },
    })

    return config
  },
}

export default nextConfig
```

- [ ] **Step 4: Verify the dev server still starts**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform"
pnpm dev &
sleep 8
curl -s http://localhost:3000 | grep -o '<title>[^<]*</title>'
kill %1
```

Expected: `<title>` tag from the Xylo homepage.

- [ ] **Step 5: Commit**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform"
git add package.json pnpm-lock.yaml next.config.mjs
git commit -m "feat(avr): install avr8js + monaco-editor, configure webpack for workers"
```

---

## Task 2: Define Shared Types

**Files:**
- Create: `lib/avr/types.ts`

These types are the contract between the main thread, the AVR worker, and the compile API. Define them once here — every subsequent task imports from this file.

- [ ] **Step 1: Create `lib/avr/types.ts`**

```typescript
// lib/avr/types.ts

export type BoardId = "arduino-uno" | "arduino-nano" | "arduino-mega"

export interface BoardProfile {
  id: BoardId
  displayName: string
  mcu: string           // avr-gcc -mmcu value
  fcpu: number          // Hz, e.g. 16000000
  maxFlashBytes: number // bytes available for sketch
  maxSRAMBytes: number
  fqbn: string          // arduino-cli fully qualified board name
}

// Arduino digital pin → AVR port + bit
export interface PinMapping {
  digitalPin: number
  port: "B" | "C" | "D"
  bit: number           // 0-7
  isPWMCapable: boolean
  analogChannel?: number // A0=0, A1=1, ... A5=5 (PORTC only)
}

// ── Messages: main thread → avr-worker ──────────────────────────────────────

export type AVRCommand =
  | { type: "load"; hex: string; board: BoardId }
  | { type: "run" }
  | { type: "stop" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "setSpeed"; multiplier: number }   // 1 = real-time 16MHz, 100 = 100× faster
  | { type: "setDigitalInput"; pin: number; high: boolean }
  | { type: "setADCInput"; pin: number; value: number }   // 0–1023
  | { type: "sendSerial"; data: string }       // bytes to inject into UART RX

// ── Events: avr-worker → main thread ────────────────────────────────────────

export type AVREvent =
  | { type: "ready" }
  | { type: "running" }
  | { type: "paused" }
  | { type: "stopped" }
  | { type: "pinChange"; pin: number; high: boolean; isPWM: boolean; dutyCycle: number }
  | { type: "serialOutput"; text: string }
  | { type: "halted"; reason: "error"; message: string }

// ── Compile API ──────────────────────────────────────────────────────────────

export interface CompileRequest {
  code: string
  board: BoardId
}

export type CompileResult =
  | {
      success: true
      hex: string          // Intel HEX string
      flashBytes: number
      sramBytes: number
      warnings: CompileDiagnostic[]
    }
  | {
      success: false
      errors: CompileDiagnostic[]
    }

export interface CompileDiagnostic {
  line: number | null
  column: number | null
  message: string
  severity: "error" | "warning"
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform"
pnpm tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

Expected: no errors from `lib/avr/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/avr/types.ts
git commit -m "feat(avr): define AVR worker protocol types and board profile interfaces"
```

---

## Task 3: Board Profiles and Pin Mapping

**Files:**
- Create: `lib/avr/board-profiles.ts`
- Create: `lib/avr/__tests__/board-profiles.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// lib/avr/__tests__/board-profiles.test.ts
import { describe, it, expect } from "vitest"
import { BOARD_PROFILES, getPinMapping, getAnalogPinNumber } from "../board-profiles"

describe("BOARD_PROFILES", () => {
  it("defines arduino-uno with correct mcu and fqbn", () => {
    const uno = BOARD_PROFILES["arduino-uno"]
    expect(uno.mcu).toBe("atmega328p")
    expect(uno.fqbn).toBe("arduino:avr:uno")
    expect(uno.fcpu).toBe(16_000_000)
    expect(uno.maxFlashBytes).toBe(32_256)
    expect(uno.maxSRAMBytes).toBe(2_048)
  })

  it("defines arduino-nano with lower max flash than uno", () => {
    const nano = BOARD_PROFILES["arduino-nano"]
    expect(nano.maxFlashBytes).toBe(30_720)
  })
})

describe("getPinMapping", () => {
  it("maps digital pin 13 to PORTB bit 5", () => {
    const mapping = getPinMapping("arduino-uno", 13)
    expect(mapping).not.toBeNull()
    expect(mapping!.port).toBe("B")
    expect(mapping!.bit).toBe(5)
    expect(mapping!.isPWMCapable).toBe(false)
  })

  it("maps digital pin 9 to PORTB bit 1 (PWM capable)", () => {
    const mapping = getPinMapping("arduino-uno", 9)
    expect(mapping!.port).toBe("B")
    expect(mapping!.bit).toBe(1)
    expect(mapping!.isPWMCapable).toBe(true)
  })

  it("maps digital pin 3 to PORTD bit 3 (PWM capable)", () => {
    const mapping = getPinMapping("arduino-uno", 3)
    expect(mapping!.port).toBe("D")
    expect(mapping!.bit).toBe(3)
    expect(mapping!.isPWMCapable).toBe(true)
  })

  it("maps A0 (pin 14 logical) to PORTC bit 0", () => {
    const mapping = getPinMapping("arduino-uno", 14)
    expect(mapping!.port).toBe("C")
    expect(mapping!.bit).toBe(0)
    expect(mapping!.analogChannel).toBe(0)
  })

  it("returns null for unmapped pin", () => {
    expect(getPinMapping("arduino-uno", 99)).toBeNull()
  })
})

describe("getAnalogPinNumber", () => {
  it("converts A0 string to analog channel 0", () => {
    expect(getAnalogPinNumber("A0")).toBe(0)
  })

  it("converts A5 string to analog channel 5", () => {
    expect(getAnalogPinNumber("A5")).toBe(5)
  })

  it("returns null for non-analog strings", () => {
    expect(getAnalogPinNumber("D13")).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform"
pnpm vitest run lib/avr/__tests__/board-profiles.test.ts 2>&1 | tail -10
```

Expected: `FAIL` — `Cannot find module '../board-profiles'`

- [ ] **Step 3: Implement `lib/avr/board-profiles.ts`**

```typescript
// lib/avr/board-profiles.ts
import type { BoardId, BoardProfile, PinMapping } from "./types"

export const BOARD_PROFILES: Record<BoardId, BoardProfile> = {
  "arduino-uno": {
    id: "arduino-uno",
    displayName: "Arduino Uno",
    mcu: "atmega328p",
    fcpu: 16_000_000,
    maxFlashBytes: 32_256,
    maxSRAMBytes: 2_048,
    fqbn: "arduino:avr:uno",
  },
  "arduino-nano": {
    id: "arduino-nano",
    displayName: "Arduino Nano",
    mcu: "atmega328p",
    fcpu: 16_000_000,
    maxFlashBytes: 30_720,
    maxSRAMBytes: 2_048,
    fqbn: "arduino:avr:nano:cpu=atmega328",
  },
  "arduino-mega": {
    id: "arduino-mega",
    displayName: "Arduino Mega 2560",
    mcu: "atmega2560",
    fcpu: 16_000_000,
    maxFlashBytes: 253_952,
    maxSRAMBytes: 8_192,
    fqbn: "arduino:avr:mega:cpu=atmega2560",
  },
}

// ATmega328P pin mapping: digital pin number → port/bit
// Pins 0-7 → PORTD bits 0-7
// Pins 8-13 → PORTB bits 0-5
// Pins 14-19 (A0-A5) → PORTC bits 0-5
const UNO_PIN_MAP: PinMapping[] = [
  { digitalPin: 0,  port: "D", bit: 0, isPWMCapable: false },
  { digitalPin: 1,  port: "D", bit: 1, isPWMCapable: false },
  { digitalPin: 2,  port: "D", bit: 2, isPWMCapable: false },
  { digitalPin: 3,  port: "D", bit: 3, isPWMCapable: true  },
  { digitalPin: 4,  port: "D", bit: 4, isPWMCapable: false },
  { digitalPin: 5,  port: "D", bit: 5, isPWMCapable: true  },
  { digitalPin: 6,  port: "D", bit: 6, isPWMCapable: true  },
  { digitalPin: 7,  port: "D", bit: 7, isPWMCapable: false },
  { digitalPin: 8,  port: "B", bit: 0, isPWMCapable: false },
  { digitalPin: 9,  port: "B", bit: 1, isPWMCapable: true  },
  { digitalPin: 10, port: "B", bit: 2, isPWMCapable: true  },
  { digitalPin: 11, port: "B", bit: 3, isPWMCapable: true  },
  { digitalPin: 12, port: "B", bit: 4, isPWMCapable: false },
  { digitalPin: 13, port: "B", bit: 5, isPWMCapable: false },
  // A0-A5 are also accessible as digital 14-19
  { digitalPin: 14, port: "C", bit: 0, isPWMCapable: false, analogChannel: 0 },
  { digitalPin: 15, port: "C", bit: 1, isPWMCapable: false, analogChannel: 1 },
  { digitalPin: 16, port: "C", bit: 2, isPWMCapable: false, analogChannel: 2 },
  { digitalPin: 17, port: "C", bit: 3, isPWMCapable: false, analogChannel: 3 },
  { digitalPin: 18, port: "C", bit: 4, isPWMCapable: false, analogChannel: 4 },
  { digitalPin: 19, port: "C", bit: 5, isPWMCapable: false, analogChannel: 5 },
]

// Nano and Mega use the same ATmega328P mapping for pins 0-19
const BOARD_PIN_MAPS: Record<BoardId, PinMapping[]> = {
  "arduino-uno": UNO_PIN_MAP,
  "arduino-nano": UNO_PIN_MAP,
  "arduino-mega": UNO_PIN_MAP, // Phase 1 scope: treat Mega as Uno pin-compatible
}

export function getPinMapping(board: BoardId, digitalPin: number): PinMapping | null {
  const map = BOARD_PIN_MAPS[board]
  return map.find((m) => m.digitalPin === digitalPin) ?? null
}

export function getAnalogPinNumber(pinLabel: string): number | null {
  const match = pinLabel.match(/^A(\d)$/)
  if (!match) return null
  return parseInt(match[1], 10)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run lib/avr/__tests__/board-profiles.test.ts 2>&1 | tail -10
```

Expected: `PASS` — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/avr/board-profiles.ts lib/avr/__tests__/board-profiles.test.ts
git commit -m "feat(avr): add board profiles and ATmega328P pin mapping with tests"
```

---

## Task 4: Server-Side Compilation API Route

**Files:**
- Create: `app/api/compile/route.ts`

This route shells out to `arduino-cli` to compile a `.ino` sketch and returns the Intel HEX string plus memory usage stats. It writes a temp directory, compiles, reads the output `.hex`, and cleans up.

- [ ] **Step 1: Verify arduino-cli is installed on your system**

```bash
arduino-cli version
arduino-cli board listall | grep "Arduino Uno"
```

Expected:
```
arduino-cli  Version: 1.x.x ...
arduino:avr:uno    Arduino Uno
```

If not installed: `brew install arduino-cli && arduino-cli core install arduino:avr`

- [ ] **Step 2: Create `app/api/compile/route.ts`**

```typescript
// app/api/compile/route.ts
import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { promisify } from "util"
import type { CompileRequest, CompileResult, CompileDiagnostic } from "@/lib/avr/types"
import { BOARD_PROFILES } from "@/lib/avr/board-profiles"

const execAsync = promisify(exec)

export async function POST(req: NextRequest): Promise<NextResponse<CompileResult>> {
  const body = (await req.json()) as CompileRequest
  const { code, board } = body

  if (!code || !board) {
    return NextResponse.json(
      { success: false, errors: [{ line: null, column: null, message: "Missing code or board", severity: "error" }] },
      { status: 400 }
    )
  }

  const profile = BOARD_PROFILES[board]
  if (!profile) {
    return NextResponse.json(
      { success: false, errors: [{ line: null, column: null, message: `Unknown board: ${board}`, severity: "error" }] },
      { status: 400 }
    )
  }

  // Create temp sketch directory — arduino-cli requires the .ino filename to match the folder name
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "xylo-compile-"))
  const sketchDir = path.join(tmpDir, "sketch")
  await fs.mkdir(sketchDir)
  const sketchFile = path.join(sketchDir, "sketch.ino")
  await fs.writeFile(sketchFile, code, "utf-8")

  try {
    const buildDir = path.join(tmpDir, "build")
    await fs.mkdir(buildDir)

    const cmd = [
      "arduino-cli", "compile",
      "--fqbn", profile.fqbn,
      "--output-dir", buildDir,
      "--format", "json",
      sketchDir,
    ].join(" ")

    let stdout = ""
    let stderr = ""
    try {
      const result = await execAsync(cmd, { timeout: 30_000 })
      stdout = result.stdout
      stderr = result.stderr
    } catch (err: unknown) {
      // arduino-cli exits non-zero on compile errors; stderr has the JSON
      if (err && typeof err === "object" && "stdout" in err) {
        stdout = (err as { stdout: string }).stdout ?? ""
        stderr = (err as { stderr: string }).stderr ?? ""
      } else {
        throw err
      }
    }

    const combined = stdout + stderr
    const parsed = tryParseArduinoJSON(combined)

    if (parsed && !parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.errors })
    }

    // Read the generated .hex file
    const hexFile = path.join(buildDir, "sketch.ino.hex")
    let hex: string
    try {
      hex = await fs.readFile(hexFile, "utf-8")
    } catch {
      return NextResponse.json({
        success: false,
        errors: [{ line: null, column: null, message: "Compilation produced no .hex file — check arduino-cli setup", severity: "error" }],
      })
    }

    // Parse memory usage from arduino-cli JSON output
    const flashBytes = parsed?.flashBytes ?? 0
    const sramBytes = parsed?.sramBytes ?? 0
    const warnings = parsed?.warnings ?? []

    return NextResponse.json({ success: true, hex, flashBytes, sramBytes, warnings })
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

interface ParsedArduinoOutput {
  success: boolean
  errors: CompileDiagnostic[]
  warnings: CompileDiagnostic[]
  flashBytes: number
  sramBytes: number
}

function tryParseArduinoJSON(output: string): ParsedArduinoOutput | null {
  try {
    // arduino-cli --format json emits one JSON object per line (NDJSON)
    const lines = output.split("\n").filter((l) => l.trim().startsWith("{"))
    const diagnostics: CompileDiagnostic[] = []
    let flashBytes = 0
    let sramBytes = 0
    let hasErrors = false

    for (const line of lines) {
      const obj = JSON.parse(line)

      if (obj.compiler_err) {
        // Parse "file.ino:10:5: error: message" format
        const errLines = String(obj.compiler_err).split("\n")
        for (const errLine of errLines) {
          const match = errLine.match(/sketch\.ino:(\d+):(\d+):\s+(error|warning):\s+(.+)/)
          if (match) {
            const severity = match[3] as "error" | "warning"
            if (severity === "error") hasErrors = true
            diagnostics.push({
              line: parseInt(match[1], 10),
              column: parseInt(match[2], 10),
              message: match[4].trim(),
              severity,
            })
          }
        }
      }

      if (obj.builder_result?.executable_sections_size) {
        const sections = obj.builder_result.executable_sections_size
        flashBytes = sections.find((s: {name: string; size: number}) => s.name === ".text")?.size ?? 0
        sramBytes = sections.find((s: {name: string; size: number}) => s.name === ".data")?.size ?? 0
      }
    }

    return {
      success: !hasErrors,
      errors: diagnostics.filter((d) => d.severity === "error"),
      warnings: diagnostics.filter((d) => d.severity === "warning"),
      flashBytes,
      sramBytes,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Manually test the compile route**

Start the dev server, then in a second terminal:

```bash
curl -s -X POST http://localhost:3000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code":"void setup(){pinMode(13,OUTPUT);}void loop(){digitalWrite(13,HIGH);delay(500);digitalWrite(13,LOW);delay(500);}","board":"arduino-uno"}' \
  | python3 -m json.tool | head -5
```

Expected:
```json
{
  "success": true,
  "hex": ":100000000C9434000C9451000C94510...",
  "flashBytes": 924,
  "sramBytes": 9
}
```

- [ ] **Step 4: Test compile error handling**

```bash
curl -s -X POST http://localhost:3000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code":"void setup(){ badSyntax ","board":"arduino-uno"}' \
  | python3 -m json.tool
```

Expected: `{ "success": false, "errors": [{ "line": 1, "column": ..., "message": "...", "severity": "error" }] }`

- [ ] **Step 5: Create client-side compiler wrapper**

```typescript
// lib/avr/compiler.ts
import type { CompileRequest, CompileResult } from "./types"

export async function compileSketch(request: CompileRequest): Promise<CompileResult> {
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    return {
      success: false,
      errors: [{ line: null, column: null, message: `Compile server error: ${response.status}`, severity: "error" }],
    }
  }

  return response.json() as Promise<CompileResult>
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/compile/route.ts lib/avr/compiler.ts
git commit -m "feat(avr): add arduino-cli compilation API route and client wrapper"
```

---

## Task 5: AVR Web Worker

**Files:**
- Create: `workers/avr-worker.ts`

This is the heart of Phase 1. It receives a `.hex` string, loads it into avr8js, and runs the ATmega328P CPU in a continuous loop. Pin changes are posted back to the main thread.

- [ ] **Step 1: Create `workers/avr-worker.ts`**

```typescript
// workers/avr-worker.ts
// Runs entirely in a Web Worker — no DOM access, no Next.js imports

import {
  CPU,
  AVRIOPort,
  portBConfig,
  portCConfig,
  portDConfig,
  AVRTimer0,
  timer0Config,
  AVRTimer1,
  timer1Config,
  AVRTimer2,
  timer2Config,
  AVRUART,
  usart0Config,
  loadHex,
  MUX_ADC0,
} from "@wokwi/avr8js"
import type { AVRCommand, AVREvent } from "@/lib/avr/types"

// ── State ──────────────────────────────────────────────────────────────────

let cpu: CPU | null = null
let portB: AVRIOPort | null = null
let portC: AVRIOPort | null = null
let portD: AVRIOPort | null = null
let uart: AVRUART | null = null

let isRunning = false
let isPaused = false
let speedMultiplier = 1
let runLoopHandle: ReturnType<typeof setTimeout> | null = null

// Cycles per event-loop tick. At 16MHz, 500k cycles = ~31ms real-time per tick at 1×
const BASE_CYCLES_PER_TICK = 500_000

// ── Pin state tracking (to detect changes) ────────────────────────────────

const prevPinHigh: Record<number, boolean> = {}

function postEvent(event: AVREvent) {
  self.postMessage(event)
}

// ── Pin mapping helpers ────────────────────────────────────────────────────
// Returns true if the given ATmega328P OCRnx register controls PWM on this pin.
// We detect PWM by checking if the port pin is in output mode AND the corresponding
// timer is in a PWM mode. For Phase 1, we approximate duty cycle from OCRnx.

function getPortPin(digitalPin: number): { port: AVRIOPort; bit: number } | null {
  if (!portB || !portC || !portD) return null
  if (digitalPin <= 7)  return { port: portD, bit: digitalPin }
  if (digitalPin <= 13) return { port: portB, bit: digitalPin - 8 }
  if (digitalPin <= 19) return { port: portC, bit: digitalPin - 14 }
  return null
}

// ── Observe port pin changes and post to main thread ──────────────────────

function observePin(pin: number) {
  const pp = getPortPin(pin)
  if (!pp) return

  pp.port.addListener(() => {
    if (!cpu) return
    const high = pp.port.pinState(pp.bit) === 1

    // Detect PWM: the OCR register for this pin drives duty cycle.
    // Phase 1 approximation: PWM detected if timer WGM mode is Fast PWM or Phase-correct PWM.
    // For simplicity in Phase 1 we check if the pin is in output mode and the port pin toggles
    // faster than the main run loop — we just report dutyCycle=0 for Phase 1 (Phase 2 adds MNA).
    const isPWM = false  // Phase 2 will derive from timer registers
    const dutyCycle = high ? 255 : 0

    if (prevPinHigh[pin] !== high) {
      prevPinHigh[pin] = high
      postEvent({ type: "pinChange", pin, high, isPWM, dutyCycle })
    }
  })
}

// Observe all Arduino Uno digital pins
for (let pin = 0; pin <= 19; pin++) {
  // We call observePin after CPU setup — see setup()
}

// ── CPU setup ──────────────────────────────────────────────────────────────

function setup(hex: string) {
  const program = loadHex(hex)
  if (!program || program.length === 0) {
    postEvent({ type: "halted", reason: "error", message: "Invalid or empty HEX file" })
    return false
  }

  // Flash is 16-bit words; avr8js expects Uint16Array
  const flash = new Uint16Array(32 * 1024) // 32KB for ATmega328P
  for (let i = 0; i < program.length; i++) {
    flash[i >> 1] |= program[i] << ((i & 1) ? 8 : 0)
  }

  cpu = new CPU(flash)

  portB = new AVRIOPort(cpu, portBConfig)
  portC = new AVRIOPort(cpu, portCConfig)
  portD = new AVRIOPort(cpu, portDConfig)

  // Timers (needed for millis(), delay(), PWM)
  const timer0 = new AVRTimer0(cpu, timer0Config)
  const timer1 = new AVRTimer1(cpu, timer1Config)
  const timer2 = new AVRTimer2(cpu, timer2Config)
  void timer0; void timer1; void timer2  // referenced for side effects

  // UART for Serial.print()
  uart = new AVRUART(cpu, usart0Config)
  uart.onByteTransmit = (byte: number) => {
    postEvent({ type: "serialOutput", text: String.fromCharCode(byte) })
  }

  // Observe all digital pins for changes
  for (let pin = 0; pin <= 19; pin++) {
    observePin(pin)
  }

  return true
}

// ── CPU run loop ───────────────────────────────────────────────────────────

function runLoop() {
  if (!isRunning || isPaused || !cpu) return

  const cycles = Math.round(BASE_CYCLES_PER_TICK * speedMultiplier)

  try {
    for (let i = 0; i < cycles; i++) {
      cpu.tick()
    }
  } catch (err) {
    postEvent({ type: "halted", reason: "error", message: String(err) })
    isRunning = false
    return
  }

  // Schedule next tick — yield to event loop so messages can be processed
  runLoopHandle = setTimeout(runLoop, 0)
}

// ── Message handler ────────────────────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent<AVRCommand>) => {
  const cmd = e.data

  switch (cmd.type) {
    case "load": {
      isRunning = false
      isPaused = false
      if (runLoopHandle) { clearTimeout(runLoopHandle); runLoopHandle = null }
      const ok = setup(cmd.hex)
      if (ok) postEvent({ type: "ready" })
      break
    }

    case "run": {
      if (!cpu) {
        postEvent({ type: "halted", reason: "error", message: "No program loaded. Compile first." })
        return
      }
      isRunning = true
      isPaused = false
      postEvent({ type: "running" })
      runLoop()
      break
    }

    case "stop": {
      isRunning = false
      isPaused = false
      if (runLoopHandle) { clearTimeout(runLoopHandle); runLoopHandle = null }
      cpu = null; portB = null; portC = null; portD = null; uart = null
      postEvent({ type: "stopped" })
      break
    }

    case "pause": {
      isPaused = true
      if (runLoopHandle) { clearTimeout(runLoopHandle); runLoopHandle = null }
      postEvent({ type: "paused" })
      break
    }

    case "resume": {
      isPaused = false
      postEvent({ type: "running" })
      runLoop()
      break
    }

    case "setSpeed": {
      speedMultiplier = Math.max(0.1, Math.min(1000, cmd.multiplier))
      break
    }

    case "setDigitalInput": {
      const pp = getPortPin(cmd.pin)
      if (pp && cpu) {
        // Set the PIN register bit (external pin state read via digitalRead)
        pp.port.setPin(pp.bit, cmd.high)
      }
      break
    }

    case "setADCInput": {
      if (cpu) {
        // Write directly to ADC data register (ADCL/ADCH) for the given analog channel.
        // Channel is cmd.pin - 14 for A0-A5 (digital pins 14-19).
        const channel = cmd.pin - 14
        if (channel >= 0 && channel <= 5) {
          const adcValue = Math.max(0, Math.min(1023, cmd.value))
          // ADCL = 0x78, ADCH = 0x79 in ATmega328P memory map
          cpu.data[0x78] = adcValue & 0xFF
          cpu.data[0x79] = (adcValue >> 8) & 0x03
        }
      }
      break
    }

    case "sendSerial": {
      if (uart) {
        for (const char of cmd.data) {
          uart.onByteSend?.(char.charCodeAt(0))
        }
      }
      break
    }
  }
})

postEvent({ type: "ready" })
```

- [ ] **Step 2: Verify TypeScript compiles the worker without errors**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform"
pnpm tsc --noEmit 2>&1 | grep "avr-worker" | head -10
```

Expected: no errors on `workers/avr-worker.ts`.

- [ ] **Step 3: Commit**

```bash
git add workers/avr-worker.ts
git commit -m "feat(avr): implement AVR Web Worker with avr8js CPU loop and pin listeners"
```

---

## Task 6: GPIO Bridge

**Files:**
- Create: `lib/avr/gpio-bridge.ts`
- Create: `lib/avr/__tests__/gpio-bridge.test.ts`

The bridge lives on the main thread and routes messages between the AVR worker and the physics world (Matter.js). In Phase 1 it only handles digital pin changes. Phase 2 will extend it for PWM and ADC.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/avr/__tests__/gpio-bridge.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GPIOBridge } from "../gpio-bridge"
import type { AVREvent } from "../types"

const makeWorker = () => ({
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  terminate: vi.fn(),
})

describe("GPIOBridge", () => {
  let bridge: GPIOBridge
  let avrWorker: ReturnType<typeof makeWorker>
  let onPinChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    avrWorker = makeWorker()
    onPinChange = vi.fn()
    bridge = new GPIOBridge({
      avrWorker: avrWorker as unknown as Worker,
      onPinChange,
    })
  })

  it("forwards pinChange events from the AVR worker to the callback", () => {
    const event: AVREvent = { type: "pinChange", pin: 13, high: true, isPWM: false, dutyCycle: 255 }
    bridge.handleAVREvent(event)
    expect(onPinChange).toHaveBeenCalledWith({ pin: 13, high: true, isPWM: false, dutyCycle: 255 })
  })

  it("sends setDigitalInput command to AVR worker", () => {
    bridge.setDigitalInput(2, true)
    expect(avrWorker.postMessage).toHaveBeenCalledWith({ type: "setDigitalInput", pin: 2, high: true })
  })

  it("sends setADCInput command to AVR worker", () => {
    bridge.setADCInput(14, 512)
    expect(avrWorker.postMessage).toHaveBeenCalledWith({ type: "setADCInput", pin: 14, value: 512 })
  })

  it("clamps ADC value to 0-1023", () => {
    bridge.setADCInput(14, 9999)
    expect(avrWorker.postMessage).toHaveBeenCalledWith({ type: "setADCInput", pin: 14, value: 1023 })

    bridge.setADCInput(14, -50)
    expect(avrWorker.postMessage).toHaveBeenCalledWith({ type: "setADCInput", pin: 14, value: 0 })
  })

  it("ignores unknown event types without throwing", () => {
    // @ts-expect-error intentional unknown type
    expect(() => bridge.handleAVREvent({ type: "unknown" })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run lib/avr/__tests__/gpio-bridge.test.ts 2>&1 | tail -5
```

Expected: `FAIL` — `Cannot find module '../gpio-bridge'`

- [ ] **Step 3: Implement `lib/avr/gpio-bridge.ts`**

```typescript
// lib/avr/gpio-bridge.ts
import type { AVRCommand, AVREvent } from "./types"

export interface PinChangePayload {
  pin: number
  high: boolean
  isPWM: boolean
  dutyCycle: number
}

export interface GPIOBridgeOptions {
  avrWorker: Worker
  onPinChange: (payload: PinChangePayload) => void
  onSerialOutput?: (text: string) => void
  onAVRError?: (message: string) => void
  onAVRStopped?: () => void
}

export class GPIOBridge {
  private avrWorker: Worker
  private onPinChange: (payload: PinChangePayload) => void
  private onSerialOutput?: (text: string) => void
  private onAVRError?: (message: string) => void
  private onAVRStopped?: () => void

  constructor(options: GPIOBridgeOptions) {
    this.avrWorker = options.avrWorker
    this.onPinChange = options.onPinChange
    this.onSerialOutput = options.onSerialOutput
    this.onAVRError = options.onAVRError
    this.onAVRStopped = options.onAVRStopped
  }

  // Called by the main thread when a message arrives from the AVR worker
  handleAVREvent(event: AVREvent): void {
    switch (event.type) {
      case "pinChange":
        this.onPinChange({
          pin: event.pin,
          high: event.high,
          isPWM: event.isPWM,
          dutyCycle: event.dutyCycle,
        })
        break
      case "serialOutput":
        this.onSerialOutput?.(event.text)
        break
      case "halted":
        this.onAVRError?.(event.message ?? "AVR halted")
        break
      case "stopped":
        this.onAVRStopped?.()
        break
      // "ready", "running", "paused" are handled by simulator-view directly
    }
  }

  // Send a digital level to an AVR input pin (e.g. button press → D2)
  setDigitalInput(pin: number, high: boolean): void {
    const cmd: AVRCommand = { type: "setDigitalInput", pin, high }
    this.avrWorker.postMessage(cmd)
  }

  // Send an ADC reading to an AVR analog pin (0-1023, clamped)
  setADCInput(pin: number, value: number): void {
    const clamped = Math.max(0, Math.min(1023, Math.round(value)))
    const cmd: AVRCommand = { type: "setADCInput", pin, value: clamped }
    this.avrWorker.postMessage(cmd)
  }

  // Send a string to the AVR's UART RX buffer (appears as Serial.read())
  sendSerial(data: string): void {
    const cmd: AVRCommand = { type: "sendSerial", data }
    this.avrWorker.postMessage(cmd)
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run lib/avr/__tests__/gpio-bridge.test.ts 2>&1 | tail -5
```

Expected: `PASS` — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/avr/gpio-bridge.ts lib/avr/__tests__/gpio-bridge.test.ts
git commit -m "feat(avr): add GPIO bridge for routing pin events between AVR worker and physics world"
```

---

## Task 7: Serial Monitor Component

**Files:**
- Create: `components/simulator/serial-monitor.tsx`

A scrolling terminal panel showing `Serial.print()` output from the AVR. Supports sending input back to the Arduino's `Serial.read()`.

- [ ] **Step 1: Create `components/simulator/serial-monitor.tsx`**

```typescript
// components/simulator/serial-monitor.tsx
"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Terminal, Trash2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SerialLine {
  id: number
  text: string
  timestamp: string
}

interface SerialMonitorProps {
  lines: SerialLine[]
  onSend: (data: string) => void
  onClear: () => void
  className?: string
}

let lineIdCounter = 0

export function SerialMonitor({ lines, onSend, onClear, className }: SerialMonitorProps) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines])

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    onSend(input + "\n")
    setInput("")
  }, [input, onSend])

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Serial Monitor</span>
          <span className="text-xs text-muted-foreground">({lines.length} lines)</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear} title="Clear">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 font-mono text-xs bg-background min-h-[120px] max-h-[200px]">
        {lines.length === 0 ? (
          <span className="text-muted-foreground">Serial output will appear here…</span>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex gap-2 leading-relaxed">
              <span className="text-muted-foreground shrink-0 select-none">{line.timestamp}</span>
              <span className="text-foreground whitespace-pre-wrap break-all">{line.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-border p-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Send to Serial.read()…"
          className="h-7 font-mono text-xs bg-background"
        />
        <Button size="sm" className="h-7 px-2" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// Factory for creating serial lines — call this from the parent component
export function makeSerialLine(text: string): SerialLine {
  return {
    id: ++lineIdCounter,
    text,
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
  }
}
```

- [ ] **Step 2: Verify it renders without errors**

```bash
pnpm tsc --noEmit 2>&1 | grep "serial-monitor" | head -5
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/simulator/serial-monitor.tsx
git commit -m "feat(avr): add Serial Monitor panel component for Serial.print() output"
```

---

## Task 8: AVR Code Panel (Monaco + Controls)

**Files:**
- Modify: `components/simulator/code-execution-panel.tsx` (full rewrite)

This panel replaces the old `CodeExecutionPanel` that relied on the toy executor. It uses Monaco for code editing, shows compilation errors inline, and has Run/Stop/Speed controls.

- [ ] **Step 1: Rewrite `components/simulator/code-execution-panel.tsx`**

```typescript
// components/simulator/code-execution-panel.tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { Play, Square, Pause, RotateCcw, Zap, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CompileDiagnostic, BoardId } from "@/lib/avr/types"
import { BOARD_PROFILES } from "@/lib/avr/board-profiles"
import { compileSketch } from "@/lib/avr/compiler"
import type { AVRCommand } from "@/lib/avr/types"

// Monaco is large — lazy load it
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Loading editor…
    </div>
  ),
})

type RunState = "idle" | "compiling" | "running" | "paused"

const SPEED_OPTIONS: { label: string; value: number }[] = [
  { label: "0.1×", value: 0.1 },
  { label: "1× (real-time)", value: 1 },
  { label: "10×", value: 10 },
  { label: "100×", value: 100 },
  { label: "1000×", value: 1000 },
]

interface CodeExecutionPanelProps {
  code: string
  onCodeChange: (code: string) => void
  runState: RunState
  onCommand: (cmd: AVRCommand) => void
  errors: CompileDiagnostic[]
  board: BoardId
  onBoardChange: (board: BoardId) => void
}

export function CodeExecutionPanel({
  code,
  onCodeChange,
  runState,
  onCommand,
  errors,
  board,
  onBoardChange,
}: CodeExecutionPanelProps) {
  const [speed, setSpeed] = useState(1)

  const handleRun = useCallback(async () => {
    // Compile first, then send hex to worker
    onCommand({ type: "load", hex: "", board }) // signal compilation started
    const result = await compileSketch({ code, board })
    if (!result.success) return // errors are passed back via onCommand flow — parent handles
    onCommand({ type: "load", hex: result.hex, board })
    onCommand({ type: "run" })
  }, [code, board, onCommand])

  const handleSpeedChange = useCallback((value: number) => {
    setSpeed(value)
    onCommand({ type: "setSpeed", multiplier: value })
  }, [onCommand])

  const errorMarkers = errors.map((e) => ({
    startLineNumber: e.line ?? 1,
    startColumn: e.column ?? 1,
    endLineNumber: e.line ?? 1,
    endColumn: (e.column ?? 1) + 20,
    message: e.message,
    severity: e.severity === "error" ? 8 : 4, // MonacoMarkerSeverity.Error = 8, Warning = 4
  }))

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
        {runState === "idle" || runState === "compiling" ? (
          <Button
            size="sm"
            className="h-7 gap-1.5 bg-primary text-primary-foreground"
            onClick={handleRun}
            disabled={runState === "compiling"}
          >
            {runState === "compiling" ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Compiling…</>
            ) : (
              <><Play className="h-3 w-3" /> Run</>
            )}
          </Button>
        ) : (
          <>
            {runState === "running" ? (
              <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => onCommand({ type: "pause" })}>
                <Pause className="h-3 w-3" /> Pause
              </Button>
            ) : (
              <Button size="sm" className="h-7 gap-1.5 bg-primary text-primary-foreground" onClick={() => onCommand({ type: "resume" })}>
                <Play className="h-3 w-3" /> Resume
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-destructive" onClick={() => onCommand({ type: "stop" })}>
              <Square className="h-3 w-3" /> Stop
            </Button>
          </>
        )}

        {/* Speed control — only visible when running or paused */}
        {runState !== "idle" && runState !== "compiling" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1">
                <Zap className="h-3 w-3" />
                {SPEED_OPTIONS.find((s) => s.value === speed)?.label ?? `${speed}×`}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {SPEED_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => handleSpeedChange(opt.value)}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="ml-auto flex items-center gap-2">
          {errors.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {errors.filter((e) => e.severity === "error").length} error(s)
            </Badge>
          )}
          {/* Board selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                {BOARD_PROFILES[board].displayName}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(Object.keys(BOARD_PROFILES) as BoardId[]).map((b) => (
                <DropdownMenuItem key={b} onClick={() => onBoardChange(b)}>
                  {BOARD_PROFILES[b].displayName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Error banner */}
      {errors.filter((e) => e.severity === "error").length > 0 && (
        <div className="border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-mono space-y-0.5 max-h-24 overflow-auto shrink-0">
          {errors.filter((e) => e.severity === "error").map((e, i) => (
            <div key={i} className="text-destructive">
              {e.line ? `Line ${e.line}: ` : ""}{e.message}
            </div>
          ))}
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language="cpp"
          theme="vs-dark"
          value={code}
          onChange={(val) => onCodeChange(val ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            readOnly: runState === "running" || runState === "paused",
          }}
          beforeMount={(monaco) => {
            // Arduino C++ syntax highlighting tweak
            monaco.languages.setLanguageConfiguration("cpp", {
              comments: { lineComment: "//", blockComment: ["/*", "*/"] },
            })
          }}
          onMount={(editor, monaco) => {
            if (errorMarkers.length > 0) {
              const model = editor.getModel()
              if (model) monaco.editor.setModelMarkers(model, "xylo", errorMarkers)
            }
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
pnpm tsc --noEmit 2>&1 | grep "code-execution-panel" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/simulator/code-execution-panel.tsx
git commit -m "feat(avr): rewrite CodeExecutionPanel with Monaco editor and AVR run controls"
```

---

## Task 9: Wire AVR Engine into Simulator View

**Files:**
- Modify: `components/simulator/simulator-view.tsx`

Replace all `RobotExecutor` and `transpileArduino` usage with the AVR worker + GPIO bridge. The simulator view becomes the orchestrator: it creates the worker, handles its events, and routes pin changes into the physics world.

- [ ] **Step 1: Read the current simulator-view.tsx imports section**

```bash
head -25 "/Users/karangupta/Projects/Xylo Robotics Platform/components/simulator/simulator-view.tsx"
```

- [ ] **Step 2: Rewrite the top of `simulator-view.tsx` — replace old imports and state**

Replace everything from line 1 through the existing `useState`/`useRef` block with:

```typescript
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Bot, Zap, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SimulatorCanvas } from "./simulator-canvas"
import { SimulatorControls } from "./simulator-controls"
import { CodeExecutionPanel } from "./code-execution-panel"
import { SerialMonitor, makeSerialLine } from "./serial-monitor"
import { VirtualRobot, RobotState } from "@/lib/simulator/robot"
import { PhysicsWorld } from "@/lib/simulator/physics"
import { ARENAS } from "@/lib/simulator/arena"
import { SAMPLE_CHALLENGES } from "@/lib/challenges/types"
import { ChallengeOverlay } from "./challenge-overlay"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { compileSketch } from "@/lib/avr/compiler"
import type { AVRCommand, AVREvent, BoardId, CompileDiagnostic } from "@/lib/avr/types"
import { toast } from "sonner"
import Link from "next/link"

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
```

- [ ] **Step 3: Replace the state declarations and refs in `SimulatorView`**

Inside the `SimulatorView` function, replace all `useState`/`useRef` declarations with:

```typescript
  const searchParams = useSearchParams()
  const challengeId = searchParams.get("challenge")
  const challengeDef = challengeId
    ? SAMPLE_CHALLENGES.find((c) => c.title.toLowerCase().replace(/\s+/g, "-") === challengeId)
    : null

  const [isRunning, setIsRunning] = useState(false)
  const [selectedArena, setSelectedArena] = useState(challengeDef?.arena_id ?? "open-arena")
  const [robotState, setRobotState] = useState<RobotState | null>(null)
  const [speed, setSpeed] = useState(50)
  const [goalReached, setGoalReached] = useState(false)
  const [arenaKey, setArenaKey] = useState(0)
  const [activeTab, setActiveTab] = useState<"controls" | "code" | "serial">("controls")

  // AVR state
  const [code, setCode] = useState(() => sessionStorage?.getItem("xylo_code") ?? DEFAULT_CODE)
  const [board, setBoard] = useState<BoardId>("arduino-uno")
  const [runState, setRunState] = useState<RunState>("idle")
  const [compileErrors, setCompileErrors] = useState<CompileDiagnostic[]>([])
  const [serialLines, setSerialLines] = useState<ReturnType<typeof makeSerialLine>[]>([])

  // Challenge state
  const [challengeResult, setChallengeResult] = useState<{
    completed: boolean; score: number; message: string; timeSeconds?: number; collisionCount?: number
  } | null>(null)
  const runStartTimeRef = useRef<number | null>(null)
  const collisionCountRef = useRef(0)
  const [collisionCount, setCollisionCount] = useState(0)

  const robotRef = useRef<VirtualRobot | null>(null)
  const physicsRef = useRef<PhysicsWorld | null>(null)
  const avrWorkerRef = useRef<Worker | null>(null)
  const bridgeRef = useRef<GPIOBridge | null>(null)
```

- [ ] **Step 4: Add AVR worker setup effect**

Add this `useEffect` inside `SimulatorView`, after the refs:

```typescript
  // Create AVR worker and bridge on mount
  useEffect(() => {
    const worker = new Worker(new URL("../../workers/avr-worker.ts", import.meta.url))
    avrWorkerRef.current = worker

    const bridge = new GPIOBridge({
      avrWorker: worker,
      onPinChange: ({ pin, high }) => {
        // Phase 1: map pin 13 (LED) to robot body LED indicator
        // Full physics mapping comes in Phase 2 with MNA solver
        if (pin === 13) {
          robotRef.current?.setLEDState?.(high)
        }
      },
      onSerialOutput: (text) => {
        setSerialLines((prev) => [...prev.slice(-499), makeSerialLine(text)])
      },
      onAVRError: (message) => {
        toast.error(`Execution error: ${message}`)
        setRunState("idle")
        setIsRunning(false)
      },
      onAVRStopped: () => {
        setRunState("idle")
        setIsRunning(false)
      },
    })
    bridgeRef.current = bridge

    worker.addEventListener("message", (e: MessageEvent<AVREvent>) => {
      const event = e.data
      if (event.type === "running") { setRunState("running"); setIsRunning(true) }
      else if (event.type === "paused") { setRunState("paused") }
      else if (event.type === "stopped") { setRunState("idle"); setIsRunning(false) }
      else bridge.handleAVREvent(event)
    })

    return () => {
      worker.postMessage({ type: "stop" } satisfies AVRCommand)
      worker.terminate()
    }
  }, [])
```

- [ ] **Step 5: Add the AVR command handler**

```typescript
  const handleAVRCommand = useCallback(async (cmd: AVRCommand) => {
    if (!avrWorkerRef.current) return

    if (cmd.type === "load" && cmd.hex === "") {
      // Signal: compilation starting
      setRunState("compiling")
      setCompileErrors([])
      const result = await compileSketch({ code, board })
      if (!result.success) {
        setCompileErrors(result.errors)
        setRunState("idle")
        toast.error(`${result.errors.length} compile error(s)`)
        return
      }
      if (result.warnings.length > 0) {
        setCompileErrors(result.warnings)
      }
      toast.success(`Compiled — ${result.flashBytes} bytes flash, ${result.sramBytes} bytes SRAM`)
      avrWorkerRef.current.postMessage({ type: "load", hex: result.hex, board } satisfies AVRCommand)
      avrWorkerRef.current.postMessage({ type: "run" } satisfies AVRCommand)
      return
    }

    avrWorkerRef.current.postMessage(cmd)
  }, [code, board])
```

- [ ] **Step 6: Update the JSX — add Serial Monitor tab and wire CodeExecutionPanel**

In the right-side panel `<Tabs>` section, update to:

```tsx
<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="controls">Controls</TabsTrigger>
    <TabsTrigger value="code">Code</TabsTrigger>
    <TabsTrigger value="serial">Serial</TabsTrigger>
  </TabsList>
  <TabsContent value="controls" className="p-4 m-0">
    <SimulatorControls
      isRunning={isRunning}
      onToggleRun={() => {
        if (runState === "running") handleAVRCommand({ type: "pause" })
        else if (runState === "paused") handleAVRCommand({ type: "resume" })
      }}
      onReset={() => {
        handleAVRCommand({ type: "stop" })
        const config = ARENAS.find((a) => a.id === selectedArena) || ARENAS[0]
        robotRef.current?.reset(config.robotStartX, config.robotStartY, config.robotStartAngle)
        setGoalReached(false)
        setIsRunning(false)
      }}
      onMoveForward={() => { robotRef.current?.moveForward(speed); setIsRunning(true) }}
      onMoveBackward={() => { robotRef.current?.moveBackward(speed); setIsRunning(true) }}
      onTurnLeft={() => { robotRef.current?.turnLeft(speed); setIsRunning(true) }}
      onTurnRight={() => { robotRef.current?.turnRight(speed); setIsRunning(true) }}
      onStop={() => robotRef.current?.stop()}
      robotState={robotState}
      selectedArena={selectedArena}
      onArenaChange={(arenaId) => {
        setSelectedArena(arenaId)
        setArenaKey((prev) => prev + 1)
        setGoalReached(false)
        setIsRunning(false)
      }}
      speed={speed}
      onSpeedChange={setSpeed}
    />
  </TabsContent>
  <TabsContent value="code" className="m-0 h-[400px]">
    <CodeExecutionPanel
      code={code}
      onCodeChange={setCode}
      runState={runState}
      onCommand={handleAVRCommand}
      errors={compileErrors}
      board={board}
      onBoardChange={setBoard}
    />
  </TabsContent>
  <TabsContent value="serial" className="m-0 p-2">
    <SerialMonitor
      lines={serialLines}
      onSend={(data) => bridgeRef.current?.sendSerial(data)}
      onClear={() => setSerialLines([])}
    />
  </TabsContent>
</Tabs>
```

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
pnpm tsc --noEmit 2>&1 | grep -i "simulator-view" | head -10
```

Expected: no errors. Resolve any type mismatches before continuing.

- [ ] **Step 8: Start dev server and manually test the Blink program**

```bash
pnpm dev
# Open http://localhost:3000/simulator
# Click the "Code" tab
# The default Blink code should be shown in Monaco
# Click "Run"
# Expected: "Compiling…" state → toast "Compiled — 924 bytes flash"
# Serial tab should show "Blink!" appearing every second
```

- [ ] **Step 9: Commit**

```bash
git add components/simulator/simulator-view.tsx
git commit -m "feat(avr): wire AVR worker + GPIO bridge into simulator view, replace old executor"
```

---

## Task 10: Delete Old Transpiler and Executor

**Files:**
- Delete: `lib/simulator/arduino-transpiler.ts`
- Delete: `lib/simulator/executor.ts`

- [ ] **Step 1: Confirm nothing else imports these files**

```bash
cd "/Users/karangupta/Projects/Xylo Robotics Platform"
grep -r "arduino-transpiler\|from.*executor" --include="*.ts" --include="*.tsx" . \
  | grep -v "node_modules" | grep -v ".next"
```

Expected: zero results (after Task 9 rewrites simulator-view.tsx).

- [ ] **Step 2: Delete the files**

```bash
rm lib/simulator/arduino-transpiler.ts lib/simulator/executor.ts
```

- [ ] **Step 3: Verify the project still builds**

```bash
pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: no errors referencing the deleted files.

- [ ] **Step 4: Run all tests**

```bash
pnpm vitest run 2>&1 | tail -15
```

Expected: all tests pass (board-profiles + gpio-bridge tests).

- [ ] **Step 5: Commit**

```bash
git rm lib/simulator/arduino-transpiler.ts lib/simulator/executor.ts
git commit -m "refactor(avr): delete toy transpiler and executor — replaced by avr8js"
```

---

## Task 11: End-to-End Smoke Test

Manual validation that the full Phase 1 pipeline works before declaring the phase complete.

- [ ] **Step 1: Test Blink with Serial output**

1. Open `http://localhost:3000/simulator`
2. Go to "Code" tab
3. Paste the default Blink code (already there)
4. Click "Run"
5. Verify: "Compiled — ~924 bytes flash" toast appears
6. Go to "Serial" tab
7. Verify: "Blink!" appears in Serial Monitor every ~1 second

- [ ] **Step 2: Test a compile error**

1. Clear the code and type: `void setup() { badSyntax`
2. Click "Run"
3. Verify: error banner appears with `Line 1: expected ';' before '}'` (or similar)
4. Verify: no crash, can fix code and re-run

- [ ] **Step 3: Test stop and re-run**

1. With Blink running, click "Stop"
2. Verify: Serial Monitor stops receiving new lines
3. Modify delay to `delay(200)`
4. Click "Run" again
5. Verify: blinking is faster, "Blink!" appears 5× per second

- [ ] **Step 4: Test speed multiplier**

1. Run the Blink code at 1×
2. Change speed to 100×
3. Verify: "Blink!" floods into Serial Monitor much faster

- [ ] **Step 5: Test Serial send (Serial.read)**

Modify the code to:
```cpp
char input;
void setup() { Serial.begin(9600); }
void loop() {
  if (Serial.available()) {
    input = Serial.read();
    Serial.print("Got: ");
    Serial.println(input);
  }
}
```
Run, go to Serial tab, type `H` and press Enter.
Verify: "Got: H" appears in Serial output.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat(avr): Phase 1 complete — real AVR emulation with avr8js in browser simulator"
```

---

## Self-Review

**Spec coverage check against §4 of design doc:**

| Spec requirement | Task that covers it |
|---|---|
| avr-gcc WASM compilation pipeline | Task 4 (server-side arduino-cli; WASM deferred to Phase 5 flasher) |
| avr8js in Web Worker | Task 5 |
| Basic GPIO bridge (digital only) | Task 6 |
| Serial Monitor | Task 7 |
| Replace arduino-transpiler.ts | Task 10 |
| Replace executor.ts | Task 10 |
| Speed multiplier | Task 5 (setSpeed), Task 8 (UI) |
| Compile errors as inline Monaco markers | Task 8 |
| Session storage code persistence | Task 9 (DEFAULT_CODE reads sessionStorage) |

**Notes on deferred items (in-scope for later phases):**
- PWM duty cycle detection in avr-worker (marked `isPWM: false` in Phase 1 — Phase 2 adds MNA)
- ADC input from circuit (Phase 2)
- `Wire` (I2C), `SPI`, `Servo` library support — avr8js supports these natively but the circuit components that feed them come in Phase 4
- avr-gcc WASM client-side (Phase 5 — Phase 1 uses server-side arduino-cli for simplicity)

---

## Subsequent Phase Plans

Write each phase plan as a separate document in `docs/superpowers/plans/` once the previous phase is complete and merged:

| Phase | Plan file | Depends on |
|---|---|---|
| Phase 2: MNA Circuit Solver | `2026-06-19-phase2-mna-solver.md` | Phase 1 complete |
| Phase 3: Mission System | `2026-06-19-phase3-mission-system.md` | Phase 2 complete |
| Phase 4: Schematic + Full Components | `2026-06-19-phase4-schematic-components.md` | Phase 3 complete |
| Phase 5: AI Mentor + Flasher | `2026-06-19-phase5-ai-mentor-flasher.md` | Phase 4 complete |
| Phase 6: Teacher Tools + Missions | `2026-06-19-phase6-teacher-tools.md` | Phase 5 complete |
