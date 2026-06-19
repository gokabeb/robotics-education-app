"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import {
  RobotComponent,
  PlacedComponent,
  getComponentById,
  createPlacedComponent,
} from "@/lib/simulator/components"
import { cn } from "@/lib/utils"

interface BuilderCanvasProps {
  components: PlacedComponent[]
  onComponentsChange: (components: PlacedComponent[]) => void
  selectedComponent: PlacedComponent | null
  onSelectComponent: (component: PlacedComponent | null) => void
  draggingComponent: RobotComponent | null
}

const GRID_SIZE = 20
const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = 500

export function BuilderCanvas({
  components,
  onComponentsChange,
  selectedComponent,
  onSelectComponent,
  draggingComponent,
}: BuilderCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })

  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
      setDragOver(true)

      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        setDragPosition({
          x: snapToGrid(e.clientX - rect.left),
          y: snapToGrid(e.clientY - rect.top),
        })
      }
    },
    []
  )

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const data = e.dataTransfer.getData("application/json")
      if (!data) return

      try {
        const component: RobotComponent = JSON.parse(data)
        const x = snapToGrid(e.clientX - rect.left)
        const y = snapToGrid(e.clientY - rect.top)

        const placedComponent = createPlacedComponent(component.id, x, y)
        onComponentsChange([...components, placedComponent])
        onSelectComponent(placedComponent)
      } catch (error) {
        console.error("Failed to parse dropped component:", error)
      }
    },
    [components, onComponentsChange, onSelectComponent]
  )

  const handleComponentDrag = useCallback(
    (id: string, x: number, y: number) => {
      onComponentsChange(
        components.map((c) =>
          c.id === id ? { ...c, x: snapToGrid(x), y: snapToGrid(y) } : c
        )
      )
    },
    [components, onComponentsChange]
  )

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current) {
        onSelectComponent(null)
      }
    },
    [onSelectComponent]
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectedComponent) {
      onComponentsChange(components.filter((c) => c.id !== selectedComponent.id))
      onSelectComponent(null)
    }
  }, [selectedComponent, components, onComponentsChange, onSelectComponent])

  const handleRotateSelected = useCallback(() => {
    if (selectedComponent) {
      onComponentsChange(
        components.map((c) =>
          c.id === selectedComponent.id
            ? { ...c, rotation: (c.rotation + 90) % 360 }
            : c
        )
      )
    }
  }, [selectedComponent, components, onComponentsChange])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        handleDeleteSelected()
      } else if (e.key === "r" || e.key === "R") {
        handleRotateSelected()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleDeleteSelected, handleRotateSelected])

  return (
    <div
      ref={canvasRef}
      className={cn(
        "relative bg-background rounded-lg border-2 border-dashed transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border"
      )}
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleCanvasClick}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        }}
      />

      {/* Drop preview */}
      {dragOver && draggingComponent && (
        <div
          className="absolute border-2 border-dashed border-primary rounded-lg bg-primary/10 pointer-events-none"
          style={{
            left: dragPosition.x - draggingComponent.width / 2,
            top: dragPosition.y - draggingComponent.height / 2,
            width: draggingComponent.width,
            height: draggingComponent.height,
          }}
        />
      )}

      {/* Placed components */}
      {components.map((placed) => {
        const component = getComponentById(placed.componentId)
        if (!component) return null

        return (
          <PlacedComponentView
            key={placed.id}
            placed={placed}
            component={component}
            isSelected={selectedComponent?.id === placed.id}
            onSelect={() => onSelectComponent(placed)}
            onDrag={(x, y) => handleComponentDrag(placed.id, x, y)}
          />
        )
      })}

      {/* Empty state */}
      {components.length === 0 && !dragOver && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="text-4xl mb-2">🤖</div>
            <p className="text-sm">Drag components here to build your robot</p>
            <p className="text-xs mt-1">Start with a chassis!</p>
          </div>
        </div>
      )}

      {/* Selection hint */}
      {selectedComponent && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded bg-secondary">
            R to rotate
          </span>
          <span className="px-2 py-1 rounded bg-secondary">
            Del to remove
          </span>
        </div>
      )}
    </div>
  )
}

interface PlacedComponentViewProps {
  placed: PlacedComponent
  component: RobotComponent
  isSelected: boolean
  onSelect: () => void
  onDrag: (x: number, y: number) => void
}

function PlacedComponentView({
  placed,
  component,
  isSelected,
  onSelect,
  onDrag,
}: PlacedComponentViewProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - placed.x,
      y: e.clientY - placed.y,
    })
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      onDrag(e.clientX - dragOffset.x, e.clientY - dragOffset.y)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset, onDrag])

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "absolute cursor-move select-none rounded-lg flex items-center justify-center",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      style={{
        left: placed.x - component.width / 2,
        top: placed.y - component.height / 2,
        width: component.width,
        height: component.height,
        backgroundColor: component.color,
        transform: `rotate(${placed.rotation}deg)`,
      }}
      onMouseDown={handleMouseDown}
    >
      <span className="text-lg drop-shadow-md">{component.icon}</span>

      {/* Slots */}
      {component.slots?.map((slot) => (
        <div
          key={slot.id}
          className="absolute w-3 h-3 rounded-full bg-background border-2 border-dashed border-muted-foreground"
          style={{
            left: slot.x + component.width / 2 - 6,
            top: slot.y + component.height / 2 - 6,
            transform: `rotate(${slot.angle || 0}deg)`,
          }}
          title={slot.name}
        />
      ))}
    </motion.div>
  )
}


