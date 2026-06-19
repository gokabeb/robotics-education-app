import { Navigation } from "@/components/navigation"
import { SimulatorView } from "@/components/simulator/simulator-view"

export default function SimulatorPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SimulatorView />
    </div>
  )
}


