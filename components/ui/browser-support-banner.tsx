"use client"

import { useEffect, useState } from "react"
import { AlertCircle } from "lucide-react"

interface BrowserSupportBannerProps {
  feature?: string
  supportedBrowsers?: string[]
}

export function BrowserSupportBanner({
  feature = "Web Serial API",
  supportedBrowsers = ["Chrome 89+", "Edge 89+", "Opera 76+"],
}: BrowserSupportBannerProps) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setIsSupported(typeof navigator !== "undefined" && "serial" in navigator)
  }, [])

  // Render nothing until we know (avoids hydration mismatch) or if supported
  if (isSupported === null || isSupported) return null

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400">
            {feature} not supported in this browser
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Hardware connection requires{" "}
            {supportedBrowsers.join(", ")}. You can still copy code and use
            the Arduino Web Editor to flash your robot.
          </p>
        </div>
      </div>
    </div>
  )
}
