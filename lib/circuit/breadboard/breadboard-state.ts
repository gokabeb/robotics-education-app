// lib/circuit/breadboard/breadboard-state.ts
// Mutable state for the breadboard editor.
// Placed components + wires → SerializedNetlist via union-find net merging.

import { holeNet, ARDUINO_HOLES, BBColumn } from "./breadboard-layout"
import type { SerializedNetlist, SerializedComponent, ComponentId, NodeId, ComponentParams } from "../types"
import { GND, VCC } from "../types"

export interface HolePosition {
  row: number
  col: BBColumn
}

export type WireEndpoint =
  | { kind: "hole"; row: number; col: BBColumn }
  | { kind: "arduino"; pinKey: string }   // key into ARDUINO_HOLES, e.g. "D13", "GND_14"

export interface PlacedComponent {
  id: ComponentId
  type: "resistor" | "led" | "voltage-source"
  params: Record<string, number | string>
  terminal1: HolePosition
  terminal2: HolePosition
}

export interface UserWire {
  id: string
  from: WireEndpoint
  to: WireEndpoint
}

function netForEndpoint(e: WireEndpoint): NodeId {
  if (e.kind === "arduino") {
    return ARDUINO_HOLES.get(e.pinKey)?.nodeId ?? "FLOATING"
  }
  return holeNet(e.row, e.col)
}

// A net name is "named" (fixed, student-meaningful) if it isn't an internal
// tie-strip label like "R12L". GND, VCC, and every Arduino pin nodeId
// (D0-D13, A0-A5, AREF, VIN, V33) are named. Named nets always win as the
// union-find root, so mission criteria can reference them by literal string
// regardless of which physical strip a student wired them through.
function isNamedNet(id: NodeId): boolean {
  return !/^R\d+[LR]$/.test(id)
}

// ── Union-Find for net merging ───────────────────────────────────────────────

function makeUnionFind(nodes: string[]): { parent: Map<string, string>; find: (x: string) => string; union: (a: string, b: string) => void } {
  const parent = new Map<string, string>(nodes.map(n => [n, n]))
  const rank   = new Map<string, number>(nodes.map(n => [n, 0]))

  function find(x: string): string {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const root = find(p)
    parent.set(x, root)
    return root
  }

  function union(a: string, b: string): void {
    const ra = find(a), rb = find(b)
    if (ra === rb) return
    const aNamed = isNamedNet(ra), bNamed = isNamedNet(rb)
    if (bNamed && !aNamed) { parent.set(ra, rb); return }
    if (aNamed && !bNamed) { parent.set(rb, ra); return }
    const rankA = rank.get(ra) ?? 0, rankB = rank.get(rb) ?? 0
    if (rankA >= rankB) { parent.set(rb, ra); if (rankA === rankB) rank.set(ra, rankA + 1) }
    else                { parent.set(ra, rb) }
  }

  return { parent, find, union }
}

// ── BreadboardState class ─────────────────────────────────────────────────────

export class BreadboardState {
  private components: PlacedComponent[] = []
  private wires:      UserWire[]       = []
  private nextWireId = 1

  addComponent(comp: PlacedComponent): void {
    this.components.push(comp)
  }

  removeComponent(id: ComponentId): void {
    this.components = this.components.filter(c => c.id !== id)
  }

  addWire(from: WireEndpoint, to: WireEndpoint): string {
    const id = `wire_${this.nextWireId++}`
    this.wires.push({ id, from, to })
    return id
  }

  removeWire(id: string): void {
    this.wires = this.wires.filter(w => w.id !== id)
  }

  getComponents(): readonly PlacedComponent[] { return this.components }
  getWires():      readonly UserWire[]        { return this.wires }

  toNetlist(): SerializedNetlist {
    const allBaseNets = new Set<NodeId>([GND, VCC])
    for (const comp of this.components) {
      allBaseNets.add(holeNet(comp.terminal1.row, comp.terminal1.col))
      allBaseNets.add(holeNet(comp.terminal2.row, comp.terminal2.col))
    }
    for (const wire of this.wires) {
      allBaseNets.add(netForEndpoint(wire.from))
      allBaseNets.add(netForEndpoint(wire.to))
    }

    const uf = makeUnionFind([...allBaseNets])

    for (const wire of this.wires) {
      uf.union(netForEndpoint(wire.from), netForEndpoint(wire.to))
    }

    const resolve = (pos: HolePosition): NodeId => uf.find(holeNet(pos.row, pos.col))

    const netSet = new Set<NodeId>()
    for (const net of allBaseNets) {
      const root = uf.find(net)
      if (root !== GND) netSet.add(root)
    }

    const serializedComponents: SerializedComponent[] = this.components.map(comp => {
      const net1 = resolve(comp.terminal1)
      const net2 = resolve(comp.terminal2)
      const p = comp.params as ComponentParams
      let terminals: Record<string, NodeId>
      switch (comp.type) {
        case "resistor":       terminals = { n1: net1, n2: net2 };       break
        case "led":            terminals = { anode: net1, cathode: net2 }; break
        case "voltage-source": terminals = { plus: net1, minus: net2 };  break
      }
      return { id: comp.id, type: comp.type, terminals, params: p } as SerializedComponent
    })

    return {
      nodes: [...netSet].filter(n => n !== GND),
      components: serializedComponents,
    }
  }

  clear(): void {
    this.components = []
    this.wires = []
    this.nextWireId = 1
  }
}
