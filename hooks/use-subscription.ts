"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { PlanId, STRIPE_PLANS } from "@/lib/stripe/config"

interface Subscription {
  planId: PlanId
  status: "active" | "canceled" | "past_due" | "trialing"
  currentPeriodEnd: string | null
}

export function useSubscription() {
  const { isSignedIn, isLoaded } = useUser()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSubscription() {
      if (!isSignedIn) {
        setSubscription({ planId: "free", status: "active", currentPeriodEnd: null })
        setLoading(false)
        return
      }

      try {
        const response = await fetch("/api/user/subscription")
        if (response.ok) {
          const data = await response.json()
          setSubscription(data)
        } else {
          // Default to free if API fails
          setSubscription({ planId: "free", status: "active", currentPeriodEnd: null })
        }
      } catch {
        setSubscription({ planId: "free", status: "active", currentPeriodEnd: null })
      } finally {
        setLoading(false)
      }
    }

    if (isLoaded) {
      fetchSubscription()
    }
  }, [isSignedIn, isLoaded])

  const plan = subscription?.planId ? STRIPE_PLANS[subscription.planId] : STRIPE_PLANS.free
  const isActive = subscription?.status === "active"
  const isPremium = (subscription?.planId === "premium" || subscription?.planId === "education") && isActive
  const isEducator = subscription?.planId === "education" && isActive

  // Check feature access
  const hasAccess = (feature: string): boolean => {
    // Free features
    const freeFeatures = ["basic_simulator", "block_programming", "3_courses", "community"]
    if (freeFeatures.includes(feature)) return true

    // Premium features
    const premiumFeatures = [
      "all_courses",
      "all_arenas",
      "python_code",
      "unlimited_ai",
      "challenges",
      "priority_support",
    ]
    if (premiumFeatures.includes(feature)) return isPremium

    // Educator features
    const educatorFeatures = [
      "classroom_management",
      "student_tracking",
      "analytics",
      "lms_integration",
    ]
    if (educatorFeatures.includes(feature)) return isEducator

    return false
  }

  // Check content limits
  const withinLimits = (type: string, count: number): boolean => {
    const limits = plan.limits as Record<string, number>
    const limit = limits[type]
    if (limit === undefined) return true
    if (limit === -1) return true // unlimited
    return count < limit
  }

  return {
    subscription,
    plan,
    loading,
    isPremium,
    isEducator,
    isActive,
    hasAccess,
    withinLimits,
  }
}


