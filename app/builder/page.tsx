import { Navigation } from "@/components/navigation"
import { BuilderView } from "@/components/builder/builder-view"

export default function BuilderPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-16">
        <BuilderView />
      </div>
    </div>
  )
}


