"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Wrench, Save, Download, Play, RotateCcw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ComponentLibrary } from "./component-library"
import { BuilderCanvas } from "./builder-canvas"
import { ComponentProperties } from "./component-properties"
import {
  RobotComponent,
  PlacedComponent,
  RobotDesign,
  createPlacedComponent,
  generateRobotConfig,
} from "@/lib/simulator/components"
import { toast } from "sonner"
import Link from "next/link"

export function BuilderView() {
  const [designName, setDesignName] = useState("My Robot")
  const [components, setComponents] = useState<PlacedComponent[]>([])
  const [selectedComponent, setSelectedComponent] = useState<PlacedComponent | null>(null)
  const [draggingComponent, setDraggingComponent] = useState<RobotComponent | null>(null)

  const handleDragStart = useCallback((component: RobotComponent) => {
    setDraggingComponent(component)
  }, [])

  const handleUpdateComponent = useCallback((updated: PlacedComponent) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    )
    setSelectedComponent(updated)
  }, [])

  const handleDeleteComponent = useCallback(() => {
    if (selectedComponent) {
      setComponents((prev) => prev.filter((c) => c.id !== selectedComponent.id))
      setSelectedComponent(null)
      toast.success("Component deleted")
    }
  }, [selectedComponent])

  const handleRotateComponent = useCallback(() => {
    if (selectedComponent) {
      const updated = {
        ...selectedComponent,
        rotation: (selectedComponent.rotation + 90) % 360,
      }
      handleUpdateComponent(updated)
    }
  }, [selectedComponent, handleUpdateComponent])

  const handleDuplicateComponent = useCallback(() => {
    if (selectedComponent) {
      const newComponent = createPlacedComponent(
        selectedComponent.componentId,
        selectedComponent.x + 30,
        selectedComponent.y + 30,
        selectedComponent.rotation
      )
      newComponent.properties = { ...selectedComponent.properties }
      setComponents((prev) => [...prev, newComponent])
      setSelectedComponent(newComponent)
      toast.success("Component duplicated")
    }
  }, [selectedComponent])

  const handleClearCanvas = useCallback(() => {
    setComponents([])
    setSelectedComponent(null)
    toast.success("Canvas cleared")
  }, [])

  const handleSaveDesign = useCallback(() => {
    const design: RobotDesign = {
      id: crypto.randomUUID(),
      name: designName,
      components,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save to localStorage for now
    const savedDesigns = JSON.parse(localStorage.getItem("xylo_designs") || "[]")
    savedDesigns.push(design)
    localStorage.setItem("xylo_designs", JSON.stringify(savedDesigns))
    
    // Also save current design for simulator
    localStorage.setItem("xylo_current_design", JSON.stringify(design))

    toast.success("Design saved!")
  }, [designName, components])

  const handleExportDesign = useCallback(() => {
    const design: RobotDesign = {
      id: crypto.randomUUID(),
      name: designName,
      components,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(design, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${designName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Design exported!")
  }, [designName, components])

  const handleImportDesign = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const design: RobotDesign = JSON.parse(event.target?.result as string)
        setDesignName(design.name)
        setComponents(design.components)
        setSelectedComponent(null)
        toast.success("Design imported!")
      } catch {
        toast.error("Failed to import design")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }, [])

  const handleTestInSimulator = useCallback(() => {
    const design: RobotDesign = {
      id: crypto.randomUUID(),
      name: designName,
      components,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem("xylo_current_design", JSON.stringify(design))
    
    // Generate config for code generation
    const config = generateRobotConfig(design)
    sessionStorage.setItem("xylo_robot_config", JSON.stringify(config))
  }, [designName, components])

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-b border-border bg-card"
      >
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Wrench className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Robot Builder
                </h1>
                <p className="mt-1 text-muted-foreground">
                  Design your robot with drag-and-drop components
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                className="w-48 h-9 bg-background border-border"
                placeholder="Design name"
              />
              <Button variant="outline" size="sm" onClick={handleSaveDesign}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground"
                onClick={handleTestInSimulator}
                asChild
              >
                <Link href="/simulator">
                  <Play className="mr-2 h-4 w-4" />
                  Test
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[250px_1fr_250px]">
          {/* Left Panel - Component Library */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-xl border border-border bg-card overflow-hidden h-[600px]"
          >
            <ComponentLibrary onDragStart={handleDragStart} />
          </motion.div>

          {/* Center - Canvas */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center"
          >
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Design Canvas</span>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportDesign}
                      className="hidden"
                    />
                    <Button variant="ghost" size="sm" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Import
                      </span>
                    </Button>
                  </label>
                  <Button variant="ghost" size="sm" onClick={handleExportDesign}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClearCanvas}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
              <BuilderCanvas
                components={components}
                onComponentsChange={setComponents}
                selectedComponent={selectedComponent}
                onSelectComponent={setSelectedComponent}
                draggingComponent={draggingComponent}
              />
            </div>

            {/* Stats */}
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="px-2 py-1 rounded bg-secondary">
                {components.length} components
              </span>
              <span className="px-2 py-1 rounded bg-secondary">
                {components.filter((c) => c.componentId.startsWith("chassis")).length} chassis
              </span>
              <span className="px-2 py-1 rounded bg-secondary">
                {components.filter((c) => c.componentId.startsWith("motor")).length} motors
              </span>
              <span className="px-2 py-1 rounded bg-secondary">
                {components.filter((c) => c.componentId.startsWith("sensor")).length} sensors
              </span>
            </div>
          </motion.div>

          {/* Right Panel - Properties */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-xl border border-border bg-card overflow-hidden h-[600px]"
          >
            <ComponentProperties
              component={selectedComponent}
              onUpdate={handleUpdateComponent}
              onDelete={handleDeleteComponent}
              onRotate={handleRotateComponent}
              onDuplicate={handleDuplicateComponent}
            />
          </motion.div>
        </div>
      </div>
    </div>
  )
}


