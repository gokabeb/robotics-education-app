"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Usb,
  Copy,
  ExternalLink,
  Check,
  AlertCircle,
  Cpu,
  Terminal,
  Send,
  X,
  ChevronDown,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { BrowserSupportBanner } from "@/components/ui/browser-support-banner"

const boards = [
  { id: "arduino-uno", name: "Arduino Uno", chip: "ATmega328P" },
  { id: "arduino-nano", name: "Arduino Nano", chip: "ATmega328P" },
  { id: "arduino-mega", name: "Arduino Mega", chip: "ATmega2560" },
  { id: "esp32", name: "ESP32", chip: "ESP32-WROOM" },
  { id: "esp8266", name: "ESP8266", chip: "ESP8266EX" },
]

const baudRates = [9600, 19200, 38400, 57600, 115200]

interface SerialLog {
  time: string
  type: "sent" | "received" | "info" | "error"
  message: string
}

export function FlasherInterface() {
  const [code, setCode] = useState("")
  const [selectedBoard, setSelectedBoard] = useState(boards[0])
  const [copied, setCopied] = useState(false)

  // Serial state
  const [port, setPort] = useState<SerialPort | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [baudRate, setBaudRate] = useState(9600)
  const serialSupported = typeof navigator !== "undefined" && "serial" in navigator
  const [serialLogs, setSerialLogs] = useState<SerialLog[]>([])
  const [serialInput, setSerialInput] = useState("")
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const serialLogsEndRef = useRef<HTMLDivElement>(null)

  // Load code from sessionStorage
  useEffect(() => {
    const savedCode = sessionStorage.getItem("xylo_code")
    if (savedCode) {
      setCode(savedCode)
    }
  }, [])

  // Auto-scroll serial logs
  useEffect(() => {
    serialLogsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [serialLogs])

  const addLog = useCallback((type: SerialLog["type"], message: string) => {
    const time = new Date().toLocaleTimeString()
    setSerialLogs((prev) => [...prev, { time, type, message }])
  }, [])

  const handleCopyCode = async () => {
    if (!code) {
      toast.error("No code to copy")
      return
    }
    await navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success("Code copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenArduinoIDE = () => {
    window.open("https://create.arduino.cc/editor", "_blank")
    toast.success("Arduino Web Editor opened in new tab")
  }

  // Web Serial API functions
  const handleConnect = async () => {
    if (!("serial" in navigator)) {
      toast.error("Web Serial API not supported. Use Chrome, Edge, or Opera.")
      return
    }

    setIsConnecting(true)
    try {
      const selectedPort = await navigator.serial.requestPort()
      await selectedPort.open({ baudRate })
      setPort(selectedPort)
      setIsConnected(true)
      addLog("info", `Connected at ${baudRate} baud`)
      toast.success("Connected to serial port!")

      // Start reading
      startReading(selectedPort)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect"
      addLog("error", message)
      toast.error(message)
    } finally {
      setIsConnecting(false)
    }
  }

  const startReading = async (serialPort: SerialPort) => {
    const textDecoder = new TextDecoderStream()
    const readableStreamClosed = serialPort.readable!.pipeTo(textDecoder.writable)
    const reader = textDecoder.readable.getReader()
    readerRef.current = reader

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }
        if (value) {
          addLog("received", value)
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "The device has been lost.") {
        addLog("error", `Read error: ${error.message}`)
      }
    } finally {
      reader.releaseLock()
      await readableStreamClosed.catch(() => {})
    }
  }

  const handleDisconnect = async () => {
    try {
      readerRef.current?.cancel()
      await port?.close()
      setPort(null)
      setIsConnected(false)
      addLog("info", "Disconnected")
      toast.success("Disconnected from serial port")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to disconnect"
      addLog("error", message)
    }
  }

  const handleSendSerial = async () => {
    if (!port || !serialInput.trim()) return

    try {
      const writer = port.writable!.getWriter()
      const encoder = new TextEncoder()
      await writer.write(encoder.encode(serialInput + "\n"))
      writer.releaseLock()
      addLog("sent", serialInput)
      setSerialInput("")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send"
      addLog("error", message)
      toast.error(message)
    }
  }

  const clearLogs = () => {
    setSerialLogs([])
    toast.success("Logs cleared")
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
              <Usb className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Arduino Flasher
              </h1>
              <p className="mt-1 text-muted-foreground">
                Copy your code and upload it using Arduino Web Editor
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <BrowserSupportBanner />
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Code & Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Code Preview */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Your Arduino Code</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-border bg-background"
                      >
                        <Cpu className="mr-2 h-3 w-3 text-primary" />
                        {selectedBoard.name}
                        <ChevronDown className="ml-2 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {boards.map((board) => (
                        <DropdownMenuItem
                          key={board.id}
                          onClick={() => setSelectedBoard(board)}
                        >
                          <span>{board.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {board.chip}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    className="border-border"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-primary" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Code
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-4">
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your Arduino code here, or go to the Block Editor or AI Generator to create code..."
                  className="min-h-[300px] font-mono text-xs bg-background border-border resize-none"
                />
              </div>

              <div className="flex items-center gap-3 border-t border-border p-4">
                <Button
                  onClick={handleCopyCode}
                  disabled={!code}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Code
                </Button>
                <Button
                  onClick={handleOpenArduinoIDE}
                  className="flex-1"
                  variant="outline"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Arduino Web Editor
                </Button>
              </div>
            </div>

            {/* Serial Terminal */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Serial Monitor</span>
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
                      isConnected
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isConnected ? "bg-primary animate-pulse" : "bg-muted-foreground"
                      }`}
                    />
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-border bg-background"
                        disabled={isConnected || !serialSupported}
                      >
                        {baudRate} baud
                        <ChevronDown className="ml-2 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {baudRates.map((rate) => (
                        <DropdownMenuItem key={rate} onClick={() => setBaudRate(rate)}>
                          {rate} baud
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnect}
                      className="border-border"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      disabled={isConnecting || !serialSupported}
                      title={!serialSupported ? "Web Serial not supported. Use Chrome 89+, Edge 89+, or Opera 76+ for hardware connection." : undefined}
                      className="bg-primary text-primary-foreground"
                    >
                      <Usb className="mr-2 h-4 w-4" />
                      {isConnecting ? "Connecting..." : "Connect"}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearLogs}
                    className="text-muted-foreground"
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="h-48 overflow-auto p-4 font-mono text-xs bg-background">
                {serialLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Serial output will appear here when connected...
                  </div>
                ) : (
                  <>
                    {serialLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-3 py-0.5">
                        <span className="text-muted-foreground shrink-0">{log.time}</span>
                        <span
                          className={
                            log.type === "sent"
                              ? "text-chart-2"
                              : log.type === "received"
                              ? "text-foreground"
                              : log.type === "error"
                              ? "text-destructive"
                              : "text-primary"
                          }
                        >
                          {log.type === "sent" && "→ "}
                          {log.type === "received" && "← "}
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={serialLogsEndRef} />
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-border p-4">
                <Input
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendSerial()}
                  placeholder="Send command..."
                  className="flex-1 font-mono text-sm bg-background border-border"
                  disabled={!isConnected}
                />
                <Button
                  onClick={handleSendSerial}
                  disabled={!isConnected || !serialInput.trim()}
                  className="bg-primary text-primary-foreground"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Step-by-step guide */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">How to Flash Your Robot</h3>
              <ol className="space-y-4 text-sm">
                {[
                  'Click "Copy Code" to copy your Arduino code',
                  'Click "Open Arduino Web Editor" (sign in if needed)',
                  "Create a new sketch and paste your code",
                  "Select your board type from the dropdown",
                  "Connect your Arduino via USB",
                  'Click "Upload" in Arduino Web Editor',
                ].map((step, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground pt-0.5">{step}</span>
                  </motion.li>
                ))}
              </ol>
            </div>

            {/* Serial Monitor Guide */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Using Serial Monitor</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">1.</span>
                  Upload your code first using Arduino Web Editor
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">2.</span>
                  Click "Connect" and select your Arduino from the list
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">3.</span>
                  View debug output and send commands in real-time
                </li>
              </ul>
            </div>

            {/* Warning */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="rounded-xl border border-chart-4/30 bg-chart-4/5 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-chart-4 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-chart-4">
                    Browser Compatibility
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Web Serial API requires Chrome, Edge, or Opera. Safari and Firefox
                    are not supported yet.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Supported Boards */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Supported Boards</h3>
              <div className="space-y-3">
                {boards.map((board, index) => (
                  <motion.div
                    key={board.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                        <Cpu className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm">{board.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{board.chip}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
