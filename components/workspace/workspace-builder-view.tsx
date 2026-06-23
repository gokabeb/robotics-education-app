"use client"

import { useCallback, useSyncExternalStore } from "react"
import type { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { ChassisCanvas } from "./chassis-canvas"

export function WorkspaceBuilderView({ store }: { store: RobotProjectStore }) {
  // isOutOfSync() returns a fresh primitive boolean each call, so reference
  // equality isn't an issue for the snapshot value itself — but subscribe
  // and getSnapshot still need stable identity (via useCallback) so
  // useSyncExternalStore doesn't resubscribe/re-evaluate on every render,
  // matching the pattern established in chassis-canvas.tsx for this store.
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.isOutOfSync(), [store])
  const outOfSync = useSyncExternalStore(subscribe, getSnapshot)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">Builder</span>
        <div className="flex items-center gap-2">
          {outOfSync && (
            <span className="text-xs text-amber-500">Out of sync — reflash to apply</span>
          )}
          <button
            type="button"
            onClick={() => store.flash()}
            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
          >
            Flash
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChassisCanvas store={store} />
      </div>
    </div>
  )
}
