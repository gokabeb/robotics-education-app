"use client"

import { PlacedComponent, getComponentById } from "@/lib/simulator/components"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { RotateCw, Trash2, Copy } from "lucide-react"

interface ComponentPropertiesProps {
  component: PlacedComponent | null
  onUpdate: (component: PlacedComponent) => void
  onDelete: () => void
  onRotate: () => void
  onDuplicate: () => void
}

export function ComponentProperties({
  component,
  onUpdate,
  onDelete,
  onRotate,
  onDuplicate,
}: ComponentPropertiesProps) {
  if (!component) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <div className="text-4xl mb-3">🔧</div>
        <h3 className="text-sm font-medium">No Component Selected</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Click on a component to view and edit its properties
        </p>
      </div>
    )
  }

  const componentDef = getComponentById(component.componentId)
  if (!componentDef) return null

  const handlePropertyChange = (propId: string, value: number | boolean | string) => {
    onUpdate({
      ...component,
      properties: {
        ...component.properties,
        [propId]: value,
      },
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xl">{componentDef.icon}</span>
          <div>
            <h3 className="text-sm font-medium">{componentDef.name}</h3>
            <p className="text-xs text-muted-foreground">{componentDef.type}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Position */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Position</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">X</Label>
              <Input
                type="number"
                value={component.x}
                onChange={(e) =>
                  onUpdate({ ...component, x: parseInt(e.target.value) || 0 })
                }
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Y</Label>
              <Input
                type="number"
                value={component.y}
                onChange={(e) =>
                  onUpdate({ ...component, y: parseInt(e.target.value) || 0 })
                }
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Rotation</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[component.rotation]}
              onValueChange={([value]) =>
                onUpdate({ ...component, rotation: value })
              }
              min={0}
              max={359}
              step={15}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {component.rotation}°
            </span>
          </div>
        </div>

        {/* Component-specific properties */}
        {componentDef.properties && componentDef.properties.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border">
            <Label className="text-xs text-muted-foreground">Properties</Label>
            {componentDef.properties.map((prop) => (
              <div key={prop.id} className="space-y-1">
                <Label className="text-xs">{prop.name}</Label>
                {prop.type === "number" && (
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[Number(component.properties[prop.id] ?? prop.default)]}
                      onValueChange={([value]) =>
                        handlePropertyChange(prop.id, value)
                      }
                      min={prop.min ?? 0}
                      max={prop.max ?? 100}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={Number(component.properties[prop.id] ?? prop.default)}
                      onChange={(e) =>
                        handlePropertyChange(prop.id, parseInt(e.target.value) || 0)
                      }
                      className="h-7 w-16 text-xs"
                    />
                  </div>
                )}
                {prop.type === "boolean" && (
                  <input
                    type="checkbox"
                    checked={Boolean(component.properties[prop.id] ?? prop.default)}
                    onChange={(e) =>
                      handlePropertyChange(prop.id, e.target.checked)
                    }
                    className="h-4 w-4"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Slots info */}
        {componentDef.slots && componentDef.slots.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs text-muted-foreground">Available Slots</Label>
            <div className="space-y-1">
              {componentDef.slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-2 text-xs p-2 rounded bg-secondary/50"
                >
                  <div className="w-2 h-2 rounded-full bg-primary/50" />
                  <span>{slot.name}</span>
                  <span className="text-muted-foreground ml-auto">
                    {slot.accepts.join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onRotate}
          >
            <RotateCw className="mr-2 h-3 w-3" />
            Rotate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onDuplicate}
          >
            <Copy className="mr-2 h-3 w-3" />
            Duplicate
          </Button>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-3 w-3" />
          Delete Component
        </Button>
      </div>
    </div>
  )
}


