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
import { VirtualRobot, RobotState } from "@/lib/simulator/robot"
import { PhysicsWorld } from "@/lib/simulator/physics"
import { RobotExecutor, ExecutionState, isArduinoCode } from "@/lib/simulator/executor"
import { transpileArduino } from "@/lib/simulator/arduino-transpiler"
import { ARENAS } from "@/lib/simulator/arena"
import { SAMPLE_CHALLENGES } from "@/lib/challenges/types"
import { ChallengeOverlay } from "./challenge-overlay"
import { toast } from "sonner"
import Link from "next/link"

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
  const [activeTab, setActiveTab] = useState<"controls" | "code">("controls")
  const [code, setCode] = useState("")
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null)
  const [isArduinoMode, setIsArduinoMode] = useState(false)
  const [transpiledScript, setTranspiledScript] = useState<string>("")
  const [unsupportedConstructs, setUnsupportedConstructs] = useState<string[]>([])
  const [challengeResult, setChallengeResult] = useState<{
    completed: boolean; score: number; message: string; timeSeconds?: number; collisionCount?: number
  } | null>(null)
  const runStartTimeRef = useRef<number | null>(null)
  const collisionCountRef = useRef(0)
  const [collisionCount, setCollisionCount] = useState(0)

  const robotRef = useRef<VirtualRobot | null>(null)
  const physicsRef = useRef<PhysicsWorld | null>(null)
  const executorRef = useRef<RobotExecutor | null>(null)

  // Load AI-generated code from session storage on mount
  useEffect(() => {
    const savedCode = sessionStorage.getItem("xylo_code")
    const projectName = sessionStorage.getItem("xylo_project_name")
    
    if (savedCode) {
      setCode(savedCode)
      setActiveTab("code")

      // Auto-detect and transpile Arduino code
      if (isArduinoCode(savedCode)) {
        setIsArduinoMode(true)
        const result = transpileArduino(savedCode)
        setTranspiledScript(result.script)
        setUnsupportedConstructs(result.unsupported)
        if (result.error) {
          toast.error(`Transpile error: ${result.error}`)
        }
      }

      if (projectName) {
        toast.success(`Loaded code from: ${projectName}`, {
          description: "Ready to test in simulator!",
        })
      }
    }
  }, [])

  const handleToggleRun = useCallback(() => {
    setIsRunning((prev) => !prev)
  }, [])

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
      executorRef.current?.stop()

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

  // Code execution handlers
  const handleExecuteCode = useCallback(() => {
    if (!robotRef.current || !physicsRef.current || !code.trim()) return

    // Use transpiled script if in Arduino mode, otherwise use raw code
    const scriptToRun = isArduinoMode ? transpiledScript : code

    if (isArduinoMode && !transpiledScript) {
      toast.error("Transpilation produced no runnable script.")
      return
    }

    const executor = new RobotExecutor(
      robotRef.current,
      physicsRef.current,
      {
        onStateChange: setExecutionState,
        onRobotUpdate: setRobotState,
        onComplete: () => {
          toast.success("Code execution completed!")
          setIsRunning(false)
        },
        onError: (error) => {
          toast.error(`Execution error: ${error}`)
          setIsRunning(false)
        },
        getSensorValue: (sensor) => {
          const state = robotRef.current?.getState()
          if (!state) return 0
          switch (sensor) {
            case "front": return state.sensors.front
            case "left": return state.sensors.left
            case "right": return state.sensors.right
            case "lineCenter": return state.sensors.lineCenter ? 1 : 0
            default: return 0
          }
        },
      }
    )

    executorRef.current = executor
    const commands = executor.parseScript(scriptToRun)

    // Reset challenge tracking
    if (challengeDef) {
      runStartTimeRef.current = Date.now()
      collisionCountRef.current = 0
      setCollisionCount(0)
      setChallengeResult(null)
    }

    setIsRunning(true)
    executor.execute(commands)
  }, [code, isArduinoMode, transpiledScript, challengeDef])

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

  const handlePauseCode = useCallback(() => {
    executorRef.current?.pause()
  }, [])

  const handleResumeCode = useCallback(() => {
    executorRef.current?.resume()
  }, [])

  const handleStopCode = useCallback(() => {
    executorRef.current?.stop()
    setIsRunning(false)
  }, [])

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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "controls" | "code")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="controls">Controls</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
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
              <TabsContent value="code" className="m-0">
                <CodeExecutionPanel
                  code={code}
                  onCodeChange={setCode}
                  executionState={executionState}
                  onExecute={handleExecuteCode}
                  onPause={handlePauseCode}
                  onResume={handleResumeCode}
                  onStop={handleStopCode}
                  isArduinoMode={isArduinoMode}
                  transpiledScript={transpiledScript}
                  unsupportedConstructs={unsupportedConstructs}
                />
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

