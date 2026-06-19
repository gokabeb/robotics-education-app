/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Empty turbopack config tells Next.js 16 the webpack config below is intentional.
  // avr8js workers use `new Worker(new URL(...))` syntax which Turbopack handles natively.
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Required for avr8js WASM/worker compatibility in browsers
      config.output.globalObject = 'self'
    }

    return config
  },
}

export default nextConfig
