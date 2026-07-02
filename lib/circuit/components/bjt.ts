import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { NonlinearCircuitComponent } from "./base-component"

// Shockley parameters for B-E junction
const Is = 1e-14   // saturation current (A)
const N  = 1.0     // ideality factor
const Vt = 0.02585 // thermal voltage at 25°C (V)
const MAX_VBE_STEP = 0.3  // NR damping — max step per iteration (V)
const EXP_CLAMP    = 700  // prevent IEEE 754 overflow in exp()

// Saturation model constants
const VCE_SAT   = 0.1    // collector-emitter saturation voltage (V)
const G_SAT_INV = 0.001  // saturation model source resistance (Ω) — stiff clamp

function beCurrentAt(Vbe: number): number {
  return Is * (Math.exp(Math.min(Vbe / (N * Vt), EXP_CLAMP)) - 1)
}

function beConductanceAt(Vbe: number): number {
  return (Is / (N * Vt)) * Math.exp(Math.min(Vbe / (N * Vt), EXP_CLAMP))
}

export class NpnBJT implements NonlinearCircuitComponent {
  readonly brightness = 0

  private Vbe = 0.0  // current operating-point B-E junction voltage
  private Vbc = 0.0  // current operating-point B-C junction voltage (Vb − Vc)
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
   * Active region — collector controlled current source Ic = β*Ibe, modelled as:
   *   Transconductance Gm = β*Gbe stamped G[collector][base] (VCCS, not self-conductance)
   *   Current source correction: (β*Ibe - β*Gbe*Vbe) from collector to emitter (NPN: collector sinks current)
   *
   * Saturation (Vbc > 0) — Vce clamped to VCE_SAT via Norton companion:
   *   Large conductance between collector and emitter
   *   Current source forcing Vce ≈ VCE_SAT
   */
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void {
    const Gbe = beConductanceAt(this.Vbe)
    const Ieq = this.Ibe - Gbe * this.Vbe

    // B-E junction
    solver.stampG(G, this.base, this.emitter, Gbe)
    solver.stampI(b, this.base, this.emitter, Ieq)

    if (this.Vbc <= 0) {
      // Active region: stamp collector VCCS (transconductance from Vbe, not Vce)
      const Ic      = this.beta * this.Ibe
      const Gm      = this.beta * Gbe               // transconductance dIc/dVbe
      const IceCorr = Ic - Gm * this.Vbe            // Norton correction at operating point

      // VCCS stamp: G[collector][base] ± Gm  (non-symmetric — intentional)
      const icol  = solver.ni(this.collector)
      const ibase = solver.ni(this.base)
      const iemit = solver.ni(this.emitter)
      if (icol >= 0) {
        if (ibase >= 0) G[icol][ibase] += Gm
        if (iemit >= 0) G[icol][iemit] -= Gm
      }
      if (iemit >= 0) {
        if (ibase >= 0) G[iemit][ibase] -= Gm
        if (iemit >= 0) G[iemit][iemit] += Gm
      }
      solver.stampI(b, this.collector, this.emitter, IceCorr)

    } else {
      // Saturation: clamp Vce ≈ VCE_SAT with stiff Norton companion
      const GceSat = 1.0 / G_SAT_INV
      solver.stampG(G, this.collector, this.emitter, GceSat)
      solver.stampI(b, this.emitter, this.collector, GceSat * VCE_SAT)
    }
  }

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    this.stampLinearized(G, b, solver)
  }

  updateOperatingPoint(solution: number[], solver: MNASolver): boolean {
    const Vb = solver.voltage(solution, this.base)
    const Vc = solver.voltage(solution, this.collector)
    const Ve = solver.voltage(solution, this.emitter)

    // Update Vbe with NR damping
    const Vterminal = Vb - Ve
    const rawDelta  = Vterminal - this.Vbe
    const delta     = Math.max(-MAX_VBE_STEP, Math.min(MAX_VBE_STEP, rawDelta))
    const Vbe_new   = this.Vbe + delta

    this.Ibe = beCurrentAt(Vbe_new)
    this.Vbe = Vbe_new

    // Update Vbc (detects saturation onset; no exponential sensitivity so no clamping needed)
    const Vbc_new    = Vb - Vc
    const vbc_change = Math.abs(Vbc_new - this.Vbc) > 1e-4
    this.Vbc         = Vbc_new

    return Math.abs(delta) > 1e-6 || vbc_change
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
