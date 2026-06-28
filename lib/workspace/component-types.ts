import type { PinKind } from "./pin-constraints"

export type WorkspaceComponentType = "motor" | "led" | "button" | "sensor" | "servo"

export interface WorkspaceComponentDef {
  type: WorkspaceComponentType
  label: string
  pinKind: PinKind
  width: number
  height: number
  color: string
}

export const WORKSPACE_COMPONENT_CATALOG: WorkspaceComponentDef[] = [
  { type: "motor",  label: "Motor",        pinKind: "pwm",     width: 60, height: 40, color: "#2196F3" },
  { type: "servo",  label: "Servo",        pinKind: "pwm",     width: 40, height: 40, color: "#FF5722" },
  { type: "led",    label: "LED",          pinKind: "digital", width: 24, height: 24, color: "#FFC107" },
  { type: "button", label: "Button",       pinKind: "digital", width: 30, height: 30, color: "#9C27B0" },
  { type: "sensor", label: "Light Sensor", pinKind: "analog",  width: 30, height: 30, color: "#4CAF50" },
]

export function getComponentDef(type: WorkspaceComponentType): WorkspaceComponentDef {
  const def = WORKSPACE_COMPONENT_CATALOG.find((d) => d.type === type)
  if (!def) throw new Error(`Unknown workspace component type: ${type}`)
  return def
}
