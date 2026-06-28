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
  | { type: "pinChange"; pin: number; high: boolean; isPWM: boolean; dutyCycle: number; cycles?: number }
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
