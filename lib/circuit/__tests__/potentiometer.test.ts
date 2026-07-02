import { describe, it, expect } from "vitest"
import { Potentiometer } from "../components/potentiometer"
import { MNASolver } from "../solver/mna-solver"
import { VoltageSource } from "../components/voltage-source"
import { newtonRaphson } from "../solver/newton-raphson"
import { createMatrix, createVector } from "../solver/matrix"

describe("Potentiometer — stamp geometry", () => {
  it("at position 0.5: g_top equals g_bot", () => {
    const solver = new MNASolver()
    solver.setup(["T1", "WIPER", "T2"], [])
    const pot = new Potentiometer("p1", "T1", "T2", "WIPER", 10000, 0.5)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    pot.stamp(G, b, solver)
    // g_top = 1/(10000*0.5) = 0.0002; g_bot = same
    const iT1 = solver.ni("T1")
    const iW  = solver.ni("WIPER")
    // G[T1][T1] should be g_top = 0.0002
    expect(G[iT1][iT1]).toBeCloseTo(0.0002, 8)
    expect(G[iW][iW]).toBeCloseTo(0.0004, 8)  // g_top + g_bot
  })

  it("at position 0: wiper is clamped (no divide-by-zero)", () => {
    const solver = new MNASolver()
    solver.setup(["T1", "WIPER", "T2"], [])
    const pot = new Potentiometer("p1", "T1", "T2", "WIPER", 10000, 0)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    expect(() => pot.stamp(G, b, solver)).not.toThrow()
  })
})

describe("Potentiometer — voltage divider integration", () => {
  it("at position 0.5, wiper voltage is 2.5V with 5V supply", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "WIPER"], ["vs"])
    const vs  = new VoltageSource("vs", "VCC", "GND", 5.0)
    const pot = new Potentiometer("p1", "VCC", "GND", "WIPER", 10000, 0.5)
    const solution = newtonRaphson(solver, [vs, pot], [])
    expect(solver.voltage(solution, "WIPER")).toBeCloseTo(2.5, 4)
  })

  it("at position 0.75, wiper voltage is 3.75V with 5V supply", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "WIPER"], ["vs"])
    const vs  = new VoltageSource("vs", "VCC", "GND", 5.0)
    const pot = new Potentiometer("p1", "VCC", "GND", "WIPER", 10000, 0.75)
    const solution = newtonRaphson(solver, [vs, pot], [])
    expect(solver.voltage(solution, "WIPER")).toBeCloseTo(3.75, 4)
  })
})
