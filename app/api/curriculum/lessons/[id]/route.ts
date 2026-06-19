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

    // Fetch lesson with content and activities
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select(`
        *,
        module:modules(id, title, course_id),
        content:lesson_content(*),
        activities:activities(*)
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching lesson:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Check premium access
    if (lesson.is_premium && !userId) {
      return NextResponse.json(
        { error: "Premium content requires authentication" },
        { status: 401 }
      )
    }

    // Fetch user progress
    let progress = null
    if (userId) {
      const { data } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("lesson_id", id)
        .single()
      
      progress = data

      // If no progress exists, create one with "in_progress" status
      if (!progress) {
        const { data: newProgress } = await supabase
          .from("user_progress")
          .insert({
            user_id: userId,
            course_id: lesson.course_id,
            lesson_id: id,
            status: "in_progress",
          })
          .select()
          .single()
        
        progress = newProgress
      }
    }

    // Get next and previous lessons
    const { data: siblingLessons } = await supabase
      .from("lessons")
      .select("id, title, order_index")
      .eq("module_id", lesson.module_id)
      .order("order_index", { ascending: true })

    const currentIndex = siblingLessons?.findIndex((l) => l.id === id) ?? -1
    const prevLesson = currentIndex > 0 ? siblingLessons?.[currentIndex - 1] : null
    const nextLesson = currentIndex < (siblingLessons?.length ?? 0) - 1 
      ? siblingLessons?.[currentIndex + 1] 
      : null

    return NextResponse.json({
      ...lesson,
      progress,
      prev_lesson: prevLesson,
      next_lesson: nextLesson,
      content: lesson.content?.sort(
        (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index
      ),
      activities: lesson.activities?.sort(
        (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index
      ),
    })
  } catch (error) {
    console.error("Lesson API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch lesson" },
      { status: 500 }
    )
  }
}

// Complete a lesson
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const { score } = body

    // Get lesson info
    const { data: lesson } = await supabase
      .from("lessons")
      .select("course_id")
      .eq("id", id)
      .single()

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Update or create progress
    const { data: progress, error } = await supabase
      .from("user_progress")
      .upsert({
        user_id: userId,
        course_id: lesson.course_id,
        lesson_id: id,
        status: "completed",
        score: score ?? null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Error updating progress:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update user stats
    await supabase.rpc("increment_lessons_completed", { user_id_param: userId })

    return NextResponse.json(progress)
  } catch (error) {
    console.error("Complete lesson API error:", error)
    return NextResponse.json(
      { error: "Failed to complete lesson" },
      { status: 500 }
    )
  }
}


