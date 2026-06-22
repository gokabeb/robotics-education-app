import { describe, it, expect } from "vitest"
import { computeScore } from "../scoring"

describe("computeScore", () => {
  it("returns 100 for a no-hint, on-time completion", () => {
    expect(computeScore({ hintsUsed: 0, timeSeconds: 300, estimatedMinutes: 10 })).toBe(100)
  })

  it("deducts 10 points per hint used", () => {
    expect(computeScore({ hintsUsed: 2, timeSeconds: 300, estimatedMinutes: 10 })).toBe(80)
  })

  it("deducts up to 20 points for taking 2x the estimated time", () => {
    // estimated = 600s; took 1200s = 2x → full 20-point time penalty
    const score = computeScore({ hintsUsed: 0, timeSeconds: 1200, estimatedMinutes: 10 })
    expect(score).toBe(80)
  })

  it("never drops below 0", () => {
    expect(computeScore({ hintsUsed: 20, timeSeconds: 100000, estimatedMinutes: 1 })).toBe(0)
  })

  it("never exceeds 100", () => {
    expect(computeScore({ hintsUsed: 0, timeSeconds: 1, estimatedMinutes: 10 })).toBe(100)
  })
})
