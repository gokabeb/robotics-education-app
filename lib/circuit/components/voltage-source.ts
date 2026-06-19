import type { MNASolver, VSourceId } from "../solver/mna-solver"
import type { ComponentFault, ComponentId, NodeId } from "../types"
import type { CircuitComponent } from "./base-component"

export class VoltageSource implements CircuitComponent {
  readonly brightness = 0
  private vsId: VSourceId

  constructor(
    readonly id: ComponentId,
    private nPlus: NodeId,
    private nMinus: NodeId,
    public voltage: number
  ) {
    this.vsId = id
  }

  stamp(G: number[][], b: number[], solver: MNASolver): void {
    solver.stampV(G, b, this.nPlus, this.nMinus, this.vsId, this.voltage)
  }

  getFaultState(_solution: number[], _solver: MNASolver): ComponentFault | null {
    return null
  }

  get voltageSourceId(): VSourceId { return this.vsId }
}
