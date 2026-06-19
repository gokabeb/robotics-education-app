"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bot, Code2, Blocks, Zap, Menu, X, FolderOpen, Gamepad2, Wrench, GraduationCap } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { UserMenu } from "@/components/auth/user-menu"
import { useUser } from "@clerk/nextjs"

const navItems = [
  { href: "/", label: "Home", icon: Bot },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/builder", label: "Builder", icon: Wrench },
  { href: "/simulator", label: "Simulator", icon: Gamepad2 },
  { href: "/playground", label: "Blocks", icon: Blocks },
  { href: "/generator", label: "AI", icon: Code2 },
  { href: "/flasher", label: "Flash", icon: Zap },
  { href: "/dashboard", label: "Projects", icon: FolderOpen, authRequired: true },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isSignedIn, isLoaded } = useUser()

  const filteredNavItems = navItems.filter(item => !item.authRequired || isSignedIn)

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary"
          >
            <Bot className="h-5 w-5 text-primary-foreground" />
          </motion.div>
          <span className="text-xl font-semibold tracking-tight">Xylo</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {filteredNavItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="hidden items-center gap-3 md:flex"
        >
          {isLoaded && <UserMenu />}
        </motion.div>

        {/* Mobile Menu Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-secondary md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </motion.button>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border bg-background overflow-hidden md:hidden"
          >
            <div className="flex flex-col gap-2 p-4">
              {filteredNavItems.map((item, index) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <motion.div
                    key={item.href}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </motion.div>
                )
              })}
              <div className="mt-4 border-t border-border pt-4">
                {isLoaded && (
                  isSignedIn ? (
                    <div className="flex items-center gap-3 px-4 py-2">
                      <UserMenu />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button variant="ghost" className="justify-start text-muted-foreground" asChild>
                        <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                          Sign In
                        </Link>
                      </Button>
                      <Button className="bg-primary text-primary-foreground" asChild>
                        <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                          Get Started
                        </Link>
                      </Button>
                    </div>
                  )
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
