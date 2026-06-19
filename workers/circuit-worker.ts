// workers/circuit-worker.ts
// Circuit simulation Web Worker — runs MNA at ~1kHz

import { MNASolver } from "@/lib/circuit/solver/mna-solver"
import { newtonRaphson } from "@/lib/circuit/solver/newton-raphson"
import { Resistor } from "@/lib/circuit/components/resistor"
import { VoltageSource } from "@/lib/circuit/components/voltage-source"
import { LED } from "@/lib/circuit/components/led"
import { isNonlinear } from "@/lib/circuit/components/base-component"
import type {
  CircuitCommand, CircuitEvent, SerializedNetlist, SerializedComponent,
  ComponentFault, NodeId
} from "@/lib/circuit/types"
import { GND, VCC, VCC_VOLTAGE } from "@/lib/circuit/types"
import type { LinearComponent, NonlinearComponent } from "@/lib/circuit/solver/newton-raphson"
import type { CircuitComponent } from "@/lib/circuit/components/base-component"
import type { LEDColor } from "@/lib/circuit/components/led"

function post(event: CircuitEvent) {
  self.postMessage(event)
}

// ── State ────────────────────────────────────────────────────────────────────

let solver = new MNASolver()
let linearComponents:    LinearComponent[]    = []
let nonlinearComponents: NonlinearComponent[] = []
let allComponents:       CircuitComponent[]   = []
let controlledSources = new Map<NodeId, VoltageSource>()
let tickTimer: ReturnType<typeof setInterval> | null = null
/** All non-GND nodes tracked for voltage reporting */
let trackedNodes: NodeId[] = []

// ── Netlist compilation ──────────────────────────────────────────────────────

function buildFromNetlist(netlist: SerializedNetlist): void {
  allComponents = []
  linearComponents = []
  nonlinearComponents = []
  controlledSources = new Map()

  const vccSource = new VoltageSource("__vs_VCC", VCC, GND, VCC_VOLTAGE)
  allComponents.push(vccSource)
  linearComponents.push(vccSource)
  controlledSources.set(VCC, vccSource)

  const vsourceIds: string[] = [vccSource.voltageSourceId]
  for (const sc of netlist.components) {
    if (sc.type === "voltage-source") vsourceIds.push(sc.id)
  }

  const nodeIds = [VCC, ...netlist.nodes.filter(n => n !== GND && n !== VCC)]
  trackedNodes = nodeIds

  solver = new MNASolver()
  solver.setup(nodeIds, vsourceIds)

  for (const sc of netlist.components) {
    const comp = buildComponent(sc)
    if (!comp) continue
    allComponents.push(comp)
    if (isNonlinear(comp)) {
      nonlinearComponents.push(comp)
    } else {
      linearComponents.push(comp)
    }
  }
}

function buildComponent(sc: SerializedComponent): CircuitComponent | null {
  switch (sc.type) {
    case "resistor": {
      const R = sc.params.resistance
      if (!R || R <= 0) return null
      return new Resistor(sc.id, sc.terminals.n1, sc.terminals.n2, R)
    }
    case "led": {
      return new LED(sc.id, sc.terminals.anode, sc.terminals.cathode, (sc.params.color ?? "red") as LEDColor)
    }
    case "voltage-source": {
      const V = sc.params.voltage ?? 0
      const vs = new VoltageSource(sc.id, sc.terminals.plus, sc.terminals.minus, V)
      controlledSources.set(sc.terminals.plus, vs)
      linearComponents.push(vs)
      return vs
    }
    default:
      return null
  }
}

// ── Tick ─────────────────────────────────────────────────────────────────────

function tick(): void {
  if (solver.size === 0) return

  const solution = newtonRaphson(solver, linearComponents, nonlinearComponents)

  const nodeVoltages: Record<NodeId, number> = {}
  for (const nodeId of trackedNodes) {
    nodeVoltages[nodeId] = solver.voltage(solution, nodeId)
  }
  nodeVoltages[GND] = 0

  const faults: ComponentFault[] = []
  const brightnessMap: Record<string, number> = {}

  for (const comp of allComponents) {
    const fault = comp.getFaultState(solution, solver)
    if (fault) faults.push(fault)
    if (comp.brightness > 0) brightnessMap[comp.id] = comp.brightness
  }

  post({ type: "tick", nodeVoltages, faults, brightnessMap })
}

// ── Message handler ──────────────────────────────────────────────────────────

self.addEventListener("message", (e: MessageEvent<CircuitCommand>) => {
  const cmd = e.data
  switch (cmd.type) {
    case "setNetlist":
      buildFromNetlist(cmd.netlist)
      break
    case "setPinVoltage": {
      const vs = controlledSources.get(cmd.nodeId)
      if (vs) vs.voltage = cmd.voltage
      break
    }
    case "start":
      if (!tickTimer) tickTimer = setInterval(tick, 1)
      break
    case "stop":
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
      break
    case "reset":
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
      buildFromNetlist({ nodes: [], components: [] })
      break
  }
})

post({ type: "ready" })
