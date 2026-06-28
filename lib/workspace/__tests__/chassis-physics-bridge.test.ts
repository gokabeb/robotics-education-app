import { describe, it, expect, vi } from "vitest"
import { ChassisPhysicsBridge } from "../chassis-physics-bridge"
import type { RobotProjectComponent } from "../robot-project-store"

function makeComp(overrides: Partial<RobotProjectComponent>): RobotProjectComponent {
  return { id: "c1", type: "led", name: "LED", x: 0, y: 0, rotation: 0, pin: 2, ...overrides }
}

function makeBridge(components: RobotProjectComponent[]) {
  const onComponentStateChange = vi.fn()
  const onMotorsChange = vi.fn()
  const onServoChange = vi.fn()
  const bridge = new ChassisPhysicsBridge({ components, onComponentStateChange, onMotorsChange, onServoChange })
  return { bridge, onComponentStateChange, onMotorsChange, onServoChange }
}

describe("LED/button routing", () => {
  it("calls onComponentStateChange with id, active, dutyCycle", () => {
    const led = makeComp({ id: "led-1", type: "led", pin: 2 })
    const { bridge, onComponentStateChange } = makeBridge([led])
    bridge.handlePinChange({ pin: 2, high: true, isPWM: false, dutyCycle: 255 })
    expect(onComponentStateChange).toHaveBeenCalledWith("led-1", true, 255)
  })

  it("does nothing for unknown pin", () => {
    const { bridge, onComponentStateChange } = makeBridge([])
    bridge.handlePinChange({ pin: 13, high: true, isPWM: false, dutyCycle: 255 })
    expect(onComponentStateChange).not.toHaveBeenCalled()
  })
})

describe("motor routing", () => {
  it("calls onMotorsChange with leftDuty from first motor, 0 for missing second", () => {
    const motor = makeComp({ id: "motor-1", type: "motor", pin: 9 })
    const { bridge, onMotorsChange } = makeBridge([motor])
    bridge.handlePinChange({ pin: 9, high: true, isPWM: true, dutyCycle: 128 })
    expect(onMotorsChange).toHaveBeenCalledWith(128, 0)
  })

  it("assigns first motor=left, second motor=right", () => {
    const m1 = makeComp({ id: "m1", type: "motor", pin: 9 })
    const m2 = makeComp({ id: "m2", type: "motor", pin: 10 })
    const { bridge, onMotorsChange } = makeBridge([m1, m2])
    bridge.handlePinChange({ pin: 10, high: true, isPWM: true, dutyCycle: 200 })
    expect(onMotorsChange).toHaveBeenCalledWith(0, 200)
  })
})

describe("servo routing", () => {
  it("calls onServoChange with 90° for a 1500µs pulse on pin 9", () => {
    const servo = makeComp({ id: "s1", type: "servo", pin: 9 })
    const { bridge, onServoChange } = makeBridge([servo])
    const risingCycles = 0
    const fallingCycles = 1500 * 16  // 1500µs × 16 cycles/µs = 24000
    bridge.handlePinChange({ pin: 9, high: true,  isPWM: true, dutyCycle: 200, cycles: risingCycles })
    bridge.handlePinChange({ pin: 9, high: false, isPWM: true, dutyCycle: 0,   cycles: fallingCycles })
    expect(onServoChange).toHaveBeenCalledWith(90)
  })

  it("clamps servo to 0° for pulse < 1000µs", () => {
    const servo = makeComp({ id: "s1", type: "servo", pin: 9 })
    const { bridge, onServoChange } = makeBridge([servo])
    bridge.handlePinChange({ pin: 9, high: true,  isPWM: true, dutyCycle: 200, cycles: 0 })
    bridge.handlePinChange({ pin: 9, high: false, isPWM: true, dutyCycle: 0,   cycles: 500 * 16 }) // 500µs
    expect(onServoChange).toHaveBeenCalledWith(0)
  })
})
