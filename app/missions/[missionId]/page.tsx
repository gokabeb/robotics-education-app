// app/missions/[missionId]/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { MissionSandbox } from "@/components/mission/mission-sandbox"
import type { MissionCompletionResult } from "@/components/mission/mission-sandbox"
import type { Mission } from "@/lib/missions/types"

export default function MissionPage() {
  const params = useParams<{ missionId: string }>()
  const router = useRouter()
  const [mission, setMission] = useState<Mission | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/missions/${params.missionId}`)
      .then(res => {
        if (!res.ok) throw new Error("not found")
        return res.json()
      })
      .then(data => setMission(data.mission))
      .catch(() => setNotFound(true))
  }, [params.missionId])

  const handleComplete = useCallback(async (result: MissionCompletionResult) => {
    const res = await fetch(`/api/missions/${params.missionId}/attempts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    })
    const data = await res.json()
    setResultMessage(data.message ?? "Mission complete!")
  }, [params.missionId])

  if (notFound) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Mission not found</p>
          <button onClick={() => router.push("/missions")} className="text-sm text-primary underline">
            Back to missions
          </button>
        </div>
      </div>
    )
  }

  if (!mission) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading mission…</div>
  }

  return (
    <div className="relative h-full">
      <MissionSandbox key={mission.id} mission={mission} onComplete={handleComplete} />
      {resultMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
          <div className="max-w-sm rounded-xl border border-border bg-card p-6 space-y-4 text-center">
            <p className="text-base font-semibold">{resultMessage}</p>
            <button
              onClick={() => router.push("/missions")}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold"
            >
              Back to missions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
