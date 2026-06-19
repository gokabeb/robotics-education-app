import { VirtualRobot, RobotState } from "./robot"
import { PhysicsWorld } from "./physics"
import { transpileArduino, isArduinoCode } from "./arduino-transpiler"

export { isArduinoCode }

export interface RobotCommand {
  type: "forward" | "backward" | "left" | "right" | "stop" | "setMotors" | "wait" | "if" | "while" | "loop"
  params?: Record<string, number | boolean | string>
  children?: RobotCommand[]
}

export interface ExecutionState {
  isRunning: boolean
  isPaused: boolean
  currentLine: number
  variables: Record<string, number | boolean>
  callStack: number[]
  error: string | null
}

export interface ExecutorCallbacks {
  onStateChange: (state: ExecutionState) => void
  onRobotUpdate: (state: RobotState) => void
  onComplete: () => void
  onError: (error: string) => void
  getSensorValue: (sensor: string) => number | boolean
}

// Simple JavaScript-like interpreter for robot control
export class RobotExecutor {
  private robot: VirtualRobot
  private physics: PhysicsWorld
  private callbacks: ExecutorCallbacks
  private state: ExecutionState
  private animationFrame: number | null = null
  private executeTimeout: NodeJS.Timeout | null = null

  constructor(
    robot: VirtualRobot,
    physics: PhysicsWorld,
    callbacks: ExecutorCallbacks
  ) {
    this.robot = robot
    this.physics = physics
    this.callbacks = callbacks
    this.state = {
      isRunning: false,
      isPaused: false,
      currentLine: 0,
      variables: {},
      callStack: [],
      error: null,
    }
  }

  // Parse a simple robot command script
  parseScript(code: string): RobotCommand[] {
    const commands: RobotCommand[] = []
    const lines = code.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"))

    for (const line of lines) {
      const command = this.parseLine(line)
      if (command) {
        commands.push(command)
      }
    }

    return commands
  }

  private parseLine(line: string): RobotCommand | null {
    // Parse basic commands
    const forwardMatch = line.match(/^(?:moveForward|forward)\s*\(?\s*(\d+)?\s*\)?/i)
    if (forwardMatch) {
      return { type: "forward", params: { speed: parseInt(forwardMatch[1]) || 50 } }
    }

    const backwardMatch = line.match(/^(?:moveBackward|backward)\s*\(?\s*(\d+)?\s*\)?/i)
    if (backwardMatch) {
      return { type: "backward", params: { speed: parseInt(backwardMatch[1]) || 50 } }
    }

    const leftMatch = line.match(/^(?:turnLeft|left)\s*\(?\s*(\d+)?\s*\)?/i)
    if (leftMatch) {
      return { type: "left", params: { speed: parseInt(leftMatch[1]) || 50 } }
    }

    const rightMatch = line.match(/^(?:turnRight|right)\s*\(?\s*(\d+)?\s*\)?/i)
    if (rightMatch) {
      return { type: "right", params: { speed: parseInt(rightMatch[1]) || 50 } }
    }

    const stopMatch = line.match(/^stop\s*\(?\s*\)?/i)
    if (stopMatch) {
      return { type: "stop" }
    }

    const motorsMatch = line.match(/^setMotors\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/i)
    if (motorsMatch) {
      return {
        type: "setMotors",
        params: {
          left: parseInt(motorsMatch[1]),
          right: parseInt(motorsMatch[2]),
        },
      }
    }

    const waitMatch = line.match(/^(?:wait|delay)\s*\(?\s*(\d+)\s*\)?/i)
    if (waitMatch) {
      return { type: "wait", params: { duration: parseInt(waitMatch[1]) } }
    }

    return null
  }

  async execute(commands: RobotCommand[]): Promise<void> {
    this.state = {
      isRunning: true,
      isPaused: false,
      currentLine: 0,
      variables: {},
      callStack: [],
      error: null,
    }
    this.callbacks.onStateChange(this.state)

    try {
      await this.executeCommands(commands)
      this.callbacks.onComplete()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed"
      this.state.error = message
      this.callbacks.onError(message)
    } finally {
      this.state.isRunning = false
      this.callbacks.onStateChange(this.state)
    }
  }

  private async executeCommands(commands: RobotCommand[]): Promise<void> {
    for (let i = 0; i < commands.length; i++) {
      if (!this.state.isRunning) break

      // Wait if paused
      while (this.state.isPaused && this.state.isRunning) {
        await this.delay(100)
      }

      this.state.currentLine = i
      this.callbacks.onStateChange(this.state)

      await this.executeCommand(commands[i])
    }
  }

  private async executeCommand(command: RobotCommand): Promise<void> {
    switch (command.type) {
      case "forward":
        this.robot.moveForward(command.params?.speed as number || 50)
        await this.runForDuration(500)
        this.robot.stop()
        break

      case "backward":
        this.robot.moveBackward(command.params?.speed as number || 50)
        await this.runForDuration(500)
        this.robot.stop()
        break

      case "left":
        this.robot.turnLeft(command.params?.speed as number || 50)
        await this.runForDuration(300)
        this.robot.stop()
        break

      case "right":
        this.robot.turnRight(command.params?.speed as number || 50)
        await this.runForDuration(300)
        this.robot.stop()
        break

      case "stop":
        this.robot.stop()
        break

      case "setMotors":
        this.robot.setMotors(
          command.params?.left as number || 0,
          command.params?.right as number || 0
        )
        await this.runForDuration(500)
        this.robot.stop()
        break

      case "wait":
        await this.delay(command.params?.duration as number || 1000)
        break
    }

    this.callbacks.onRobotUpdate(this.robot.getState())
  }

  private async runForDuration(ms: number): Promise<void> {
    const startTime = Date.now()
    while (Date.now() - startTime < ms && this.state.isRunning) {
      this.robot.update()
      this.callbacks.onRobotUpdate(this.robot.getState())
      await this.delay(16) // ~60fps
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.executeTimeout = setTimeout(resolve, ms)
    })
  }

  pause(): void {
    this.state.isPaused = true
    this.callbacks.onStateChange(this.state)
  }

  resume(): void {
    this.state.isPaused = false
    this.callbacks.onStateChange(this.state)
  }

  stop(): void {
    this.state.isRunning = false
    this.robot.stop()
    if (this.executeTimeout) {
      clearTimeout(this.executeTimeout)
    }
    this.callbacks.onStateChange(this.state)
  }

  getState(): ExecutionState {
    return { ...this.state }
  }
}

// Generate Xylo Script from Arduino C++ code using the transpiler
export function generateXyloScript(arduinoCode: string): string {
  const result = transpileArduino(arduinoCode)
  if (result.error) {
    throw new Error(result.error)
  }
  return result.script
}

// Pre-built example scripts for learning
export const EXAMPLE_SCRIPTS = {
  forward: `// Move forward
forward(50)
wait(1000)
stop()`,

  square: `// Drive in a square
forward(50)
wait(500)
right(50)
wait(300)
forward(50)
wait(500)
right(50)
wait(300)
forward(50)
wait(500)
right(50)
wait(300)
forward(50)
wait(500)
right(50)
wait(300)
stop()`,

  zigzag: `// Zigzag pattern
forward(50)
wait(300)
left(30)
wait(200)
forward(50)
wait(300)
right(30)
wait(200)
forward(50)
wait(300)
left(30)
wait(200)
forward(50)
wait(300)
stop()`,

  spin: `// Spin in place
left(100)
wait(2000)
right(100)
wait(2000)
stop()`,
}


