"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import RAPIER from "@dimforge/rapier2d-compat"
import type { RobotProjectStore, WorkspaceSnapshot } from "@/lib/workspace/robot-project-store"
import { ChassisPhysicsBridge } from "@/lib/workspace/chassis-physics-bridge"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { compileSketch } from "@/lib/avr/compiler"
import { createPhysicsWorld, addArenaBodies } from "@/lib/simulator/rapier-physics"
import { VirtualRobot } from "@/lib/simulator/rapier-robot"
import { SensorSimulation, type SensorPinConfig } from "@/lib/simulator/sensor-simulation"
import { ARENAS, type ArenaConfig } from "@/lib/simulator/arena"
import type { AVREvent } from "@/lib/avr/types"
import { getComponentDef } from "@/lib/workspace/component-types"

const CANVAS_W = 800
const CANVAS_H = 600

function deriveSensorPins(snapshot: WorkspaceSnapshot): SensorPinConfig {
  const sensors = snapshot.components.filter((c) => c.type === "sensor")
  const count = sensors.length

  // Assign by sensor count to match real build patterns:
  //   1 sensor  → distance only (e.g. obstacle-avoider)
  //   3 sensors → all line sensors left/center/right (standard line-follower)
  //   4 sensors → distance + 3 line sensors
  if (count === 1) {
    return {
      distanceSensorPin:   sensors[0].pin,
      lineSensorLeftPin:   null,
      lineSensorCenterPin: null,
      lineSensorRightPin:  null,
      bumpPin: null,
    }
  }
  if (count === 3) {
    return {
      distanceSensorPin:   null,
      lineSensorLeftPin:   sensors[0].pin,
      lineSensorCenterPin: sensors[1].pin,
      lineSensorRightPin:  sensors[2].pin,
      bumpPin: null,
    }
  }
  if (count === 4) {
    return {
      distanceSensorPin:   sensors[0].pin,
      lineSensorLeftPin:   sensors[1].pin,
      lineSensorCenterPin: sensors[2].pin,
      lineSensorRightPin:  sensors[3].pin,
      bumpPin: null,
    }
  }
  return {
    distanceSensorPin:   null,
    lineSensorLeftPin:   null,
    lineSensorCenterPin: null,
    lineSensorRightPin:  null,
    bumpPin: null,
  }
}

function drawArena(ctx: CanvasRenderingContext2D, arena: ArenaConfig): void {
  ctx.fillStyle = "#f8f8f8"
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Arena border
  ctx.strokeStyle = "#333"
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2)

  // Line track
  if (arena.lineTrack) {
    ctx.strokeStyle = "#111"
    ctx.lineWidth = 20
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    for (const seg of arena.lineTrack) {
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
    }
    ctx.stroke()
  }

  // Goals
  if (arena.goals) {
    for (const goal of arena.goals) {
      ctx.beginPath()
      ctx.arc(goal.x, goal.y, goal.radius, 0, Math.PI * 2)
      ctx.fillStyle = goal.color + "44"
      ctx.fill()
      ctx.strokeStyle = goal.color
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = goal.color
      ctx.font = "12px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(goal.label, goal.x, goal.y + 4)
    }
  }
}

function drawRobot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number,
  servoAngle: number,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)

  // Robot body
  ctx.fillStyle = "#22c55e"
  ctx.strokeStyle = "#16a34a"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.rect(-30, -25, 60, 50)
  ctx.fill()
  ctx.stroke()

  // Heading arrow
  ctx.strokeStyle = "#fff"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(25, 0)
  ctx.stroke()

  // Servo arm (orange line from center)
  const servoRad = ((servoAngle - 90) * Math.PI) / 180
  ctx.strokeStyle = "#FF5722"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(servoRad) * 20, Math.sin(servoRad) * 20)
  ctx.stroke()

  ctx.restore()
}

function drawLEDs(
  ctx: CanvasRenderingContext2D,
  snapshot: WorkspaceSnapshot,
  brightnessMap: Record<string, number>,
): void {
  let ledIndex = 0
  for (const comp of snapshot.components) {
    if (comp.type !== "led") continue
    const def = getComponentDef(comp.type)
    const brightness = brightnessMap[comp.id] ?? 0
    const x = 20 + ledIndex * 40
    const y = CANVAS_H - 30

    ctx.save()
    if (brightness > 0.1) {
      ctx.shadowBlur = 12
      ctx.shadowColor = def.color
    }
    ctx.globalAlpha = Math.max(0.15, brightness)
    ctx.fillStyle = def.color
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.fillStyle = "#555"
    ctx.font = "10px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(comp.name, x, y + 18)
    ledIndex++
  }
}

export function WorkspaceSimulatorView({ store }: { store: RobotProjectStore }) {
  const subscribe = useCallback((l: () => void) => store.subscribe(l), [store])
  const getFlashedSnapshot = useCallback(() => store.getFlashed(), [store])
  const getOutOfSyncSnapshot = useCallback(() => store.isOutOfSync(), [store])
  const flashed = useSyncExternalStore(subscribe, getFlashedSnapshot)
  const outOfSync = useSyncExternalStore(subscribe, getOutOfSyncSnapshot)

  const [running, setRunning] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [selectedArenaId, setSelectedArenaId] = useState("line-follow")
  const [physicsLoading, setPhysicsLoading] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const avrWorkerRef = useRef<Worker | null>(null)
  const rapierRef = useRef<{ world: RAPIER.World; robot: VirtualRobot; sensors: SensorSimulation } | null>(null)
  const animFrameRef = useRef<number>(0)
  const brightnessMapRef = useRef<Record<string, number>>({})
  const flashedRef = useRef<WorkspaceSnapshot | null>(null)

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const selectedArena = ARENAS.find((a) => a.id === selectedArenaId) ?? ARENAS[0]

    function loop() {
      if (!ctx) return
      const r = rapierRef.current
      if (r) {
        r.robot.update()
        r.world.step()
        r.sensors.tick()
      }

      drawArena(ctx, selectedArena)
      if (r) {
        const state = r.robot.getState()
        drawRobot(ctx, state.x, state.y, state.angle, state.servoAngle)
      }
      if (flashedRef.current) {
        drawLEDs(ctx, flashedRef.current, brightnessMapRef.current)
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [selectedArenaId, flashed?.hash])

  // AVR + Rapier bootstrap — re-runs when the flashed snapshot hash changes
  useEffect(() => {
    if (!flashed) return
    flashedRef.current = flashed
    setRunning(false)
    setCompileError(null)
    setRuntimeError(null)
    brightnessMapRef.current = {}

    // Tear down previous Rapier world
    if (rapierRef.current) {
      rapierRef.current.robot.destroy()
      rapierRef.current.world.free()
      rapierRef.current = null
    }

    const selectedArena = ARENAS.find((a) => a.id === selectedArenaId) ?? ARENAS[0]
    const sensorPins = deriveSensorPins(flashed)

    const avrWorker = new Worker(new URL("@/workers/avr-worker.ts", import.meta.url))
    avrWorkerRef.current = avrWorker

    const physicsBridge = new ChassisPhysicsBridge({
      components: flashed.components,
      onComponentStateChange: (id, _active, dutyCycle) => {
        brightnessMapRef.current = { ...brightnessMapRef.current, [id]: dutyCycle / 255 }
      },
      onMotorsChange: (leftDuty, rightDuty) => {
        rapierRef.current?.robot.setMotors(leftDuty, rightDuty)
      },
      onServoChange: (angleDeg) => {
        rapierRef.current?.robot.setServoAngle(angleDeg)
      },
    })

    const gpioBridge = new GPIOBridge({
      avrWorker,
      onPinChange: (payload) => physicsBridge.handlePinChange(payload),
      onAVRError: (msg) => { setRuntimeError(msg); setRunning(false) },
      onAVRStopped: () => setRunning(false),
    })

    avrWorker.onmessage = (e: MessageEvent<AVREvent>) => {
      const ev = e.data
      if (ev.type === "running") { setRunning(true); return }
      if (ev.type === "stopped") { setRunning(false); return }
      gpioBridge.handleAVREvent(ev)
    }

    // Initialise Rapier world asynchronously, then compile + run
    let cancelled = false
    setPhysicsLoading(true)
    createPhysicsWorld()
      .then((world) => {
        if (cancelled) { world.free(); return }
        setPhysicsLoading(false)
        addArenaBodies(world, selectedArena.id)
        const robot = new VirtualRobot(world, selectedArena.robotStartX, selectedArena.robotStartY, selectedArena.robotStartAngle)
        const sensors = new SensorSimulation(world, robot, selectedArena, gpioBridge, sensorPins)
        rapierRef.current = { world, robot, sensors }

        return compileSketch({ code: flashed.code.generatedCode, board: "arduino-uno" })
      })
      .then((result) => {
        if (!result) return
        if (result.success) {
          avrWorker.postMessage({ type: "load", hex: result.hex, board: "arduino-uno" })
          avrWorker.postMessage({ type: "run" })
        } else {
          setCompileError(result.errors.map((e) => e.message).join("\n") || "Compile failed")
        }
      })
      .catch((err: unknown) => {
        setCompileError(err instanceof Error ? err.message : "Compile failed")
      })

    return () => {
      cancelled = true
      avrWorker.terminate()
      avrWorkerRef.current = null
      if (rapierRef.current) {
        rapierRef.current.robot.destroy()
        rapierRef.current.world.free()
        rapierRef.current = null
      }
      setRunning(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashed?.hash, selectedArenaId])

  if (!flashed) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Nothing flashed yet — flash from the Builder tab first.
      </div>
    )
  }

  if (outOfSync) {
    return (
      <div className="p-4 text-sm text-amber-500">
        Out of sync with the Builder — reflash to run the latest build.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{running ? "▶ Running" : "⏹ Stopped"}</span>
        <select
          className="rounded border border-border bg-background px-2 py-1 text-xs"
          value={selectedArenaId}
          onChange={(e) => setSelectedArenaId(e.target.value)}
        >
          {ARENAS.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      {compileError && (
        <div data-testid="sim-compile-error" className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Compile error: {compileError}
        </div>
      )}
      {runtimeError && (
        <div data-testid="sim-runtime-error" className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          Runtime error: {runtimeError}
        </div>
      )}
      {physicsLoading && (
        <div className="text-xs text-muted-foreground">Loading simulator…</div>
      )}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded border border-border"
        style={{ maxWidth: "100%", aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
      />
    </div>
  )
}
