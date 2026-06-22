// app/api/missions/[id]/route.ts
import { NextResponse } from "next/server"
import { getMissionById } from "@/lib/missions/seed"

// GET /api/missions/[id] — full mission config (everything MissionSandbox needs)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mission = getMissionById(id)
  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 })
  }
  return NextResponse.json({ mission })
}
