import type { RobotProjectComponent } from "./robot-project-store"

export interface PinChangePayload {
  pin: number
  high: boolean
  isPWM: boolean
  dutyCycle: number
}

export interface ChassisPhysicsBridgeOptions {
  components: RobotProjectComponent[]
  onComponentStateChange: (componentId: string, active: boolean) => void
}

export class ChassisPhysicsBridge {
  private components: RobotProjectComponent[]
  private onComponentStateChange: (componentId: string, active: boolean) => void

  constructor(options: ChassisPhysicsBridgeOptions) {
    this.components = options.components
    this.onComponentStateChange = options.onComponentStateChange
  }

  handlePinChange(payload: PinChangePayload): void {
    const component = this.components.find((c) => c.pin === payload.pin)
    if (!component) return
    // PWM duty-cycle detection is not implemented upstream (avr-worker.ts
    // hardcodes isPWM: false) — every component is binary on/off for now.
    this.onComponentStateChange(component.id, payload.high)
  }
}
