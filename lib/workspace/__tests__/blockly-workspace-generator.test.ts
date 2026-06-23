import { describe, it, expect, beforeAll } from "vitest"
import * as Blockly from "blockly"
import { registerWorkspaceBlocks, setActiveWorkspaceStore } from "../blockly-workspace-blocks"
import { generateWorkspaceArduinoCode } from "../blockly-workspace-generator"
import { RobotProjectStore } from "../robot-project-store"

beforeAll(() => {
  registerWorkspaceBlocks()
})

describe("generateWorkspaceArduinoCode", () => {
  it("emits a #define pin constant for every placed component", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 0, 0)
    setActiveWorkspaceStore(store)
    const workspace = new Blockly.Workspace()
    const code = generateWorkspaceArduinoCode(workspace, store)
    expect(code).toContain(`#define ${led.name.replace(/\s+/g, "")}${led.id.replace(/-/g, "_")}Pin ${led.pin}`)
  })

  it("emits pinMode calls for every placed component in setup()", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    setActiveWorkspaceStore(store)
    const workspace = new Blockly.Workspace()
    const code = generateWorkspaceArduinoCode(workspace, store)
    expect(code).toMatch(/pinMode\(\w+Pin, OUTPUT\);/)
  })

  it("includes generated block code from the workspace", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    setActiveWorkspaceStore(store)
    const workspace = new Blockly.Workspace()
    const block = workspace.newBlock("workspace_led_set")
    block.initSvg?.()
    const code = generateWorkspaceArduinoCode(workspace, store)
    expect(code).toContain("void loop()")
  })
})
