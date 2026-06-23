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
