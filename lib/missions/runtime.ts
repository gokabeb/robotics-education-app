// lib/missions/runtime.ts
//
// Pure, framework-free criteria evaluator. Ticked by MissionSandbox with a
// MissionSimSnapshot assembled from CircuitBridge/GPIOBridge event streams.
// Holds no DOM/worker references — fully unit-testable in isolation.

import type {
  Mission, CompletionCriterion, MissionSimSnapshot, MissionTickResult,
  CriterionStatus, Hint,
} from "./types"

const PIN_TOGGLE_WINDOW_MS = 5000

export class MissionRuntime {
  private mission: Mission
  private startedAtMs: number

  private pinToggleHistory = new Map<number, number[]>()       // pin -> recent toggle timestamps
  private virtualPressCounts = new Map<string, number>()       // inputId -> count
  private criterionMetSinceMs = new Map<string, number>()      // criterion id -> first-met timestamp
  private hintsShown = new Set<string>()
  private latchedCriteria = new Set<string>()                  // led-lit criteria that have ever been satisfied

  constructor(mission: Mission, nowMs: number) {
    this.mission = mission
    this.startedAtMs = nowMs
  }

  getStartedAtMs(): number {
    return this.startedAtMs
  }

  getHintsUsedCount(): number {
    return this.hintsShown.size
  }

  tick(snapshot: MissionSimSnapshot): MissionTickResult {
    this.recordPinEvents(snapshot)
    this.recordVirtualPresses(snapshot)

    const criteria: CriterionStatus[] = this.mission.completionCriteria.map(c =>
      this.evaluateWithSustain(c, snapshot)
    )

    const complete = this.isPassing(criteria)
    const activeHint = complete ? null : this.computeActiveHint(snapshot.nowMs, criteria)

    return { criteria, complete, activeHint }
  }

  private recordPinEvents(snapshot: MissionSimSnapshot): void {
    for (const ev of snapshot.newPinEvents) {
      const hist = this.pinToggleHistory.get(ev.pin) ?? []
      hist.push(ev.timestampMs)
      while (hist.length > 0 && ev.timestampMs - hist[0] > PIN_TOGGLE_WINDOW_MS) hist.shift()
      this.pinToggleHistory.set(ev.pin, hist)
    }
  }

  private recordVirtualPresses(snapshot: MissionSimSnapshot): void {
    for (const inputId of snapshot.newVirtualPresses) {
      this.virtualPressCounts.set(inputId, (this.virtualPressCounts.get(inputId) ?? 0) + 1)
    }
  }

  private evaluateWithSustain(c: CompletionCriterion, s: MissionSimSnapshot): CriterionStatus {
    if (this.latchedCriteria.has(c.id)) {
      return { id: c.id, met: true, label: describeCriterion(c) }
    }

    const instantMet = this.evaluateInstant(c, s)
    const durationMs = "durationMs" in c ? c.durationMs ?? 0 : 0

    if (!instantMet) {
      this.criterionMetSinceMs.set(c.id, s.nowMs)
      return { id: c.id, met: false, label: describeCriterion(c) }
    }

    if (!this.criterionMetSinceMs.has(c.id)) {
      this.criterionMetSinceMs.set(c.id, s.nowMs)
    }
    const metSince = this.criterionMetSinceMs.get(c.id)!
    const sustained = s.nowMs - metSince >= durationMs

    if (sustained && c.type === "led-lit") {
      this.latchedCriteria.add(c.id)
    }

    return { id: c.id, met: sustained, label: describeCriterion(c) }
  }

  private evaluateInstant(c: CompletionCriterion, s: MissionSimSnapshot): boolean {
    switch (c.type) {
      case "component-present": {
        const count = s.netlist.components.filter(comp => comp.type === c.componentType).length
        return count >= (c.minCount ?? 1)
      }
      case "component-param": {
        const comp = s.netlist.components.find(comp => comp.type === c.componentType)
        if (!comp) return false
        const val = (comp.params as Record<string, unknown>)[c.param]
        return typeof val === "number" && val >= c.min && val <= c.max
      }
      case "led-lit": {
        const led = s.netlist.components.find(comp =>
          comp.type === "led" && (!c.color || comp.params.color === c.color)
        )
        if (!led) return false
        const brightness = s.brightnessMap[led.id] ?? 0
        return brightness >= (c.minBrightness ?? 0.3)
      }
      case "led-blinking": {
        return this.evaluateLedBlinking(c, s)
      }
      case "pin-toggled": {
        const hist = this.pinToggleHistory.get(c.pin) ?? []
        if (hist.length < 2) return false
        const windowSeconds = (hist[hist.length - 1] - hist[0]) / 1000
        if (windowSeconds <= 0) return false
        const freqHz = (hist.length - 1) / 2 / windowSeconds
        const minOk = c.minFreqHz === undefined || freqHz >= c.minFreqHz
        const maxOk = c.maxFreqHz === undefined || freqHz <= c.maxFreqHz
        return minOk && maxOk
      }
      case "serial-output-contains": {
        const haystack = c.caseSensitive ? s.serialBuffer : s.serialBuffer.toLowerCase()
        const needle = c.caseSensitive ? c.substring : c.substring.toLowerCase()
        return haystack.includes(needle)
      }
      case "serial-output-matches": {
        return new RegExp(c.pattern).test(s.serialBuffer)
      }
      case "code-contains": {
        return new RegExp(c.pattern).test(s.code)
      }
      case "function-called": {
        return new RegExp(`${escapeRegExp(c.functionName)}\\s*\\(`).test(s.code)
      }
      case "virtual-input-pressed": {
        const count = this.virtualPressCounts.get(c.inputId) ?? 0
        return count >= (c.minPresses ?? 1)
      }
      case "fault-free": {
        return s.faults.length === 0
      }
    }
  }

  // Tracks brightness lit/unlit transitions per matching LED to estimate a
  // blink frequency, mirroring the pin-toggled sliding-window approach.
  private ledBlinkHistory = new Map<string, { lastLit: boolean; transitions: number[] }>()

  private evaluateLedBlinking(
    c: Extract<CompletionCriterion, { type: "led-blinking" }>,
    s: MissionSimSnapshot
  ): boolean {
    const led = s.netlist.components.find(comp =>
      comp.type === "led" && (!c.color || comp.params.color === c.color)
    )
    if (!led) return false

    const isLit = (s.brightnessMap[led.id] ?? 0) >= 0.3
    const key = led.id
    const state = this.ledBlinkHistory.get(key) ?? { lastLit: isLit, transitions: [] }

    if (isLit !== state.lastLit) {
      state.transitions.push(s.nowMs)
      while (state.transitions.length > 0 && s.nowMs - state.transitions[0] > PIN_TOGGLE_WINDOW_MS) {
        state.transitions.shift()
      }
    }
    state.lastLit = isLit
    this.ledBlinkHistory.set(key, state)

    if (state.transitions.length < 2) return false
    const windowSeconds = (state.transitions[state.transitions.length - 1] - state.transitions[0]) / 1000
    if (windowSeconds <= 0) return false
    const freqHz = (state.transitions.length - 1) / 2 / windowSeconds
    return freqHz >= c.minFreqHz && freqHz <= c.maxFreqHz
  }

  private isPassing(statuses: CriterionStatus[]): boolean {
    const pass = this.mission.passCriteria
    if (pass === "all") return statuses.length > 0 && statuses.every(s => s.met)
    if (pass === "any") return statuses.some(s => s.met)
    return statuses.filter(s => s.met).length >= pass.minOf
  }

  private computeActiveHint(nowMs: number, criteria: CriterionStatus[]): Hint | null {
    const elapsedSeconds = (nowMs - this.startedAtMs) / 1000
    const unmetIds = new Set(criteria.filter(c => !c.met).map(c => c.id))

    let best: Hint | null = null
    for (const hint of this.mission.hints) {
      if (elapsedSeconds < hint.afterSeconds) continue
      if (hint.unmetCriterionId && !unmetIds.has(hint.unmetCriterionId)) continue
      this.hintsShown.add(hint.id)
      if (!best || hint.tier > best.tier) best = hint
    }
    return best
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function describeCriterion(c: CompletionCriterion): string {
  switch (c.type) {
    case "component-present": return `Place ${c.minCount ?? 1}+ ${c.componentType}`
    case "component-param": return `Set ${c.componentType} ${c.param} between ${c.min} and ${c.max}`
    case "led-lit": return `Light up the ${c.color ?? ""} LED`.trim()
    case "led-blinking": return `Blink the ${c.color ?? ""} LED`.trim()
    case "pin-toggled": return `Toggle pin ${c.pin}`
    case "serial-output-contains": return `Print "${c.substring}" to Serial`
    case "serial-output-matches": return `Match Serial output to /${c.pattern}/`
    case "code-contains": return `Use the pattern: ${c.pattern}`
    case "function-called": return `Call ${c.functionName}()`
    case "virtual-input-pressed": return `Press the button ${c.minPresses ?? 1}+ times`
    case "fault-free": return "Avoid circuit faults"
  }
}
