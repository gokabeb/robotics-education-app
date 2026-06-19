"use client"

import { createBrowserClient, SupabaseClient } from "@supabase/ssr"

let supabaseInstance: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  // Return cached instance if available
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check if we're in a browser environment and have the env vars
  if (typeof window !== "undefined" && supabaseUrl && supabaseKey) {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseKey)
    return supabaseInstance
  }

  // For SSR/build time without env vars, return a mock-like client
  // This allows the build to complete but will throw on actual API calls
  if (supabaseUrl && supabaseKey) {
    return createBrowserClient(supabaseUrl, supabaseKey)
  }

  // Return a dummy client for build time that won't crash on import
  // but will fail gracefully on use
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth: async () => ({ data: { url: null, provider: "" }, error: { message: "Supabase not configured" } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ data: null, error: { message: "Supabase not configured" } }),
      insert: () => ({ select: () => ({ single: () => ({ data: null, error: { message: "Supabase not configured" } }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: null, error: { message: "Supabase not configured" } }) }) }) }),
      delete: () => ({ eq: () => ({ data: null, error: { message: "Supabase not configured" } }) }),
    }),
  } as unknown as SupabaseClient
}
