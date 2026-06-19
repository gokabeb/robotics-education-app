import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// GET /api/challenges/leaderboard?challengeId=<id>&limit=10
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const challengeId = searchParams.get("challengeId")
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50)

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    let query = supabase
      .from("challenge_leaderboard")
      .select("challenge_id, user_id, score, time_seconds, created_at")
      .order("score", { ascending: false })
      .order("time_seconds", { ascending: true })
      .limit(limit)

    if (challengeId) {
      query = query.eq("challenge_id", challengeId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Leaderboard query error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Rank entries and format (no Clerk lookup to keep it simple)
    const entries = (data ?? []).map(
      (
        row: {
          challenge_id: string
          user_id: string
          score: number
          time_seconds: number
          created_at: string
        },
        index: number
      ) => ({
        rank: index + 1,
        userId: row.user_id,
        // Use truncated user ID as display name (Clerk lookup would need server SDK)
        username: `User-${row.user_id.slice(-6)}`,
        score: row.score,
        timeSeconds: row.time_seconds,
        completedAt: row.created_at,
        challengeId: row.challenge_id,
      })
    )

    return NextResponse.json(entries)
  } catch (error) {
    console.error("Leaderboard API error:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
