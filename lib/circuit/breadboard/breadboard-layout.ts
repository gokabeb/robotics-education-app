import type { NodeId } from "../types"
import { GND, VCC } from "../types"

export const BREADBOARD_ROWS = 63
export const BB_COLS_LEFT  = ["a", "b", "c", "d", "e"] as const
export const BB_COLS_RIGHT = ["f", "g", "h", "i", "j"] as const
export type BBColumn = "a"|"b"|"c"|"d"|"e"|"f"|"g"|"h"|"i"|"j"|"TOP_PLUS"|"TOP_MINUS"|"BOT_PLUS"|"BOT_MINUS"

export function holeNet(row: number, col: BBColumn): NodeId {
  switch (col) {
    case "TOP_PLUS":  return VCC
    case "BOT_PLUS":  return VCC
    case "TOP_MINUS": return GND
    case "BOT_MINUS": return GND
    default:
      if ((BB_COLS_LEFT as readonly string[]).includes(col)) return `R${row}L`
      if ((BB_COLS_RIGHT as readonly string[]).includes(col)) return `R${row}R`
      return "FLOATING"
  }
}

export interface ArduinoHole {
  label: string
  nodeId: NodeId
  x: number
  y: number
}

export const ARDUINO_HOLE_PITCH = 14
export const ARDUINO_WIDTH      = 120
export const ARDUINO_HEIGHT     = 28 * ARDUINO_HOLE_PITCH

const RIGHT_PINS: Array<{ label: string; nodeId: NodeId }> = [
  { label: "D0",    nodeId: "D0"  },
  { label: "D1",    nodeId: "D1"  },
  { label: "D2",    nodeId: "D2"  },
  { label: "D3",    nodeId: "D3"  },
  { label: "D4",    nodeId: "D4"  },
  { label: "D5",    nodeId: "D5"  },
  { label: "D6",    nodeId: "D6"  },
  { label: "D7",    nodeId: "D7"  },
  { label: "D8",    nodeId: "D8"  },
  { label: "D9",    nodeId: "D9"  },
  { label: "D10",   nodeId: "D10" },
  { label: "D11",   nodeId: "D11" },
  { label: "D12",   nodeId: "D12" },
  { label: "D13",   nodeId: "D13" },
  { label: "GND",   nodeId: GND   },
  { label: "AREF",  nodeId: "AREF"},
  { label: "3.3V",  nodeId: "V33" },
  { label: "5V",    nodeId: VCC   },
  { label: "GND",   nodeId: GND   },
  { label: "GND",   nodeId: GND   },
  { label: "VIN",   nodeId: "VIN" },
  { label: "A0",    nodeId: "A0"  },
  { label: "A1",    nodeId: "A1"  },
  { label: "A2",    nodeId: "A2"  },
  { label: "A3",    nodeId: "A3"  },
  { label: "A4",    nodeId: "A4"  },
  { label: "A5",    nodeId: "A5"  },
]

export const ARDUINO_HOLES: Map<string, ArduinoHole> = new Map(
  RIGHT_PINS.map((pin, i) => [
    pin.label === "GND" ? `GND_${i}` : pin.label,
    {
      label:  pin.label,
      nodeId: pin.nodeId,
      x: ARDUINO_WIDTH - 4,
      y: 20 + i * ARDUINO_HOLE_PITCH,
    }
  ])
)
