"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { RobotProjectStore, WorkspaceSnapshot } from "@/lib/workspace/robot-project-store"
import { ChassisPhysicsBridge } from "@/lib/workspace/chassis-physics-bridge"
import { GPIOBridge } from "@/lib/avr/gpio-bridge"
import { compileSketch } from "@/lib/avr/compiler"
import type { AVREvent } from "@/lib/avr/types"
import { getComponentDef } from "@/lib/workspace/component-types"

export function WorkspaceSimulatorView({ store }: { store: RobotProjectStore }) {
  // store.getFlashed() only swaps reference on flash(), and isOutOfSync()
  // returns a fresh primitive each call — but useSyncExternalStore still
  // needs stable subscribe/getSnapshot identity across renders to avoid
  // resubscribing every render, matching the pattern established in
  // workspace-builder-view.tsx and chassis-canvas.tsx for this store.
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getFlashedSnapshot = useCallback(() => store.getFlashed(), [store])
  const getOutOfSyncSnapshot = useCallback(() => store.isOutOfSync(), [store])
  const flashed = useSyncExternalStore(subscribe, getFlashedSnapshot)
  const outOfSync = useSyncExternalStore(subscribe, getOutOfSyncSnapshot)

  const [componentState, setComponentState] = useState<Record<string, boolean>>({})
  const [running, setRunning] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const avrWorkerRef = useRef<Worker | null>(null)
  const flashedRef = useRef<WorkspaceSnapshot | null>(null)

  useEffect(() => {
    if (!flashed) return
    flashedRef.current = flashed
    setComponentState({})
    setRunning(false)
    setCompileError(null)
    setRuntimeError(null)

    const avrWorker = new Worker(new URL("@/workers/avr-worker.ts", import.meta.url))
    avrWorkerRef.current = avrWorker

    const bridge = new ChassisPhysicsBridge({
      components: flashed.components,
      onComponentStateChange: (id, active) => setComponentState((prev) => ({ ...prev, [id]: active })),
    })

    const gpioBridge = new GPIOBridge({
      avrWorker,
      onPinChange: (payload) => bridge.handlePinChange(payload),
      onAVRError: (message) => {
        setRuntimeError(message)
        setRunning(false)
      },
      onAVRStopped: () => setRunning(false),
    })

    avrWorker.onmessage = (e: MessageEvent<AVREvent>) => {
      const ev = e.data
      switch (ev.type) {
        case "running":
          setRunning(true)
          break
        case "stopped":
          setRunning(false)
          break
        default:
          gpioBridge.handleAVREvent(ev)
          break
      }
    }

    compileSketch({ code: flashed.code.generatedCode, board: "arduino-uno" })
      .then((result) => {
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
      avrWorker.terminate()
      avrWorkerRef.current = null
      setRunning(false)
    }
    // Re-bootstrap only when the flashed snapshot's hash changes, not on every store notification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashed?.hash])

  if (!flashed) {
    return <div className="p-4 text-sm text-muted-foreground">Nothing flashed yet — flash from the Builder tab first.</div>
  }

  if (outOfSync) {
    return (
      <div className="p-4 text-sm text-amber-500">
        Out of sync with the Builder — reflash to run the latest build.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="text-xs text-muted-foreground">{running ? "Running" : "Stopped"}</div>
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
      <div className="flex flex-wrap gap-3">
        {flashedRef.current?.components.map((component) => {
          const def = getComponentDef(component.type)
          const active = componentState[component.id] ?? false
          return (
            <div
              key={component.id}
              data-testid={`sim-component-${component.id}`}
              className="rounded border border-border p-2 text-xs"
              style={{ opacity: active ? 1 : 0.4, borderLeftColor: def.color, borderLeftWidth: 4 }}
            >
              {component.name} — {active ? "ON" : "OFF"}
            </div>
          )
        })}
      </div>
    </div>
  )
}
