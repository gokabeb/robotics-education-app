// components/workspace/workspace-editor-panel.tsx
"use client"

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react"
import * as Blockly from "blockly"
import { CodeExecutionPanel } from "@/components/simulator/code-execution-panel"
import type { RunState } from "@/components/simulator/code-execution-panel"
import type { AVRCommand, CompileDiagnostic } from "@/lib/avr/types"
import type { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { registerWorkspaceBlocks, setActiveWorkspaceStore } from "@/lib/workspace/blockly-workspace-blocks"
import { buildWorkspaceToolbox } from "@/lib/workspace/blockly-dynamic-toolbox"
import { generateWorkspaceArduinoCode } from "@/lib/workspace/blockly-workspace-generator"

registerWorkspaceBlocks()

interface WorkspaceEditorPanelProps {
  store: RobotProjectStore
  runState: RunState
  onCommand: (cmd: AVRCommand) => void
  errors: CompileDiagnostic[]
  onErrors: (errors: CompileDiagnostic[]) => void
}

export function WorkspaceEditorPanel({ store, runState, onCommand, errors, onErrors }: WorkspaceEditorPanelProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const [pendingSwitchToBlocks, setPendingSwitchToBlocks] = useState(false)

  // `subscribe`/`getSnapshot` need stable identity (via useCallback) so
  // useSyncExternalStore doesn't resubscribe/re-evaluate on every render.
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.getCode(), [store])
  const code = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    setActiveWorkspaceStore(store)
    return () => setActiveWorkspaceStore(null)
  }, [store])

  useEffect(() => {
    if (!blocklyDiv.current || workspaceRef.current) return
    const ws = Blockly.inject(blocklyDiv.current, { toolbox: buildWorkspaceToolbox(store) })
    workspaceRef.current = ws
    if (code.blocklyXml) {
      try {
        const xml = Blockly.utils.xml.textToDom(code.blocklyXml)
        Blockly.Xml.domToWorkspace(xml, ws)
      } catch {
        // Stale/invalid XML — start from an empty workspace rather than blocking the editor.
      }
    }
    ws.addChangeListener(() => {
      const generated = generateWorkspaceArduinoCode(ws, store)
      const xmlText = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws))
      store.setBlocklyXml(xmlText, generated)
    })
    return () => {
      ws.dispose()
      workspaceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live-refresh the toolbox whenever placed components change.
  useEffect(() => {
    return store.subscribe(() => {
      if (workspaceRef.current) {
        workspaceRef.current.updateToolbox(buildWorkspaceToolbox(store))
      }
    })
  }, [store])

  const handleSwitchToCode = useCallback(() => {
    store.setManualCode(code.generatedCode)
  }, [store, code.generatedCode])

  const requestSwitchToBlocks = useCallback(() => {
    setPendingSwitchToBlocks(true)
  }, [])

  const confirmSwitchToBlocks = useCallback(() => {
    setPendingSwitchToBlocks(false)
    if (workspaceRef.current) {
      const generated = generateWorkspaceArduinoCode(workspaceRef.current, store)
      const xmlText = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspaceRef.current))
      store.setBlocklyXml(xmlText, generated)
    }
  }, [store])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-sm font-medium">Editor</span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={code.source === "blocks"}
            onClick={requestSwitchToBlocks}
            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
          >
            Blocks
          </button>
          <button
            type="button"
            disabled={code.source === "text"}
            onClick={handleSwitchToCode}
            className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
          >
            Code
          </button>
        </div>
      </div>

      {pendingSwitchToBlocks && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs">
          <span>Switching to Blocks will regenerate code from your block program. Manual edits in Code mode will be discarded.</span>
          <div className="flex gap-2">
            <button type="button" onClick={confirmSwitchToBlocks} className="rounded bg-amber-500 px-2 py-1 text-background">
              Switch anyway
            </button>
            <button type="button" onClick={() => setPendingSwitchToBlocks(false)} className="rounded border border-border px-2 py-1">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div ref={blocklyDiv} className={code.source === "blocks" ? "flex-1" : "hidden"} />
        {code.source === "text" && (
          <div className="flex-1">
            <CodeExecutionPanel
              code={code.generatedCode}
              onCodeChange={(next) => store.setManualCode(next)}
              runState={runState}
              onCommand={onCommand}
              errors={errors}
              onErrors={onErrors}
              board="arduino-uno"
              onBoardChange={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  )
}
