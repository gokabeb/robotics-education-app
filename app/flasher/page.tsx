import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { FlasherInterface } from "@/components/flasher/flasher-interface"

export default function FlasherPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-16">
        <FlasherInterface />
      </main>
      <Footer />
    </div>
  )
}
