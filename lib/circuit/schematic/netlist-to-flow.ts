import dagre from "@dagrejs/dagre"
import type { Node, Edge } from "@xyflow/react"
import type { SerializedNetlist } from "../types"
import { GND, VCC } from "../types"

const NODE_W = 120
const NODE_H = 60

export function netlistToFlow(
  netlist: SerializedNetlist
): { nodes: Node[]; edges: Edge[] } {
  if (netlist.components.length === 0) return { nodes: [], edges: [] }

  const nodes: Node[] = []
  const edges: Edge[] = []
  let edgeIdx = 0

  // Component nodes
  for (const comp of netlist.components) {
    nodes.push({
      id: comp.id,
      type: comp.type,
      data: { ...comp.params, id: comp.id },
      position: { x: 0, y: 0 },
    })
  }

  // Power rail nodes
  const hasVcc = netlist.nodes.includes(VCC) ||
    netlist.components.some(c => Object.values(c.terminals).includes(VCC))
  if (hasVcc) {
    nodes.push({
      id: "__VCC",
      type: "power-node",
      data: { label: "5V" },
      position: { x: 0, y: 0 },
    })
  }
  nodes.push({
    id: "__GND",
    type: "ground-node",
    data: { label: "GND" },
    position: { x: 0, y: 0 },
  })

  // Edges — connect each component terminal to its net partners
  for (const comp of netlist.components) {
    for (const [termKey, netId] of Object.entries(comp.terminals)) {
      if (netId === VCC && hasVcc) {
        edges.push({
          id: `e${edgeIdx++}`,
          source: "__VCC",
          target: comp.id,
          targetHandle: termKey,
        })
        continue
      }
      if (netId === GND) {
        edges.push({
          id: `e${edgeIdx++}`,
          source: comp.id,
          sourceHandle: termKey,
          target: "__GND",
        })
        continue
      }
      // Connect to other components sharing this net
      for (const other of netlist.components) {
        if (other.id <= comp.id) continue  // deduplicate: only add once
        for (const [otherKey, otherNet] of Object.entries(other.terminals)) {
          if (otherNet === netId) {
            edges.push({
              id: `e${edgeIdx++}`,
              source: comp.id,
              sourceHandle: termKey,
              target: other.id,
              targetHandle: otherKey,
            })
          }
        }
      }
    }
  }

  // dagre auto-layout (left-to-right)
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  for (const node of nodes) {
    const pos = g.node(node.id)
    if (pos) {
      node.position = {
        x: pos.x - NODE_W / 2,
        y: pos.y - NODE_H / 2,
      }
    }
  }

  return { nodes, edges }
}
