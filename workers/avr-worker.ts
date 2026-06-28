// workers/avr-worker.ts
// Runs entirely in a Web Worker — no DOM access, no Next.js imports

import {
  CPU,
  AVRIOPort,
  portBConfig,
  portCConfig,
  portDConfig,
  AVRTimer,
  timer0Config,
  timer1Config,
  timer2Config,
  AVRUSART,
  usart0Config,
  AVRADC,
  adcConfig,
  PinState,
} from "avr8js"
import type { AVRCommand, AVREvent } from "../lib/avr/types"

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

// ── Constants ──────────────────────────────────────────────────────────────

const FREQ_HZ = 16_000_000 // ATmega328P @ 16 MHz

// Cycles per event-loop tick. At 16MHz, 500k cycles ≈ 31ms real-time per tick at 1×
const BASE_CYCLES_PER_TICK = 500_000

// ── State ──────────────────────────────────────────────────────────────────

let cpu: CPU | null = null
let portB: AVRIOPort | null = null
let portC: AVRIOPort | null = null
let portD: AVRIOPort | null = null
let uart: AVRUSART | null = null
let adc: AVRADC | null = null

let isRunning = false
let isPaused = false
let speedMultiplier = 1
let runLoopHandle: ReturnType<typeof setTimeout> | null = null

// ── Pin state tracking (to detect changes) ────────────────────────────────

const prevPinHigh: Record<number, boolean> = {}

function postEvent(event: AVREvent) {
  self.postMessage(event)
}

// ── Port/pin helper ────────────────────────────────────────────────────────

function getPortPin(digitalPin: number): { port: AVRIOPort; bit: number } | null {
  if (!portB || !portC || !portD) return null
  if (digitalPin <= 7)  return { port: portD, bit: digitalPin }
  if (digitalPin <= 13) return { port: portB, bit: digitalPin - 8 }
  if (digitalPin <= 19) return { port: portC, bit: digitalPin - 14 }
  return null
}

// ── Observe all digital pins for changes ──────────────────────────────────

function attachPinListeners() {
  for (let pin = 0; pin <= 19; pin++) {
    const pinNum = pin // capture for closure
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

// ── Intel HEX parser ───────────────────────────────────────────────────────
// avr8js does not export a loadHex utility, so we implement one inline.

function parseIntelHex(hex: string): Uint8Array {
  const flash = new Uint8Array(32 * 1024) // 32KB for ATmega328P
  flash.fill(0xff) // unprogrammed flash is 0xFF

  for (const line of hex.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith(":")) continue

    const byteCount  = parseInt(trimmed.slice(1, 3), 16)
    const address    = parseInt(trimmed.slice(3, 7), 16)
    const recordType = parseInt(trimmed.slice(7, 9), 16)

    if (recordType === 0x01) break // EOF record
    if (recordType !== 0x00) continue // only handle data records

    for (let i = 0; i < byteCount; i++) {
      const byteOffset = 9 + i * 2
      const byte = parseInt(trimmed.slice(byteOffset, byteOffset + 2), 16)
      if (address + i < flash.length) {
        flash[address + i] = byte
      }
    }
  }

  return flash
}

// ── CPU setup ──────────────────────────────────────────────────────────────

function setup(hex: string): boolean {
  try {
    // Parse Intel HEX into raw bytes
    const flashBytes = parseIntelHex(hex)
    if (!flashBytes || flashBytes.length === 0) {
      postEvent({ type: "halted", reason: "error", message: "Invalid or empty HEX file" })
      return false
    }

    // avr8js CPU expects a Uint16Array (16-bit words, little-endian)
    const progMem = new Uint16Array(flashBytes.length / 2)
    for (let i = 0; i < progMem.length; i++) {
      progMem[i] = flashBytes[i * 2] | (flashBytes[i * 2 + 1] << 8)
    }

    cpu = new CPU(progMem)

    portB = new AVRIOPort(cpu, portBConfig)
    portC = new AVRIOPort(cpu, portCConfig)
    portD = new AVRIOPort(cpu, portDConfig)

    // Timers needed for millis(), delay(), analogWrite()
    new AVRTimer(cpu, timer0Config)
    new AVRTimer(cpu, timer1Config)
    new AVRTimer(cpu, timer2Config)

    // ADC for analogRead()
    adc = new AVRADC(cpu, adcConfig)

    // UART for Serial.print()
    uart = new AVRUSART(cpu, usart0Config, FREQ_HZ)
    uart.onByteTransmit = (byte: number) => {
      postEvent({ type: "serialOutput", text: String.fromCharCode(byte) })
    }

    attachPinListeners()
    return true
  } catch (err) {
    postEvent({ type: "halted", reason: "error", message: String(err) })
    return false
  }
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

  runLoopHandle = setTimeout(runLoop, 0)
}

// ── Message handler ────────────────────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent<AVRCommand>) => {
  const cmd = e.data

  switch (cmd.type) {
    case "load": {
      isRunning = false
      isPaused = false
      if (runLoopHandle) {
        clearTimeout(runLoopHandle)
        runLoopHandle = null
      }
      cpu = null
      portB = null
      portC = null
      portD = null
      uart = null
      adc = null

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
      if (runLoopHandle) {
        clearTimeout(runLoopHandle)
        runLoopHandle = null
      }
      cpu = null
      portB = null
      portC = null
      portD = null
      uart = null
      adc = null
      postEvent({ type: "stopped" })
      break
    }

    case "pause": {
      isPaused = true
      if (runLoopHandle) {
        clearTimeout(runLoopHandle)
        runLoopHandle = null
      }
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
      if (pp) {
        // bit index within the port (already computed in getPortPin)
        pp.port.setPin(pp.bit, cmd.high)
      }
      break
    }

    case "setADCInput": {
      if (adc) {
        const channel = cmd.pin - 14 // A0=pin14 → channel 0, A5=pin19 → channel 5
        if (channel >= 0 && channel <= 5) {
          const adcValue = Math.max(0, Math.min(1023, cmd.value))
          // AVRADC.channelValues expects voltage (0–5V), convert from 10-bit ADC value
          adc.channelValues[channel] = (adcValue / 1023) * 5.0
        }
      }
      break
    }

    case "sendSerial": {
      if (uart) {
        for (const char of cmd.data) {
          uart.writeByte(char.charCodeAt(0), true)
        }
      }
      break
    }
  }
})

// Signal worker is alive
postEvent({ type: "ready" })
