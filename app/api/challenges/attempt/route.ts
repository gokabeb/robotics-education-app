import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"
import { SAMPLE_CHALLENGES, DIFFICULTY_POINTS } from "@/lib/challenges/types"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// POST /api/challenges/attempt
// Body: { challengeId, codeUsed, goalReached, collisionCount, timeSeconds }
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { challengeId, codeUsed, goalReached, collisionCount, timeSeconds } =
      await request.json()

    if (!challengeId) {
      return NextResponse.json({ error: "challengeId is required" }, { status: 400 })
    }

    // Find challenge definition
    const challenge = SAMPLE_CHALLENGES.find(
      (c) => c.title.toLowerCase().replace(/\s+/g, "-") === challengeId
    )

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 })
    }

    // Evaluate success criteria
    const criteria = challenge.success_criteria
    let completed = false
    let failReason: string | null = null

    if (criteria.type === "reach_goal") {
      if (!goalReached) {
        failReason = "Goal was not reached"
      } else if (criteria.params?.no_collisions && collisionCount > 0) {
        failReason = `Completed with ${collisionCount} collision(s); challenge requires zero collisions`
      } else {
        completed = true
      }
    } else if (criteria.type === "time_trial") {
      const targetTime = (criteria.params?.target_time as number) ?? challenge.time_limit_seconds ?? 60
      if (!goalReached) {
        failReason = "Goal was not reached"
      } else if (timeSeconds > targetTime) {
        failReason = `Time ${timeSeconds}s exceeded target ${targetTime}s`
      } else {
        completed = true
      }
    } else {
      // no_collisions standalone
      if (collisionCount === 0 && goalReached) {
        completed = true
      } else {
        failReason = "Criteria not met"
      }
    }

    // Compute score
    const difficultyMultiplier = DIFFICULTY_POINTS[challenge.difficulty] ?? 1
    const score = completed ? challenge.points * difficultyMultiplier : 0

    // Insert attempt
    const { error: insertError } = await supabase.from("challenge_attempts").insert({
      user_id: userId,
      challenge_id: challengeId,
      code_used: codeUsed ?? null,
      completed,
      score,
      time_seconds: timeSeconds ?? null,
      goal_reached: goalReached ?? false,
      collision_count: collisionCount ?? 0,
    })

    if (insertError) {
      console.error("Insert attempt error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const message = completed
      ? `Challenge complete! You earned ${score} points.`
      : failReason ?? "Challenge not completed"

    return NextResponse.json({ completed, score, message })
  } catch (error) {
    console.error("Challenge attempt API error:", error)
    return NextResponse.json({ error: "Failed to submit attempt" }, { status: 500 })
  }
}
