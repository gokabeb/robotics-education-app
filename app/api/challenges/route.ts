import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"
import { SAMPLE_CHALLENGES } from "@/lib/challenges/types"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// GET /api/challenges — list challenges with user completion status
export async function GET() {
  try {
    const { userId } = await auth()
    const supabase = getSupabase()

    if (!supabase || !userId) {
      // Return static list without completion data
      return NextResponse.json(
        SAMPLE_CHALLENGES.map((c, i) => ({ ...c, id: `challenge-${i}`, completed: false }))
      )
    }

    // Fetch completed challenge IDs for this user
    const { data: attempts } = await supabase
      .from("challenge_attempts")
      .select("challenge_id")
      .eq("user_id", userId)
      .eq("completed", true)

    const completedIds = new Set((attempts ?? []).map((a: { challenge_id: string }) => a.challenge_id))

    const challenges = SAMPLE_CHALLENGES.map((c, i) => {
      const id = c.title.toLowerCase().replace(/\s+/g, "-")
      return { ...c, id, created_at: new Date().toISOString(), completed: completedIds.has(id) }
    })

    return NextResponse.json(challenges)
  } catch (error) {
    console.error("Challenges API error:", error)
    return NextResponse.json({ error: "Failed to fetch challenges" }, { status: 500 })
  }
}
