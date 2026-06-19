import Matter from "matter-js"

export interface RobotConfig {
  width: number
  height: number
  color: string
  maxSpeed: number
  turnSpeed: number
  sensorRange: number
}

export interface RobotState {
  x: number
  y: number
  angle: number
  leftMotor: number // -100 to 100
  rightMotor: number // -100 to 100
  sensors: {
    front: number
    left: number
    right: number
    lineLeft: boolean
    lineCenter: boolean
    lineRight: boolean
  }
}

export const DEFAULT_ROBOT_CONFIG: RobotConfig = {
  width: 60,
  height: 50,
  color: "#22c55e",
  maxSpeed: 5,
  turnSpeed: 0.1,
  sensorRange: 150,
}

export class VirtualRobot {
  body: Matter.Body
  config: RobotConfig
  leftMotor: number = 0
  rightMotor: number = 0
  private world: Matter.World

  constructor(world: Matter.World, x: number, y: number, config: Partial<RobotConfig> = {}) {
    this.config = { ...DEFAULT_ROBOT_CONFIG, ...config }
    this.world = world

    // Create robot body with rounded front
    const vertices = this.createRobotShape()
    
    this.body = Matter.Bodies.fromVertices(x, y, [vertices], {
      label: "robot",
      friction: 0.1,
      frictionAir: 0.05,
      restitution: 0.2,
      render: {
        fillStyle: this.config.color,
        strokeStyle: "#16a34a",
        lineWidth: 2,
      },
    })

    // Reset position after creating from vertices (it may shift)
    Matter.Body.setPosition(this.body, { x, y })
    Matter.World.add(world, this.body)
  }

  private createRobotShape(): Matter.Vector[] {
    const w = this.config.width / 2
    const h = this.config.height / 2
    
    // Create a robot shape with rounded front
    return [
      { x: -w, y: -h },
      { x: -w, y: h },
      { x: w * 0.5, y: h },
      { x: w, y: h * 0.5 },
      { x: w, y: -h * 0.5 },
      { x: w * 0.5, y: -h },
    ]
  }

  setMotors(left: number, right: number): void {
    this.leftMotor = Math.max(-100, Math.min(100, left))
    this.rightMotor = Math.max(-100, Math.min(100, right))
  }

  moveForward(speed: number = 50): void {
    this.setMotors(speed, speed)
  }

  moveBackward(speed: number = 50): void {
    this.setMotors(-speed, -speed)
  }

  turnLeft(speed: number = 50): void {
    this.setMotors(-speed, speed)
  }

  turnRight(speed: number = 50): void {
    this.setMotors(speed, -speed)
  }

  stop(): void {
    this.setMotors(0, 0)
    Matter.Body.setVelocity(this.body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(this.body, 0)
  }

  update(): void {
    // Convert motor values to actual movement
    const leftSpeed = (this.leftMotor / 100) * this.config.maxSpeed
    const rightSpeed = (this.rightMotor / 100) * this.config.maxSpeed

    // Differential drive physics
    const linearSpeed = (leftSpeed + rightSpeed) / 2
    const angularSpeed = (rightSpeed - leftSpeed) / this.config.width * 2

    // Apply velocity in the direction the robot is facing
    const angle = this.body.angle
    const vx = Math.cos(angle) * linearSpeed
    const vy = Math.sin(angle) * linearSpeed

    Matter.Body.setVelocity(this.body, { x: vx, y: vy })
    Matter.Body.setAngularVelocity(this.body, angularSpeed * this.config.turnSpeed)
  }

  getState(): RobotState {
    return {
      x: this.body.position.x,
      y: this.body.position.y,
      angle: this.body.angle,
      leftMotor: this.leftMotor,
      rightMotor: this.rightMotor,
      sensors: {
        front: 0,
        left: 0,
        right: 0,
        lineLeft: false,
        lineCenter: false,
        lineRight: false,
      },
    }
  }

  reset(x: number, y: number, angle: number = 0): void {
    Matter.Body.setPosition(this.body, { x, y })
    Matter.Body.setAngle(this.body, angle)
    Matter.Body.setVelocity(this.body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(this.body, 0)
    this.leftMotor = 0
    this.rightMotor = 0
  }

  destroy(): void {
    Matter.World.remove(this.world, this.body)
  }
}

// Raycast for distance sensors
export function castRay(
  engine: Matter.Engine,
  startX: number,
  startY: number,
  angle: number,
  maxDistance: number,
  ignoreLabels: string[] = ["robot"]
): { distance: number; hitBody: Matter.Body | null } {
  const endX = startX + Math.cos(angle) * maxDistance
  const endY = startY + Math.sin(angle) * maxDistance

  const bodies = Matter.Composite.allBodies(engine.world)
  let closestDistance = maxDistance
  let hitBody: Matter.Body | null = null

  for (const body of bodies) {
    if (ignoreLabels.includes(body.label)) continue
    if (body.isSensor) continue

    // Check intersection with each edge of the body
    const vertices = body.vertices
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i]
      const v2 = vertices[(i + 1) % vertices.length]

      const intersection = lineIntersection(
        startX, startY, endX, endY,
        v1.x, v1.y, v2.x, v2.y
      )

      if (intersection) {
        const distance = Math.sqrt(
          Math.pow(intersection.x - startX, 2) +
          Math.pow(intersection.y - startY, 2)
        )
        if (distance < closestDistance) {
          closestDistance = distance
          hitBody = body
        }
      }
    }
  }

  return { distance: closestDistance, hitBody }
}

function lineIntersection(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): { x: number; y: number } | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 0.0001) return null

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    }
  }

  return null
}


