import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// Get all classrooms for the current teacher
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data: classrooms, error } = await supabase
      .from("classrooms")
      .select(`
        *,
        enrollments:classroom_enrollments(count),
        assignments:assignments(count)
      `)
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching classrooms:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to include counts
    const classroomsWithCounts = classrooms?.map((c) => ({
      ...c,
      student_count: c.enrollments?.[0]?.count || 0,
      assignment_count: c.assignments?.[0]?.count || 0,
      enrollments: undefined,
      assignments: undefined,
    }))

    return NextResponse.json(classroomsWithCounts)
  } catch (error) {
    console.error("Classrooms API error:", error)
    return NextResponse.json({ error: "Failed to fetch classrooms" }, { status: 500 })
  }
}

// Create a new classroom
export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const body = await request.json()
    const { name, description, grade_level } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const { data: classroom, error } = await supabase
      .from("classrooms")
      .insert({
        teacher_id: userId,
        name,
        description,
        grade_level,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating classroom:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(classroom, { status: 201 })
  } catch (error) {
    console.error("Create classroom API error:", error)
    return NextResponse.json({ error: "Failed to create classroom" }, { status: 500 })
  }
}


