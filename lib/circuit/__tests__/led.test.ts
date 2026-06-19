import { describe, it, expect } from "vitest"
import { LED } from "../components/led"
import { Resistor } from "../components/resistor"
import { VoltageSource } from "../components/voltage-source"
import { MNASolver } from "../solver/mna-solver"
import { newtonRaphson } from "../solver/newton-raphson"
import { isNonlinear } from "../components/base-component"

function solveLEDCircuit(supplyV: number, seriesR: number) {
  const vs = new VoltageSource("vs_vcc", "VCC", "GND", supplyV)
  const r  = new Resistor("r1", "VCC", "ANODE", seriesR)
  const led = new LED("led1", "ANODE", "GND", "red")

  const solver = new MNASolver()
  solver.setup(["VCC", "ANODE"], [vs.voltageSourceId])

  const solution = newtonRaphson(solver, [vs, r], [led])

  return {
    Vanode: solver.voltage(solution, "ANODE"),
    Ivcc:   solver.current(solution, vs.voltageSourceId),
    led,
    solver,
    solution,
  }
}

describe("LED forward bias — 5V, 220Ω", () => {
  it("converges to forward current ~20mA", () => {
    const { Ivcc } = solveLEDCircuit(5.0, 220)
    expect(Math.abs(Ivcc)).toBeGreaterThan(0.005)
    expect(Math.abs(Ivcc)).toBeLessThan(0.03)
  })

  it("LED anode voltage is between 1.5V and 3.5V (forward bias range)", () => {
    const { Vanode } = solveLEDCircuit(5.0, 220)
    expect(Vanode).toBeGreaterThan(1.5)
    expect(Vanode).toBeLessThan(3.5)
  })

  it("brightness is between 0.1 and 1.0", () => {
    const { led } = solveLEDCircuit(5.0, 220)
    expect(led.brightness).toBeGreaterThan(0.1)
    expect(led.brightness).toBeLessThanOrEqual(1.0)
  })

  it("no fault at 220Ω (safe current)", () => {
    const { led, solution, solver } = solveLEDCircuit(5.0, 220)
    const fault = led.getFaultState(solution, solver)
    expect(fault).toBeNull()
  })
})

describe("LED fault — direct connection (no resistor)", () => {
  it("reports damage fault when current exceeds 20mA", () => {
    const { led, solution, solver } = solveLEDCircuit(5.0, 1)
    const fault = led.getFaultState(solution, solver)
    expect(fault).not.toBeNull()
    expect(fault!.severity).toMatch(/damage|destroyed/)
    expect(fault!.suggestion).toContain("resistor")
  })
})

describe("LED reverse bias", () => {
  it("passes negligible reverse current (< 1µA)", () => {
    const vs = new VoltageSource("vs_vcc", "CATHODE", "GND", 5.0)
    const r  = new Resistor("r1", "CATHODE", "ANODE", 220)
    const led = new LED("led1", "ANODE", "GND", "red")

    const solver = new MNASolver()
    solver.setup(["CATHODE", "ANODE"], [vs.voltageSourceId])

    const solution = newtonRaphson(solver, [vs, r], [led])
    const Ivcc = solver.current(solution, vs.voltageSourceId)
    expect(Math.abs(Ivcc)).toBeLessThan(1e-6)
  })
})

describe("LED isNonlinear type guard", () => {
  it("LED implements NonlinearCircuitComponent", () => {
    const led = new LED("l", "A", "GND", "red")
    expect(isNonlinear(led)).toBe(true)
  })
})
