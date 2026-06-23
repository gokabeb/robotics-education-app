import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@/lib/supabase/client"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const supabase = createClient()
  const { data, error } = await supabase
    .from("workspace_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single()

  if (error) {
    console.error("Error fetching workspace project:", error)
    return NextResponse.json({ error: "Failed to fetch workspace project" }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const supabase = createClient()
  const { data, error } = await supabase
    .from("workspace_projects")
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) {
    console.error("Error updating workspace project:", error)
    return NextResponse.json({ error: "Failed to update workspace project" }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const supabase = createClient()
  const { error } = await supabase
    .from("workspace_projects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) {
    console.error("Error deleting workspace project:", error)
    return NextResponse.json({ error: "Failed to delete workspace project" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
