// lib/missions/__tests__/seed.test.ts
import { describe, it, expect } from "vitest"
import { getAllMissions, getMissionById } from "../seed"

describe("mission seed registry", () => {
  it("loads exactly 6 missions with unique ids", () => {
    const missions = getAllMissions()
    expect(missions).toHaveLength(6)
    const ids = missions.map(m => m.id)
    expect(new Set(ids).size).toBe(6)
  })

  it("every mission has at least one completion criterion and passCriteria 'all'", () => {
    for (const mission of getAllMissions()) {
      expect(mission.completionCriteria.length).toBeGreaterThan(0)
      expect(mission.passCriteria).toBe("all")
    }
  })

  it("every mission has unique criterion ids", () => {
    for (const mission of getAllMissions()) {
      const ids = mission.completionCriteria.map(c => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("every hint's unmetCriterionId (if set) references a real criterion", () => {
    for (const mission of getAllMissions()) {
      const criterionIds = new Set(mission.completionCriteria.map(c => c.id))
      for (const hint of mission.hints) {
        if (hint.unmetCriterionId) {
          expect(criterionIds.has(hint.unmetCriterionId)).toBe(true)
        }
      }
    }
  })

  it("getMissionById finds a known mission and returns null for unknown ids", () => {
    expect(getMissionById("blink-led")?.title).toBe("Make an LED Blink")
    expect(getMissionById("does-not-exist")).toBeNull()
  })
})
