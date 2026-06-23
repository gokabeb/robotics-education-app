import * as Blockly from "blockly"
import { Order } from "blockly/javascript"
import type { RobotProjectComponent } from "./robot-project-store"
import type { RobotProjectStore } from "./robot-project-store"

const workspaceGenerator = new Blockly.Generator("WorkspaceArduino")
workspaceGenerator.ORDER_ATOMIC = Order.ATOMIC
workspaceGenerator.ORDER_NONE = Order.NONE
workspaceGenerator.scrub_ = function (block, code, thisOnly) {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock()
  if (nextBlock && !thisOnly) return code + workspaceGenerator.blockToCode(nextBlock)
  return code
}

function pinConstantName(component: RobotProjectComponent): string {
  return `${component.name.replace(/\s+/g, "")}${component.id.replace(/-/g, "_")}Pin`
}

function findComponent(store: RobotProjectStore, id: string): RobotProjectComponent | undefined {
  return store.getComponents().find((c) => c.id === id)
}

workspaceGenerator.forBlock["workspace_motor_spin"] = function (block: Blockly.Block) {
  const componentId = block.getFieldValue("COMPONENT")
  const direction = block.getFieldValue("DIRECTION")
  const store = (workspaceGenerator as unknown as { __store: RobotProjectStore }).__store
  const component = findComponent(store, componentId)
  if (!component) return ""
  const pinName = pinConstantName(component)
  if (direction === "STOP") return `digitalWrite(${pinName}, LOW);\n`
  return `digitalWrite(${pinName}, HIGH); // ${direction.toLowerCase()}\n`
}

workspaceGenerator.forBlock["workspace_led_set"] = function (block: Blockly.Block) {
  const componentId = block.getFieldValue("COMPONENT")
  const state = block.getFieldValue("STATE")
  const store = (workspaceGenerator as unknown as { __store: RobotProjectStore }).__store
  const component = findComponent(store, componentId)
  if (!component) return ""
  const pinName = pinConstantName(component)
  return `digitalWrite(${pinName}, ${state === "ON" ? "HIGH" : "LOW"});\n`
}

workspaceGenerator.forBlock["workspace_button_read"] = function (block: Blockly.Block) {
  const componentId = block.getFieldValue("COMPONENT")
  const store = (workspaceGenerator as unknown as { __store: RobotProjectStore }).__store
  const component = findComponent(store, componentId)
  if (!component) return ["LOW", Order.ATOMIC]
  return [`digitalRead(${pinConstantName(component)})`, Order.ATOMIC]
}

workspaceGenerator.forBlock["workspace_sensor_read"] = function (block: Blockly.Block) {
  const componentId = block.getFieldValue("COMPONENT")
  const store = (workspaceGenerator as unknown as { __store: RobotProjectStore }).__store
  const component = findComponent(store, componentId)
  if (!component) return ["0", Order.ATOMIC]
  return [`analogRead(${pinConstantName(component)})`, Order.ATOMIC]
}

export function generateWorkspaceArduinoCode(workspace: Blockly.Workspace, store: RobotProjectStore): string {
  // forBlock implementations above read the store off this hidden field
  // rather than a generator-constructor argument, because Blockly.Generator's
  // forBlock signature is fixed to (block) => string by the library.
  ;(workspaceGenerator as unknown as { __store: RobotProjectStore }).__store = store

  const userCode = workspaceGenerator.workspaceToCode(workspace)
  const components = store.getComponents()

  const defines = components
    .filter((c) => c.pin !== null)
    .map((c) => `#define ${pinConstantName(c)} ${c.pin}`)
    .join("\n")

  const pinModes = components
    .filter((c) => c.pin !== null)
    .map((c) => `  pinMode(${pinConstantName(c)}, ${c.type === "button" || c.type === "sensor" ? "INPUT" : "OUTPUT"});`)
    .join("\n")

  return `${defines}

void setup() {
${pinModes}
}

void loop() {
  ${userCode}
}
`
}
