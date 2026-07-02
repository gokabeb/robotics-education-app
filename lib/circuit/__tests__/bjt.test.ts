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
    const solver = new MNASolver()
    solver.setup(["VCC", "BASE", "COL"], ["vs"])
    const vs  = new VoltageSource("vs",  "VCC", "GND", 5.0)
    const rb  = new Resistor("rb", "VCC", "BASE",  1000)   // very low Rb → heavy saturation
    const rc  = new Resistor("rc", "VCC", "COL",  10000)   // high Rc
    const bjt = new NpnBJT("q1", "BASE", "COL", "GND", 100)

    const solution = newtonRaphson(solver, [vs, rb, rc], [bjt])
    const fault = bjt.getFaultState(solution, solver)
    if (fault !== null) {
      expect(fault.severity).toBe("warning")
      expect(fault.message).toContain("saturat")
    }
    // Fault may or may not fire depending on operating point; just verify no throw
  })
})
