import type { RobotProjectComponent } from "./robot-project-store"
import type { PinChangePayload } from "../avr/gpio-bridge"

export interface ChassisPhysicsBridgeOptions {
  components: RobotProjectComponent[]
  onComponentStateChange: (componentId: string, active: boolean, dutyCycle: number) => void
  onMotorsChange: (leftDuty: number, rightDuty: number) => void
  onServoChange: (angleDeg: number) => void
}

const CYCLES_PER_US = 16  // ATmega328P @ 16MHz

export class ChassisPhysicsBridge {
  private options: ChassisPhysicsBridgeOptions
  private motorDuties: Record<string, number> = {}
  private servoRisingCycles: Map<number, number> = new Map()

  constructor(options: ChassisPhysicsBridgeOptions) {
    this.options = options
  }

  handlePinChange(payload: PinChangePayload): void {
    const component = this.options.components.find((c) => c.pin === payload.pin)
    if (!component) return

    if (component.type === "motor") {
      this.motorDuties[component.id] = payload.dutyCycle
      this.flushMotors()
    } else if (component.type === "servo") {
      this.handleServoPulse(payload)
    } else {
      // led, button, sensor
      this.options.onComponentStateChange(component.id, payload.high, payload.dutyCycle)
    }
  }

  private flushMotors(): void {
    const motors = this.options.components.filter((c) => c.type === "motor")
    const leftDuty  = motors[0] ? (this.motorDuties[motors[0].id] ?? 0) : 0
    const rightDuty = motors[1] ? (this.motorDuties[motors[1].id] ?? 0) : 0
    this.options.onMotorsChange(leftDuty, rightDuty)
  }

  private handleServoPulse(payload: PinChangePayload): void {
    if (payload.cycles === undefined) return
    if (payload.high) {
      this.servoRisingCycles.set(payload.pin, payload.cycles)
    } else {
      const rising = this.servoRisingCycles.get(payload.pin)
      if (rising === undefined) return
      this.servoRisingCycles.delete(payload.pin)
      const pulseWidthUs = (payload.cycles - rising) / CYCLES_PER_US
      const angle = Math.max(0, Math.min(180, (pulseWidthUs - 1000) / 1000 * 180))
      this.options.onServoChange(Math.round(angle))
    }
  }
}
