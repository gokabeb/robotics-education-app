"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { COMPONENT_LIBRARY, ComponentType, RobotComponent } from "@/lib/simulator/components"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ComponentLibraryProps {
  onDragStart: (component: RobotComponent) => void
}

const COMPONENT_TYPES: { type: ComponentType; label: string; icon: string }[] = [
  { type: "chassis", label: "Chassis", icon: "🔲" },
  { type: "motor", label: "Motors", icon: "⚙️" },
  { type: "sensor", label: "Sensors", icon: "📡" },
  { type: "arm", label: "Arms", icon: "🦾" },
]

export function ComponentLibrary({ onDragStart }: ComponentLibraryProps) {
  const [activeTab, setActiveTab] = useState<ComponentType>("chassis")

  const filteredComponents = COMPONENT_LIBRARY.filter((c) => c.type === activeTab)

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">Components</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Drag components to the canvas
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ComponentType)}
        className="flex-1 flex flex-col"
      >
        <TabsList className="grid grid-cols-4 mx-4 mt-3">
          {COMPONENT_TYPES.map((ct) => (
            <TabsTrigger key={ct.type} value={ct.type} className="text-xs">
              <span className="mr-1">{ct.icon}</span>
              <span className="hidden sm:inline">{ct.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {filteredComponents.map((component, index) => (
              <ComponentCard
                key={component.id}
                component={component}
                index={index}
                onDragStart={onDragStart}
              />
            ))}
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  )
}

interface ComponentCardProps {
  component: RobotComponent
  index: number
  onDragStart: (component: RobotComponent) => void
}

function ComponentCard({ component, index, onDragStart }: ComponentCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify(component))
    e.dataTransfer.effectAllowed = "copy"
    onDragStart(component)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "p-3 rounded-lg border border-border bg-secondary/30 cursor-grab",
        "hover:bg-secondary/50 hover:border-primary/30 transition-colors",
        "active:cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
          style={{ backgroundColor: component.color + "20" }}
        >
          {component.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{component.name}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">
            {component.description}
          </div>
        </div>
      </div>

      {/* Preview dimensions */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-secondary">
          {component.width}×{component.height}px
        </span>
        {component.slots && (
          <span className="px-1.5 py-0.5 rounded bg-secondary">
            {component.slots.length} slots
          </span>
        )}
        {component.properties && (
          <span className="px-1.5 py-0.5 rounded bg-secondary">
            {component.properties.length} props
          </span>
        )}
      </div>
    </motion.div>
  )
}


