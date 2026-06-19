import type { AVRCommand, AVREvent } from "./types"

export interface PinChangePayload {
  pin: number
  high: boolean
  isPWM: boolean
  dutyCycle: number
}

export interface GPIOBridgeOptions {
  avrWorker: Worker
  onPinChange: (payload: PinChangePayload) => void
  onSerialOutput?: (text: string) => void
  onAVRError?: (message: string) => void
  onAVRStopped?: () => void
}

export class GPIOBridge {
  private avrWorker: Worker
  private onPinChange: (payload: PinChangePayload) => void
  private onSerialOutput?: (text: string) => void
  private onAVRError?: (message: string) => void
  private onAVRStopped?: () => void

  constructor(options: GPIOBridgeOptions) {
    this.avrWorker = options.avrWorker
    this.onPinChange = options.onPinChange
    this.onSerialOutput = options.onSerialOutput
    this.onAVRError = options.onAVRError
    this.onAVRStopped = options.onAVRStopped
  }

  handleAVREvent(event: AVREvent): void {
    switch (event.type) {
      case "pinChange":
        this.onPinChange({
          pin: event.pin,
          high: event.high,
          isPWM: event.isPWM,
          dutyCycle: event.dutyCycle,
        })
        break
      case "serialOutput":
        this.onSerialOutput?.(event.text)
        break
      case "halted":
        this.onAVRError?.(event.message)
        break
      case "stopped":
        this.onAVRStopped?.()
        break
    }
  }

  setDigitalInput(pin: number, high: boolean): void {
    const cmd: AVRCommand = { type: "setDigitalInput", pin, high }
    this.avrWorker.postMessage(cmd)
  }

  setADCInput(pin: number, value: number): void {
    const clamped = Math.max(0, Math.min(1023, Math.round(value)))
    const cmd: AVRCommand = { type: "setADCInput", pin, value: clamped }
    this.avrWorker.postMessage(cmd)
  }

  sendSerial(data: string): void {
    const cmd: AVRCommand = { type: "sendSerial", data }
    this.avrWorker.postMessage(cmd)
  }
}
