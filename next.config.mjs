/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Enable Turbopack for `next dev`.
  // Turbopack handles `new Worker(new URL(..., import.meta.url))` natively — no extra config needed.
  turbopack: {},

  // webpack() only runs for production builds (next build) because Turbopack is used in dev.
  // Setting globalObject='self' is required so the AVR Web Worker bundle (Task 5)
  // bootstraps correctly in a browser Worker context where `self` exists but `global` does not.
  // avr8js itself ships no workers — this is pre-emptive for workers/avr-worker.ts.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.output.globalObject = 'self'
    }

    return config
  },
}

export default nextConfig
