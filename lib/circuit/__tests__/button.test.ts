import { describe, it, expect } from "vitest"
import { Button } from "../components/button"
import { MNASolver } from "../solver/mna-solver"
import { createMatrix, createVector } from "../solver/matrix"

describe("Button — open", () => {
  it("stamps no conductance when open", () => {
    const solver = new MNASolver()
    solver.setup(["A", "B"], [])
    const btn = new Button("b1", "A", "B", false)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    btn.stamp(G, b, solver)
    // G should remain all zeros — no conductance between A and B
    expect(G[0][1]).toBe(0)
    expect(G[1][0]).toBe(0)
    expect(G[0][0]).toBe(0)
  })

  it("getFaultState returns null", () => {
    const solver = new MNASolver()
    solver.setup(["A"], [])
    const btn = new Button("b1", "A", "GND", false)
    expect(btn.getFaultState([], solver)).toBeNull()
  })

  it("brightness is always 0", () => {
    const btn = new Button("b1", "A", "B", true)
    expect(btn.brightness).toBe(0)
  })
})

describe("Button — closed", () => {
  it("stamps 10 S conductance (0.1Ω) when closed", () => {
    const solver = new MNASolver()
    solver.setup(["A", "B"], [])
    const btn = new Button("b1", "A", "B", true)
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)
    btn.stamp(G, b, solver)
    expect(G[0][0]).toBeCloseTo(10, 6)
    expect(G[1][1]).toBeCloseTo(10, 6)
    expect(G[0][1]).toBeCloseTo(-10, 6)
    expect(G[1][0]).toBeCloseTo(-10, 6)
  })
})
