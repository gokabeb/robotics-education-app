"use client"

import type { RobotProjectStore } from "@/lib/workspace/robot-project-store"
import { ChassisCanvas } from "./chassis-canvas"

export function WorkspaceBuilderView({ store }: { store: RobotProjectStore }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2 text-sm font-medium">Builder</div>
      <div className="flex-1 overflow-hidden">
        <ChassisCanvas store={store} />
      </div>
    </div>
  )
}
