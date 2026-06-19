// Force dynamic rendering for flasher routes
export const dynamic = "force-dynamic"

export default function FlasherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

