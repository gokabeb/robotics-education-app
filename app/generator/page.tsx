import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { CodeGenerator } from "@/components/generator/code-generator"

export default function GeneratorPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-16">
        <CodeGenerator />
      </main>
      <Footer />
    </div>
  )
}
