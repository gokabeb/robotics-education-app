import type { SerializedNetlist, NodeId, ComponentFault } from "@/lib/circuit/types"

export type AssistanceLevel = "full" | "nudge" | "circuit-only" | "disabled"
export type LEDColor = "red" | "green" | "blue" | "white" | "yellow"

/** A button the student clicks on-screen, driving an AVR digital input pin
 *  directly via GPIOBridge.setDigitalInput — stands in for a real circuit
 *  pushbutton component until one exists (Phase 4). */
export interface VirtualInputSpec {
  id: string
  label: string
  pin: number
  simulateBounce?: boolean
}

export interface ComponentSpec {
  type: "resistor" | "led"
  label: string
  params: Record<string, number | string>
  color?: string
}

interface CriterionBase {
  id: string
}

export type CompletionCriterion = CriterionBase & (
  | { type: "component-present"; componentType: "resistor" | "led"; minCount?: number }
  | { type: "component-param"; componentType: "resistor" | "led"; param: string; min: number; max: number }
  | { type: "led-lit"; color?: LEDColor; minBrightness?: number; durationMs?: number }
  | { type: "led-blinking"; color?: LEDColor; minFreqHz: number; maxFreqHz: number; durationMs?: number }
  | { type: "pin-toggled"; pin: number; minFreqHz?: number; maxFreqHz?: number; durationMs?: number }
  | { type: "serial-output-contains"; substring: string; caseSensitive?: boolean }
  | { type: "serial-output-matches"; pattern: string }
  | { type: "code-contains"; pattern: string }
  | { type: "function-called"; functionName: string }
  | { type: "virtual-input-pressed"; inputId: string; minPresses?: number }
  | { type: "fault-free" }
)

export interface Hint {
  id: string
  afterSeconds: number
  unmetCriterionId?: string
  tier: 1 | 2 | 3
  content: string
}

export interface Mission {
  id: string
  title: string
  subtitle: string
  difficulty: 1 | 2 | 3 | 4 | 5
  ageRange: [number, number]
  estimatedMinutes: number
  tags: string[]

  layout: {
    circuit: boolean
    codeEditor: boolean
    serialMonitor: boolean
  }

  initial: {
    circuit: SerializedNetlist
    code: string
    lockedComponentIds: string[]
    lockedWireIds: string[]
    virtualInputs: VirtualInputSpec[]
  }

  palette: ComponentSpec[]

  completionCriteria: CompletionCriterion[]
  passCriteria: "all" | "any" | { minOf: number }

  hints: Hint[]

  narrative: {
    briefing: string
    context: string
    successMessage: string
    failureMessage?: string
  }

  aiMentorConfig: {
    assistanceLevel: AssistanceLevel
    neverReveal: string[]
  }
}

/** One tick of live state, assembled by MissionSandbox from CircuitBridge/
 *  GPIOBridge events, fed into MissionRuntime.tick(). */
export interface MissionSimSnapshot {
  nowMs: number
  netlist: SerializedNetlist
  brightnessMap: Record<string, number>
  faults: ComponentFault[]
  code: string
  serialBuffer: string
  newPinEvents: Array<{ pin: number; high: boolean; timestampMs: number }>
  newVirtualPresses: string[]
}

export interface CriterionStatus {
  id: string
  met: boolean
  label: string
}

export interface MissionTickResult {
  criteria: CriterionStatus[]
  complete: boolean
  activeHint: Hint | null
}
