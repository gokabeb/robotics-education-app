import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    if (!supabase) {
      // Return free plan if database not configured
      return NextResponse.json({
        planId: "free",
        status: "active",
        currentPeriodEnd: null,
      })
    }

    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (!subscription) {
      return NextResponse.json({
        planId: "free",
        status: "active",
        currentPeriodEnd: null,
      })
    }

    return NextResponse.json({
      planId: subscription.plan_id,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
    })
  } catch (error) {
    console.error("Subscription API error:", error)
    return NextResponse.json({
      planId: "free",
      status: "active",
      currentPeriodEnd: null,
    })
  }
}


