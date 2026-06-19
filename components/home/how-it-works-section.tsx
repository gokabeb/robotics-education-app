"use client"

import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

const steps = [
  {
    number: "01",
    title: "Design Your Robot",
    description: "Use our intuitive drag-and-drop builder to assemble your virtual robot from a library of components.",
  },
  {
    number: "02",
    title: "Write Your Code",
    description: "Program using visual blocks or Python. Our AI assistant helps you write better code faster.",
  },
  {
    number: "03",
    title: "Test in Simulation",
    description: "Run your robot through physics-based challenges. Debug and iterate without any risk.",
  },
  {
    number: "04",
    title: "Deploy to Hardware",
    description: "Flash your code to real microcontrollers with a single click via Web Serial API.",
  },
]

export function HowItWorksSection() {
  return (
    <section className="py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">From idea to reality in minutes</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A seamless workflow that bridges virtual learning with physical creation.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <div className="flex items-start gap-4">
                <motion.span whileHover={{ scale: 1.1 }} className="text-5xl font-bold text-border">
                  {step.number}
                </motion.span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              {index < steps.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 + 0.3 }}
                  className="absolute -right-4 top-4 hidden lg:block"
                >
                  <ArrowRight className="h-6 w-6 text-border" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
