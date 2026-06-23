import type { BoardId, BoardProfile, PinMapping } from "./types"

export const BOARD_PROFILES: Record<BoardId, BoardProfile> = {
  "arduino-uno": {
    id: "arduino-uno",
    displayName: "Arduino Uno",
    mcu: "atmega328p",
    fcpu: 16_000_000,
    maxFlashBytes: 32_256,
    maxSRAMBytes: 2_048,
    fqbn: "arduino:avr:uno",
  },
  "arduino-nano": {
    id: "arduino-nano",
    displayName: "Arduino Nano",
    mcu: "atmega328p",
    fcpu: 16_000_000,
    maxFlashBytes: 30_720,
    maxSRAMBytes: 2_048,
    fqbn: "arduino:avr:nano:cpu=atmega328",
  },
  "arduino-mega": {
    id: "arduino-mega",
    displayName: "Arduino Mega 2560",
    mcu: "atmega2560",
    fcpu: 16_000_000,
    maxFlashBytes: 253_952,
    maxSRAMBytes: 8_192,
    fqbn: "arduino:avr:mega:cpu=atmega2560",
  },
}

// ATmega328P pin mapping: digital pin number → port/bit
export const UNO_PIN_MAP: PinMapping[] = [
  { digitalPin: 0,  port: "D", bit: 0, isPWMCapable: false },
  { digitalPin: 1,  port: "D", bit: 1, isPWMCapable: false },
  { digitalPin: 2,  port: "D", bit: 2, isPWMCapable: false },
  { digitalPin: 3,  port: "D", bit: 3, isPWMCapable: true  },
  { digitalPin: 4,  port: "D", bit: 4, isPWMCapable: false },
  { digitalPin: 5,  port: "D", bit: 5, isPWMCapable: true  },
  { digitalPin: 6,  port: "D", bit: 6, isPWMCapable: true  },
  { digitalPin: 7,  port: "D", bit: 7, isPWMCapable: false },
  { digitalPin: 8,  port: "B", bit: 0, isPWMCapable: false },
  { digitalPin: 9,  port: "B", bit: 1, isPWMCapable: true  },
  { digitalPin: 10, port: "B", bit: 2, isPWMCapable: true  },
  { digitalPin: 11, port: "B", bit: 3, isPWMCapable: true  },
  { digitalPin: 12, port: "B", bit: 4, isPWMCapable: false },
  { digitalPin: 13, port: "B", bit: 5, isPWMCapable: false },
  { digitalPin: 14, port: "C", bit: 0, isPWMCapable: false, analogChannel: 0 },
  { digitalPin: 15, port: "C", bit: 1, isPWMCapable: false, analogChannel: 1 },
  { digitalPin: 16, port: "C", bit: 2, isPWMCapable: false, analogChannel: 2 },
  { digitalPin: 17, port: "C", bit: 3, isPWMCapable: false, analogChannel: 3 },
  { digitalPin: 18, port: "C", bit: 4, isPWMCapable: false, analogChannel: 4 },
  { digitalPin: 19, port: "C", bit: 5, isPWMCapable: false, analogChannel: 5 },
]

const BOARD_PIN_MAPS: Record<BoardId, PinMapping[]> = {
  "arduino-uno": UNO_PIN_MAP,
  "arduino-nano": UNO_PIN_MAP,
  "arduino-mega": UNO_PIN_MAP, // Phase 1: treat Mega as Uno-compatible for pins 0-19
}

export function getPinMapping(board: BoardId, digitalPin: number): PinMapping | null {
  const map = BOARD_PIN_MAPS[board]
  return map.find((m) => m.digitalPin === digitalPin) ?? null
}

export function getAnalogPinNumber(pinLabel: string): number | null {
  const match = pinLabel.match(/^A(\d)$/)
  if (!match) return null
  return parseInt(match[1], 10)
}
