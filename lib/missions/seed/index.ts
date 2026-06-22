// lib/missions/seed/index.ts
// In-process registry of system missions. Definitions ship as JSON in this
// directory; only student *attempts* round-trip through Supabase (see Task 10).

import type { Mission } from "../types"
import blinkLed from "./01-blink-led.json"
import trafficLight from "./02-traffic-light.json"
import morseCodeSender from "./03-morse-code-sender.json"
import buttonControlledLed from "./04-button-controlled-led.json"
import debouncedButtonCounter from "./05-debounced-button-counter.json"
import toggleLock from "./06-toggle-lock.json"

const MISSIONS = [
  blinkLed,
  trafficLight,
  morseCodeSender,
  buttonControlledLed,
  debouncedButtonCounter,
  toggleLock,
] as unknown as Mission[]

export function getAllMissions(): Mission[] {
  return MISSIONS
}

export function getMissionById(id: string): Mission | null {
  return MISSIONS.find(m => m.id === id) ?? null
}
