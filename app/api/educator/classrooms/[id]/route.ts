import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// Get classroom details
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

    // Get classroom with students
    const { data: classroom, error } = await supabase
      .from("classrooms")
      .select(`
        *,
        enrollments:classroom_enrollments(
          id,
          student_id,
          role,
          status,
          joined_at
        ),
        assignments:assignments(*)
      `)
      .eq("id", id)
      .eq("teacher_id", userId)
      .single()

    if (error) {
      console.error("Error fetching classroom:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!classroom) {
      return NextResponse.json({ error: "Classroom not found" }, { status: 404 })
    }

    return NextResponse.json(classroom)
  } catch (error) {
    console.error("Classroom detail API error:", error)
    return NextResponse.json({ error: "Failed to fetch classroom" }, { status: 500 })
  }
}

// Update classroom
export async function PUT(
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

    const body = await request.json()
    const { name, description, grade_level, is_active } = body

    const { data: classroom, error } = await supabase
      .from("classrooms")
      .update({ name, description, grade_level, is_active })
      .eq("id", id)
      .eq("teacher_id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error updating classroom:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(classroom)
  } catch (error) {
    console.error("Update classroom API error:", error)
    return NextResponse.json({ error: "Failed to update classroom" }, { status: 500 })
  }
}

// Delete classroom
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

    const supabase = getSupabaseClient()
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { error } = await supabase
      .from("classrooms")
      .delete()
      .eq("id", id)
      .eq("teacher_id", userId)

    if (error) {
      console.error("Error deleting classroom:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete classroom API error:", error)
    return NextResponse.json({ error: "Failed to delete classroom" }, { status: 500 })
  }
}


