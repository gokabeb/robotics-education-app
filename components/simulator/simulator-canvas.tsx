"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import Matter from "matter-js"
import { createPhysicsWorld, startPhysics, stopPhysics, clearWorld, PhysicsWorld } from "@/lib/simulator/physics"
import { VirtualRobot, castRay, RobotState } from "@/lib/simulator/robot"
import { setupArena, ArenaConfig, isPointInGoal, isPointOnLine, ARENAS } from "@/lib/simulator/arena"

interface SimulatorCanvasProps {
  arenaId: string
  isRunning: boolean
  onRobotUpdate?: (state: RobotState) => void
  onGoalReached?: () => void
  onCollision?: (count: number) => void
  robotRef?: React.MutableRefObject<VirtualRobot | null>
  physicsRef?: React.MutableRefObject<PhysicsWorld | null>
}

export function SimulatorCanvas({
  arenaId,
  isRunning,
  onRobotUpdate,
  onGoalReached,
  onCollision,
  robotRef: externalRobotRef,
  physicsRef: externalPhysicsRef,
}: SimulatorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const internalPhysicsRef = useRef<PhysicsWorld | null>(null)
  const internalRobotRef = useRef<VirtualRobot | null>(null)
  const arenaSetupRef = useRef<ReturnType<typeof setupArena> | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const collisionCountRef = useRef(0)
  const goalFiredRef = useRef(false)

  const physicsRef = externalPhysicsRef || internalPhysicsRef
  const robotRef = externalRobotRef || internalRobotRef

  // Get arena config
  const arenaConfig = ARENAS.find((a) => a.id === arenaId) || ARENAS[0]

  // Initialize physics world and robot
  useEffect(() => {
    const physics = createPhysicsWorld()
    physicsRef.current = physics

    // Setup arena
    arenaSetupRef.current = setupArena(physics.world, arenaId)
    const config = arenaSetupRef.current.config

    // Create robot
    const robot = new VirtualRobot(
      physics.world,
      config.robotStartX,
      config.robotStartY,
      { color: "#22c55e" }
    )
    Matter.Body.setAngle(robot.body, config.robotStartAngle)
    robotRef.current = robot

    // Start physics
    startPhysics(physics)

    // Reset per-run counters
    collisionCountRef.current = 0
    goalFiredRef.current = false

    // Track collisions between robot and walls/obstacles
    const handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
      const pairs = event.pairs
      const robotBody = robotRef.current?.body
      if (!robotBody) return
      const robotInvolved = pairs.some(
        (p) => p.bodyA === robotBody || p.bodyB === robotBody
      )
      if (robotInvolved) {
        collisionCountRef.current += 1
        onCollision?.(collisionCountRef.current)
        console.log(`Collision: ${collisionCountRef.current}`)
      }
    }

    Matter.Events.on(physics.engine, "collisionStart", handleCollision)

    return () => {
      Matter.Events.off(physics.engine, "collisionStart", handleCollision)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      stopPhysics(physics)
      robot.destroy()
      clearWorld(physics)
    }
  }, [arenaId, physicsRef, robotRef])

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.min(arenaConfig.width, rect.width),
          height: Math.min(arenaConfig.height, rect.height),
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [arenaConfig])

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const robot = robotRef.current
    const physics = physicsRef.current
    const arenaSetup = arenaSetupRef.current

    if (!canvas || !ctx || !robot || !physics || !arenaSetup) return

    const config = arenaSetup.config
    const scale = Math.min(dimensions.width / config.width, dimensions.height / config.height)

    // Clear canvas
    ctx.fillStyle = "#0f0f11"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.scale(scale, scale)

    // Draw grid
    ctx.strokeStyle = "#1a1a1f"
    ctx.lineWidth = 1
    const gridSize = 50
    for (let x = 0; x <= config.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, config.height)
      ctx.stroke()
    }
    for (let y = 0; y <= config.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(config.width, y)
      ctx.stroke()
    }

    // Draw line track if present
    if (config.lineTrack) {
      ctx.strokeStyle = "#1f2937"
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      for (const segment of config.lineTrack) {
        ctx.lineWidth = segment.width
        ctx.beginPath()
        ctx.moveTo(segment.x1, segment.y1)
        ctx.lineTo(segment.x2, segment.y2)
        ctx.stroke()
      }
    }

    // Draw goals
    if (config.goals) {
      for (const goal of config.goals) {
        ctx.beginPath()
        ctx.arc(goal.x, goal.y, goal.radius, 0, Math.PI * 2)
        ctx.fillStyle = goal.color + "40"
        ctx.fill()
        ctx.strokeStyle = goal.color
        ctx.lineWidth = 3
        ctx.stroke()

        // Goal label
        ctx.fillStyle = goal.color
        ctx.font = "14px system-ui"
        ctx.textAlign = "center"
        ctx.fillText(goal.label, goal.x, goal.y + goal.radius + 20)
      }
    }

    // Draw all physics bodies
    const bodies = Matter.Composite.allBodies(physics.world)
    for (const body of bodies) {
      if (body.label === "robot") continue // Draw robot separately

      ctx.beginPath()
      const vertices = body.vertices
      ctx.moveTo(vertices[0].x, vertices[0].y)
      for (let j = 1; j < vertices.length; j++) {
        ctx.lineTo(vertices[j].x, vertices[j].y)
      }
      ctx.closePath()

      if (body.label.startsWith("wall")) {
        ctx.fillStyle = "#27272a"
      } else {
        ctx.fillStyle = "#ef4444"
      }
      ctx.fill()
      ctx.strokeStyle = "#3f3f46"
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Draw robot
    const robotBody = robot.body
    ctx.save()
    ctx.translate(robotBody.position.x, robotBody.position.y)
    ctx.rotate(robotBody.angle)

    // Robot body
    ctx.beginPath()
    const w = robot.config.width / 2
    const h = robot.config.height / 2
    ctx.moveTo(-w, -h)
    ctx.lineTo(-w, h)
    ctx.lineTo(w * 0.5, h)
    ctx.lineTo(w, h * 0.5)
    ctx.lineTo(w, -h * 0.5)
    ctx.lineTo(w * 0.5, -h)
    ctx.closePath()
    ctx.fillStyle = robot.config.color
    ctx.fill()
    ctx.strokeStyle = "#16a34a"
    ctx.lineWidth = 2
    ctx.stroke()

    // Direction indicator
    ctx.beginPath()
    ctx.moveTo(w * 0.3, 0)
    ctx.lineTo(w, 0)
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 3
    ctx.stroke()

    // Wheels
    ctx.fillStyle = "#1f2937"
    ctx.fillRect(-w - 5, -h + 5, 8, 15)
    ctx.fillRect(-w - 5, h - 20, 8, 15)

    ctx.restore()

    // Draw sensor rays
    if (isRunning) {
      const sensorAngles = [0, -Math.PI / 4, Math.PI / 4]
      const sensorColors = ["#3b82f6", "#8b5cf6", "#8b5cf6"]
      
      for (let i = 0; i < sensorAngles.length; i++) {
        const angle = robotBody.angle + sensorAngles[i]
        const result = castRay(
          physics.engine,
          robotBody.position.x,
          robotBody.position.y,
          angle,
          robot.config.sensorRange
        )

        const endX = robotBody.position.x + Math.cos(angle) * result.distance
        const endY = robotBody.position.y + Math.sin(angle) * result.distance

        ctx.beginPath()
        ctx.moveTo(robotBody.position.x, robotBody.position.y)
        ctx.lineTo(endX, endY)
        ctx.strokeStyle = sensorColors[i] + "60"
        ctx.lineWidth = 2
        ctx.stroke()

        if (result.hitBody) {
          ctx.beginPath()
          ctx.arc(endX, endY, 5, 0, Math.PI * 2)
          ctx.fillStyle = sensorColors[i]
          ctx.fill()
        }
      }
    }

    ctx.restore()

    // Update robot physics
    if (isRunning) {
      robot.update()

      // Update sensor readings
      const state = robot.getState()
      const sensorAngles = [0, -Math.PI / 4, Math.PI / 4]
      const sensorResults = sensorAngles.map((angleOffset) => {
        return castRay(
          physics.engine,
          robotBody.position.x,
          robotBody.position.y,
          robotBody.angle + angleOffset,
          robot.config.sensorRange
        )
      })

      state.sensors.front = sensorResults[0].distance
      state.sensors.left = sensorResults[1].distance
      state.sensors.right = sensorResults[2].distance

      // Check line sensors
      if (config.lineTrack) {
        const frontOffset = robot.config.width / 2
        const sideOffset = robot.config.height / 3
        const cos = Math.cos(robotBody.angle)
        const sin = Math.sin(robotBody.angle)

        state.sensors.lineCenter = isPointOnLine(
          robotBody.position.x + cos * frontOffset,
          robotBody.position.y + sin * frontOffset,
          config.lineTrack
        )
        state.sensors.lineLeft = isPointOnLine(
          robotBody.position.x + cos * frontOffset - sin * sideOffset,
          robotBody.position.y + sin * frontOffset + cos * sideOffset,
          config.lineTrack
        )
        state.sensors.lineRight = isPointOnLine(
          robotBody.position.x + cos * frontOffset + sin * sideOffset,
          robotBody.position.y + sin * frontOffset - cos * sideOffset,
          config.lineTrack
        )
      }

      onRobotUpdate?.(state)

      // Check goals (debounced to fire once per run)
      if (config.goals && !goalFiredRef.current) {
        for (const goal of config.goals) {
          if (isPointInGoal(robotBody.position.x, robotBody.position.y, goal)) {
            goalFiredRef.current = true
            console.log("Goal reached!")
            onGoalReached?.()
            break
          }
        }
      }
    }

    animationRef.current = requestAnimationFrame(render)
  }, [dimensions, isRunning, onRobotUpdate, onGoalReached, physicsRef, robotRef])

  // Start render loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(render)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-background rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="border border-border rounded-lg"
      />
    </div>
  )
}


