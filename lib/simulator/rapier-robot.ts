import RAPIER from "@dimforge/rapier2d-compat"

// Max linear speed in px/s at 100% duty (255)
const MAX_LINEAR_SPEED = 200
// Wheel base in px (distance between left and right wheels)
const WHEEL_BASE = 50
// Half-extents of robot body (px)
const HALF_W = 30
const HALF_H = 25

export interface RobotState {
  x: number
  y: number
  angle: number
  leftDuty: number
  rightDuty: number
  servoAngle: number
}

export class VirtualRobot {
  private body: RAPIER.RigidBody
  private world: RAPIER.World
  private leftDuty = 0
  private rightDuty = 0
  private servoAngleDeg = 90

  constructor(world: RAPIER.World, x: number, y: number, startAngleDeg?: number) {
    this.world = world
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      .setLinearDamping(8)
      .setAngularDamping(5)
    this.body = world.createRigidBody(bodyDesc)
    this.body.setRotation(startAngleDeg ?? 0, true)
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(HALF_W, HALF_H)
        .setFriction(0.8)
        .setRestitution(0.1)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.body,
    )
  }

  setMotors(leftDuty: number, rightDuty: number): void {
    this.leftDuty = Math.max(0, Math.min(255, leftDuty))
    this.rightDuty = Math.max(0, Math.min(255, rightDuty))
  }

  setServoAngle(angleDeg: number): void {
    this.servoAngleDeg = Math.max(0, Math.min(180, angleDeg))
  }

  update(): void {
    const leftSpeed  = (this.leftDuty  / 255) * MAX_LINEAR_SPEED
    const rightSpeed = (this.rightDuty / 255) * MAX_LINEAR_SPEED

    const linearVel  = (leftSpeed + rightSpeed) / 2
    const angularVel = (rightSpeed - leftSpeed) / WHEEL_BASE

    const angle = this.body.rotation()
    this.body.setLinvel({ x: Math.cos(angle) * linearVel, y: Math.sin(angle) * linearVel }, true)
    this.body.setAngvel(angularVel, true)
  }

  getState(): RobotState {
    const pos = this.body.translation()
    return {
      x: pos.x,
      y: pos.y,
      angle: this.body.rotation(),
      leftDuty: this.leftDuty,
      rightDuty: this.rightDuty,
      servoAngle: this.servoAngleDeg,
    }
  }

  destroy(): void {
    this.world.removeRigidBody(this.body)
  }
}
