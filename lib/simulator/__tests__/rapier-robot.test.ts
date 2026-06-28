import { describe, it, expect, beforeEach, afterEach } from "vitest"
import RAPIER from "@dimforge/rapier2d-compat"
import { createPhysicsWorld } from "../rapier-physics"
import { VirtualRobot } from "../rapier-robot"

let world: RAPIER.World
let robot: VirtualRobot

beforeEach(async () => {
  world = await createPhysicsWorld()
  robot = new VirtualRobot(world, 100, 300)
})

afterEach(() => {
  robot.destroy()
  world.free()
})

describe("VirtualRobot", () => {
  it("initialises at the given position", () => {
    const s = robot.getState()
    expect(s.x).toBeCloseTo(100, 0)
    expect(s.y).toBeCloseTo(300, 0)
    expect(s.angle).toBeCloseTo(0, 3)
  })

  it("stores motor duty cycles", () => {
    robot.setMotors(128, 200)
    const s = robot.getState()
    expect(s.leftDuty).toBe(128)
    expect(s.rightDuty).toBe(200)
  })

  it("moves forward when both motors at full duty", () => {
    robot.setMotors(255, 255)
    robot.update()
    world.step()
    const s = robot.getState()
    // Should have moved in +x direction (angle=0)
    expect(s.x).toBeGreaterThan(100)
  })

  it("stays near start when motors are zero", () => {
    robot.setMotors(0, 0)
    robot.update()
    world.step()
    const s = robot.getState()
    expect(s.x).toBeCloseTo(100, 0)
  })

  it("clamps servoAngle to 0–180", () => {
    robot.setServoAngle(270)
    expect(robot.getState().servoAngle).toBe(180)
    robot.setServoAngle(-10)
    expect(robot.getState().servoAngle).toBe(0)
  })
})
