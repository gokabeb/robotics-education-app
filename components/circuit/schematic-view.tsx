"use client"

import { useMemo } from "react"
import { ReactFlow, ReactFlowProvider, Background, Controls } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { netlistToFlow } from "@/lib/circuit/schematic/netlist-to-flow"
import { NODE_TYPES } from "@/lib/circuit/schematic/node-types"
import type { SerializedNetlist } from "@/lib/circuit/types"

export function SchematicView({ netlist }: { netlist: SerializedNetlist }) {
  const { nodes, edges } = useMemo(() => netlistToFlow(netlist), [netlist])

  if (netlist.components.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Wire your circuit to see the schematic
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div style={{ width: "100%", height: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="#2a3a4a" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}
