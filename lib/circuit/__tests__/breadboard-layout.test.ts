import { describe, it, expect } from "vitest"
import {
  holeNet, ARDUINO_HOLES, BREADBOARD_ROWS, BB_COLS_LEFT, BB_COLS_RIGHT
} from "../breadboard/breadboard-layout"

describe("holeNet — tie-strip connectivity", () => {
  it("same row, left side (a-e) → same net", () => {
    expect(holeNet(5, "a")).toBe(holeNet(5, "e"))
    expect(holeNet(5, "b")).toBe(holeNet(5, "c"))
  })

  it("same row, right side (f-j) → same net", () => {
    expect(holeNet(10, "f")).toBe(holeNet(10, "j"))
  })

  it("left and right sides of same row → DIFFERENT nets", () => {
    expect(holeNet(5, "e")).not.toBe(holeNet(5, "f"))
  })

  it("different rows, same column → DIFFERENT nets", () => {
    expect(holeNet(1, "a")).not.toBe(holeNet(2, "a"))
  })

  it("top power rail + → VCC", () => {
    expect(holeNet(1, "TOP_PLUS")).toBe("VCC")
  })

  it("top power rail − → GND", () => {
    expect(holeNet(1, "TOP_MINUS")).toBe("GND")
  })

  it("bottom power rail + → VCC", () => {
    expect(holeNet(1, "BOT_PLUS")).toBe("VCC")
  })

  it("bottom power rail − → GND", () => {
    expect(holeNet(1, "BOT_MINUS")).toBe("GND")
  })
})

describe("Arduino pin holes", () => {
  it("Arduino D13 has a defined hole position", () => {
    const d13 = ARDUINO_HOLES.get("D13")
    expect(d13).toBeDefined()
    expect(d13!.nodeId).toBe("D13")
  })

  it("Arduino GND hole maps to GND node", () => {
    const gndHole = Array.from(ARDUINO_HOLES.values()).find(h => h.nodeId === "GND")
    expect(gndHole).toBeDefined()
  })

  it("Arduino 5V hole maps to VCC node", () => {
    const vccHole = Array.from(ARDUINO_HOLES.values()).find(h => h.nodeId === "VCC")
    expect(vccHole).toBeDefined()
  })
})

describe("layout constants", () => {
  it("has 63 rows", () => {
    expect(BREADBOARD_ROWS).toBe(63)
  })

  it("left columns are a-e", () => {
    expect(BB_COLS_LEFT).toEqual(["a", "b", "c", "d", "e"])
  })

  it("right columns are f-j", () => {
    expect(BB_COLS_RIGHT).toEqual(["f", "g", "h", "i", "j"])
  })
})
