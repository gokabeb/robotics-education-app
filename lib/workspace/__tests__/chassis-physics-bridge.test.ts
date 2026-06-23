import { describe, it, expect, vi } from "vitest"
import { ChassisPhysicsBridge } from "../chassis-physics-bridge"
import type { RobotProjectComponent } from "../robot-project-store"

function makeComponent(overrides: Partial<RobotProjectComponent>): RobotProjectComponent {
  return { id: "c1", type: "led", name: "LED", x: 0, y: 0, rotation: 0, pin: 2, ...overrides }
}

describe("ChassisPhysicsBridge.handlePinChange", () => {
  it("calls onComponentStateChange with the owning component's id and the new state", () => {
    const onChange = vi.fn()
    const led = makeComponent({ id: "led-1", pin: 2 })
    const bridge = new ChassisPhysicsBridge({ components: [led], onComponentStateChange: onChange })
    bridge.handlePinChange({ pin: 2, high: true, isPWM: false, dutyCycle: 255 })
    expect(onChange).toHaveBeenCalledWith("led-1", true)
  })

  it("does nothing for a pin not owned by any flashed component", () => {
    const onChange = vi.fn()
    const bridge = new ChassisPhysicsBridge({ components: [], onComponentStateChange: onChange })
    bridge.handlePinChange({ pin: 13, high: true, isPWM: false, dutyCycle: 255 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("routes to the correct component when multiple components are flashed", () => {
    const onChange = vi.fn()
    const motor = makeComponent({ id: "motor-1", type: "motor", pin: 3 })
    const led = makeComponent({ id: "led-1", type: "led", pin: 2 })
    const bridge = new ChassisPhysicsBridge({ components: [motor, led], onComponentStateChange: onChange })
    bridge.handlePinChange({ pin: 3, high: false, isPWM: false, dutyCycle: 0 })
    expect(onChange).toHaveBeenCalledWith("motor-1", false)
    expect(onChange).not.toHaveBeenCalledWith("led-1", expect.anything())
  })
})
