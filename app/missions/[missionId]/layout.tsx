// app/missions/[missionId]/layout.tsx
// Full-height, no app chrome — the mission sandbox owns the entire viewport.
export default function MissionLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden">{children}</div>
}
