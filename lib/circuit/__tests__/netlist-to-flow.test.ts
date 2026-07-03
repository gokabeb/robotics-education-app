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

  it("creates 3 nodes: resistor + power rails (VCC, GND)", () => {
    const { nodes } = netlistToFlow(netlist)
    const ids = nodes.map(n => n.id)
    expect(ids).toHaveLength(3)
    expect(ids).toContain("r1")
    expect(ids).toContain("__VCC")
    expect(ids).toContain("__GND")
  })

  it("creates 2 edges: VCC→r1 and r1→GND", () => {
    const { edges } = netlistToFlow(netlist)
    expect(edges).toHaveLength(2)
    expect(edges.some(e => e.source === "__VCC" && e.target === "r1")).toBe(true)
    expect(edges.some(e => e.source === "r1" && e.target === "__GND")).toBe(true)
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

  it("creates 4 nodes: 2 components + power rails (VCC, GND)", () => {
    const { nodes } = netlistToFlow(netlist)
    expect(nodes).toHaveLength(4)
    expect(nodes.map(n => n.id)).toContain("r1")
    expect(nodes.map(n => n.id)).toContain("l1")
    expect(nodes.map(n => n.id)).toContain("__VCC")
    expect(nodes.map(n => n.id)).toContain("__GND")
  })

  it("creates 3 edges: VCC→r1, l1→r1 (via MID net), l1→GND", () => {
    const { edges } = netlistToFlow(netlist)
    expect(edges).toHaveLength(3)
    expect(edges.some(e => e.source === "__VCC" && e.target === "r1")).toBe(true)
    const hasMidEdge = edges.some(e =>
      (e.source === "l1" && e.target === "r1") || (e.source === "r1" && e.target === "l1")
    )
    expect(hasMidEdge).toBe(true)
    expect(edges.some(e => e.source === "l1" && e.target === "__GND")).toBe(true)
  })

  it("all nodes have dagre-assigned positions (not all zero)", () => {
    const { nodes } = netlistToFlow(netlist)
    const allZero = nodes.every(n => n.position.x === 0 && n.position.y === 0)
    expect(allZero).toBe(false)
  })
})

describe("netlistToFlow — potentiometer (3-terminal component)", () => {
  const netlist: SerializedNetlist = {
    nodes: ["VCC", "A0"],
    components: [{
      id: "pot1",
      type: "potentiometer",
      terminals: { t1: "VCC", t2: "GND", wiper: "A0" },
      params: { resistance: 10000, position: 0.5 },
    }],
  }

  it("creates 3 nodes: potentiometer + power rails (VCC, GND)", () => {
    const { nodes } = netlistToFlow(netlist)
    const ids = nodes.map(n => n.id)
    expect(ids).toHaveLength(3)
    expect(ids).toContain("pot1")
    expect(ids).toContain("__VCC")
    expect(ids).toContain("__GND")
  })

  it("creates edges connecting VCC→potentiometer and potentiometer→GND", () => {
    const { edges } = netlistToFlow(netlist)
    expect(edges.some(e => e.source === "__VCC" && e.target === "pot1")).toBe(true)
    expect(edges.some(e => e.source === "pot1" && e.target === "__GND")).toBe(true)
  })

  it("wiper terminal (A0) produces no extra node when unconnected to other components", () => {
    const { nodes } = netlistToFlow(netlist)
    const ids = nodes.map(n => n.id)
    // A0 is not another component — no standalone net node is created
    expect(ids).not.toContain("A0")
    expect(ids).not.toContain("__A0")
  })
})
