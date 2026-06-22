// components/mission/mission-sandbox.tsx
"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { BreadboardCanvas } from "@/components/circuit/breadboard-canvas"
import type { DraggedComponent } from "@/components/circuit/breadboard-canvas"
import { ComponentPalette } from "@/components/circuit/component-palette"
import type { PaletteItem } from "@/components/circuit/component-palette"
import { CodeExecutionPanel } from "@/components/simulator/code-execution-panel"
import { SerialMonitor, makeSerialLine } from "@/components/simulator/serial-monitor"
import type { SerialLine } from "@/components/simulator/serial-monitor"
import { BreadboardState } from "@/lib/circuit/breadboard/breadboard-state"
import { CircuitBridge } from "@/lib/circuit/circuit-bridge"
import type { PinNodeMap } from "@/lib/circuit/circuit-bridge"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { ARDUINO_HOLES } from "@/lib/circuit/breadboard/breadboard-layout"
import type { AVRCommand, AVREvent, CompileDiagnostic, BoardId } from "@/lib/avr/types"
import type { CircuitEvent, ComponentFault, SerializedNetlist } from "@/lib/circuit/types"
import { MissionRuntime } from "@/lib/missions/runtime"
import type { Mission, MissionSimSnapshot, MissionTickResult } from "@/lib/missions/types"
import { MissionBriefing } from "./mission-briefing"
import { MissionGoalPanel } from "./mission-goal-panel"
import { MissionHint } from "./mission-hint"
import { VirtualButton } from "./virtual-button"
import { cn } from "@/lib/utils"

type RunState = "idle" | "compiling" | "running" | "paused"
const TICK_MS = 100

export interface MissionCompletionResult {
  timeSeconds: number
  hintsUsed: number
  finalCircuit: SerializedNetlist
  finalCode: string
  criteriaMet: string[]
}

export interface MissionSandboxProps {
  mission: Mission
  onComplete: (result: MissionCompletionResult) => void
  className?: string
}

function buildPinNodeMap(): PinNodeMap {
  const digitalPins = new Map<number, string>()
  const analogPins = new Map<number, string>()
  for (const hole of ARDUINO_HOLES.values()) {
    const dMatch = hole.label.match(/^D(\d+)$/)
    if (dMatch) digitalPins.set(parseInt(dMatch[1], 10), hole.nodeId)
    const aMatch = hole.label.match(/^A(\d+)$/)
    if (aMatch) analogPins.set(parseInt(aMatch[1], 10), hole.nodeId)
  }
  return { digitalPins, analogPins }
}

function missionPaletteItems(mission: Mission): PaletteItem[] {
  return mission.palette.map(spec => ({
    label: spec.label,
    component: { type: spec.type, params: spec.params } as DraggedComponent,
    color: spec.color,
  }))
}

type TabId = "code" | "serial"

export function MissionSandbox({ mission, onComplete, className }: MissionSandboxProps) {
  const [code, setCode] = useState(mission.initial.code)
  const [board, setBoard] = useState<BoardId>("arduino-uno")
  const [runState, setRunState] = useState<RunState>("idle")
  const [compileErrors, setCompileErrors] = useState<CompileDiagnostic[]>([])
  const [serialLines, setSerialLines] = useState<SerialLine[]>([])
  const [brightnessMap, setBrightnessMap] = useState<Record<string, number>>({})
  const [draggedComp, setDraggedComp] = useState<DraggedComponent | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("code")
  const [showBriefing, setShowBriefing] = useState(true)
  const [tickResult, setTickResult] = useState<MissionTickResult>({ criteria: [], complete: false, activeHint: null })
  const [, forceRedraw] = useState(0)

  const bbStateRef = useRef<BreadboardState>(new BreadboardState())
  const avrWorkerRef = useRef<Worker | null>(null)
  const circuitWorkerRef = useRef<Worker | null>(null)
  const bridgeRef = useRef<CircuitBridge | null>(null)
  const gpioBridgeRef = useRef<GPIOBridge | null>(null)
  const runtimeRef = useRef<MissionRuntime | null>(null)
  const completedRef = useRef(false)
  const codeRef = useRef(code)
  const latestFaultsRef = useRef<ComponentFault[]>([])
  const latestNetlistRef = useRef<SerializedNetlist>(mission.initial.circuit)
  const brightnessMapRef = useRef<Record<string, number>>({})

  // Buffers drained on each 100ms tick — see Task 4's MissionSimSnapshot shape.
  const serialBufferRef = useRef("")
  const pendingPinEventsRef = useRef<Array<{ pin: number; high: boolean; timestampMs: number }>>([])
  const pendingVirtualPressesRef = useRef<string[]>([])

  useEffect(() => { codeRef.current = code }, [code])

  const handleErrors = useCallback((errors: CompileDiagnostic[]) => {
    setCompileErrors(errors)
    setRunState("idle")
  }, [])

  const handleNetlistChange = useCallback(() => {
    const netlist = bbStateRef.current.toNetlist()
    latestNetlistRef.current = netlist
    bridgeRef.current?.sendNetlist(netlist)
    forceRedraw(n => n + 1)
  }, [])

  const handleAVRCommand = useCallback((cmd: AVRCommand) => {
    if (cmd.type === "load" && cmd.hex === "") setRunState("compiling")
    avrWorkerRef.current?.postMessage(cmd)
  }, [])

  const handleVirtualPress = useCallback((inputId: string) => {
    pendingVirtualPressesRef.current.push(inputId)
  }, [])

  const handleVirtualSetDigitalInput = useCallback((pin: number, high: boolean) => {
    gpioBridgeRef.current?.setDigitalInput(pin, high)
  }, [])

  // Worker setup — identical wiring to Phase 2's circuit-view.tsx.
  useEffect(() => {
    const avrWorker = new Worker(new URL("@/workers/avr-worker.ts", import.meta.url))
    const circuitWorker = new Worker(new URL("@/workers/circuit-worker.ts", import.meta.url))
    avrWorkerRef.current = avrWorker
    circuitWorkerRef.current = circuitWorker

    const bridge = new CircuitBridge({
      avrWorker,
      circuitWorker,
      pinNodeMap: buildPinNodeMap(),
      onFault: (f) => { latestFaultsRef.current = f },
      onBrightnessUpdate: (bm) => { brightnessMapRef.current = bm; setBrightnessMap(bm) },
    })
    bridgeRef.current = bridge

    const gpioBridge = new GPIOBridge({
      avrWorker,
      onPinChange: ({ pin, high, isPWM, dutyCycle }) => {
        pendingPinEventsRef.current.push({ pin, high, timestampMs: Date.now() })
        bridge.handleAVREvent({ type: "pinChange", pin, high, isPWM, dutyCycle })
      },
      onSerialOutput: (text: string) => {
        serialBufferRef.current += text
        setSerialLines(prev => [...prev, makeSerialLine(text)])
      },
      onAVRError: (message: string) => {
        setCompileErrors([{ line: null, column: null, message, severity: "error" }])
        setRunState("idle")
      },
      onAVRStopped: () => setRunState("idle"),
    })
    gpioBridgeRef.current = gpioBridge

    avrWorker.onmessage = (e: MessageEvent<AVREvent>) => {
      const ev = e.data
      if (ev.type === "running") setRunState("running")
      else if (ev.type === "paused") setRunState("paused")
      else if (ev.type === "stopped") setRunState("idle")
      else gpioBridge.handleAVREvent(ev)
    }

    circuitWorker.onmessage = (e: MessageEvent<CircuitEvent>) => bridge.handleCircuitEvent(e.data)
    circuitWorker.postMessage({ type: "start" })

    runtimeRef.current = new MissionRuntime(mission, Date.now())
    bbStateRef.current = new BreadboardState()
    latestNetlistRef.current = bbStateRef.current.toNetlist()

    return () => {
      avrWorker.terminate()
      circuitWorker.terminate()
      avrWorkerRef.current = null
      circuitWorkerRef.current = null
      bridgeRef.current = null
      gpioBridgeRef.current = null
    }
    // mission is treated as immutable for the lifetime of one sandbox mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mission runtime tick loop — drains the event buffers every 100ms.
  useEffect(() => {
    const interval = setInterval(() => {
      const runtime = runtimeRef.current
      if (!runtime || completedRef.current) return

      const snapshot: MissionSimSnapshot = {
        nowMs: Date.now(),
        netlist: latestNetlistRef.current,
        brightnessMap: brightnessMapRef.current,
        faults: latestFaultsRef.current,
        code: codeRef.current,
        serialBuffer: serialBufferRef.current,
        newPinEvents: pendingPinEventsRef.current,
        newVirtualPresses: pendingVirtualPressesRef.current,
      }
      pendingPinEventsRef.current = []
      pendingVirtualPressesRef.current = []
      latestFaultsRef.current = []

      const result = runtime.tick(snapshot)
      setTickResult(result)

      if (result.complete && !completedRef.current) {
        completedRef.current = true
        onComplete({
          timeSeconds: Math.round((snapshot.nowMs - runtime.getStartedAtMs()) / 1000),
          hintsUsed: runtime.getHintsUsedCount(),
          finalCircuit: latestNetlistRef.current,
          finalCode: codeRef.current,
          criteriaMet: result.criteria.filter(c => c.met).map(c => c.id),
        })
      }
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [onComplete])

  const handleSerialSend = useCallback((data: string) => {
    gpioBridgeRef.current?.sendSerial(data)
  }, [])

  const paletteItems = missionPaletteItems(mission)

  return (
    <div className={cn("flex h-screen w-full overflow-hidden bg-background", className)}>
      {showBriefing && (
        <MissionBriefing mission={mission} onDismiss={() => setShowBriefing(false)} />
      )}

      {/* Left: palette + breadboard */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <div className="w-40 shrink-0 border-r border-border p-2 overflow-y-auto bg-card space-y-2">
          <ComponentPalette items={paletteItems} onPick={(comp) => setDraggedComp(comp)} />
          {draggedComp && (
            <div className="rounded bg-primary/10 border border-primary/30 px-2 py-1 text-[10px] text-primary">
              {draggedComp.type} selected — click a hole to place
            </div>
          )}
          {mission.initial.virtualInputs.map(spec => (
            <VirtualButton
              key={spec.id}
              spec={spec}
              onPress={handleVirtualPress}
              onSetDigitalInput={handleVirtualSetDigitalInput}
              className="w-full"
            />
          ))}
        </div>

        <div className="flex-1 overflow-auto p-2">
          <div className="text-[10px] text-muted-foreground/60 mb-1">
            Click two holes (or an Arduino pin) to draw a wire · Click to select · Del to remove
          </div>
          <BreadboardCanvas
            bbState={bbStateRef.current}
            brightnessMap={brightnessMap}
            onNetlistChange={handleNetlistChange}
            draggedComponent={draggedComp}
            onDragConsumed={() => setDraggedComp(null)}
          />
        </div>
      </div>

      {/* Right: goal panel, hint, code/serial */}
      <div className="w-[360px] shrink-0 flex flex-col border-l border-border overflow-hidden">
        <div className="p-2 space-y-2 border-b border-border">
          <MissionGoalPanel criteria={tickResult.criteria} complete={tickResult.complete} />
          <MissionHint hint={tickResult.activeHint} />
        </div>

        <div className="flex shrink-0 border-b border-border">
          {(["code", "serial"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium capitalize transition-colors",
                activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "code" ? "Code" : "Serial"}
              {tab === "serial" && serialLines.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">({serialLines.length})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <div className={cn("h-full", activeTab === "code" ? "flex" : "hidden")}>
            <CodeExecutionPanel
              code={code}
              onCodeChange={setCode}
              runState={runState}
              onCommand={handleAVRCommand}
              errors={compileErrors}
              onErrors={handleErrors}
              board={board}
              onBoardChange={setBoard}
            />
          </div>
          {mission.layout.serialMonitor && (
            <div className={cn("h-full p-2", activeTab === "serial" ? "flex flex-col" : "hidden")}>
              <SerialMonitor
                lines={serialLines}
                onSend={handleSerialSend}
                onClear={() => setSerialLines([])}
                className="flex-1"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
