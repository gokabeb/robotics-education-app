import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

const MIN_POS = 0.001  // clamp to prevent divide-by-zero at position 0 or 1

export class Potentiometer implements CircuitComponent {
  readonly brightness = 0

  constructor(
    readonly id: ComponentId,
    private t1:     NodeId,  // VCC end
    private t2:     NodeId,  // GND end
    private wiper:  NodeId,
    private R:      number,
    private position: number  // 0.0–1.0
  ) {}

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    const pos  = Math.max(MIN_POS, Math.min(1 - MIN_POS, this.position))
    const gTop = 1 / (this.R * (1 - pos))
    const gBot = 1 / (this.R * pos)
    solver.stampG(G, this.t1, this.wiper, gTop)
    solver.stampG(G, this.wiper, this.t2, gBot)
  }

  getFaultState(_solution: number[], _solver: MNASolver): ComponentFault | null {
    return null
  }
}
