"use client"

import { ReactNode } from "react"
import { useSubscription } from "@/hooks/use-subscription"
import { Button } from "@/components/ui/button"
import { Lock, Sparkles } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface PremiumGateProps {
  feature: string
  children: ReactNode
  fallback?: ReactNode
  showUpgrade?: boolean
  className?: string
}

export function PremiumGate({
  feature,
  children,
  fallback,
  showUpgrade = true,
  className,
}: PremiumGateProps) {
  const { hasAccess, loading } = useSubscription()

  if (loading) {
    return null
  }

  if (hasAccess(feature)) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (!showUpgrade) {
    return null
  }

  return (
    <div
      className={cn(
        "relative rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-center",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
          <Lock className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h3 className="font-medium">Premium Feature</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade to access this feature
          </p>
        </div>
        <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
          <Link href="/pricing">
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade to Premium
          </Link>
        </Button>
      </div>
    </div>
  )
}

// Lock overlay for partially visible content
export function PremiumOverlay({
  children,
  feature,
  message = "Premium feature",
}: {
  children: ReactNode
  feature: string
  message?: string
}) {
  const { hasAccess, loading } = useSubscription()

  if (loading || hasAccess(feature)) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      <div className="pointer-events-none blur-sm opacity-50">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
        <div className="text-center">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-amber-500/10 mb-3">
            <Lock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-sm font-medium mb-2">{message}</p>
          <Button size="sm" asChild>
            <Link href="/pricing">Upgrade</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}


