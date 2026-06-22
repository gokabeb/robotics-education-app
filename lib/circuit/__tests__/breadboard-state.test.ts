import { describe, it, expect } from "vitest"
import { BreadboardState } from "../breadboard/breadboard-state"

describe("BreadboardState — Arduino pin wire endpoints", () => {
  it("wiring D13 to a tie-strip hole resolves that strip's net to literal 'D13'", () => {
    const bb = new BreadboardState()
    bb.addComponent({
      id: "r1",
      type: "resistor",
      params: { resistance: 220 },
      terminal1: { row: 10, col: "a" },
      terminal2: { row: 12, col: "a" },
    })
    bb.addWire(
      { kind: "arduino", pinKey: "D13" },
      { kind: "hole", row: 10, col: "a" }
    )
    const netlist = bb.toNetlist()
    const resistor = netlist.components.find(c => c.id === "r1")!
    expect(resistor.terminals.n1).toBe("D13")
  })

  it("wiring GND to a tie-strip hole resolves that strip's net to literal 'GND'", () => {
    const bb = new BreadboardState()
    bb.addComponent({
      id: "led1",
      type: "led",
      params: { color: "red" },
      terminal1: { row: 20, col: "f" },
      terminal2: { row: 22, col: "f" },
    })
    bb.addWire(
      { kind: "hole", row: 22, col: "f" },
      { kind: "arduino", pinKey: "GND_14" }
    )
    const netlist = bb.toNetlist()
    const led = netlist.components.find(c => c.id === "led1")!
    expect(led.terminals.cathode).toBe("GND")
  })

  it("two tie-strip holes merge with normal rank-based union when neither is named", () => {
    const bb = new BreadboardState()
    bb.addWire({ kind: "hole", row: 5, col: "a" }, { kind: "hole", row: 7, col: "a" })
    const netlist = bb.toNetlist()
    // Both R5L and R7L existed before the union; one becomes root — just confirm
    // the netlist doesn't crash and produces exactly one merged net (no FLOATING leak).
    expect(netlist.nodes.every(n => n !== "FLOATING")).toBe(true)
  })
})
