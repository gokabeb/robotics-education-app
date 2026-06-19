import { Suspense } from "react"
import { CircuitView } from "@/components/circuit/circuit-view"

export const metadata = { title: "Circuit Builder — Xylo" }

export default function CircuitPage() {
  return (
    <Suspense>
      <CircuitView />
    </Suspense>
  )
}
