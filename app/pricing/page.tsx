"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Check, Star, GraduationCap, Sparkles, Users } from "lucide-react"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import { STRIPE_PLANS } from "@/lib/stripe/config"
import { cn } from "@/lib/utils"

export default function PricingPage() {
  const { isSignedIn } = useUser()
  const [isAnnual, setIsAnnual] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleSubscribe = async (planId: string) => {
    if (!isSignedIn) {
      toast.error("Please sign in to subscribe")
      window.location.href = "/sign-in"
      return
    }

    if (planId === "free") {
      toast.success("You're already on the free plan!")
      return
    }

    setLoadingPlan(planId)
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || "Failed to create checkout session")
      }
    } catch {
      toast.error("Failed to process subscription")
    } finally {
      setLoadingPlan(null)
    }
  }

  const getPrice = (plan: (typeof STRIPE_PLANS)[keyof typeof STRIPE_PLANS]) => {
    if (plan.price === 0) return "Free"
    const price = isAnnual ? plan.price * 10 : plan.price // 2 months free for annual
    return `$${price.toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-20 text-center px-6 py-16"
      >
        <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
          <Sparkles className="mr-1 h-3 w-3" />
          Simple Pricing
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Choose Your Plan
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Start free and upgrade as you grow. All plans include our core robotics
          simulation platform.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <span className={cn("text-sm", !isAnnual && "text-foreground font-medium")}>
            Monthly
          </span>
          <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
          <span className={cn("text-sm", isAnnual && "text-foreground font-medium")}>
            Annual
            <Badge variant="outline" className="ml-2 text-primary border-primary/30">
              Save 17%
            </Badge>
          </span>
        </div>
      </motion.div>

      {/* Pricing Cards */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Free Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <Star className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{STRIPE_PLANS.free.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {STRIPE_PLANS.free.description}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">Free</span>
              <span className="text-muted-foreground"> forever</span>
            </div>

            <Button
              variant="outline"
              className="w-full mb-6"
              onClick={() => handleSubscribe("free")}
            >
              Get Started
            </Button>

            <ul className="space-y-3">
              {STRIPE_PLANS.free.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Premium Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl border-2 border-primary bg-card p-8 shadow-lg shadow-primary/10"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground">
                Most Popular
              </Badge>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{STRIPE_PLANS.premium.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {STRIPE_PLANS.premium.description}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">{getPrice(STRIPE_PLANS.premium)}</span>
              <span className="text-muted-foreground">
                {" "}
                / {isAnnual ? "year" : "month"}
              </span>
            </div>

            <Button
              className="w-full mb-6 bg-primary text-primary-foreground"
              onClick={() => handleSubscribe("premium")}
              disabled={loadingPlan === "premium"}
            >
              {loadingPlan === "premium" ? "Processing..." : "Subscribe"}
            </Button>

            <ul className="space-y-3">
              {STRIPE_PLANS.premium.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Education Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border bg-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <GraduationCap className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{STRIPE_PLANS.education.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {STRIPE_PLANS.education.description}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">{getPrice(STRIPE_PLANS.education)}</span>
              <span className="text-muted-foreground">
                {" "}
                / {isAnnual ? "year" : "month"}
              </span>
            </div>

            <Button
              variant="outline"
              className="w-full mb-6"
              onClick={() => handleSubscribe("education")}
              disabled={loadingPlan === "education"}
            >
              {loadingPlan === "education" ? "Processing..." : "Subscribe"}
            </Button>

            <ul className="space-y-3">
              {STRIPE_PLANS.education.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-blue-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Enterprise CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 rounded-2xl border border-border bg-card p-8 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
            <h3 className="text-2xl font-semibold">Enterprise & District Licensing</h3>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Need to deploy Xylo across your entire school district? We offer custom
            pricing, dedicated support, and enterprise features for large deployments.
          </p>
          <Button variant="outline" size="lg">
            Contact Sales
          </Button>
        </motion.div>
      </div>
    </div>
  )
}


