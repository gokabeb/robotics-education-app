import { describe, it, expect } from "vitest"
import { netlistToFlow } from "../schematic/netlist-to-flow"
import type { SerializedNetlist } from "../types"

describe("netlistToFlow — empty netlist", () => {
  it("returns empty nodes and edges", () => {
    const result = netlistToFlow({ nodes: [], components: [] })
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
  })
})

describe("netlistToFlow — single resistor", () => {
  const netlist: SerializedNetlist = {
    nodes: ["VCC", "R1L"],
    components: [{
      id: "r1",
      type: "resistor",
      terminals: { n1: "VCC", n2: "GND" },
      params: { resistance: 220 },
    }],
  }

  it("creates one component node plus VCC and GND nodes", () => {
    const { nodes } = netlistToFlow(netlist)
    const ids = nodes.map(n => n.id)
    expect(ids).toContain("r1")
    expect(ids).toContain("__GND")
  })

  it("creates edges from VCC to r1 and from r1 to GND", () => {
    const { edges } = netlistToFlow(netlist)
    expect(edges.length).toBeGreaterThanOrEqual(2)
    const targets = edges.map(e => e.target)
    expect(targets).toContain("r1")
    const sources = edges.map(e => e.source)
    expect(sources).toContain("r1")
  })
})

describe("netlistToFlow — resistor + LED in series", () => {
  const netlist: SerializedNetlist = {
    nodes: ["VCC", "MID"],
    components: [
      { id: "r1", type: "resistor",  terminals: { n1: "VCC", n2: "MID" }, params: { resistance: 220 } },
      { id: "l1", type: "led",       terminals: { anode: "MID", cathode: "GND" }, params: { color: "red" } },
    ],
  }

  it("creates 2 component nodes + VCC + GND", () => {
    const { nodes } = netlistToFlow(netlist)
    expect(nodes.map(n => n.id)).toContain("r1")
    expect(nodes.map(n => n.id)).toContain("l1")
  })

  it("creates an edge between the two components via MID net", () => {
    const { edges } = netlistToFlow(netlist)
    const hasRtoL = edges.some(e =>
      (e.source === "r1" && e.target === "l1") ||
      (e.source === "l1" && e.target === "r1")
    )
    expect(hasRtoL).toBe(true)
  })

  it("all nodes have dagre-assigned positions (not all zero)", () => {
    const { nodes } = netlistToFlow(netlist)
    const allZero = nodes.every(n => n.position.x === 0 && n.position.y === 0)
    expect(allZero).toBe(false)
  })
})
