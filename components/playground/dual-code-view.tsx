"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Copy, Download, Code2, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

interface DualCodeViewProps {
  arduinoCode: string
  pythonCode: string
  showBothPanels?: boolean
}

export function DualCodeView({
  arduinoCode,
  pythonCode,
  showBothPanels = false,
}: DualCodeViewProps) {
  const [activeTab, setActiveTab] = useState<"arduino" | "python">("arduino")

  const handleCopy = (code: string, language: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`${language} code copied!`)
  }

  const handleDownload = (code: string, language: string, extension: string) => {
    const blob = new Blob([code], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `robot_code.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`${language} code downloaded!`)
  }

  if (showBothPanels) {
    return (
      <div className="grid grid-cols-2 gap-4 h-full">
        {/* Arduino Panel */}
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Arduino C++</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(arduinoCode, "Arduino")}
                className="h-7 w-7"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(arduinoCode, "Arduino", "ino")}
                className="h-7 w-7"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4 bg-background">
            <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
              <code>{arduinoCode || "// Add blocks to generate code..."}</code>
            </pre>
          </ScrollArea>
        </div>

        {/* Python Panel */}
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Python</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopy(pythonCode, "Python")}
                className="h-7 w-7"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(pythonCode, "Python", "py")}
                className="h-7 w-7"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4 bg-background">
            <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
              <code>{pythonCode || "# Add blocks to generate code..."}</code>
            </pre>
          </ScrollArea>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "arduino" | "python")}>
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <TabsList className="h-8">
            <TabsTrigger value="arduino" className="text-xs gap-1.5 px-3">
              <Code2 className="h-3.5 w-3.5" />
              Arduino
            </TabsTrigger>
            <TabsTrigger value="python" className="text-xs gap-1.5 px-3">
              <FileCode className="h-3.5 w-3.5" />
              Python
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                handleCopy(
                  activeTab === "arduino" ? arduinoCode : pythonCode,
                  activeTab === "arduino" ? "Arduino" : "Python"
                )
              }
              className="h-7 w-7"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                handleDownload(
                  activeTab === "arduino" ? arduinoCode : pythonCode,
                  activeTab === "arduino" ? "Arduino" : "Python",
                  activeTab === "arduino" ? "ino" : "py"
                )
              }
              className="h-7 w-7"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <TabsContent value="arduino" className="flex-1 m-0">
          <ScrollArea className="h-full p-4 bg-background">
            <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
              <code>{arduinoCode || "// Add blocks to generate code..."}</code>
            </pre>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="python" className="flex-1 m-0">
          <ScrollArea className="h-full p-4 bg-background">
            <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
              <code>{pythonCode || "# Add blocks to generate code..."}</code>
            </pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}


