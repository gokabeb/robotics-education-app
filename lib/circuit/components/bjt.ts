import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { NonlinearCircuitComponent } from "./base-component"

// Shockley parameters for B-E junction
const Is = 1e-14   // saturation current (A)
const N  = 1.0     // ideality factor
const Vt = 0.02585 // thermal voltage at 25°C (V)
const MAX_VBE_STEP = 0.3  // NR damping — max step per iteration (V)
const EXP_CLAMP    = 700  // prevent IEEE 754 overflow in exp()

function beCurrentAt(Vbe: number): number {
  return Is * (Math.exp(Math.min(Vbe / (N * Vt), EXP_CLAMP)) - 1)
}

function beConductanceAt(Vbe: number): number {
  return (Is / (N * Vt)) * Math.exp(Math.min(Vbe / (N * Vt), EXP_CLAMP))
}

export class NpnBJT implements NonlinearCircuitComponent {
  readonly brightness = 0

  private Vbe = 0.0  // current operating-point junction voltage
  private Ibe = 0.0  // current B-E current

  constructor(
    readonly id: ComponentId,
    private base:      NodeId,
    private collector: NodeId,
    private emitter:   NodeId,
    private beta:      number
  ) {}

  /**
   * Stamp linearized Norton equivalents for B-E diode and β*Ibe collector source.
   *
   * B-E junction Norton companion:
   *   Gbe = dIbe/dVbe   (conductance between base and emitter)
   *   Ieq = Ibe - Gbe*Vbe  (companion current source)
   *
   * Collector controlled current source Ic = β*Ibe, modelled as:
   *   Conductance β*Gbe between collector and emitter (Jacobian term)
   *   Current source correction: (β*Ibe - β*Gbe*Vbe) from emitter to collector
   */
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void {
    const Gbe = beConductanceAt(this.Vbe)
    const Ieq = this.Ibe - Gbe * this.Vbe

    // B-E junction
    solver.stampG(G, this.base, this.emitter, Gbe)
    solver.stampI(b, this.base, this.emitter, Ieq)

    // Collector: β*Ibe (Jacobian stamp)
    const Ic      = this.beta * this.Ibe
    const GceJac  = this.beta * Gbe
    const IceCorr = Ic - GceJac * this.Vbe
    solver.stampG(G, this.collector, this.emitter, GceJac)
    solver.stampI(b, this.collector, this.emitter, IceCorr)
  }

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    this.stampLinearized(G, b, solver)
  }

  updateOperatingPoint(solution: number[], solver: MNASolver): boolean {
    const Vb = solver.voltage(solution, this.base)
    const Ve = solver.voltage(solution, this.emitter)
    const Vterminal = Vb - Ve

    const rawDelta = Vterminal - this.Vbe
    const delta    = Math.max(-MAX_VBE_STEP, Math.min(MAX_VBE_STEP, rawDelta))
    const Vbe_new  = this.Vbe + delta

    this.Ibe = beCurrentAt(Vbe_new)
    this.Vbe = Vbe_new

    return Math.abs(delta) > 1e-6
  }

  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null {
    const Vc  = solver.voltage(solution, this.collector)
    const Ve  = solver.voltage(solution, this.emitter)
    const Vce = Vc - Ve
    if (Vce < 0.2 && this.Ibe > 1e-6) {
      return {
        severity: "warning",
        componentId: this.id,
        message: "Transistor saturated",
        technical: `V_CE = ${Vce.toFixed(3)}V (below 0.2V threshold); BJT is in saturation`,
        suggestion: "Reduce base current or increase collector resistance to bring transistor into active region"
      }
    }
    return null
  }
}
