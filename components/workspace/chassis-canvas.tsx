"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import type { RobotProjectComponent, RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { WORKSPACE_COMPONENT_CATALOG, getComponentDef, type WorkspaceComponentType } from "@/lib/workspace/component-types"
import type { PinInfo } from "@/lib/workspace/pin-constraints"

export function ChassisCanvas({ store }: { store: RobotProjectStore }) {
  // store.getComponents() returns the store's live internal array, mutated
  // in place by addComponent/removeComponent (and per-component fields are
  // mutated in place by moveComponent/rotateComponent/reassignPin).
  // useSyncExternalStore relies on the snapshot reference changing whenever
  // the underlying data changes, so we take a fresh copy each time the store
  // notifies subscribers, and otherwise return the cached copy.
  const snapshotRef = useRef<RobotProjectComponent[]>([...store.getComponents()])
  const subscribe = useCallback(
    (listener: () => void) =>
      store.subscribe(() => {
        snapshotRef.current = [...store.getComponents()]
        flushSync(() => listener())
      }),
    [store]
  )
  const getSnapshot = useCallback(() => snapshotRef.current, [])
  const components = useSyncExternalStore(subscribe, getSnapshot)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openPinPickerId, setOpenPinPickerId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "r" && selectedId) {
        const component = store.getComponents().find((c) => c.id === selectedId)
        if (component) store.rotateComponent(selectedId, (component.rotation + 90) % 360)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedId, store])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData("text/workspace-component-type") as WorkspaceComponentType
      if (!type) return
      const rect = canvasRef.current?.getBoundingClientRect()
      const x = e.clientX - (rect?.left ?? 0)
      const y = e.clientY - (rect?.top ?? 0)
      store.addComponent(type, x, y)
    },
    [store]
  )

  return (
    <div className="flex h-full w-full">
      <div className="w-40 shrink-0 border-r border-border p-2 space-y-2">
        {WORKSPACE_COMPONENT_CATALOG.map((def) => (
          <div
            key={def.type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/workspace-component-type", def.type)}
            className="cursor-grab rounded border border-border px-2 py-1 text-xs"
            style={{ borderLeftColor: def.color, borderLeftWidth: 4 }}
          >
            {def.label}
          </div>
        ))}
      </div>

      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden bg-card"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => setSelectedId(null)}
      >
        {components.map((component) => {
          const def = getComponentDef(component.type)
          const freePins: PinInfo[] = store.getFreePinsForComponent(component.id)
          const isOpen = openPinPickerId === component.id
          return (
            <div
              key={component.id}
              data-testid={`component-${component.id}`}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(component.id)
              }}
              className="absolute select-none"
              style={{
                left: component.x,
                top: component.y,
                width: def.width,
                height: def.height,
                transform: `rotate(${component.rotation}deg)`,
                outline: selectedId === component.id ? "2px solid var(--primary)" : "none",
              }}
            >
              <div className="h-full w-full rounded" style={{ backgroundColor: def.color }} />
              <button
                type="button"
                data-testid={`pin-badge-${component.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenPinPickerId(isOpen ? null : component.id)
                }}
                className="absolute -top-2 -right-2 rounded bg-background px-1 text-[10px] border border-border"
              >
                {component.pin === null ? "no pin" : `D${component.pin}`}
              </button>
              {isOpen && (
                <select
                  data-testid={`pin-select-${component.id}`}
                  value={component.pin ?? ""}
                  onChange={(e) => {
                    store.reassignPin(component.id, Number(e.target.value))
                    setOpenPinPickerId(null)
                  }}
                  className="absolute top-4 left-0 z-10"
                >
                  {freePins.map((p) => (
                    <option key={p.digitalPin} value={p.digitalPin}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
