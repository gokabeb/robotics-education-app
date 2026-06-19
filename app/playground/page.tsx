import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { PlaygroundView } from "@/components/playground/playground-view"
import { Suspense } from "react"

function PlaygroundContent() {
  return <PlaygroundView />
}

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-16">
        <Suspense fallback={
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading editor...</div>
          </div>
        }>
          <PlaygroundContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
