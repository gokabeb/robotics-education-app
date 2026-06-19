import { describe, it, expect } from "vitest"
import { createMatrix, createVector, luFactorize, luSolve } from "../solver/matrix"

describe("createMatrix", () => {
  it("creates n×n zero matrix", () => {
    const M = createMatrix(3)
    expect(M.length).toBe(3)
    expect(M[0].length).toBe(3)
    expect(M[1][2]).toBe(0)
  })
})

describe("luFactorize + luSolve", () => {
  it("solves 2×2 system: 2x + y = 5, x + 3y = 10", () => {
    const A = [[2, 1], [1, 3]]
    const b = [5, 10]
    const piv = luFactorize(A, 2)
    const x = luSolve(A, piv, b)
    expect(x[0]).toBeCloseTo(1, 8)
    expect(x[1]).toBeCloseTo(3, 8)
  })

  it("solves 3×3 system", () => {
    const A = [[1,1,1],[0,2,5],[2,5,-1]]
    const b = [6, -4, 27]
    const piv = luFactorize(A, 3)
    const x = luSolve(A, piv, b)
    expect(x[0]).toBeCloseTo(5, 8)
    expect(x[1]).toBeCloseTo(3, 8)
    expect(x[2]).toBeCloseTo(-2, 8)
  })

  it("handles pivot swap (needs partial pivoting)", () => {
    const A = [[0, 1], [1, 0]]
    const b = [3, 7]
    const piv = luFactorize(A, 2)
    const x = luSolve(A, piv, b)
    expect(x[0]).toBeCloseTo(7, 8)
    expect(x[1]).toBeCloseTo(3, 8)
  })

  it("throws on singular matrix", () => {
    const A = [[1, 2], [2, 4]]
    expect(() => luFactorize(A, 2)).toThrow("Singular")
  })
})
