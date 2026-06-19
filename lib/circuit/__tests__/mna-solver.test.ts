import { describe, it, expect } from "vitest"
import { MNASolver } from "../solver/mna-solver"
import { createMatrix, createVector } from "../solver/matrix"

describe("MNASolver — voltage divider", () => {
  it("5V → 1kΩ → 1kΩ → GND gives Vmid = 2.5V", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "MID"], ["vs_vcc"])

    const G = createMatrix(solver.size)
    const b = createVector(solver.size)

    solver.stampV(G, b, "VCC", "GND", "vs_vcc", 5.0)
    solver.stampG(G, "VCC", "MID", 1 / 1000)
    solver.stampG(G, "MID", "GND", 1 / 1000)

    const x = solver.solve(G, b)

    expect(solver.voltage(x, "VCC")).toBeCloseTo(5.0, 6)
    expect(solver.voltage(x, "MID")).toBeCloseTo(2.5, 6)
    expect(solver.current(x, "vs_vcc")).toBeCloseTo(0.0025, 6)
  })
})

describe("MNASolver — single resistor", () => {
  it("5V → 100Ω → GND gives I = 50mA", () => {
    const solver = new MNASolver()
    solver.setup(["VCC"], ["vs_vcc"])

    const G = createMatrix(solver.size)
    const b = createVector(solver.size)

    solver.stampV(G, b, "VCC", "GND", "vs_vcc", 5.0)
    solver.stampG(G, "VCC", "GND", 1 / 100)

    const x = solver.solve(G, b)

    expect(solver.voltage(x, "VCC")).toBeCloseTo(5.0, 6)
    expect(solver.current(x, "vs_vcc")).toBeCloseTo(0.05, 6)
  })
})

describe("MNASolver — stampI", () => {
  it("1mA current source into 1kΩ to GND gives V = 1V", () => {
    const solver = new MNASolver()
    solver.setup(["NET1"], [])

    const G = createMatrix(solver.size)
    const b = createVector(solver.size)

    solver.stampI(b, "GND", "NET1", 0.001)
    solver.stampG(G, "NET1", "GND", 1 / 1000)

    const x = solver.solve(G, b)
    expect(solver.voltage(x, "NET1")).toBeCloseTo(1.0, 6)
  })
})
