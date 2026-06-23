import { describe, it, expect, vi } from "vitest"
import { RobotProjectStore } from "../robot-project-store"

describe("RobotProjectStore.addComponent", () => {
  it("auto-assigns the first free PWM pin to a motor", () => {
    const store = new RobotProjectStore()
    const motor = store.addComponent("motor", 10, 10)
    expect(motor.pin).toBe(3) // first PWM-capable pin per UNO_PIN_MAP
  })

  it("auto-assigns a different free pin to a second motor", () => {
    const store = new RobotProjectStore()
    const m1 = store.addComponent("motor", 10, 10)
    const m2 = store.addComponent("motor", 20, 20)
    expect(m2.pin).not.toBe(m1.pin)
    expect(m2.pin).toBe(5)
  })

  it("assigns null pin when no free valid pin remains", () => {
    const store = new RobotProjectStore()
    for (let i = 0; i < 6; i++) store.addComponent("motor", i, i) // exhausts all 6 PWM pins
    const overflow = store.addComponent("motor", 99, 99)
    expect(overflow.pin).toBeNull()
  })

  it("notifies subscribers on add", () => {
    const store = new RobotProjectStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.addComponent("led", 0, 0)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("RobotProjectStore.removeComponent", () => {
  it("removes the component and frees its pin", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 0, 0)
    store.removeComponent(led.id)
    expect(store.getComponents()).toHaveLength(0)
    const led2 = store.addComponent("led", 0, 0)
    expect(led2.pin).toBe(led.pin) // pin freed and reused
  })
})

describe("RobotProjectStore.moveComponent / rotateComponent", () => {
  it("updates position and rotation in place", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 0, 0)
    store.moveComponent(led.id, 50, 60)
    store.rotateComponent(led.id, 90)
    const updated = store.getComponents()[0]
    expect(updated.x).toBe(50)
    expect(updated.y).toBe(60)
    expect(updated.rotation).toBe(90)
  })
})

describe("RobotProjectStore.reassignPin", () => {
  it("accepts a non-reserved pin for a digital component, even an analog-labeled one", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 0, 0) // digital kind accepts any non-reserved pin
    const ok = store.reassignPin(led.id, 14) // A0
    expect(ok).toBe(true)
  })

  it("rejects a pin already used by another component", () => {
    const store = new RobotProjectStore()
    const m1 = store.addComponent("motor", 0, 0)
    const m2 = store.addComponent("motor", 10, 10)
    const ok = store.reassignPin(m2.id, m1.pin!)
    expect(ok).toBe(false)
  })

  it("rejects a pin not valid for a pwm component", () => {
    const store = new RobotProjectStore()
    const motor = store.addComponent("motor", 0, 0)
    const ok = store.reassignPin(motor.id, 4) // D4 is not PWM-capable
    expect(ok).toBe(false)
  })

  it("accepts a valid free pin and notifies subscribers", () => {
    const store = new RobotProjectStore()
    const motor = store.addComponent("motor", 0, 0)
    const listener = vi.fn()
    store.subscribe(listener)
    const ok = store.reassignPin(motor.id, 9)
    expect(ok).toBe(true)
    expect(store.getComponents()[0].pin).toBe(9)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("RobotProjectStore code", () => {
  it("starts in blocks mode with empty code", () => {
    const store = new RobotProjectStore()
    expect(store.getCode()).toEqual({ source: "blocks", blocklyXml: null, generatedCode: "" })
  })

  it("setBlocklyXml updates xml and generated code, keeps source=blocks", () => {
    const store = new RobotProjectStore()
    store.setBlocklyXml("<xml/>", "void loop() {}")
    expect(store.getCode()).toEqual({ source: "blocks", blocklyXml: "<xml/>", generatedCode: "void loop() {}" })
  })

  it("setManualCode switches source to text and preserves blocklyXml", () => {
    const store = new RobotProjectStore()
    store.setBlocklyXml("<xml/>", "void loop() {}")
    store.setManualCode("void loop() { /* edited */ }")
    const code = store.getCode()
    expect(code.source).toBe("text")
    expect(code.blocklyXml).toBe("<xml/>")
    expect(code.generatedCode).toBe("void loop() { /* edited */ }")
  })
})

describe("RobotProjectStore.subscribe", () => {
  it("unsubscribe stops further notifications", () => {
    const store = new RobotProjectStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.addComponent("led", 0, 0)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe("RobotProjectStore.flash / isOutOfSync", () => {
  it("has no flashed snapshot and is not out of sync before any flash", () => {
    const store = new RobotProjectStore()
    expect(store.getFlashed()).toBeNull()
    expect(store.isOutOfSync()).toBe(false)
  })

  it("flash() captures the current components and code", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    store.setManualCode("void loop() {}")
    const snapshot = store.flash()
    expect(snapshot.components).toHaveLength(1)
    expect(snapshot.code.generatedCode).toBe("void loop() {}")
    expect(store.getFlashed()).toEqual(snapshot)
  })

  it("is not out of sync immediately after flashing", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    store.flash()
    expect(store.isOutOfSync()).toBe(false)
  })

  it("is out of sync after a component is added post-flash", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    store.flash()
    store.addComponent("motor", 10, 10)
    expect(store.isOutOfSync()).toBe(true)
  })

  it("is out of sync after code changes post-flash", () => {
    const store = new RobotProjectStore()
    store.setManualCode("void loop() {}")
    store.flash()
    store.setManualCode("void loop() { delay(1); }")
    expect(store.isOutOfSync()).toBe(true)
  })

  it("re-flashing clears the out-of-sync state", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 0, 0)
    store.flash()
    store.addComponent("motor", 10, 10)
    expect(store.isOutOfSync()).toBe(true)
    store.flash()
    expect(store.isOutOfSync()).toBe(false)
  })

  it("produces the same hash for the same content flashed twice", () => {
    const storeA = new RobotProjectStore()
    storeA.addComponent("led", 5, 5)
    const snapA = storeA.flash()

    const storeB = new RobotProjectStore()
    storeB.addComponent("led", 5, 5)
    const snapB = storeB.flash()

    expect(snapA.hash).toBe(snapB.hash)
  })
})
