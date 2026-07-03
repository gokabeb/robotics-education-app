import { Handle, Position } from "@xyflow/react"
import type { NodeProps } from "@xyflow/react"

function NodeShell({
  label,
  children,
  bg = "#2a3a4a",
  border = "#4a6a8a",
}: {
  label: string
  children?: React.ReactNode
  bg?: string
  border?: string
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 6,
        padding: "6px 10px",
        minWidth: 80,
        textAlign: "center",
        fontSize: 10,
        color: "#ccc",
        fontFamily: "monospace",
      }}
    >
      {children}
      <div style={{ marginTop: 2, fontSize: 9, color: "#888" }}>{label}</div>
    </div>
  )
}

function ResistorNode({ data }: NodeProps) {
  const R = data.resistance as number | undefined
  return (
    <NodeShell label={R ? `${R}Ω` : "R"} bg="#2a2510" border="#c8a060">
      <svg width={40} height={16}>
        <line x1={0} y1={8} x2={8} y2={8} stroke="#888" strokeWidth={1.5} />
        <rect x={8} y={3} width={24} height={10} fill="#c8a060" rx={2} />
        <line x1={32} y1={8} x2={40} y2={8} stroke="#888" strokeWidth={1.5} />
      </svg>
    </NodeShell>
  )
}

const LED_COLORS: Record<string, string> = {
  red: "#ff3333", green: "#33ff66", blue: "#3399ff", white: "#ffffff", yellow: "#ffee33",
}

function LEDNode({ data }: NodeProps) {
  const color = LED_COLORS[(data.color as string) ?? "red"] ?? "#ff3333"
  return (
    <NodeShell label="LED" bg="#2a1010" border={color}>
      <svg width={32} height={20}>
        <polygon points="4,2 4,18 20,10" fill={color} opacity={0.8} />
        <line x1={20} y1={2} x2={20} y2={18} stroke={color} strokeWidth={2} />
        <line x1={23} y1={4} x2={28} y2={0} stroke={color} strokeWidth={1} />
        <line x1={23} y1={8} x2={28} y2={4} stroke={color} strokeWidth={1} />
      </svg>
    </NodeShell>
  )
}

function ButtonNode({ data }: NodeProps) {
  const closed = data.state === "closed"
  return (
    <NodeShell label={closed ? "CLOSED" : "OPEN"} bg="#1a1a1a" border={closed ? "#44dd88" : "#885544"}>
      <svg width={40} height={16}>
        <line x1={0} y1={8} x2={12} y2={8} stroke="#888" strokeWidth={1.5} />
        <circle cx={12} cy={8} r={3} fill={closed ? "#44dd88" : "#885544"} />
        {closed
          ? <line x1={15} y1={8} x2={25} y2={8} stroke="#44dd88" strokeWidth={2} />
          : <line x1={15} y1={4} x2={25} y2={8} stroke="#885544" strokeWidth={1.5} strokeDasharray="2,2" />}
        <circle cx={28} cy={8} r={3} fill={closed ? "#44dd88" : "#885544"} />
        <line x1={31} y1={8} x2={40} y2={8} stroke="#888" strokeWidth={1.5} />
      </svg>
    </NodeShell>
  )
}

function PotentiometerNode({ data }: NodeProps) {
  const R = data.resistance as number | undefined
  return (
    <NodeShell label={R ? `${R}Ω POT` : "POT"} bg="#1a0e2a" border="#8860c8">
      <Handle type="target" position={Position.Left} id="t1" />
      <Handle type="source" position={Position.Right} id="t2" />
      <Handle type="source" position={Position.Bottom} id="wiper" />
      <svg width={44} height={20}>
        <rect x={4} y={5} width={28} height={10} fill="#8860c8" opacity={0.6} rx={2} />
        <line x1={0} y1={10} x2={4} y2={10} stroke="#888" strokeWidth={1.5} />
        <line x1={32} y1={10} x2={36} y2={10} stroke="#888" strokeWidth={1.5} />
        <line x1={18} y1={18} x2={18} y2={26} stroke="#888" strokeWidth={1.5} />
        <line x1={10} y1={18} x2={26} y2={2} stroke="#fff" strokeWidth={1.5} />
        <polygon points="24,2 26,2 26,6" fill="#fff" />
      </svg>
    </NodeShell>
  )
}

function CapacitorNode({ data }: NodeProps) {
  const C = data.capacitance as number | undefined
  const label = C ? `${(C * 1e6).toFixed(0)}µF` : "C"
  return (
    <NodeShell label={label} bg="#0e1a2a" border="#60aaee">
      <svg width={32} height={20}>
        <line x1={0} y1={10} x2={12} y2={10} stroke="#888" strokeWidth={1.5} />
        <line x1={12} y1={2} x2={12} y2={18} stroke="#60aaee" strokeWidth={2.5} />
        <line x1={16} y1={2} x2={16} y2={18} stroke="#60aaee" strokeWidth={2.5} />
        <line x1={16} y1={10} x2={32} y2={10} stroke="#888" strokeWidth={1.5} />
      </svg>
    </NodeShell>
  )
}

function BJTNode({ data }: NodeProps) {
  const beta = data.beta as number | undefined
  return (
    <NodeShell label={`NPN β=${beta ?? 100}`} bg="#2a1a0a" border="#e8902a">
      <Handle type="target" position={Position.Left} id="base" />
      <Handle type="source" position={Position.Top} id="collector" />
      <Handle type="source" position={Position.Bottom} id="emitter" />
      <svg width={44} height={36}>
        <circle cx={22} cy={18} r={14} fill="none" stroke="#e8902a" strokeWidth={1.5} />
        <line x1={22} y1={6} x2={22} y2={30} stroke="#e8902a" strokeWidth={1.5} />
        <line x1={0} y1={18} x2={22} y2={18} stroke="#888" strokeWidth={1.5} />
        <line x1={22} y1={12} x2={40} y2={2} stroke="#e8902a" strokeWidth={1.5} />
        <line x1={22} y1={24} x2={40} y2={34} stroke="#e8902a" strokeWidth={1.5} />
        <polygon points="34,6 40,2 36,10" fill="#e8902a" />
        <text x={22} y={21} textAnchor="middle" fontSize={7} fill="#ccc" fontFamily="monospace">NPN</text>
      </svg>
    </NodeShell>
  )
}

function VoltageSourceNode({ data }: NodeProps) {
  return (
    <NodeShell label={(data.label as string) ?? "VCC"} bg="#2a0a0a" border="#cc4444">
      <svg width={24} height={16}>
        <line x1={12} y1={0} x2={12} y2={16} stroke="#cc4444" strokeWidth={2} />
        <line x1={4} y1={4} x2={20} y2={4} stroke="#cc4444" strokeWidth={2} />
      </svg>
    </NodeShell>
  )
}

function GroundNode({ data }: NodeProps) {
  return (
    <NodeShell label={(data.label as string) ?? "GND"} bg="#0a0a2a" border="#4466cc">
      <svg width={28} height={16}>
        <line x1={14} y1={0} x2={14} y2={6} stroke="#4466cc" strokeWidth={2} />
        <line x1={4} y1={6} x2={24} y2={6} stroke="#4466cc" strokeWidth={2} />
        <line x1={8} y1={10} x2={20} y2={10} stroke="#4466cc" strokeWidth={2} />
        <line x1={12} y1={14} x2={16} y2={14} stroke="#4466cc" strokeWidth={2} />
      </svg>
    </NodeShell>
  )
}

export const NODE_TYPES = {
  resistor:      ResistorNode,
  led:           LEDNode,
  button:        ButtonNode,
  potentiometer: PotentiometerNode,
  capacitor:     CapacitorNode,
  bjt:           BJTNode,
  "power-node":  VoltageSourceNode,
  "ground-node": GroundNode,
} as const
