export interface RobotPinConfig {
  leftMotor: { enable: number; in1: number; in2: number }
  rightMotor: { enable: number; in1: number; in2: number }
  ultrasonic: { trig: number; echo: number }
  lineSensors: { left: number; center: number; right: number }
  baudRate: number
}

export const DEFAULT_PIN_CONFIG: RobotPinConfig = {
  leftMotor: { enable: 5, in1: 4, in2: 3 },
  rightMotor: { enable: 6, in1: 7, in2: 8 },
  ultrasonic: { trig: 9, echo: 10 },
  lineSensors: { left: 0, center: 1, right: 2 }, // A0, A1, A2
  baudRate: 9600,
}
