// app/workspace/[projectId]/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { WorkspaceBuilderView } from "@/components/workspace/workspace-builder-view"
import { WorkspaceEditorPanel } from "@/components/workspace/workspace-editor-panel"
import { WorkspaceSimulatorView } from "@/components/workspace/workspace-simulator-view"
import type { AVRCommand, CompileDiagnostic } from "@/lib/avr/types"
import type { RunState } from "@/components/simulator/code-execution-panel"

type TabId = "builder" | "editor" | "simulator"

// Auto-save is debounced: the store's `subscribe` fires synchronously on
// every mutation (including high-frequency ones like dragging a component
// across the canvas, which calls `moveComponent` many times per second).
// Without debouncing this would fire a PATCH per mutation. Trailing-edge
// debounce coalesces bursts into a single request once mutations settle.
const AUTOSAVE_DEBOUNCE_MS = 500

export default function WorkspaceProjectPage() {
  const params = useParams<{ projectId: string }>()
  const storeRef = useRef<RobotProjectStore>(new RobotProjectStore())
  const [tab, setTab] = useState<TabId>("builder")
  const [runState, setRunState] = useState<RunState>("idle")
  const [errors, setErrors] = useState<CompileDiagnostic[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/workspace-projects/${params.projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        storeRef.current = RobotProjectStore.fromJSON({
          components: data.components ?? [],
          code: data.code ?? { source: "blocks", blocklyXml: null, generatedCode: "" },
          flashed: data.flashed ?? null,
        })
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [params.projectId])

  useEffect(() => {
    if (!loaded) return
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const save = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        fetch(`/api/workspace-projects/${params.projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(storeRef.current.toJSON()),
        })
      }, AUTOSAVE_DEBOUNCE_MS)
    }

    const unsubscribe = storeRef.current.subscribe(save)
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [loaded, params.projectId])

  const handleCommand = (cmd: AVRCommand) => {
    if (cmd.type === "load") setRunState("compiling")
    // Compilation/run wiring for the Editor tab's manual-code path is handled
    // inside CodeExecutionPanel + WorkspaceEditorPanel; this page only tracks
    // run-state for the disabled/enabled affordances on the tab bar.
    void cmd
  }

  if (!loaded) return <div className="p-4 text-sm text-muted-foreground">Loading project…</div>

  return (
    <div className="flex h-screen flex-col">
      <div className="flex border-b border-border">
        {(["builder", "editor", "simulator"] as TabId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm capitalize ${tab === id ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          >
            {id}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "builder" && <WorkspaceBuilderView store={storeRef.current} />}
        {tab === "editor" && (
          <WorkspaceEditorPanel
            store={storeRef.current}
            runState={runState}
            onCommand={handleCommand}
            errors={errors}
            onErrors={setErrors}
          />
        )}
        {tab === "simulator" && <WorkspaceSimulatorView store={storeRef.current} />}
      </div>
    </div>
  )
}
