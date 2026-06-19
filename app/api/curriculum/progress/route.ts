import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}

// Get user's overall progress and stats
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      )
    }

    // Get user stats
    const { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single()

    // Get user achievements
    const { data: achievements } = await supabase
      .from("user_achievements")
      .select(`
        *,
        achievement:achievements(*)
      `)
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })

    // Get recent progress
    const { data: recentProgress } = await supabase
      .from("user_progress")
      .select(`
        *,
        lesson:lessons(id, title),
        course:courses(id, title)
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(10)

    // Get course progress summary
    const { data: courseProgress } = await supabase
      .from("user_progress")
      .select("course_id, status")
      .eq("user_id", userId)

    const courseSummary: Record<string, { total: number; completed: number }> = {}
    if (courseProgress) {
      for (const p of courseProgress) {
        if (!courseSummary[p.course_id]) {
          courseSummary[p.course_id] = { total: 0, completed: 0 }
        }
        courseSummary[p.course_id].total++
        if (p.status === "completed") {
          courseSummary[p.course_id].completed++
        }
      }
    }

    return NextResponse.json({
      stats: stats || {
        total_points: 0,
        current_streak: 0,
        longest_streak: 0,
        lessons_completed: 0,
        challenges_completed: 0,
      },
      achievements: achievements?.map((a) => a.achievement) || [],
      recent_progress: recentProgress || [],
      course_progress: courseSummary,
    })
  } catch (error) {
    console.error("Progress API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    )
  }
}

// Update user stats (add points, update streak, etc.)
export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { points, type } = body

    // Get current stats
    let { data: stats } = await supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single()

    // Create stats if not exists
    if (!stats) {
      const { data: newStats } = await supabase
        .from("user_stats")
        .insert({ user_id: userId })
        .select()
        .single()
      stats = newStats
    }

    if (!stats) {
      return NextResponse.json({ error: "Failed to get stats" }, { status: 500 })
    }

    // Calculate streak
    const lastActivity = stats.last_activity_at ? new Date(stats.last_activity_at) : null
    const now = new Date()
    const daysSinceLastActivity = lastActivity 
      ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      : null

    let newStreak = stats.current_streak
    if (daysSinceLastActivity === null || daysSinceLastActivity > 1) {
      newStreak = 1 // Reset streak
    } else if (daysSinceLastActivity === 1) {
      newStreak = stats.current_streak + 1 // Increment streak
    }
    // If same day, keep streak as is

    // Update stats
    const updates: Record<string, unknown> = {
      total_points: stats.total_points + (points || 0),
      current_streak: newStreak,
      longest_streak: Math.max(stats.longest_streak, newStreak),
      last_activity_at: now.toISOString(),
    }

    if (type === "lesson") {
      updates.lessons_completed = stats.lessons_completed + 1
    } else if (type === "challenge") {
      updates.challenges_completed = stats.challenges_completed + 1
    }

    const { data: updatedStats, error } = await supabase
      .from("user_stats")
      .update(updates)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error updating stats:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check for new achievements
    const newAchievements = await checkAchievements(supabase, userId, updatedStats)

    return NextResponse.json({
      stats: updatedStats,
      new_achievements: newAchievements,
    })
  } catch (error) {
    console.error("Update stats API error:", error)
    return NextResponse.json(
      { error: "Failed to update stats" },
      { status: 500 }
    )
  }
}

// Check and award achievements
async function checkAchievements(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  stats: {
    lessons_completed: number
    challenges_completed: number
    current_streak: number
  }
) {
  const { data: allAchievements } = await supabase
    .from("achievements")
    .select("*")

  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId)

  const earnedIds = new Set(userAchievements?.map((a) => a.achievement_id) || [])
  const newlyEarned: unknown[] = []

  for (const achievement of allAchievements || []) {
    if (earnedIds.has(achievement.id)) continue

    const criteria = achievement.criteria_json as { type: string; count?: number; days?: number }
    let earned = false

    switch (criteria.type) {
      case "lessons_completed":
        earned = stats.lessons_completed >= (criteria.count || 1)
        break
      case "challenges_completed":
        earned = stats.challenges_completed >= (criteria.count || 1)
        break
      case "streak":
        earned = stats.current_streak >= (criteria.days || 7)
        break
    }

    if (earned) {
      await supabase.from("user_achievements").insert({
        user_id: userId,
        achievement_id: achievement.id,
      })
      newlyEarned.push(achievement)
    }
  }

  return newlyEarned
}


