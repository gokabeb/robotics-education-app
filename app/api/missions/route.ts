// app/api/missions/route.ts
import { NextResponse } from "next/server"
import { getAllMissions } from "@/lib/missions/seed"

// GET /api/missions — list all system missions (summary fields only)
export async function GET() {
  const missions = getAllMissions().map(m => ({
    id: m.id,
    title: m.title,
    subtitle: m.subtitle,
    difficulty: m.difficulty,
    ageRange: m.ageRange,
    estimatedMinutes: m.estimatedMinutes,
    tags: m.tags,
  }))
  return NextResponse.json({ missions })
}
