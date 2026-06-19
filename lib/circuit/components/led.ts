import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { NonlinearCircuitComponent } from "./base-component"

// Shockley diode model parameters
const Is   = 1e-20  // saturation current (A)
const N    = 2.0    // ideality factor
const Vt   = 0.02585 // thermal voltage at 25°C (V)
const Imax = 0.020  // absolute max forward current (20 mA)

// NR damping: max step in Vd per iteration (prevents exp divergence)
const MAX_VD_STEP = 0.5 // V

// Clamp the exp argument to prevent IEEE 754 Infinity (exp(710) overflows)
const EXP_CLAMP = 700

/** Shockley diode current given junction voltage Vd */
function diodeCurrent(Vd: number): number {
  return Is * (Math.exp(Math.min(Vd / (N * Vt), EXP_CLAMP)) - 1)
}

/** Shockley differential conductance dId/dVd at junction voltage Vd */
function diodeConductance(Vd: number): number {
  return (Is / (N * Vt)) * Math.exp(Math.min(Vd / (N * Vt), EXP_CLAMP))
}

export type LEDColor = "red" | "green" | "blue" | "white" | "yellow"

export class LED implements NonlinearCircuitComponent {
  readonly id: ComponentId

  private anode: NodeId
  private cathode: NodeId
  readonly color: LEDColor

  /** Current junction voltage estimate (operating point) */
  private Vd = 0.0
  /** Diode current at current operating point */
  private Id = 0.0
  /** Whether LED has been burned out */
  private burned = false

  constructor(
    id: ComponentId,
    anode: NodeId,
    cathode: NodeId,
    color: LEDColor
  ) {
    this.id = id
    this.anode = anode
    this.cathode = cathode
    this.color = color
  }

  /**
   * Stamp linearized Norton equivalent for current operating point.
   *
   * Norton companion model of the Shockley diode:
   *   Geq = dId/dVd = Is * exp(Vd/(N*Vt)) / (N*Vt)
   *   Ieq = Id - Geq * Vd   (Norton current source)
   *
   * Stamps G(anode, cathode, Geq) and I(anode→cathode, Ieq)
   */
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void {
    const Geq = diodeConductance(this.Vd)
    const Ieq = this.Id - Geq * this.Vd

    solver.stampG(G, this.anode, this.cathode, Geq)
    solver.stampI(b, this.anode, this.cathode, Ieq)
  }

  /** Delegates to stampLinearized (required by CircuitComponent interface) */
  stamp(G: number[][], b: number[], solver: MNASolver): void {
    this.stampLinearized(G, b, solver)
  }

  /**
   * Update operating point from new solution.
   *
   * Uses terminal voltage (Va - Vc) as the junction voltage proxy,
   * damped by MAX_VD_STEP per NR iteration to prevent divergence.
   *
   * Returns true if Vd changed by more than 1e-6.
   */
  updateOperatingPoint(solution: number[], solver: MNASolver): boolean {
    const Va = solver.voltage(solution, this.anode)
    const Vc = solver.voltage(solution, this.cathode)
    const Vterminal = Va - Vc

    // Clamp the NR step to MAX_VD_STEP
    const rawDelta = Vterminal - this.Vd
    const delta = Math.max(-MAX_VD_STEP, Math.min(MAX_VD_STEP, rawDelta))
    const Vd_new = this.Vd + delta

    this.Id = diodeCurrent(Vd_new)
    this.Vd = Vd_new

    return Math.abs(delta) > 1e-6
  }

  getFaultState(_solution: number[], _solver: MNASolver): ComponentFault | null {
    const Id = this.Id

    if (Id > Imax * 3) {
      this.burned = true
      return {
        severity: "destroyed",
        componentId: this.id,
        message: "LED destroyed by excessive current",
        technical: `Forward current ${(Id * 1000).toFixed(1)}mA far exceeds ${(Imax * 1000).toFixed(0)}mA absolute maximum`,
        suggestion: "Add a current-limiting resistor (e.g. 220Ω) in series with the LED"
      }
    }

    if (Id > Imax * 1.1) {
      return {
        severity: "damage",
        componentId: this.id,
        message: "LED overdriven — damage likely",
        technical: `Forward current ${(Id * 1000).toFixed(1)}mA exceeds ${(Imax * 1000).toFixed(0)}mA maximum`,
        suggestion: "Add a current-limiting resistor (e.g. 220Ω) in series with the LED"
      }
    }

    return null
  }

  /** Brightness 0–1 based on forward current (0 if burned) */
  get brightness(): number {
    if (this.burned) return 0
    return Math.min(1, Math.max(0, this.Id / Imax))
  }
}
