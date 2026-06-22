// app/api/missions/[id]/attempts/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"
import { getMissionById } from "@/lib/missions/seed"
import { computeScore } from "@/lib/missions/scoring"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// POST /api/missions/[id]/attempts
// Body: { timeSeconds, hintsUsed, finalCircuit, finalCode, criteriaMet }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: missionId } = await params
    const mission = getMissionById(missionId)
    if (!mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { timeSeconds, hintsUsed, finalCircuit, finalCode, criteriaMet } = await request.json()

    if (typeof timeSeconds !== "number" || typeof hintsUsed !== "number") {
      return NextResponse.json({ error: "timeSeconds and hintsUsed are required numbers" }, { status: 400 })
    }

    const score = computeScore({
      hintsUsed,
      timeSeconds,
      estimatedMinutes: mission.estimatedMinutes,
    })

    const { error: insertError } = await supabase.from("mission_attempts").insert({
      user_id: userId,
      mission_id: missionId,
      status: "completed",
      time_seconds: timeSeconds,
      hints_used: hintsUsed,
      criteria_met: criteriaMet ?? [],
      final_circuit: finalCircuit ?? null,
      final_code: finalCode ?? null,
      score,
    })

    if (insertError) {
      console.error("Insert mission attempt error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      score,
      message: mission.narrative.successMessage,
    })
  } catch (error) {
    console.error("Mission attempt API error:", error)
    return NextResponse.json({ error: "Failed to submit attempt" }, { status: 500 })
  }
}
