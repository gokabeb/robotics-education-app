"use client"

import { Code2, Cpu, Zap, Users, BookOpen, Shield } from "lucide-react"
import { motion } from "framer-motion"

const features = [
  {
    icon: Code2,
    title: "AI Code Generation",
    description:
      "Generate robot control code using natural language. From block-based to Python, we've got you covered.",
  },
  {
    icon: Cpu,
    title: "3D Simulation",
    description: "Test your robots in a physics-based virtual environment. No hardware damage, unlimited iterations.",
  },
  {
    icon: Zap,
    title: "Direct Flashing",
    description: "Deploy code directly to Arduino and microcontrollers via Web Serial API. One click, real results.",
  },
  {
    icon: Users,
    title: "Classroom Tools",
    description: "Manage students, track progress, and auto-grade assignments. Built for educators.",
  },
  {
    icon: BookOpen,
    title: "Curriculum Aligned",
    description: "Standards-aligned lessons from beginner to advanced. Ready-to-use in any classroom.",
  },
  {
    icon: Shield,
    title: "Safe Learning",
    description: "Virtual robots can't break. Encourage experimentation without the fear of failure.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
}

export function FeaturesSection() {
  return (
    <section className="border-t border-border bg-card py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Everything you need to teach robotics</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A complete platform for students, educators, and institutions.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group rounded-xl border border-border bg-background p-6 transition-colors hover:border-primary/30"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
