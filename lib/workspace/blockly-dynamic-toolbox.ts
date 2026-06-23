import { WORKSPACE_COMPONENT_CATALOG, type WorkspaceComponentType } from "./component-types"
import type { RobotProjectStore } from "./robot-project-store"

const BLOCK_TYPE_FOR: Record<WorkspaceComponentType, string> = {
  motor: "workspace_motor_spin",
  led: "workspace_led_set",
  button: "workspace_button_read",
  sensor: "workspace_sensor_read",
}

export interface ToolboxCategory {
  kind: "category"
  name: string
  colour: string
  contents: { kind: "block"; type: string }[]
}

export interface ToolboxDefinition {
  kind: "categoryToolbox"
  contents: ToolboxCategory[]
}

export function buildWorkspaceToolbox(store: RobotProjectStore): ToolboxDefinition {
  const presentTypes = new Set(store.getComponents().map((c) => c.type))
  const contents: ToolboxCategory[] = []

  for (const def of WORKSPACE_COMPONENT_CATALOG) {
    if (!presentTypes.has(def.type)) continue
    contents.push({
      kind: "category",
      name: def.label,
      colour: def.color,
      contents: [{ kind: "block", type: BLOCK_TYPE_FOR[def.type] }],
    })
  }

  return { kind: "categoryToolbox", contents }
}
