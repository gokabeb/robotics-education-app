"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Bot, Code, Zap, Trophy, Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SimulatorCanvas } from "./simulator-canvas"
import { SimulatorControls } from "./simulator-controls"
import { CodeExecutionPanel } from "./code-execution-panel"
import { SerialMonitor, makeSerialLine } from "./serial-monitor"
import { VirtualRobot, RobotState } from "@/lib/simulator/robot"
import { PhysicsWorld } from "@/lib/simulator/physics"
import { ARENAS } from "@/lib/simulator/arena"
import { SAMPLE_CHALLENGES } from "@/lib/challenges/types"
import { ChallengeOverlay } from "./challenge-overlay"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import type { AVRCommand, AVREvent, BoardId, CompileDiagnostic } from "@/lib/avr/types"
import { toast } from "sonner"
import Link from "next/link"

type RunState = "idle" | "compiling" | "running" | "paused"

const DEFAULT_CODE = `void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
  Serial.println("Blink!");
}`

export function SimulatorView() {
  // Challenge mode — must be before useState calls that depend on it
  const searchParams = useSearchParams()
  const challengeId = searchParams.get("challenge")
  const challengeDef = challengeId
    ? SAMPLE_CHALLENGES.find((c) => c.title.toLowerCase().replace(/\s+/g, "-") === challengeId)
    : null

  const [isRunning, setIsRunning] = useState(false)
  const [selectedArena, setSelectedArena] = useState(challengeDef?.arena_id ?? "open-arena")
  const [robotState, setRobotState] = useState<RobotState | null>(null)
  const [speed, setSpeed] = useState(50)
  const [goalReached, setGoalReached] = useState(false)
  const [arenaKey, setArenaKey] = useState(0)
  const [activeTab, setActiveTab] = useState<"controls" | "code" | "serial">("controls")

  // AVR state
  const [code, setCode] = useState(() =>
    typeof window !== "undefined" ? (sessionStorage.getItem("xylo_code") ?? DEFAULT_CODE) : DEFAULT_CODE
  )
  const [board, setBoard] = useState<BoardId>("arduino-uno")
  const [runState, setRunState] = useState<RunState>("idle")
  const [compileErrors, setCompileErrors] = useState<CompileDiagnostic[]>([])
  const [serialLines, setSerialLines] = useState<ReturnType<typeof makeSerialLine>[]>([])

  // Challenge state
  const [challengeResult, setChallengeResult] = useState<{
    completed: boolean; score: number; message: string; timeSeconds?: number; collisionCount?: number
  } | null>(null)
  const runStartTimeRef = useRef<number | null>(null)
  const collisionCountRef = useRef(0)
  const [collisionCount, setCollisionCount] = useState(0)

  const robotRef = useRef<VirtualRobot | null>(null)
  const physicsRef = useRef<PhysicsWorld | null>(null)
  const avrWorkerRef = useRef<Worker | null>(null)
  const bridgeRef = useRef<GPIOBridge | null>(null)

  // Show toast if code was loaded from session storage
  useEffect(() => {
    const projectName = sessionStorage.getItem("xylo_project_name")
    if (sessionStorage.getItem("xylo_code") && projectName) {
      toast.success(`Loaded code from: ${projectName}`, {
        description: "Ready to test in simulator!",
      })
    }
  }, [])

  // Create AVR worker and GPIO bridge on mount
  useEffect(() => {
    const worker = new Worker(new URL("../../workers/avr-worker.ts", import.meta.url))
    avrWorkerRef.current = worker

    const bridge = new GPIOBridge({
      avrWorker: worker,
      onPinChange: ({ pin, high }) => {
        // Phase 1: pin 13 maps to robot LED indicator
        if (pin === 13) {
          setIsRunning(high)
        }
      },
      onSerialOutput: (text) => {
        setSerialLines((prev) => [...prev.slice(-499), makeSerialLine(text)])
      },
      onAVRError: (message) => {
        toast.error(`Execution error: ${message}`)
        setRunState("idle")
        setIsRunning(false)
      },
      onAVRStopped: () => {
        setRunState("idle")
        setIsRunning(false)
      },
    })
    bridgeRef.current = bridge

    worker.addEventListener("message", (e: MessageEvent<AVREvent>) => {
      const event = e.data
      if (event.type === "running") {
        setRunState("running")
        setIsRunning(true)
      } else if (event.type === "paused") {
        setRunState("paused")
      } else if (event.type === "stopped") {
        setRunState("idle")
        setIsRunning(false)
      } else {
        bridge.handleAVREvent(event)
      }
    })

    return () => {
      worker.postMessage({ type: "stop" } satisfies AVRCommand)
      worker.terminate()
    }
  }, [])

  const handleToggleRun = useCallback(() => {
    if (runState === "running") {
      avrWorkerRef.current?.postMessage({ type: "pause" } satisfies AVRCommand)
    } else if (runState === "paused") {
      avrWorkerRef.current?.postMessage({ type: "resume" } satisfies AVRCommand)
    }
  }, [runState])

  const handleReset = useCallback(() => {
    const config = ARENAS.find((a) => a.id === selectedArena) || ARENAS[0]
    if (robotRef.current) {
      robotRef.current.reset(config.robotStartX, config.robotStartY, config.robotStartAngle)
    }
    setGoalReached(false)
    setIsRunning(false)
  }, [selectedArena])

  const handleArenaChange = useCallback((arenaId: string) => {
    setSelectedArena(arenaId)
    setArenaKey((prev) => prev + 1)
    setGoalReached(false)
    setIsRunning(false)
  }, [])

  const handleGoalReached = useCallback(async () => {
    if (!goalReached) {
      setGoalReached(true)
      setIsRunning(false)
      avrWorkerRef.current?.postMessage({ type: "stop" } satisfies AVRCommand)

      if (challengeDef && challengeId) {
        const timeSeconds = runStartTimeRef.current
          ? (Date.now() - runStartTimeRef.current) / 1000
          : 0
        const collisions = collisionCountRef.current

        try {
          const res = await fetch("/api/challenges/attempt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              challengeId,
              codeUsed: code,
              goalReached: true,
              collisionCount: collisions,
              timeSeconds,
            }),
          })
          const result = await res.json()
          setChallengeResult({ ...result, timeSeconds, collisionCount: collisions })
        } catch {
          setChallengeResult({
            completed: true, score: 0,
            message: "Goal reached! (Could not save score — check database connection)",
            timeSeconds,
            collisionCount: collisions,
          })
        }
      } else {
        toast.success("🎉 Congratulations! You reached the goal!", {
          description: "Try another arena or challenge yourself with a harder one!",
        })
      }
    }
  }, [goalReached, challengeDef, challengeId, code])

  const handleAVRCommand = useCallback((cmd: AVRCommand) => {
    if (!avrWorkerRef.current) return

    if (cmd.type === "load" && cmd.hex === "") {
      // CodeExecutionPanel signals compile-start — update state, let panel do the compile
      setRunState("compiling")
      setCompileErrors([])
      return
    }

    avrWorkerRef.current.postMessage(cmd)
  }, [])

  const handleCollision = useCallback((count: number) => {
    collisionCountRef.current = count
    setCollisionCount(count)
  }, [])

  const handleChallengeReset = useCallback(() => {
    setChallengeResult(null)
    setGoalReached(false)
    setIsRunning(false)
    collisionCountRef.current = 0
    setCollisionCount(0)
    runStartTimeRef.current = null
    const config = ARENAS.find((a) => a.id === selectedArena) || ARENAS[0]
    if (robotRef.current) {
      robotRef.current.reset(config.robotStartX, config.robotStartY, config.robotStartAngle)
    }
  }, [selectedArena])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!robotRef.current) return

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          robotRef.current.moveForward(speed)
          setIsRunning(true)
          break
        case "s":
        case "arrowdown":
          robotRef.current.moveBackward(speed)
          setIsRunning(true)
          break
        case "a":
        case "arrowleft":
          robotRef.current.turnLeft(speed)
          setIsRunning(true)
          break
        case "d":
        case "arrowright":
          robotRef.current.turnRight(speed)
          setIsRunning(true)
          break
        case " ":
          robotRef.current.stop()
          break
        case "r":
          handleReset()
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!robotRef.current) return

      const movementKeys = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]
      if (movementKeys.includes(e.key.toLowerCase())) {
        robotRef.current.stop()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [speed, handleReset])

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-b border-border bg-card"
      >
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Robot Simulator
                </h1>
                <p className="mt-1 text-muted-foreground">
                  Test your robot in a virtual environment
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-border" asChild>
                <Link href="/playground">
                  <Code className="mr-2 h-4 w-4" />
                  Block Editor
                </Link>
              </Button>
              <Button size="sm" className="bg-primary text-primary-foreground" asChild>
                <Link href="/flasher">
                  <Zap className="mr-2 h-4 w-4" />
                  Flash to Arduino
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Simulator Canvas */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {ARENAS.find((a) => a.id === selectedArena)?.name || "Arena"}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
                      isRunning
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isRunning ? "bg-primary animate-pulse" : "bg-muted-foreground"
                      }`}
                    />
                    {isRunning ? "Running" : "Paused"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Keyboard className="h-3 w-3" />
                  <span>WASD / Arrow Keys to control</span>
                </div>
              </div>

              <div className="aspect-[4/3] bg-background">
                <SimulatorCanvas
                  key={arenaKey}
                  arenaId={selectedArena}
                  isRunning={isRunning}
                  onRobotUpdate={setRobotState}
                  onGoalReached={handleGoalReached}
                  onCollision={handleCollision}
                  robotRef={robotRef}
                  physicsRef={physicsRef}
                />
              </div>
            </div>

            {/* Challenge result overlay */}
            {challengeResult && challengeDef && (
              <ChallengeOverlay
                result={challengeResult}
                challengeTitle={challengeDef.title}
                onTryAgain={handleChallengeReset}
              />
            )}

            {/* Goal Reached Overlay (non-challenge mode) */}
            {goalReached && !challengeDef && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl"
              >
                <div className="text-center">
                  <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">Goal Reached!</h2>
                  <p className="text-muted-foreground mb-4">
                    Great job navigating your robot to the goal!
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={handleReset}>
                      Try Again
                    </Button>
                    <Button onClick={() => setGoalReached(false)}>
                      Continue
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Controls Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="controls">Controls</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
                <TabsTrigger value="serial">Serial</TabsTrigger>
              </TabsList>
              <TabsContent value="controls" className="p-4 m-0">
                <SimulatorControls
                  isRunning={isRunning}
                  onToggleRun={handleToggleRun}
                  onReset={handleReset}
                  onMoveForward={() => {
                    robotRef.current?.moveForward(speed)
                    setIsRunning(true)
                  }}
                  onMoveBackward={() => {
                    robotRef.current?.moveBackward(speed)
                    setIsRunning(true)
                  }}
                  onTurnLeft={() => {
                    robotRef.current?.turnLeft(speed)
                    setIsRunning(true)
                  }}
                  onTurnRight={() => {
                    robotRef.current?.turnRight(speed)
                    setIsRunning(true)
                  }}
                  onStop={() => robotRef.current?.stop()}
                  robotState={robotState}
                  selectedArena={selectedArena}
                  onArenaChange={handleArenaChange}
                  speed={speed}
                  onSpeedChange={setSpeed}
                />
              </TabsContent>
              <TabsContent value="code" className="m-0 h-[400px]">
                <CodeExecutionPanel
                  code={code}
                  onCodeChange={setCode}
                  runState={runState}
                  onCommand={handleAVRCommand}
                  onErrors={(errors) => {
                    setCompileErrors(errors)
                    setRunState("idle")
                  }}
                  errors={compileErrors}
                  board={board}
                  onBoardChange={setBoard}
                />
              </TabsContent>
              <TabsContent value="serial" className="m-0 p-2">
                <SerialMonitor
                  lines={serialLines}
                  onSend={(data) => bridgeRef.current?.sendSerial(data)}
                  onClear={() => setSerialLines([])}
                />
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
