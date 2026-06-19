"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Copy, Download, RotateCcw, Zap, AlertCircle, Loader2, Wrench, Info, BookOpen, ChevronDown, ChevronUp, Settings } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import Link from "next/link"

const examplePrompts = [
  "Create a line-following robot that stops when it detects an obstacle within 20cm",
  "Build a robot that avoids obstacles and navigates around them using ultrasonic sensor",
  "Make a robot that follows a wall on its right side maintaining 15cm distance",
  "Create a robot that responds to serial commands (F=forward, B=backward, L=left, R=right, S=stop)",
  "Design a maze-solving robot that uses right-hand rule to find the exit",
  "Create a robot that does a dance routine with forward, spin, and backward moves",
]

const behaviorTemplates = [
  {
    id: "line-follower",
    name: "Line Follower",
    description: "Follow a black line on white surface",
    icon: "➖",
    prompt: "Create a precise line-following robot using the three line sensors (left, center, right on A0, A1, A2). Use proportional control for smooth following. Stop if no line is detected for 2 seconds.",
  },
  {
    id: "obstacle-avoider",
    name: "Obstacle Avoider",
    description: "Navigate while avoiding obstacles",
    icon: "🚧",
    prompt: "Create an obstacle avoidance robot using the ultrasonic sensor on pins 9 (TRIG) and 10 (ECHO). When an obstacle is detected within 30cm, turn right 90 degrees. If still blocked, turn left 180 degrees. Move forward when clear.",
  },
  {
    id: "wall-follower",
    name: "Wall Follower",
    description: "Follow along a wall",
    icon: "🧱",
    prompt: "Create a wall-following robot that maintains 15cm distance from the wall on its right side using the ultrasonic sensor. Adjust speed based on distance - slow down when too close, speed up when too far.",
  },
  {
    id: "remote-control",
    name: "Serial Remote Control",
    description: "Control via serial commands",
    icon: "🎮",
    prompt: "Create a serial-controlled robot that responds to single-character commands: 'F' for forward, 'B' for backward, 'L' for turn left, 'R' for turn right, 'S' for stop. Include speed control with numbers 0-9. Echo commands back to serial.",
  },
  {
    id: "maze-solver",
    name: "Maze Solver",
    description: "Navigate through a maze",
    icon: "🌀",
    prompt: "Create a maze-solving robot using the right-hand rule algorithm. Use the ultrasonic sensor to detect walls. Always turn right when possible, go straight if can't turn right, turn left if can't go straight, turn around if blocked on all sides.",
  },
  {
    id: "light-seeker",
    name: "Light Seeker",
    description: "Move towards light source",
    icon: "💡",
    prompt: "Create a light-seeking robot using two LDR sensors (photoresistors) on analog pins A3 and A4. Compare light levels and turn towards the brighter side. Move forward when light is balanced.",
  },
]

export function CodeGenerator() {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedCode, setGeneratedCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [aiNotConfigured, setAiNotConfigured] = useState(false)
  const [existingCode, setExistingCode] = useState<string | null>(null)
  const [robotConfig, setRobotConfig] = useState<unknown>(null)
  const [selectedBehavior, setSelectedBehavior] = useState<string | null>(null)
  const [isExplaining, setIsExplaining] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)

  // Check for existing code from block editor and robot config from builder
  useEffect(() => {
    const savedCode = sessionStorage.getItem("xylo_code")
    if (savedCode) {
      setExistingCode(savedCode)
      setGeneratedCode(savedCode)
    }

    const savedConfig = sessionStorage.getItem("xylo_robot_config")
    if (savedConfig) {
      try {
        setRobotConfig(JSON.parse(savedConfig))
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setIsGenerating(true)
    setError(null)
    setGeneratedCode("")

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          existingCode: existingCode || undefined,
          robotConfig: robotConfig || undefined,
          targetBehavior: selectedBehavior || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 503 && errorData.error === "AI_NOT_CONFIGURED") {
          setAiNotConfigured(true)
          setIsGenerating(false)
          return
        }
        throw new Error(errorData.error || "Failed to generate code")
      }

      // Stream the response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("Failed to read response")
      }

      let code = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        code += chunk
        setGeneratedCode(code)
      }

      // Save to session storage for simulator and flasher
      sessionStorage.setItem("xylo_code", code)
      sessionStorage.setItem("xylo_project_name", "AI Generated Code")

      toast.success("Code generated successfully!")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate code"
      setError(message)
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!generatedCode) return
    navigator.clipboard.writeText(generatedCode)
    toast.success("Code copied to clipboard!")
  }

  const handleDownload = () => {
    if (!generatedCode) return
    const blob = new Blob([generatedCode], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "robot_code.ino"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Code downloaded!")
  }

  const handleReset = () => {
    setGeneratedCode("")
    setExistingCode(null)
    sessionStorage.removeItem("xylo_code")
    sessionStorage.removeItem("xylo_project_name")
    toast.success("Reset complete!")
  }

  const handleOpenInFlasher = () => {
    sessionStorage.setItem("xylo_code", generatedCode)
    sessionStorage.setItem("xylo_project_name", "AI Generated Code")
  }

  const handleExplain = async () => {
    if (!generatedCode) return
    setIsExplaining(true)
    setExplanation("")
    setShowExplanation(true)

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: generatedCode }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to explain code")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error("Failed to read response")

      let text = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value)
        setExplanation(text)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to explain code"
      toast.error(message)
    } finally {
      setIsExplaining(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-b border-border bg-card"
      >
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">AI Code Generator</h1>
              <p className="mt-1 text-muted-foreground">
                Describe what you want your robot to do, and AI will generate Arduino code.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Workflow Banner */}
        {!robotConfig && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4"
          >
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-foreground">Pro Tip: Design your robot first!</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Build your robot in the Robot Builder first. The AI will generate code tailored to your specific robot configuration, sensors, and motors.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-primary/30"
                  asChild
                >
                  <Link href="/builder">
                    <Wrench className="mr-2 h-4 w-4" />
                    Open Robot Builder
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Panel */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-6"
          >
            <div className="rounded-xl border border-border bg-card p-6">
              <label className="text-sm font-medium text-foreground">
                Describe your robot behavior
              </label>
              <Textarea
                placeholder="e.g., Create a robot that follows a line and stops when it sees an obstacle within 20cm..."
                className="mt-3 min-h-[160px] resize-none border-border bg-background"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />

              {existingCode && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <span>Using code from Block Editor as base</span>
                  <button
                    onClick={() => {
                      setExistingCode(null)
                      sessionStorage.removeItem("xylo_code")
                    }}
                    className="text-primary hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}

              {robotConfig && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-green-500" />
                  <span>Using robot config from Builder</span>
                  <button
                    onClick={() => {
                      setRobotConfig(null)
                      sessionStorage.removeItem("xylo_robot_config")
                    }}
                    className="text-primary hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Code
                    </>
                  )}
                </Button>
              </motion.div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-destructive">Generation Failed</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Behavior Templates */}
            <div className="space-y-3">
              <span className="text-sm font-medium text-foreground">Pre-built Behaviors:</span>
              <div className="grid grid-cols-2 gap-2">
                {behaviorTemplates.map((template, index) => (
                  <motion.button
                    key={template.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setPrompt(template.prompt)
                      setSelectedBehavior(template.id)
                    }}
                    className="rounded-lg border border-border bg-secondary/50 p-3 text-left transition-colors hover:bg-secondary hover:border-primary/30"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{template.icon}</span>
                      <span className="text-sm font-medium">{template.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm text-muted-foreground">Or try a custom prompt:</span>
              <div className="flex flex-wrap gap-2">
                {examplePrompts.slice(0, 3).map((example, index) => (
                  <motion.button
                    key={example}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setPrompt(example)
                      setSelectedBehavior(null)
                    }}
                    className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {example}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-sm font-medium mb-3">Tips for better results</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Be specific about sensor thresholds (e.g., "stop within 20cm")
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Mention motor speeds if you have preferences (0-100%)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Describe the expected behavior step by step
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Start with the Block Editor for visual programming, then enhance with AI
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Output Panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Generated Arduino Code</span>
                {isGenerating && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    Streaming...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopy}
                    disabled={!generatedCode}
                    className="h-8 w-8"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownload}
                    disabled={!generatedCode}
                    className="h-8 w-8"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    className="h-8 w-8"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </div>

            <div className="flex-1 h-[500px] overflow-auto p-4 bg-background">
              {aiNotConfigured ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-full max-w-sm rounded-xl border border-border bg-secondary/30 p-6 text-center">
                    <Settings className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <h4 className="text-sm font-semibold text-foreground mb-1">AI Code Generation is not configured</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      To enable AI features, add your OpenAI API key to{" "}
                      <code className="font-mono bg-background px-1 rounded">.env.local</code>:
                    </p>
                    <pre className="rounded bg-background border border-border p-2 font-mono text-xs text-left mb-3">
                      OPENAI_API_KEY=sk-...
                    </pre>
                    <p className="text-xs text-muted-foreground">
                      See <code className="font-mono">ENV_VARIABLES.md</code> for full setup instructions.
                    </p>
                    <p className="mt-3 text-xs text-primary">
                      Templates, manual code editing, and all other features remain available.
                    </p>
                  </div>
                </div>
              ) : generatedCode ? (
                <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                  <code>{generatedCode}</code>
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Generated code will appear here...
                </div>
              )}
            </div>

            {/* Explain Code button */}
            {generatedCode && !aiNotConfigured && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-border"
                  onClick={handleExplain}
                  disabled={isExplaining}
                >
                  {isExplaining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Explaining...
                    </>
                  ) : (
                    <>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Explain Code
                    </>
                  )}
                </Button>

                {showExplanation && (
                  <div className="rounded-xl border border-border bg-secondary/30 p-4">
                    <button
                      className="flex w-full items-center justify-between text-sm font-medium mb-2"
                      onClick={() => setShowExplanation((v) => !v)}
                    >
                      <span>What this code does:</span>
                      {showExplanation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {explanation ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{explanation}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground animate-pulse">Loading explanation...</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
              <Button
                variant="outline"
                className="border-border"
                disabled={!generatedCode}
                title="Converts Arduino C++ to simulator commands and runs them"
                onClick={() => {
                  sessionStorage.setItem("xylo_code", generatedCode)
                  sessionStorage.setItem("xylo_project_name", "AI Generated")
                }}
                asChild
              >
                <Link href="/simulator">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Test in Simulator
                </Link>
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!generatedCode}
                onClick={handleOpenInFlasher}
                asChild
              >
                <Link href="/flasher">
                  <Zap className="mr-2 h-4 w-4" />
                  Flash to Arduino
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
