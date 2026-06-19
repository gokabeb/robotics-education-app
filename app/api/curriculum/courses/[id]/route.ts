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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()
    const supabase = getSupabaseClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      )
    }

    // Fetch course with full details
    const { data: course, error } = await supabase
      .from("courses")
      .select(`
        *,
        modules:modules(
          *,
          lessons:lessons(
            *,
            activities:activities(*)
          )
        )
      `)
      .eq("id", id)
      .order("order_index", { foreignTable: "modules", ascending: true })
      .single()

    if (error) {
      console.error("Error fetching course:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // Fetch user progress if authenticated
    let progressMap: Record<string, { status: string; score: number | null }> = {}

    if (userId) {
      const { data: progress } = await supabase
        .from("user_progress")
        .select("lesson_id, status, score")
        .eq("user_id", userId)
        .eq("course_id", id)

      if (progress) {
        for (const p of progress) {
          progressMap[p.lesson_id] = { status: p.status, score: p.score }
        }
      }
    }

    // Sort lessons within modules and add progress
    const modulesWithProgress = course.modules
      ?.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
      .map((module: { lessons: { id: string; order_index: number }[] }) => ({
        ...module,
        lessons: module.lessons
          ?.sort((a, b) => a.order_index - b.order_index)
          .map((lesson) => ({
            ...lesson,
            status: progressMap[lesson.id]?.status || "available",
            score: progressMap[lesson.id]?.score || null,
          })),
      }))

    // Calculate overall progress
    const totalLessons = modulesWithProgress?.reduce(
      (acc: number, mod: { lessons: unknown[] }) => acc + (mod.lessons?.length || 0),
      0
    ) || 0
    
    const completedLessons = Object.values(progressMap).filter(
      (p) => p.status === "completed"
    ).length

    return NextResponse.json({
      ...course,
      modules: modulesWithProgress,
      total_lessons: totalLessons,
      lessons_completed: completedLessons,
      progress_percentage: totalLessons > 0 
        ? Math.round((completedLessons / totalLessons) * 100) 
        : 0,
    })
  } catch (error) {
    console.error("Course detail API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch course" },
      { status: 500 }
    )
  }
}


