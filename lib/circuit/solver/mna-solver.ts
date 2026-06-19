import { luFactorize, luSolve } from "./matrix"
import type { NodeId } from "../types"

export type VSourceId = string

/**
 * Assembles and solves the MNA system Gx = b.
 * Node voltages occupy indices 0..n-1 in the solution.
 * Voltage source branch currents occupy indices n..n+m-1.
 * Ground ("GND") is never in the unknowns — its voltage is 0 by definition.
 */
export class MNASolver {
  private n = 0
  private m = 0
  private nodeMap = new Map<NodeId, number>()
  private vsMap   = new Map<VSourceId, number>()

  setup(nodeIds: NodeId[], voltageSourceIds: VSourceId[]): void {
    this.n = nodeIds.length
    this.m = voltageSourceIds.length
    this.nodeMap = new Map(nodeIds.map((id, i) => [id, i]))
    this.vsMap   = new Map(voltageSourceIds.map((id, i) => [id, i]))
  }

  get size(): number { return this.n + this.m }

  ni(nodeId: NodeId): number { return this.nodeMap.get(nodeId) ?? -1 }

  vi(vsId: VSourceId): number {
    const i = this.vsMap.get(vsId)
    return i !== undefined ? this.n + i : -1
  }

  stampG(G: number[][], n1: NodeId, n2: NodeId, g: number): void {
    const i1 = this.ni(n1), i2 = this.ni(n2)
    if (i1 >= 0) G[i1][i1] += g
    if (i2 >= 0) G[i2][i2] += g
    if (i1 >= 0 && i2 >= 0) { G[i1][i2] -= g; G[i2][i1] -= g }
  }

  stampI(b: number[], srcNode: NodeId, dstNode: NodeId, I: number): void {
    const is = this.ni(srcNode), id = this.ni(dstNode)
    if (is >= 0) b[is] -= I
    if (id >= 0) b[id] += I
  }

  stampV(
    G: number[][],
    b: number[],
    nPlus: NodeId,
    nMinus: NodeId,
    vsId: VSourceId,
    V: number
  ): void {
    const ip = this.ni(nPlus), im = this.ni(nMinus), k = this.vi(vsId)
    if (k < 0) return
    if (ip >= 0) { G[ip][k] += 1; G[k][ip] += 1 }
    if (im >= 0) { G[im][k] -= 1; G[k][im] -= 1 }
    b[k] = V
  }

  solve(G: number[][], b: number[]): number[] {
    if (this.size === 0) return []
    const LU = G.map(row => [...row])
    const piv = luFactorize(LU, this.size)
    return luSolve(LU, piv, b)
  }

  voltage(solution: number[], nodeId: NodeId): number {
    const i = this.ni(nodeId)
    return i >= 0 ? (solution[i] ?? 0) : 0
  }

  current(solution: number[], vsId: VSourceId): number {
    const i = this.vi(vsId)
    // The MNA branch variable I_k is the current flowing INTO nPlus from
    // the external circuit (i.e. absorbed by the source). Negate to get
    // the conventional "current delivered by source" (flowing out of +).
    return i >= 0 ? -(solution[i] ?? 0) : 0
  }
}
