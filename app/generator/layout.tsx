// Force dynamic rendering for generator routes
export const dynamic = "force-dynamic"

export default function GeneratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

