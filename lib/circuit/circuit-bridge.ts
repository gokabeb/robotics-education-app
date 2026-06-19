// lib/circuit/circuit-bridge.ts
// Main-thread message router: connects avr-worker ↔ circuit-worker.
// Holds no simulation state — only translates and forwards messages.

import type { AVRCommand, AVREvent } from "@/lib/avr/types"
import type { CircuitCommand, CircuitEvent, NodeId, ComponentFault, SerializedNetlist } from "./types"

export interface PinNodeMap {
  digitalPins: Map<number, NodeId>
  analogPins: Map<number, NodeId>
}

export interface CircuitBridgeOptions {
  avrWorker: Worker
  circuitWorker: Worker
  pinNodeMap: PinNodeMap
  onFault?: (faults: ComponentFault[]) => void
  onBrightnessUpdate?: (brightnessMap: Record<string, number>) => void
  onNodeVoltages?: (voltages: Record<NodeId, number>) => void
}

export class CircuitBridge {
  private avrWorker: Worker
  private circuitWorker: Worker
  private pinNodeMap: PinNodeMap
  private onFault?: (faults: ComponentFault[]) => void
  private onBrightnessUpdate?: (brightnessMap: Record<string, number>) => void
  private onNodeVoltages?: (voltages: Record<NodeId, number>) => void

  constructor(options: CircuitBridgeOptions) {
    this.avrWorker = options.avrWorker
    this.circuitWorker = options.circuitWorker
    this.pinNodeMap = options.pinNodeMap
    this.onFault = options.onFault
    this.onBrightnessUpdate = options.onBrightnessUpdate
    this.onNodeVoltages = options.onNodeVoltages
  }

  handleAVREvent(event: AVREvent): void {
    if (event.type !== "pinChange") return

    const { pin, high, isPWM, dutyCycle } = event
    const nodeId = this.pinNodeMap.digitalPins.get(pin)
    if (!nodeId) return

    const voltage = isPWM ? (dutyCycle / 255) * 5.0 : (high ? 5.0 : 0.0)

    const cmd: CircuitCommand = { type: "setPinVoltage", nodeId, voltage }
    this.circuitWorker.postMessage(cmd)
  }

  handleCircuitEvent(event: CircuitEvent): void {
    if (event.type !== "tick") return

    const { nodeVoltages, faults, brightnessMap } = event

    for (const [analogChannel, nodeId] of this.pinNodeMap.analogPins) {
      const V = nodeVoltages[nodeId] ?? 0
      const adcValue = Math.max(0, Math.min(1023, Math.round((V / 5.0) * 1023)))
      const cmd: AVRCommand = { type: "setADCInput", pin: analogChannel, value: adcValue }
      this.avrWorker.postMessage(cmd)
    }

    if (faults.length > 0) this.onFault?.(faults)
    if (Object.keys(brightnessMap).length > 0) this.onBrightnessUpdate?.(brightnessMap)
    this.onNodeVoltages?.(nodeVoltages)
  }

  sendNetlist(netlist: SerializedNetlist): void {
    const cmd: CircuitCommand = { type: "setNetlist", netlist }
    this.circuitWorker.postMessage(cmd)
  }

  startCircuit(): void {
    this.circuitWorker.postMessage({ type: "start" } satisfies CircuitCommand)
  }

  stopCircuit(): void {
    this.circuitWorker.postMessage({ type: "stop" } satisfies CircuitCommand)
  }
}
