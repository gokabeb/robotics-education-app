import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

export class Capacitor implements CircuitComponent {
  readonly brightness = 0
  private vPrev = 0  // voltage across capacitor at previous tick

  constructor(
    readonly id: ComponentId,
    private t1: NodeId,
    private t2: NodeId,
    readonly C:  number,  // Farads
    private dt:  number   // seconds per circuit-worker tick
  ) {}

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    const g     = this.C / this.dt
    const iHist = g * this.vPrev
    solver.stampG(G, this.t1, this.t2, g)
    // History current source: iHist flows t2→t1 (charging direction)
    solver.stampI(b, this.t2, this.t1, iHist)
  }

  /** Call after each tick solve to update V_prev for the next tick. */
  updateTick(solution: number[], solver: MNASolver): void {
    const v1 = solver.voltage(solution, this.t1)
    const v2 = solver.voltage(solution, this.t2)
    this.vPrev = v1 - v2
  }

  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null {
    const v1 = solver.voltage(solution, this.t1)
    const v2 = solver.voltage(solution, this.t2)
    if (Math.abs(v1 - v2) > 50) {
      return {
        severity: "damage",
        componentId: this.id,
        message: "Capacitor voltage rating exceeded",
        technical: `Voltage across capacitor is ${Math.abs(v1 - v2).toFixed(1)}V — exceeds 50V rating`,
        suggestion: "Use a capacitor rated for higher voltage"
      }
    }
    return null
  }
}
