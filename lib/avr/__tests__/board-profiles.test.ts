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
