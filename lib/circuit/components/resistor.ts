import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

const MAX_POWER_W = 0.25

export class Resistor implements CircuitComponent {
  readonly brightness = 0

  constructor(
    readonly id: ComponentId,
    private n1: NodeId,
    private n2: NodeId,
    private R: number
  ) {
    if (R <= 0) throw new Error(`Resistor ${id}: resistance must be positive, got ${R}`)
  }

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    solver.stampG(G, this.n1, this.n2, 1 / this.R)
  }

  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null {
    const V1 = solver.voltage(solution, this.n1)
    const V2 = solver.voltage(solution, this.n2)
    const Vr = V1 - V2
    const P = (Vr * Vr) / this.R
    if (P > MAX_POWER_W * 2) {
      return {
        severity: "damage",
        componentId: this.id,
        message: "Resistor overloaded",
        technical: `Power dissipation ${(P * 1000).toFixed(0)}mW exceeds 1/4W (250mW) rating`,
        suggestion: "Use a higher-wattage resistor or increase the resistance value"
      }
    }
    return null
  }
}
