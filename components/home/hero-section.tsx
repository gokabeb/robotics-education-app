"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Sparkles } from "lucide-react"
import { motion } from "framer-motion"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 blur-[120px] rounded-full"
      />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Now in Beta</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-4xl text-4xl font-semibold tracking-tight text-balance md:text-6xl lg:text-7xl"
          >
            The future of <span className="text-primary">robotics education</span> is here
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed md:text-xl"
          >
            Build, simulate, and deploy code to real robots — all from your browser. No expensive hardware required.
            Just imagination and curiosity.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Button size="lg" className="h-12 px-8 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link href="/generator">
                Start Building
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 border-border bg-transparent hover:bg-secondary">
              <Play className="mr-2 h-4 w-4" />
              Watch Demo
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="relative mt-16 w-full max-w-5xl"
          >
            <div className="aspect-video rounded-xl border border-border bg-card overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-4 p-8 w-full h-full">
                  {/* Code Editor Mock */}
                  <div className="col-span-2 rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-3 w-3 rounded-full bg-destructive/50" />
                      <div className="h-3 w-3 rounded-full bg-chart-4/50" />
                      <div className="h-3 w-3 rounded-full bg-primary/50" />
                      <span className="ml-2 text-xs text-muted-foreground font-mono">robot_control.py</span>
                    </div>
                    <div className="space-y-2 font-mono text-sm">
                      <div className="text-muted-foreground">
                        <span className="text-primary">def</span> move_forward(speed):
                      </div>
                      <div className="text-muted-foreground pl-4">motor.set_velocity(speed)</div>
                      <div className="text-muted-foreground pl-4">motor.spin()</div>
                      <div className="text-muted-foreground mt-4">
                        <span className="text-primary">while</span> sensor.distance() {">"} 10:
                      </div>
                      <div className="text-muted-foreground pl-4">
                        move_forward(<span className="text-chart-1">50</span>)
                      </div>
                    </div>
                  </div>

                  {/* 3D Preview Mock */}
                  <div className="rounded-lg border border-border bg-background p-4 flex flex-col">
                    <span className="text-xs text-muted-foreground mb-3">3D Preview</span>
                    <div className="flex-1 rounded-lg bg-secondary/50 flex items-center justify-center">
                      <motion.div
                        animate={{ rotateY: [0, 10, -10, 0] }}
                        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                        className="w-16 h-12 rounded border-2 border-primary/30 bg-primary/10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="absolute -left-4 top-1/4 rounded-lg border border-border bg-card p-3 shadow-xl"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-muted-foreground">Connected</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="absolute -right-4 bottom-1/4 rounded-lg border border-border bg-card p-3 shadow-xl"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">AI Assisted</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
