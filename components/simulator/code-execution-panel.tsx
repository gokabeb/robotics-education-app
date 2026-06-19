"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Play, Pause, Square, RotateCcw, Code2, ChevronDown, ChevronUp } from "lucide-react"
import { motion } from "framer-motion"
import { EXAMPLE_SCRIPTS, ExecutionState } from "@/lib/simulator/executor"

interface CodeExecutionPanelProps {
  code: string
  onCodeChange: (code: string) => void
  executionState: ExecutionState | null
  onExecute: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  isArduinoMode?: boolean
  transpiledScript?: string
  unsupportedConstructs?: string[]
}

export function CodeExecutionPanel({
  code,
  onCodeChange,
  executionState,
  onExecute,
  onPause,
  onResume,
  onStop,
  isArduinoMode = false,
  transpiledScript = "",
  unsupportedConstructs = [],
}: CodeExecutionPanelProps) {
  const [selectedExample, setSelectedExample] = useState<string>("")
  const [showTranspiled, setShowTranspiled] = useState(false)

  const handleExampleChange = (value: string) => {
    setSelectedExample(value)
    if (value && EXAMPLE_SCRIPTS[value as keyof typeof EXAMPLE_SCRIPTS]) {
      onCodeChange(EXAMPLE_SCRIPTS[value as keyof typeof EXAMPLE_SCRIPTS])
    }
  }

  const isRunning = executionState?.isRunning ?? false
  const isPaused = executionState?.isPaused ?? false

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Code Runner</span>
        </div>
        <Select value={selectedExample} onValueChange={handleExampleChange}>
          <SelectTrigger className="w-32 h-7 text-xs">
            <SelectValue placeholder="Examples" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="forward">Forward</SelectItem>
            <SelectItem value="square">Square</SelectItem>
            <SelectItem value="zigzag">Zigzag</SelectItem>
            <SelectItem value="spin">Spin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Arduino mode banners */}
      {isArduinoMode && (
        <div className="px-3 pt-3 space-y-2">
          <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
            Running converted Arduino code in simulator
            {transpiledScript && (
              <button
                className="ml-2 underline hover:no-underline"
                onClick={() => setShowTranspiled((v) => !v)}
              >
                {showTranspiled ? (
                  <span className="inline-flex items-center gap-0.5">Hide script <ChevronUp className="h-3 w-3" /></span>
                ) : (
                  <span className="inline-flex items-center gap-0.5">View converted script <ChevronDown className="h-3 w-3" /></span>
                )}
              </button>
            )}
          </div>
          {showTranspiled && transpiledScript && (
            <div className="rounded-md bg-background border border-border p-2 font-mono text-xs text-muted-foreground whitespace-pre overflow-auto max-h-32">
              {transpiledScript}
            </div>
          )}
          {unsupportedConstructs.length > 0 && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
              Some Arduino constructs were skipped:{" "}
              {unsupportedConstructs.slice(0, 3).map((c, i) => (
                <span key={i}><code className="font-mono">{c.substring(0, 40)}</code>{i < Math.min(unsupportedConstructs.length, 3) - 1 ? ", " : ""}</span>
              ))}
              {unsupportedConstructs.length > 3 && ` and ${unsupportedConstructs.length - 3} more`}
              {" "}({unsupportedConstructs.length} total). These are not supported in simulation.
            </div>
          )}
        </div>
      )}

      {/* Code Editor */}
      <div className="flex-1 p-3">
        <Textarea
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder={`// Enter robot commands
forward(50)
wait(1000)
right(50)
wait(500)
stop()`}
          className="h-full min-h-[200px] font-mono text-xs bg-background border-border resize-none"
          disabled={isRunning}
        />
      </div>

      {/* Status */}
      {executionState && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
                isRunning
                  ? isPaused
                    ? "bg-chart-4/10 text-chart-4"
                    : "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isRunning
                    ? isPaused
                      ? "bg-chart-4"
                      : "bg-primary animate-pulse"
                    : "bg-muted-foreground"
                }`}
              />
              {isRunning ? (isPaused ? "Paused" : "Running") : "Stopped"}
            </span>
            {isRunning && (
              <span className="text-muted-foreground">
                Line {executionState.currentLine + 1}
              </span>
            )}
          </div>
          {executionState.error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-xs text-destructive"
            >
              Error: {executionState.error}
            </motion.p>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="p-3 border-t border-border flex gap-2">
        {!isRunning ? (
          <Button
            size="sm"
            className="flex-1 bg-primary text-primary-foreground"
            onClick={onExecute}
            disabled={!code.trim()}
          >
            <Play className="mr-2 h-4 w-4" />
            Run
          </Button>
        ) : isPaused ? (
          <Button
            size="sm"
            className="flex-1 bg-primary text-primary-foreground"
            onClick={onResume}
          >
            <Play className="mr-2 h-4 w-4" />
            Resume
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-border"
            onClick={onPause}
          >
            <Pause className="mr-2 h-4 w-4" />
            Pause
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="border-border"
          onClick={onStop}
          disabled={!isRunning}
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-border"
          onClick={() => onCodeChange("")}
          disabled={isRunning}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Help */}
      <div className="px-4 py-3 border-t border-border bg-secondary/30">
        <p className="text-xs text-muted-foreground font-medium mb-2">
          Available Commands:
        </p>
        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground font-mono">
          <span>forward(speed)</span>
          <span>backward(speed)</span>
          <span>left(speed)</span>
          <span>right(speed)</span>
          <span>stop()</span>
          <span>wait(ms)</span>
          <span className="col-span-2">setMotors(left, right)</span>
        </div>
      </div>
    </div>
  )
}


