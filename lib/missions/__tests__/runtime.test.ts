// lib/missions/__tests__/runtime.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { MissionRuntime } from "../runtime"
import type { Mission, MissionSimSnapshot } from "../types"

function emptySnapshot(overrides: Partial<MissionSimSnapshot> = {}): MissionSimSnapshot {
  return {
    nowMs: 0,
    netlist: { nodes: [], components: [] },
    brightnessMap: {},
    faults: [],
    code: "",
    serialBuffer: "",
    newPinEvents: [],
    newVirtualPresses: [],
    ...overrides,
  }
}

function baseMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "test-mission",
    title: "Test",
    subtitle: "",
    difficulty: 1,
    ageRange: [8, 16],
    estimatedMinutes: 5,
    tags: [],
    layout: { circuit: true, codeEditor: true, serialMonitor: false },
    initial: { circuit: { nodes: [], components: [] }, code: "", lockedComponentIds: [], lockedWireIds: [], virtualInputs: [] },
    palette: [],
    completionCriteria: [],
    passCriteria: "all",
    hints: [],
    narrative: { briefing: "", context: "", successMessage: "" },
    aiMentorConfig: { assistanceLevel: "nudge", neverReveal: [] },
    ...overrides,
  }
}

describe("MissionRuntime — component-present", () => {
  it("is unmet with an empty netlist, met once a matching component exists", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "component-present", componentType: "led", minCount: 1 }],
    })
    const runtime = new MissionRuntime(mission, 0)

    let result = runtime.tick(emptySnapshot())
    expect(result.criteria[0].met).toBe(false)
    expect(result.complete).toBe(false)

    result = runtime.tick(emptySnapshot({
      netlist: { nodes: ["D13", "GND"], components: [
        { id: "led1", type: "led", terminals: { anode: "D13", cathode: "GND" }, params: { color: "red" } },
      ] },
    }))
    expect(result.criteria[0].met).toBe(true)
    expect(result.complete).toBe(true)
  })
})

describe("MissionRuntime — led-lit with sustained duration", () => {
  it("only counts as met once brightness has been sustained for durationMs", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "led-lit", minBrightness: 0.3, durationMs: 1000 }],
    })
    const runtime = new MissionRuntime(mission, 0)
    const litSnapshot = (nowMs: number) => emptySnapshot({
      nowMs,
      netlist: { nodes: [], components: [
        { id: "led1", type: "led", terminals: { anode: "X", cathode: "GND" }, params: { color: "red" } },
      ] },
      brightnessMap: { led1: 0.8 },
    })

    expect(runtime.tick(litSnapshot(0)).criteria[0].met).toBe(false)
    expect(runtime.tick(litSnapshot(500)).criteria[0].met).toBe(false)
    expect(runtime.tick(litSnapshot(1100)).criteria[0].met).toBe(true)
  })

  it("resets the sustain timer if brightness drops below threshold", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "led-lit", minBrightness: 0.3, durationMs: 1000 }],
    })
    const runtime = new MissionRuntime(mission, 0)
    const snap = (nowMs: number, brightness: number) => emptySnapshot({
      nowMs,
      netlist: { nodes: [], components: [
        { id: "led1", type: "led", terminals: { anode: "X", cathode: "GND" }, params: { color: "red" } },
      ] },
      brightnessMap: { led1: brightness },
    })

    runtime.tick(snap(0, 0.8))
    runtime.tick(snap(500, 0.0))   // drops out — resets sustain timer
    expect(runtime.tick(snap(800, 0.8)).criteria[0].met).toBe(false)  // only 300ms sustained
    expect(runtime.tick(snap(1600, 0.8)).criteria[0].met).toBe(true)  // 1100ms sustained
  })
})

describe("MissionRuntime — pin-toggled frequency", () => {
  it("detects a ~1Hz toggle as met for a 0.5-2Hz target range", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "pin-toggled", pin: 13, minFreqHz: 0.5, maxFreqHz: 2, durationMs: 0 }],
    })
    const runtime = new MissionRuntime(mission, 0)

    // Simulate toggles every 500ms (1Hz) for 3 seconds
    let result
    for (let t = 0; t <= 3000; t += 500) {
      result = runtime.tick(emptySnapshot({
        nowMs: t,
        newPinEvents: t > 0 ? [{ pin: 13, high: t % 1000 === 0, timestampMs: t }] : [],
      }))
    }
    expect(result!.criteria[0].met).toBe(true)
  })
})

describe("MissionRuntime — serial-output-contains", () => {
  it("matches a substring in the accumulated serial buffer", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "serial-output-contains", substring: "SOS" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ serialBuffer: "hello\n" })).criteria[0].met).toBe(false)
    expect(runtime.tick(emptySnapshot({ serialBuffer: "hello\nSOS sent\n" })).criteria[0].met).toBe(true)
  })
})

describe("MissionRuntime — code-contains and function-called", () => {
  it("checks a regex pattern against the source code", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "code-contains", pattern: "digitalWrite\\(13" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ code: "void loop() {}" })).criteria[0].met).toBe(false)
    expect(runtime.tick(emptySnapshot({ code: "digitalWrite(13, HIGH);" })).criteria[0].met).toBe(true)
  })

  it("checks for a function call by name", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "function-called", functionName: "millis" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ code: "delay(1000);" })).criteria[0].met).toBe(false)
    expect(runtime.tick(emptySnapshot({ code: "if (millis() - last > 50) {}" })).criteria[0].met).toBe(true)
  })
})

describe("MissionRuntime — virtual-input-pressed", () => {
  it("counts presses across ticks until minPresses is reached", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "virtual-input-pressed", inputId: "btn1", minPresses: 3 }],
    })
    const runtime = new MissionRuntime(mission, 0)
    runtime.tick(emptySnapshot({ newVirtualPresses: ["btn1"] }))
    runtime.tick(emptySnapshot({ newVirtualPresses: ["btn1"] }))
    expect(runtime.tick(emptySnapshot({ newVirtualPresses: [] })).criteria[0].met).toBe(false)
    expect(runtime.tick(emptySnapshot({ newVirtualPresses: ["btn1"] })).criteria[0].met).toBe(true)
  })
})

describe("MissionRuntime — fault-free", () => {
  it("is unmet on any tick with a reported fault", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "fault-free" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot()).criteria[0].met).toBe(true)
    expect(runtime.tick(emptySnapshot({
      faults: [{ severity: "damage", componentId: "led1", message: "x", technical: "x", suggestion: "x" }],
    })).criteria[0].met).toBe(false)
  })
})

describe("MissionRuntime — passCriteria", () => {
  it("'any' completes when at least one criterion is met", () => {
    const mission = baseMission({
      passCriteria: "any",
      completionCriteria: [
        { id: "c1", type: "fault-free" },
        { id: "c2", type: "serial-output-contains", substring: "NEVER" },
      ],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot()).complete).toBe(true)
  })

  it("{ minOf: N } completes once N criteria are met", () => {
    const mission = baseMission({
      passCriteria: { minOf: 1 },
      completionCriteria: [
        { id: "c1", type: "fault-free" },
        { id: "c2", type: "serial-output-contains", substring: "NEVER" },
      ],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot()).complete).toBe(true)
  })
})

describe("MissionRuntime — hints", () => {
  it("surfaces a tier-1 hint once afterSeconds has elapsed without completion", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "serial-output-contains", substring: "NEVER" }],
      hints: [{ id: "h1", afterSeconds: 90, tier: 1, content: "Try wiring pin 13." }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ nowMs: 1000 })).activeHint).toBeNull()
    expect(runtime.tick(emptySnapshot({ nowMs: 91000 })).activeHint?.id).toBe("h1")
  })

  it("does not surface hints once the mission is already complete", () => {
    const mission = baseMission({
      completionCriteria: [{ id: "c1", type: "fault-free" }],
      hints: [{ id: "h1", afterSeconds: 0, tier: 1, content: "x" }],
    })
    const runtime = new MissionRuntime(mission, 0)
    expect(runtime.tick(emptySnapshot({ nowMs: 1000 })).activeHint).toBeNull()
  })
})
