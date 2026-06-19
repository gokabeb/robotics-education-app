// lib/circuit/types.ts

export type NodeId = string   // "GND", "VCC", "D13", "NET_R5L", etc.
export type ComponentId = string

export interface ComponentFault {
  severity: "warning" | "damage" | "destroyed"
  componentId: ComponentId
  message: string
  technical: string
  suggestion: string
}

export type ComponentType = "resistor" | "led" | "voltage-source"

export interface ComponentParams {
  resistance?: number            // Ω — for resistor
  voltage?: number               // V — for voltage-source
  color?: "red" | "green" | "blue" | "white" | "yellow"  // for LED
}

// Serialized form safe for postMessage (no Maps)
export interface SerializedComponent {
  id: ComponentId
  type: ComponentType
  terminals: Record<string, NodeId>  // e.g. { n1: "NET_R5L", n2: "NET_R6L" }
  params: ComponentParams
}

export interface SerializedNetlist {
  /** All non-ground nodes. Ground ("GND") is implicit — do not include it here. */
  nodes: NodeId[]
  components: SerializedComponent[]
}

// ── Circuit Worker Protocol ──────────────────────────────────────────────────

export type CircuitCommand =
  | { type: "setNetlist"; netlist: SerializedNetlist }
  | { type: "setPinVoltage"; nodeId: NodeId; voltage: number }
  | { type: "start" }
  | { type: "stop" }
  | { type: "reset" }

export type CircuitEvent =
  | { type: "ready" }
  | { type: "tick"
      nodeVoltages: Record<NodeId, number>
      faults: ComponentFault[]
      brightnessMap: Record<ComponentId, number>  // 0–1
    }
  | { type: "error"; message: string }

// ── Constants ────────────────────────────────────────────────────────────────

export const GND: NodeId = "GND"
export const VCC: NodeId = "VCC"
export const VCC_VOLTAGE = 5.0  // V
