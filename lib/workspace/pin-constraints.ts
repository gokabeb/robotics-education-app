import { UNO_PIN_MAP } from "../avr/board-profiles"
import type { PinMapping } from "../avr/types"

export type PinKind = "digital" | "pwm" | "analog"

export const RESERVED_PINS: ReadonlySet<number> = new Set([0, 1]) // D0/D1 = Serial RX/TX

export interface PinInfo {
  digitalPin: number
  label: string
  isPWMCapable: boolean
  isAnalogCapable: boolean
  isReserved: boolean
}

function pinLabel(mapping: PinMapping): string {
  return mapping.analogChannel !== undefined ? `A${mapping.analogChannel}` : `D${mapping.digitalPin}`
}

function toPinInfo(mapping: PinMapping): PinInfo {
  return {
    digitalPin: mapping.digitalPin,
    label: pinLabel(mapping),
    isPWMCapable: mapping.isPWMCapable,
    isAnalogCapable: mapping.analogChannel !== undefined,
    isReserved: RESERVED_PINS.has(mapping.digitalPin),
  }
}

export function getAllPins(): PinInfo[] {
  return UNO_PIN_MAP.map(toPinInfo)
}

export function isPinValidFor(kind: PinKind, pin: PinInfo): boolean {
  if (pin.isReserved) return false
  if (kind === "pwm") return pin.isPWMCapable
  if (kind === "analog") return pin.isAnalogCapable
  return true
}

export function getFreePinsFor(kind: PinKind, usedPins: number[]): PinInfo[] {
  const used = new Set(usedPins)
  return getAllPins().filter((p) => !used.has(p.digitalPin) && isPinValidFor(kind, p))
}

export function isPinFreeAndValidFor(kind: PinKind, digitalPin: number, usedPins: number[]): boolean {
  if (usedPins.includes(digitalPin)) return false
  const pin = getAllPins().find((p) => p.digitalPin === digitalPin)
  return pin !== undefined && isPinValidFor(kind, pin)
}
