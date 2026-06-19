import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

// Create Supabase client for API routes
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    return null
  }
  
  return createClient(url, key)
}

export async function GET() {
  try {
    const { userId } = await auth()
    const supabase = getSupabaseClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      )
    }

    // Fetch all courses with module and lesson counts
    const { data: courses, error } = await supabase
      .from("courses")
      .select(`
        *,
        modules:modules(
          id,
          title,
          lessons:lessons(id)
        )
      `)
      .order("order_index", { ascending: true })

    if (error) {
      console.error("Error fetching courses:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If user is authenticated, fetch their progress
    let progressMap: Record<string, { completed: number; total: number }> = {}

    if (userId) {
      const { data: progress } = await supabase
        .from("user_progress")
        .select("course_id, status")
        .eq("user_id", userId)

      if (progress) {
        for (const p of progress) {
          if (!progressMap[p.course_id]) {
            progressMap[p.course_id] = { completed: 0, total: 0 }
          }
          progressMap[p.course_id].total++
          if (p.status === "completed") {
            progressMap[p.course_id].completed++
          }
        }
      }
    }

    // Transform courses with progress info
    const coursesWithProgress = courses?.map((course) => {
      const totalLessons = course.modules?.reduce(
        (acc: number, mod: { lessons: { id: string }[] }) => acc + (mod.lessons?.length || 0),
        0
      ) || 0
      
      const progress = progressMap[course.id] || { completed: 0, total: 0 }
      
      return {
        ...course,
        total_lessons: totalLessons,
        lessons_completed: progress.completed,
        progress_percentage: totalLessons > 0 
          ? Math.round((progress.completed / totalLessons) * 100) 
          : 0,
        modules: undefined, // Don't send full module data in list view
      }
    })

    return NextResponse.json(coursesWithProgress)
  } catch (error) {
    console.error("Courses API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    )
  }
}


