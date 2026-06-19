import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider } from "@clerk/nextjs"
import { Toaster } from "sonner"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Xylo — Robotics Education Platform",
  description:
    "The next-generation web-based robotics education platform. Build, simulate, and deploy code to real robots.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

// Force dynamic rendering for the root layout to avoid static generation issues with Clerk
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  // If no Clerk key, render without ClerkProvider (for builds without env vars)
  if (!publishableKey) {
    return (
      <html lang="en" className="dark">
        <body className={`font-sans antialiased`}>
          {children}
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
          />
          <Analytics />
        </body>
      </html>
    )
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en" className="dark">
        <body className={`font-sans antialiased`}>
          {children}
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
          />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
