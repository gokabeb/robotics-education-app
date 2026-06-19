"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as Blockly from "blockly"
import { toolbox } from "@/lib/blockly/toolbox"
import { generateArduinoCode } from "@/lib/blockly/generators/arduino"
import { generatePythonCode } from "@/lib/blockly/generators/python"
import "@/lib/blockly/blocks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, RotateCcw, Zap, Columns, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import Link from "next/link"
import { DualCodeView } from "./dual-code-view"

// Define theme matching our app
const xyloTheme = Blockly.Theme.defineTheme("xylo", {
  name: "xylo",
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: "#0f0f11",
    toolboxBackgroundColour: "#16161a",
    toolboxForegroundColour: "#f0f0f0",
    flyoutBackgroundColour: "#1a1a1f",
    flyoutForegroundColour: "#f0f0f0",
    flyoutOpacity: 1,
    scrollbarColour: "#3a3a40",
    insertionMarkerColour: "#fff",
    insertionMarkerOpacity: 0.3,
    scrollbarOpacity: 0.4,
    cursorColour: "#d0d0d0",
  },
  fontStyle: {
    family: "system-ui, -apple-system, sans-serif",
    weight: "500",
    size: 12,
  },
})

interface BlocklyEditorProps {
  projectId?: string
  projectName?: string
  initialXml?: string
  onSave?: (xml: string, code: string) => void
}

export function BlocklyEditor({
  projectId,
  projectName = "Untitled Project",
  initialXml,
  onSave,
}: BlocklyEditorProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const [arduinoCode, setArduinoCode] = useState("")
  const [pythonCode, setPythonCode] = useState("")
  const [name, setName] = useState(projectName)
  const [isSaving, setIsSaving] = useState(false)
  const [showDualView, setShowDualView] = useState(false)

  const updateCode = useCallback(() => {
    if (workspaceRef.current) {
      const arduino = generateArduinoCode(workspaceRef.current)
      const python = generatePythonCode(workspaceRef.current)
      setArduinoCode(arduino)
      setPythonCode(python)
    }
  }, [])

  useEffect(() => {
    if (blocklyDiv.current && !workspaceRef.current) {
      // Initialize Blockly workspace
      workspaceRef.current = Blockly.inject(blocklyDiv.current, {
        toolbox,
        theme: xyloTheme,
        grid: {
          spacing: 20,
          length: 3,
          colour: "#2a2a30",
          snap: true,
        },
        zoom: {
          controls: true,
          wheel: true,
          startScale: 1.0,
          maxScale: 3,
          minScale: 0.3,
          scaleSpeed: 1.2,
        },
        trashcan: true,
        move: {
          scrollbars: true,
          drag: true,
          wheel: true,
        },
        renderer: "zelos",
      })

      // Load initial XML if provided
      if (initialXml) {
        try {
          const xml = Blockly.utils.xml.textToDom(initialXml)
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current)
        } catch (e) {
          console.error("Error loading Blockly XML:", e)
        }
      }

      // Add listener for workspace changes
      workspaceRef.current.addChangeListener(updateCode)

      // Generate initial code
      updateCode()
    }

    // Cleanup
    return () => {
      if (workspaceRef.current) {
        workspaceRef.current.dispose()
        workspaceRef.current = null
      }
    }
  }, [initialXml, updateCode])

  const handleSave = async () => {
    if (!workspaceRef.current || !onSave) return

    setIsSaving(true)
    try {
      const xml = Blockly.Xml.workspaceToDom(workspaceRef.current)
      const xmlText = Blockly.Xml.domToText(xml)
      await onSave(xmlText, arduinoCode)
      toast.success("Project saved successfully!")
    } catch {
      toast.error("Failed to save project")
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (workspaceRef.current) {
      workspaceRef.current.clear()
      updateCode()
      toast.success("Workspace cleared!")
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Blockly Workspace */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex flex-col rounded-xl border border-border bg-card overflow-hidden"
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-48 bg-background border-border"
              placeholder="Project name"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDualView(!showDualView)}
              className="border-border"
            >
              <Columns className="mr-2 h-4 w-4" />
              {showDualView ? "Single View" : "Dual View"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-border"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear
            </Button>
            {onSave && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-primary text-primary-foreground"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </div>

        {/* Blockly Container */}
        <div ref={blocklyDiv} className="flex-1" />
      </motion.div>

      {/* Code Preview Panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={`${showDualView ? "w-[700px]" : "w-[450px]"} flex flex-col rounded-xl border border-border bg-card overflow-hidden`}
      >
        {/* Code View */}
        <div className="flex-1 overflow-hidden">
          <DualCodeView
            arduinoCode={arduinoCode}
            pythonCode={pythonCode}
            showBothPanels={showDualView}
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
          <Button
            size="sm"
            variant="outline"
            className="border-border"
            onClick={() => {
              // Store code in sessionStorage for AI enhancement
              sessionStorage.setItem("xylo_code", arduinoCode)
              sessionStorage.setItem("xylo_project_name", name)
              toast.success("Code sent to AI Generator!")
            }}
            asChild
          >
            <Link href="/generator">
              <Sparkles className="mr-2 h-4 w-4" />
              Enhance with AI
            </Link>
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              // Store code in sessionStorage for flasher
              sessionStorage.setItem("xylo_code", arduinoCode)
              sessionStorage.setItem("xylo_project_name", name)
            }}
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
  )
}

