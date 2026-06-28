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
