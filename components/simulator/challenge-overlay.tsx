"use client"

import { motion } from "framer-motion"
import { Trophy, RotateCcw, ArrowLeft, Clock, Zap, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface ChallengeResult {
  completed: boolean
  score: number
  message: string
  timeSeconds?: number
  collisionCount?: number
}

interface ChallengeOverlayProps {
  result: ChallengeResult
  challengeTitle: string
  onTryAgain: () => void
}

export function ChallengeOverlay({
  result,
  challengeTitle,
  onTryAgain,
}: ChallengeOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex items-center justify-center bg-background/85 backdrop-blur-sm rounded-xl z-10"
    >
      <div className="text-center max-w-sm w-full px-6">
        {result.completed ? (
          <Trophy className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        ) : (
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        )}

        <h2 className="text-2xl font-semibold mb-1">
          {result.completed ? "Challenge Complete!" : "Challenge Failed"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">{challengeTitle}</p>

        <div className="rounded-xl border border-border bg-card p-4 mb-6 space-y-3 text-sm">
          {result.completed && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-4 w-4 text-amber-500" />
                Score
              </span>
              <span className="font-semibold text-amber-500">{result.score} pts</span>
            </div>
          )}
          {result.timeSeconds !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Time
              </span>
              <span className="font-medium">{result.timeSeconds.toFixed(1)}s</span>
            </div>
          )}
          {result.collisionCount !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Collisions</span>
              <span
                className={`font-medium ${result.collisionCount === 0 ? "text-green-500" : "text-destructive"}`}
              >
                {result.collisionCount}
              </span>
            </div>
          )}
          {!result.completed && (
            <p className="text-xs text-muted-foreground border-t border-border pt-2">
              {result.message}
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onTryAgain} className="border-border">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild>
            <Link href="/challenges">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Challenges
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
