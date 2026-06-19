import { describe, it, expect, vi, beforeEach } from "vitest"
import { GPIOBridge } from "../gpio-bridge"
import type { AVREvent } from "../types"

const makeWorker = () => ({
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  terminate: vi.fn(),
})

describe("GPIOBridge", () => {
  let bridge: GPIOBridge
  let avrWorker: ReturnType<typeof makeWorker>
  let onPinChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    avrWorker = makeWorker()
    onPinChange = vi.fn()
    bridge = new GPIOBridge({
      avrWorker: avrWorker as unknown as Worker,
      onPinChange,
    })
  })

  it("forwards pinChange events from the AVR worker to the callback", () => {
    const event: AVREvent = { type: "pinChange", pin: 13, high: true, isPWM: false, dutyCycle: 255 }
    bridge.handleAVREvent(event)
    expect(onPinChange).toHaveBeenCalledWith({ pin: 13, high: true, isPWM: false, dutyCycle: 255 })
  })

  it("sends setDigitalInput command to AVR worker", () => {
    bridge.setDigitalInput(2, true)
    expect(avrWorker.postMessage).toHaveBeenCalledWith({ type: "setDigitalInput", pin: 2, high: true })
  })

  it("sends setADCInput command to AVR worker", () => {
    bridge.setADCInput(14, 512)
    expect(avrWorker.postMessage).toHaveBeenCalledWith({ type: "setADCInput", pin: 14, value: 512 })
  })

  it("clamps ADC value to 0-1023", () => {
    bridge.setADCInput(14, 9999)
    expect(avrWorker.postMessage).toHaveBeenCalledWith({ type: "setADCInput", pin: 14, value: 1023 })

    bridge.setADCInput(14, -50)
    expect(avrWorker.postMessage).toHaveBeenCalledWith({ type: "setADCInput", pin: 14, value: 0 })
  })

  it("ignores unknown event types without throwing", () => {
    // @ts-expect-error intentional unknown type
    expect(() => bridge.handleAVREvent({ type: "unknown" })).not.toThrow()
  })
})
