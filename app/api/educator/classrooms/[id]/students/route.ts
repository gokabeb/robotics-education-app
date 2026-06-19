import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// Get students in a classroom with their progress
export async function GET(
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
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    // Verify teacher owns this classroom
    const { data: classroom } = await supabase
      .from("classrooms")
      .select("id")
      .eq("id", id)
      .eq("teacher_id", userId)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: "Classroom not found" }, { status: 404 })
    }

    // Get enrollments
    const { data: enrollments, error } = await supabase
      .from("classroom_enrollments")
      .select("*")
      .eq("classroom_id", id)
      .eq("status", "active")

    if (error) {
      console.error("Error fetching students:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get progress for each student
    const studentIds = enrollments?.map((e) => e.student_id) || []
    
    const { data: progressData } = await supabase
      .from("user_progress")
      .select("user_id, status")
      .in("user_id", studentIds)

    const { data: statsData } = await supabase
      .from("user_stats")
      .select("*")
      .in("user_id", studentIds)

    // Build student list with progress
    const students = enrollments?.map((enrollment) => {
      const userProgress = progressData?.filter((p) => p.user_id === enrollment.student_id) || []
      const userStats = statsData?.find((s) => s.user_id === enrollment.student_id)
      
      return {
        ...enrollment,
        lessons_completed: userProgress.filter((p) => p.status === "completed").length,
        total_points: userStats?.total_points || 0,
        current_streak: userStats?.current_streak || 0,
        last_activity: userStats?.last_activity_at || null,
      }
    })

    return NextResponse.json(students)
  } catch (error) {
    console.error("Students API error:", error)
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
  }
}

// Remove a student from classroom
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    // Verify teacher owns this classroom
    const { data: classroom } = await supabase
      .from("classrooms")
      .select("id")
      .eq("id", id)
      .eq("teacher_id", userId)
      .single()

    if (!classroom) {
      return NextResponse.json({ error: "Classroom not found" }, { status: 404 })
    }

    // Update enrollment status to removed
    const { error } = await supabase
      .from("classroom_enrollments")
      .update({ status: "removed" })
      .eq("classroom_id", id)
      .eq("student_id", studentId)

    if (error) {
      console.error("Error removing student:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Remove student API error:", error)
    return NextResponse.json({ error: "Failed to remove student" }, { status: 500 })
  }
}


