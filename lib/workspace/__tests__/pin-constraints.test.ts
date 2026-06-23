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
