import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

const CLOSED_CONDUCTANCE = 10  // 1 / 0.1 Ω

export class Button implements CircuitComponent {
  readonly brightness = 0

  constructor(
    readonly id: ComponentId,
    private t1: NodeId,
    private t2: NodeId,
    private closed: boolean
  ) {}

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    if (this.closed) solver.stampG(G, this.t1, this.t2, CLOSED_CONDUCTANCE)
    // open: stamp nothing — infinite resistance
  }

  getFaultState(_solution: number[], _solver: MNASolver): ComponentFault | null {
    return null
  }
}
