// components/circuit/circuit-view.tsx
"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { BreadboardCanvas } from "./breadboard-canvas"
import type { DraggedComponent } from "./breadboard-canvas"
import { ComponentPalette } from "./component-palette"
import { SchematicView } from "./schematic-view"
import { CodeExecutionPanel } from "@/components/simulator/code-execution-panel"
import { SerialMonitor, makeSerialLine } from "@/components/simulator/serial-monitor"
import type { SerialLine } from "@/components/simulator/serial-monitor"
import { BreadboardState } from "@/lib/circuit/breadboard/breadboard-state"
import { CircuitBridge } from "@/lib/circuit/circuit-bridge"
import type { PinNodeMap } from "@/lib/circuit/circuit-bridge"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { ARDUINO_HOLES } from "@/lib/circuit/breadboard/breadboard-layout"
import type { AVRCommand, AVREvent, CompileDiagnostic, BoardId } from "@/lib/avr/types"
import type { CircuitEvent, ComponentFault } from "@/lib/circuit/types"
import type { SerializedNetlist } from "@/lib/circuit/types"
import { cn } from "@/lib/utils"

type RunState = "idle" | "compiling" | "running" | "paused"

const DEFAULT_CODE = `void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED on");
  delay(1000);
  digitalWrite(13, LOW);
  Serial.println("LED off");
  delay(1000);
}
`

function buildPinNodeMap(): PinNodeMap {
  const digitalPins = new Map<number, string>()
  const analogPins = new Map<number, string>()

  for (const hole of ARDUINO_HOLES.values()) {
    // Digital pins D0-D13
    const dMatch = hole.label.match(/^D(\d+)$/)
    if (dMatch) {
      digitalPins.set(parseInt(dMatch[1], 10), hole.nodeId)
    }
    // Analog pins A0-A5
    const aMatch = hole.label.match(/^A(\d+)$/)
    if (aMatch) {
      analogPins.set(parseInt(aMatch[1], 10), hole.nodeId)
    }
  }

  return { digitalPins, analogPins }
}

type TabId = "code" | "serial"

export function CircuitView({ className }: { className?: string }) {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [board, setBoard] = useState<BoardId>("arduino-uno")
  const [runState, setRunState] = useState<RunState>("idle")
  const [compileErrors, setCompileErrors] = useState<CompileDiagnostic[]>([])
  const [serialLines, setSerialLines] = useState<SerialLine[]>([])
  const [faults, setFaults] = useState<ComponentFault[]>([])
  const [brightnessMap, setBrightnessMap] = useState<Record<string, number>>({})
  const [draggedComp, setDraggedComp] = useState<DraggedComponent | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("code")
  const [, forceRedraw] = useState(0)
  const [netlist, setNetlist] = useState<SerializedNetlist>({ nodes: [], components: [] })

  const bbStateRef = useRef<BreadboardState>(new BreadboardState())
  const avrWorkerRef = useRef<Worker | null>(null)
  const circuitWorkerRef = useRef<Worker | null>(null)
  const bridgeRef = useRef<CircuitBridge | null>(null)
  const gpioBridgeRef = useRef<GPIOBridge | null>(null)

  // Memoized handlers
  const handleErrors = useCallback((errors: CompileDiagnostic[]) => {
    setCompileErrors(errors)
    setRunState("idle")
  }, [])

  const handleNetlistChange = useCallback(() => {
    const nl = bbStateRef.current.toNetlist()
    bridgeRef.current?.sendNetlist(nl)
    setNetlist(nl)
    forceRedraw(n => n + 1)
  }, [])

  const handleAVRCommand = useCallback((cmd: AVRCommand) => {
    if (cmd.type === "load" && cmd.hex === "") {
      setRunState("compiling")
    }
    avrWorkerRef.current?.postMessage(cmd)
  }, [])

  // Worker setup
  useEffect(() => {
    const avrWorker = new Worker(new URL("@/workers/avr-worker.ts", import.meta.url))
    const circuitWorker = new Worker(new URL("@/workers/circuit-worker.ts", import.meta.url))
    avrWorkerRef.current = avrWorker
    circuitWorkerRef.current = circuitWorker

    const pinNodeMap = buildPinNodeMap()

    const bridge = new CircuitBridge({
      avrWorker,
      circuitWorker,
      pinNodeMap,
      onFault: (f: ComponentFault[]) => setFaults(f),
      onBrightnessUpdate: (bm: Record<string, number>) => setBrightnessMap(bm),
    })
    bridgeRef.current = bridge

    const gpioBridge = new GPIOBridge({
      avrWorker,
      onPinChange: ({ pin, high, isPWM, dutyCycle }) => {
        // Forward to circuit bridge as pinChange event
        bridge.handleAVREvent({ type: "pinChange", pin, high, isPWM, dutyCycle })
      },
      onSerialOutput: (text: string) => {
        setSerialLines(prev => [...prev, makeSerialLine(text)])
      },
      onAVRError: (message: string) => {
        setCompileErrors([{ line: null, column: null, message, severity: "error" }])
        setRunState("idle")
      },
      onAVRStopped: () => {
        setRunState("idle")
      },
    })
    gpioBridgeRef.current = gpioBridge

    // AVR worker message handler
    avrWorker.onmessage = (e: MessageEvent<AVREvent>) => {
      const ev = e.data
      switch (ev.type) {
        case "running":
          setRunState("running")
          break
        case "paused":
          setRunState("paused")
          break
        case "stopped":
          setRunState("idle")
          break
        default:
          gpioBridge.handleAVREvent(ev)
          break
      }
    }

    // Circuit worker message handler
    circuitWorker.onmessage = (e: MessageEvent<CircuitEvent>) => {
      bridge.handleCircuitEvent(e.data)
    }

    // Start circuit simulation
    circuitWorker.postMessage({ type: "start" })

    return () => {
      avrWorker.terminate()
      circuitWorker.terminate()
      avrWorkerRef.current = null
      circuitWorkerRef.current = null
      bridgeRef.current = null
      gpioBridgeRef.current = null
    }
  }, [])

  const handleSerialSend = useCallback((data: string) => {
    gpioBridgeRef.current?.sendSerial(data)
  }, [])

  const handleSerialClear = useCallback(() => {
    setSerialLines([])
  }, [])

  void faults // available for fault display if needed

  return (
    <div className={cn("flex h-screen w-full overflow-hidden bg-background", className)}>
      {/* Left area: palette + breadboard | schematic split */}
      <PanelGroup direction="horizontal" className="flex flex-1 min-w-0 overflow-hidden">
        {/* Breadboard + palette panel (default 60%) */}
        <Panel defaultSize={60} minSize={30} className="flex overflow-hidden">
          {/* Component palette */}
          <div className="w-36 shrink-0 border-r border-border p-2 overflow-y-auto bg-card">
            <ComponentPalette
              onPick={(comp) => setDraggedComp(comp)}
            />
            {draggedComp && (
              <div className="mt-2 rounded bg-primary/10 border border-primary/30 px-2 py-1 text-[10px] text-primary">
                {draggedComp.type} selected — click a hole to place
              </div>
            )}
          </div>

          {/* Breadboard area */}
          <div className="flex-1 overflow-auto p-2">
            <div className="text-[10px] text-muted-foreground/60 mb-1">
              {runState !== "idle" ? (
                <span className="text-amber-400">Simulation running — breadboard live</span>
              ) : (
                "Click two holes to draw a wire · Click a component/wire to select · Del to remove · Click button to toggle"
              )}
            </div>
            <BreadboardCanvas
              bbState={bbStateRef.current}
              brightnessMap={brightnessMap}
              onNetlistChange={handleNetlistChange}
              draggedComponent={draggedComp}
              onDragConsumed={() => setDraggedComp(null)}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/40 transition-colors cursor-col-resize" />

        {/* Schematic panel (default 40%) */}
        <Panel defaultSize={40} minSize={30} className="overflow-hidden bg-[#111827]">
          <div className="flex flex-col h-full">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b border-border uppercase tracking-wide shrink-0">
              Schematic
            </div>
            <div className="flex-1 min-h-0">
              <SchematicView netlist={netlist} />
            </div>
          </div>
        </Panel>
      </PanelGroup>

      {/* Right: code + serial panel (340px) */}
      <div className="w-[340px] shrink-0 flex flex-col border-l border-border overflow-hidden">
        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border">
          {(["code", "serial"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium capitalize transition-colors",
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "code" ? "Code" : "Serial"}
              {tab === "serial" && serialLines.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">({serialLines.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
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
          <div className={cn("h-full p-2", activeTab === "serial" ? "flex flex-col" : "hidden")}>
            <SerialMonitor
              lines={serialLines}
              onSend={handleSerialSend}
              onClear={handleSerialClear}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
