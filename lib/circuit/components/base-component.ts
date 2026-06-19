import type { MNASolver } from "../solver/mna-solver"
import type { ComponentFault, ComponentId } from "../types"

export interface CircuitComponent {
  readonly id: ComponentId
  stamp(G: number[][], b: number[], solver: MNASolver): void
  getFaultState(solution: number[], solver: MNASolver): ComponentFault | null
  readonly brightness: number
}

export interface NonlinearCircuitComponent extends CircuitComponent {
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void
  updateOperatingPoint(solution: number[], solver: MNASolver): boolean
}

export function isNonlinear(c: CircuitComponent): c is NonlinearCircuitComponent {
  return "stampLinearized" in c && "updateOperatingPoint" in c
}
