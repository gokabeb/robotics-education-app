"use client"

import { motion } from "framer-motion"

const stats = [
  { value: "50K+", label: "Students Learning" },
  { value: "2,500+", label: "Schools Worldwide" },
  { value: "100K+", label: "Projects Created" },
  { value: "98%", label: "Teacher Satisfaction" },
]

export function StatsSection() {
  return (
    <section className="border-t border-b border-border bg-card py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center"
            >
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 + 0.2 }}
                className="text-4xl font-semibold text-primary md:text-5xl"
              >
                {stat.value}
              </motion.div>
              <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
