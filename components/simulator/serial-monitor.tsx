// components/simulator/serial-monitor.tsx
"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Terminal, Trash2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SerialLine {
  id: number
  text: string
  timestamp: string
}

interface SerialMonitorProps {
  lines: SerialLine[]
  onSend: (data: string) => void
  onClear: () => void
  className?: string
}

let lineIdCounter = 0

export function SerialMonitor({ lines, onSend, onClear, className }: SerialMonitorProps) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines])

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    onSend(input + "\n")
    setInput("")
  }, [input, onSend])

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Serial Monitor</span>
          <span className="text-xs text-muted-foreground">({lines.length} lines)</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear} title="Clear">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 font-mono text-xs bg-background min-h-[120px] max-h-[200px]">
        {lines.length === 0 ? (
          <span className="text-muted-foreground">Serial output will appear here…</span>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="flex gap-2 leading-relaxed">
              <span className="text-muted-foreground shrink-0 select-none">{line.timestamp}</span>
              <span className="text-foreground whitespace-pre-wrap break-all">{line.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-border p-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Send to Serial.read()…"
          className="h-7 font-mono text-xs bg-background"
        />
        <Button size="sm" className="h-7 px-2" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// Factory for creating serial lines — call this from the parent component
export function makeSerialLine(text: string): SerialLine {
  return {
    id: ++lineIdCounter,
    text,
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
  }
}
