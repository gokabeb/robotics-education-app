import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import RAPIER from "@dimforge/rapier2d-compat"
import { createPhysicsWorld } from "../rapier-physics"
import { VirtualRobot } from "../rapier-robot"
import { SensorSimulation, type SensorPinConfig } from "../sensor-simulation"
import { ARENAS } from "../arena"
import type { GPIOBridge } from "../../avr/gpio-bridge"

function makeBridge() {
  return { setADCInput: vi.fn(), setDigitalInput: vi.fn() } as unknown as GPIOBridge
}

const ALL_NULL: SensorPinConfig = {
  distanceSensorPin: null, lineSensorLeftPin: null,
  lineSensorCenterPin: null, lineSensorRightPin: null, bumpPin: null,
}

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

describe("distance sensor", () => {
  it("calls setADCInput on distanceSensorPin", () => {
    const bridge = makeBridge()
    const arena = ARENAS.find(a => a.id === "open-arena")!
    const sim = new SensorSimulation(world, robot, arena, bridge, { ...ALL_NULL, distanceSensorPin: 14 })
    sim.tick()
    expect(bridge.setADCInput).toHaveBeenCalledWith(14, expect.any(Number))
  })

  it("skips setADCInput when distanceSensorPin is null", () => {
    const bridge = makeBridge()
    const arena = ARENAS[0]
    const sim = new SensorSimulation(world, robot, arena, bridge, ALL_NULL)
    sim.tick()
    expect(bridge.setADCInput).not.toHaveBeenCalled()
  })
})

describe("line sensor", () => {
  it("sends LOW (false) for left sensor when robot is on line-track start", () => {
    const bridge = makeBridge()
    const arena = ARENAS.find(a => a.id === "line-follow")!
    // Robot starts at (100, 500) which is exactly on the line track start
    robot.destroy()
    robot = new VirtualRobot(world, 100, 500)
    const sim = new SensorSimulation(world, robot, arena, bridge, { ...ALL_NULL, lineSensorLeftPin: 15 })
    sim.tick()
    // IR sensor LOW = on line; pin set to false
    expect(bridge.setDigitalInput).toHaveBeenCalledWith(15, false)
  })

  it("sends HIGH (true) for sensor when far from any line", () => {
    const bridge = makeBridge()
    const arena = ARENAS.find(a => a.id === "line-follow")!
    // Robot at (700, 550) — off any line segment
    robot.destroy()
    robot = new VirtualRobot(world, 700, 550)
    const sim = new SensorSimulation(world, robot, arena, bridge, { ...ALL_NULL, lineSensorCenterPin: 16 })
    sim.tick()
    expect(bridge.setDigitalInput).toHaveBeenCalledWith(16, true)
  })
})

describe("bump sensor", () => {
  it("sets bump pin LOW on collision start, HIGH on end", () => {
    const bridge = makeBridge()
    const arena = ARENAS[0]
    const sim = new SensorSimulation(world, robot, arena, bridge, { ...ALL_NULL, bumpPin: 4 })
    sim.handleCollisionEvent(0, 1, true)
    expect(bridge.setDigitalInput).toHaveBeenCalledWith(4, false)
    sim.handleCollisionEvent(0, 1, false)
    expect(bridge.setDigitalInput).toHaveBeenCalledWith(4, true)
  })

  it("skips bump when bumpPin is null", () => {
    const bridge = makeBridge()
    const arena = ARENAS[0]
    const sim = new SensorSimulation(world, robot, arena, bridge, ALL_NULL)
    sim.handleCollisionEvent(0, 1, true)
    expect(bridge.setDigitalInput).not.toHaveBeenCalled()
  })
})
