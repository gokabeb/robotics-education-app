// lib/circuit/solver/newton-raphson.ts

import { createMatrix, createVector } from "./matrix"
import { MNASolver } from "./mna-solver"

export interface LinearComponent {
  stamp(G: number[][], b: number[], solver: MNASolver): void
}

export interface NonlinearComponent {
  /** Stamp linearized Norton equivalent at current operating point */
  stampLinearized(G: number[][], b: number[], solver: MNASolver): void
  /**
   * Update operating point from new solution.
   * Returns true if the component's state changed by more than tolerance.
   */
  updateOperatingPoint(solution: number[], solver: MNASolver): boolean
}

/**
 * Run Newton-Raphson until convergence or maxIter.
 * Returns final solution vector [V1..Vn, I1..Im].
 */
export function newtonRaphson(
  solver: MNASolver,
  linear: LinearComponent[],
  nonlinear: NonlinearComponent[],
  maxIter = 50,
  tol = 1e-6
): number[] {
  if (solver.size === 0) return []

  let solution = createVector(solver.size)

  for (let iter = 0; iter < maxIter; iter++) {
    const G = createMatrix(solver.size)
    const b = createVector(solver.size)

    for (const comp of linear)    comp.stamp(G, b, solver)
    for (const comp of nonlinear) comp.stampLinearized(G, b, solver)

    let newSolution: number[]
    try {
      newSolution = solver.solve(G, b)
    } catch {
      // Singular matrix — circuit is disconnected or shorted; return last good solution
      break
    }

    // Check node voltage convergence
    const n = (solver as unknown as { n: number }).n
    let voltageConverged = true
    for (let i = 0; i < n; i++) {
      if (Math.abs((newSolution[i] ?? 0) - (solution[i] ?? 0)) > tol) {
        voltageConverged = false
        break
      }
    }

    solution = newSolution

    let anyChanged = false
    for (const comp of nonlinear) {
      if (comp.updateOperatingPoint(solution, solver)) anyChanged = true
    }

    if (voltageConverged && !anyChanged) break
  }

  return solution
}
