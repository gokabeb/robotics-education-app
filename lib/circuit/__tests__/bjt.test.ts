import { describe, it, expect } from "vitest"
import { NpnBJT } from "../components/bjt"
import { MNASolver } from "../solver/mna-solver"
import { VoltageSource } from "../components/voltage-source"
import { Resistor } from "../components/resistor"
import { newtonRaphson } from "../solver/newton-raphson"
import { isNonlinear } from "../components/base-component"

describe("NpnBJT — identity", () => {
  it("is recognised as nonlinear by isNonlinear()", () => {
    const bjt = new NpnBJT("q1", "B", "C", "E", 100)
    expect(isNonlinear(bjt)).toBe(true)
  })

  it("brightness is always 0", () => {
    expect(new NpnBJT("q1", "B", "C", "E", 100).brightness).toBe(0)
  })
})

describe("NpnBJT — NR convergence (simple switch)", () => {
  // Circuit: 5V → 1kΩ → Collector; Base driven via 47kΩ from 5V; Emitter → GND
  // Expected: BJT conducts, Vce low
  it("converges and collector voltage drops below Vcc when base is driven", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "BASE", "COL"], ["vs"])
    const vs   = new VoltageSource("vs",  "VCC", "GND", 5.0)
    const rb   = new Resistor("rb", "VCC", "BASE", 47000)   // base resistor
    const rc   = new Resistor("rc", "VCC", "COL",   1000)   // collector load
    const bjt  = new NpnBJT("q1", "BASE", "COL", "GND", 100)

    const solution = newtonRaphson(solver, [vs, rb, rc], [bjt])
    const Vcol = solver.voltage(solution, "COL")
    // Transistor conducts → Vcol pulled toward GND
    expect(Vcol).toBeLessThan(4.0)
    expect(Vcol).toBeGreaterThanOrEqual(0)
  })
})

describe("NpnBJT — saturation fault", () => {
  it("getFaultState returns saturation warning when Vce < 0.2V", () => {
    // Rb=1kΩ delivers ~4.3mA base current; β×Ib = 430mA >> Vcc/Rc = 0.5mA → deep saturation
    const solver = new MNASolver()
    solver.setup(["VCC", "BASE", "COL"], ["vs"])
    const vs  = new VoltageSource("vs",  "VCC", "GND", 5.0)
    const rb  = new Resistor("rb", "VCC", "BASE",  1000)   // very low Rb → heavy saturation
    const rc  = new Resistor("rc", "VCC", "COL",  10000)   // high Rc
    const bjt = new NpnBJT("q1", "BASE", "COL", "GND", 100)

    const solution = newtonRaphson(solver, [vs, rb, rc], [bjt])
    const fault = bjt.getFaultState(solution, solver)
    expect(fault).not.toBeNull()
    expect(fault!.severity).toBe("warning")
    expect(fault!.message).toContain("saturat")
  })
})

describe("NpnBJT — IC ≈ β × IBE", () => {
  // Active-region circuit: Rb=47kΩ, Rc=100Ω, Vcc=5V, β=100
  //   Ib ≈ (5−0.6)/47kΩ ≈ 93µA → Ic = 9.3mA < Vcc/Rc = 50mA → active region
  //   Vcol = 5 − 9.3mA×100Ω ≈ 4.07V (Vce ≈ 4.07V >> 0.2V)
  it("collector current is within 10% of β × base current (Shockley)", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "BASE", "COL"], ["vs"])
    const vs  = new VoltageSource("vs",  "VCC", "GND", 5.0)
    const rb  = new Resistor("rb", "VCC", "BASE", 47000)
    const rc  = new Resistor("rc", "VCC", "COL",    100)   // small Rc → active region
    const bjt = new NpnBJT("q1", "BASE", "COL", "GND", 100)

    const solution = newtonRaphson(solver, [vs, rb, rc], [bjt])

    const IS = 1e-14
    const VT = 0.02585
    const beta = 100

    const Vb  = solver.voltage(solution, "BASE")
    const VBE = Vb  // emitter is GND
    const IBE = IS * (Math.exp(VBE / VT) - 1)
    const expectedIc = beta * IBE

    const Vcol    = solver.voltage(solution, "COL")
    const actualIc = (5 - Vcol) / 100

    expect(actualIc).toBeGreaterThan(0)
    expect(Math.abs(actualIc - expectedIc) / expectedIc).toBeLessThan(0.10)
  })
})

describe("NpnBJT — no fault in active region", () => {
  // Same active-region circuit (Rb=47kΩ, Rc=100Ω, Vcc=5V)
  // Vce ≈ 4.07V >> 0.2V → no saturation fault
  it("getFaultState returns null when BJT is in active region (V_CE > 0.2V)", () => {
    const solver = new MNASolver()
    solver.setup(["VCC", "BASE", "COL"], ["vs"])
    const vs  = new VoltageSource("vs",  "VCC", "GND", 5.0)
    const rb  = new Resistor("rb", "VCC", "BASE", 47000)
    const rc  = new Resistor("rc", "VCC", "COL",    100)   // small Rc → active region
    const bjt = new NpnBJT("q1", "BASE", "COL", "GND", 100)

    const solution = newtonRaphson(solver, [vs, rb, rc], [bjt])
    const fault = bjt.getFaultState(solution, solver)
    expect(fault).toBeNull()
  })
})
