// components/simulator/code-execution-panel.tsx
"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import type { Monaco } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { Play, Square, Pause, Zap, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CompileDiagnostic, BoardId, AVRCommand } from "@/lib/avr/types"
import { BOARD_PROFILES } from "@/lib/avr/board-profiles"
import { compileSketch } from "@/lib/avr/compiler"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Loading editor…
    </div>
  ),
})

type RunState = "idle" | "compiling" | "running" | "paused"

const SPEED_OPTIONS: { label: string; value: number }[] = [
  { label: "0.1×", value: 0.1 },
  { label: "1× (real-time)", value: 1 },
  { label: "10×", value: 10 },
  { label: "100×", value: 100 },
  { label: "1000×", value: 1000 },
]

export interface CodeExecutionPanelProps {
  code: string
  onCodeChange: (code: string) => void
  runState: RunState
  onCommand: (cmd: AVRCommand) => void
  errors: CompileDiagnostic[]
  onErrors: (errors: CompileDiagnostic[]) => void
  board: BoardId
  onBoardChange: (board: BoardId) => void
}

export function CodeExecutionPanel({
  code,
  onCodeChange,
  runState,
  onCommand,
  errors,
  onErrors,
  board,
  onBoardChange,
}: CodeExecutionPanelProps) {
  const [speed, setSpeed] = useState(1)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)

  const errorDiagnostics = errors.filter((e) => e.severity === "error")

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (!model || !monacoRef.current) return
    const markers = errors.map((e) => ({
      startLineNumber: e.line ?? 1,
      startColumn: e.column ?? 1,
      endLineNumber: e.line ?? 1,
      endColumn: (e.column ?? 1) + 20,
      message: e.message,
      severity: e.severity === "error" ? 8 : 4,
    }))
    monacoRef.current.editor.setModelMarkers(model, "xylo", markers)
  }, [errors])

  const handleRun = useCallback(async () => {
    onCommand({ type: "load", hex: "", board })
    const result = await compileSketch({ code, board })
    if (!result.success) {
      onErrors(result.errors)
      return
    }
    onCommand({ type: "load", hex: result.hex, board })
    onCommand({ type: "run" })
  }, [code, board, onCommand, onErrors])

  const handleSpeedChange = useCallback((value: number) => {
    setSpeed(value)
    onCommand({ type: "setSpeed", multiplier: value })
  }, [onCommand])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 shrink-0">
        {runState === "idle" || runState === "compiling" ? (
          <Button
            size="sm"
            className="h-7 gap-1.5 bg-primary text-primary-foreground"
            onClick={handleRun}
            disabled={runState === "compiling"}
            aria-label="Compile and run sketch"
          >
            {runState === "compiling" ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Compiling…</>
            ) : (
              <><Play className="h-3 w-3" /> Run</>
            )}
          </Button>
        ) : (
          <>
            {runState === "running" ? (
              <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => onCommand({ type: "pause" })} aria-label="Pause execution">
                <Pause className="h-3 w-3" /> Pause
              </Button>
            ) : (
              <Button size="sm" className="h-7 gap-1.5 bg-primary text-primary-foreground" onClick={() => onCommand({ type: "resume" })} aria-label="Resume execution">
                <Play className="h-3 w-3" /> Resume
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-destructive" onClick={() => onCommand({ type: "stop" })} aria-label="Stop execution">
              <Square className="h-3 w-3" /> Stop
            </Button>
          </>
        )}

        {runState !== "idle" && runState !== "compiling" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1" aria-label="Simulation speed">
                <Zap className="h-3 w-3" />
                {SPEED_OPTIONS.find((s) => s.value === speed)?.label ?? `${speed}×`}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {SPEED_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => handleSpeedChange(opt.value)}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="ml-auto flex items-center gap-2">
          {errorDiagnostics.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {errorDiagnostics.length} error(s)
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" aria-label="Select board">
                {BOARD_PROFILES[board].displayName}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(Object.keys(BOARD_PROFILES) as BoardId[]).map((b) => (
                <DropdownMenuItem key={b} onClick={() => onBoardChange(b)}>
                  {BOARD_PROFILES[b].displayName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {errorDiagnostics.length > 0 && (
        <div className="border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-mono space-y-0.5 max-h-24 overflow-auto shrink-0">
          {errorDiagnostics.map((e, i) => (
            <div key={`${e.line ?? 0}-${e.column ?? 0}-${i}`} className="text-destructive">
              {e.line ? `Line ${e.line}: ` : ""}{e.message}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language="cpp"
          theme="vs-dark"
          value={code}
          onChange={(val) => onCodeChange(val ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            readOnly: runState === "running" || runState === "paused",
          }}
          beforeMount={(monaco) => {
            monaco.languages.setLanguageConfiguration("cpp", {
              comments: { lineComment: "//", blockComment: ["/*", "*/"] },
            })
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor
            monacoRef.current = monaco
          }}
        />
      </div>
    </div>
  )
}
