import { describe, it, expect, beforeAll } from "vitest"
import * as Blockly from "blockly"
import { registerWorkspaceBlocks } from "../blockly-workspace-blocks"
import { buildWorkspaceToolbox } from "../blockly-dynamic-toolbox"
import { RobotProjectStore } from "../robot-project-store"

beforeAll(() => {
  registerWorkspaceBlocks()
})

describe("registerWorkspaceBlocks", () => {
  it("registers the four workspace block types", () => {
    expect(Blockly.Blocks["workspace_motor_spin"]).toBeDefined()
    expect(Blockly.Blocks["workspace_led_set"]).toBeDefined()
    expect(Blockly.Blocks["workspace_button_read"]).toBeDefined()
    expect(Blockly.Blocks["workspace_sensor_read"]).toBeDefined()
  })

  it("is idempotent when called twice", () => {
    expect(() => registerWorkspaceBlocks()).not.toThrow()
  })
})

describe("buildWorkspaceToolbox", () => {
  it("returns no categories for an empty store", () => {
    const store = new RobotProjectStore()
    const toolbox = buildWorkspaceToolbox(store)
    expect(toolbox.contents).toHaveLength(0)
  })

  it("returns one category per distinct placed component type", () => {
    const store = new RobotProjectStore()
    store.addComponent("motor", 0, 0)
    store.addComponent("led", 0, 0)
    store.addComponent("motor", 10, 10) // second motor: same type, no new category
    const toolbox = buildWorkspaceToolbox(store)
    expect(toolbox.contents).toHaveLength(2)
    const blockTypes = toolbox.contents.flatMap((cat: { contents: { type: string }[] }) =>
      cat.contents.map((b) => b.type)
    )
    expect(blockTypes).toContain("workspace_motor_spin")
    expect(blockTypes).toContain("workspace_led_set")
  })
})
