import { describe, it, expect } from "vitest"
import { Capacitor } from "../components/capacitor"
import { MNASolver } from "../solver/mna-solver"
import { VoltageSource } from "../components/voltage-source"
import { newtonRaphson } from "../solver/newton-raphson"
import { createMatrix, createVector } from "../solver/matrix"

describe("Capacitor — companion model", () => {
  it("initial V_prev is 0 — stamps companion conductance g = C/dt", () => {
    const C = 0.0001  // 100µF
    const dt = 0.001  // 1ms
    const solver = new MNASolver()
    solver.setup(["A", "B"], [])
    const cap = new Capacitor("c1", "A", "B", C, dt)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    cap.stamp(G, b, solver)
    const g = C / dt  // 0.1 S
    const iA = solver.ni("A")
    expect(G[iA][iA]).toBeCloseTo(g, 8)
    // history current source is 0 at t=0 (V_prev = 0)
    expect(b[iA]).toBeCloseTo(0, 8)
  })

  it("charging toward VCC: voltage increases each tick", () => {
    const C  = 0.0001  // 100µF
    const dt = 0.001   // 1ms — τ = RC = 1000 * 100e-6 = 0.1s
    const R  = 1000    // 1kΩ
    const solver = new MNASolver()
    solver.setup(["VCC", "MID"], ["vs"])
    const vs  = new VoltageSource("vs", "VCC", "GND", 5.0)
    const res = { stamp: (G: number[][], _b: number[], s: MNASolver) => s.stampG(G, "VCC", "MID", 1 / R) }
    const cap = new Capacitor("c1", "MID", "GND", C, dt)

    let prevV = 0
    for (let i = 0; i < 10; i++) {
      const solution = newtonRaphson(solver, [vs, res as never, cap], [])
      const v = solver.voltage(solution, "MID")
      expect(v).toBeGreaterThan(prevV)
      prevV = v
      cap.updateTick(solution, solver)
    }
    // After 10 ticks (10ms), should be charged somewhat (not yet at VCC)
    expect(prevV).toBeGreaterThan(0)
    expect(prevV).toBeLessThan(5.0)
  })

  it("getFaultState returns null below 50V", () => {
    const solver = new MNASolver()
    solver.setup(["A"], ["vs"])
    const cap = new Capacitor("c1", "A", "GND", 0.0001, 0.001)
    expect(cap.getFaultState([5.0, 0], solver)).toBeNull()
  })
})
