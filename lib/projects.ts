import { createClient } from "@/lib/supabase/client"
import { auth } from "@clerk/nextjs/server"
import type { Project, ProjectInsert, ProjectUpdate } from "@/lib/database.types"

// Create client lazily to avoid build-time issues
function getSupabaseClient() {
  return createClient()
}

// Get current user ID from Clerk
async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth()
  return userId
}

export async function getProjects(): Promise<Project[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error fetching projects:", error)
    return []
  }

  return data || []
}

export async function getProject(id: string): Promise<Project | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single()

  if (error) {
    console.error("Error fetching project:", error)
    return null
  }

  return data
}

export async function createProject(project: Omit<ProjectInsert, "user_id">): Promise<Project | null> {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.error("User not authenticated")
    return null
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("projects")
    .insert({
      ...project,
      user_id: userId,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating project:", error)
    return null
  }

  return data
}

export async function updateProject(id: string, updates: ProjectUpdate): Promise<Project | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("projects")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) {
    console.error("Error updating project:", error)
    return null
  }

  return data
}

export async function deleteProject(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (!userId) return false

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error) {
    console.error("Error deleting project:", error)
    return false
  }

  return true
}

export async function saveBlocklyWorkspace(projectId: string, xml: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (!userId) return false

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("projects")
    .update({
      blockly_xml: xml,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error saving Blockly workspace:", error)
    return false
  }

  return true
}

export async function saveGeneratedCode(projectId: string, code: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (!userId) return false

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("projects")
    .update({
      generated_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", userId)

  if (error) {
    console.error("Error saving generated code:", error)
    return false
  }

  return true
}
