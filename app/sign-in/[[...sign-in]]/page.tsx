import { SignIn } from "@clerk/nextjs"
import { Bot } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/5 blur-[120px] rounded-full"
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">Xylo</span>
        </Link>

        <div className="flex items-center justify-center">
          <SignIn 
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "bg-card border border-border shadow-xl",
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}

