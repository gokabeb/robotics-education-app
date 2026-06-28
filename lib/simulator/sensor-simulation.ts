import RAPIER from "@dimforge/rapier2d-compat"
import type { VirtualRobot } from "./rapier-robot"
import type { ArenaConfig } from "./arena"
import { isPointOnLine } from "./arena"
import type { GPIOBridge } from "../avr/gpio-bridge"

export interface SensorPinConfig {
  distanceSensorPin: number | null
  lineSensorLeftPin: number | null
  lineSensorCenterPin: number | null
  lineSensorRightPin: number | null
  bumpPin: number | null
}

// Distance sensor: ray origin 35px ahead of robot centroid
const DIST_OFFSET = 35

// Line sensor lateral offsets in robot-local space (pixels)
// left, center, right — all at forward=0 (robot centroid row)

// Physical placement note: line sensors sit ~20px behind the front edge.
// In simulation we treat them as lying on the centroid row (forward=0).
const LINE_OFFSETS = [-15, 0, 15] as const

const MAX_DIST_PX = 400

/**
 * Rotate a local (forward, lateral) offset into world space.
 *
 * @param forward  - component along the robot's heading direction
 * @param lateral  - component perpendicular to heading (positive = left of heading)
 * @param angle    - robot heading angle in radians
 */
function rotateOffset(forward: number, lateral: number, angle: number): { x: number; y: number } {
  return {
    x: forward * Math.cos(angle) - lateral * Math.sin(angle),
    y: forward * Math.sin(angle) + lateral * Math.cos(angle),
  }
}

export class SensorSimulation {
  private world: RAPIER.World
  private robot: VirtualRobot
  private arena: ArenaConfig
  private bridge: GPIOBridge
  private pins: SensorPinConfig

  constructor(
    world: RAPIER.World,
    robot: VirtualRobot,
    arena: ArenaConfig,
    bridge: GPIOBridge,
    pins: SensorPinConfig,
  ) {
    this.world = world
    this.robot = robot
    this.arena = arena
    this.bridge = bridge
    this.pins = pins
  }

  tick(): void {
    const state = this.robot.getState()
    this.tickDistance(state.x, state.y, state.angle)
    this.tickLineSensors(state.x, state.y, state.angle)
  }

  private tickDistance(rx: number, ry: number, angle: number): void {
    const { distanceSensorPin } = this.pins
    if (distanceSensorPin === null) return

    const off = rotateOffset(DIST_OFFSET, 0, angle)
    const origin = { x: rx + off.x, y: ry + off.y }
    const dir = { x: Math.cos(angle), y: Math.sin(angle) }

    const ray = new RAPIER.Ray(origin, dir)
    const hit = this.world.castRay(ray, MAX_DIST_PX, true)
    const distPx = hit ? hit.toi : MAX_DIST_PX
    // Closer = higher ADC value; no hit → 0
    const adcValue = Math.round((1 - distPx / MAX_DIST_PX) * 1023)
    this.bridge.setADCInput(distanceSensorPin, adcValue)
  }

  private tickLineSensors(rx: number, ry: number, angle: number): void {
    const linePins = [
      this.pins.lineSensorLeftPin,
      this.pins.lineSensorCenterPin,
      this.pins.lineSensorRightPin,
    ]
    const lineTrack = this.arena.lineTrack

    LINE_OFFSETS.forEach((lateralOffset, i) => {
      const pin = linePins[i]
      if (pin === null) return

      // Line sensors lie on the robot centroid row (forward=0), spread laterally
      const off = rotateOffset(0, lateralOffset, angle)
      const wx = rx + off.x
      const wy = ry + off.y

      const onLine = lineTrack ? isPointOnLine(wx, wy, lineTrack) : false
      // IR sensor convention: LOW (false) when over line, HIGH (true) when off line
      this.bridge.setDigitalInput(pin, !onLine)
    })
  }

  handleCollisionEvent(_handle1: number, _handle2: number, started: boolean): void {
    if (this.pins.bumpPin === null) return
    // Active-low: LOW (false) = bumped, HIGH (true) = released
    this.bridge.setDigitalInput(this.pins.bumpPin, !started)
  }
}
