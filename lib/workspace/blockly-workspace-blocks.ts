import * as Blockly from "blockly"
import type { RobotProjectStore, RobotProjectComponent } from "./robot-project-store"

// Each block reads live store state through this module-level reference,
// set by registerWorkspaceBlocks() callers before building dropdown options.
// Blockly evaluates FieldDropdown option-generator functions lazily (on
// open), so this only needs to be current at click time, not at block-init time.
let activeStore: RobotProjectStore | null = null

export function setActiveWorkspaceStore(store: RobotProjectStore | null): void {
  activeStore = store
}

function componentOptions(type: RobotProjectComponent["type"]): () => [string, string][] {
  return () => {
    const components = activeStore?.getComponents().filter((c) => c.type === type) ?? []
    if (components.length === 0) return [["(none placed)", "__none__"]]
    return components.map((c) => [c.name, c.id])
  }
}

let registered = false

export function registerWorkspaceBlocks(): void {
  if (registered) return
  registered = true

  Blockly.Blocks["workspace_motor_spin"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("spin motor")
        .appendField(new Blockly.FieldDropdown(componentOptions("motor")), "COMPONENT")
        .appendField(
          new Blockly.FieldDropdown([
            ["forward", "FORWARD"],
            ["backward", "BACKWARD"],
            ["stop", "STOP"],
          ]),
          "DIRECTION"
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#2196F3")
    },
  }

  Blockly.Blocks["workspace_led_set"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("set LED")
        .appendField(new Blockly.FieldDropdown(componentOptions("led")), "COMPONENT")
        .appendField(
          new Blockly.FieldDropdown([
            ["on", "ON"],
            ["off", "OFF"],
          ]),
          "STATE"
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFC107")
    },
  }

  Blockly.Blocks["workspace_button_read"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("button")
        .appendField(new Blockly.FieldDropdown(componentOptions("button")), "COMPONENT")
        .appendField("is pressed")
      this.setOutput(true, "Boolean")
      this.setColour("#9C27B0")
    },
  }

  Blockly.Blocks["workspace_sensor_read"] = {
    init: function (this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("read sensor")
        .appendField(new Blockly.FieldDropdown(componentOptions("sensor")), "COMPONENT")
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }
}
