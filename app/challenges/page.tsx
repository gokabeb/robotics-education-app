"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Trophy,
  Clock,
  Star,
  Play,
  Lock,
  Medal,
  Users,
  Target,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  SAMPLE_CHALLENGES,
  DIFFICULTY_COLORS,
  CHALLENGE_TYPE_ICONS,
} from "@/lib/challenges/types"

interface LeaderboardEntry {
  rank: number
  username: string
  score: number
  timeSeconds: number
  completedAt: string
  challengeId: string
}

export default function ChallengesPage() {
  const [activeTab, setActiveTab] = useState("challenges")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  const filteredChallenges = SAMPLE_CHALLENGES.filter(
    (c) => difficultyFilter === "all" || c.difficulty === difficultyFilter
  )

  useEffect(() => {
    if (activeTab !== "leaderboard") return
    setLeaderboardLoading(true)
    fetch("/api/challenges/leaderboard?limit=10")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLeaderboard(data)
      })
      .catch(() => {})
      .finally(() => setLeaderboardLoading(false))
  }, [activeTab])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-card pt-20"
      >
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold">Challenges</h1>
              <p className="text-muted-foreground">
                Test your skills and compete on the leaderboard
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="challenges" className="gap-2">
              <Target className="h-4 w-4" />
              Challenges
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2">
              <Medal className="h-4 w-4" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* Challenges Tab */}
          <TabsContent value="challenges">
            {/* Difficulty Filter */}
            <div className="flex gap-2 mb-6">
              {["all", "easy", "medium", "hard", "expert"].map((diff) => (
                <Button
                  key={diff}
                  variant={difficultyFilter === diff ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDifficultyFilter(diff)}
                  className={cn(
                    difficultyFilter !== diff && "border-border",
                    difficultyFilter === diff && "bg-primary"
                  )}
                >
                  {diff === "all" ? "All" : diff.charAt(0).toUpperCase() + diff.slice(1)}
                </Button>
              ))}
            </div>

            {/* Challenge Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {filteredChallenges.map((challenge, index) => (
                <motion.div
                  key={challenge.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
                >
                  {/* Premium badge */}
                  {challenge.is_premium && (
                    <div className="absolute -top-2 -right-2">
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                        <Star className="mr-1 h-3 w-3" />
                        Premium
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-2xl">
                      {CHALLENGE_TYPE_ICONS[challenge.type]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{challenge.title}</h3>
                        <Badge
                          variant="outline"
                          className={cn("text-xs capitalize", DIFFICULTY_COLORS[challenge.difficulty])}
                        >
                          {challenge.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {challenge.description}
                      </p>

                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        {challenge.time_limit_seconds && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {challenge.time_limit_seconds}s limit
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-amber-500">
                          <Star className="h-3.5 w-3.5" />
                          {challenge.points} pts
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>156 completions</span>
                    </div>
                    {challenge.is_premium ? (
                      <Button variant="outline" size="sm" disabled>
                        <Lock className="mr-2 h-3.5 w-3.5" />
                        Premium
                      </Button>
                    ) : (
                      <Button size="sm" asChild>
                        <Link href={`/simulator?challenge=${challenge.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <Play className="mr-2 h-3.5 w-3.5" />
                          Start
                        </Link>
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard">
            {leaderboardLoading ? (
              <div className="py-16 text-center text-muted-foreground">Loading leaderboard...</div>
            ) : leaderboard.length === 0 ? (
              <div className="rounded-xl border border-border py-16 text-center text-muted-foreground">
                <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No entries yet</p>
                <p className="text-sm mt-1">Complete a challenge to appear on the leaderboard!</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {/* Top 3 Podium */}
                {leaderboard.length >= 3 && (
                  <div className="bg-gradient-to-b from-amber-500/10 to-transparent p-8">
                    <div className="flex items-end justify-center gap-4">
                      {/* 2nd Place */}
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
                        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-slate-400 text-white font-bold text-xl mb-2">2</div>
                        <p className="font-medium">{leaderboard[1].username}</p>
                        <p className="text-sm text-muted-foreground">{leaderboard[1].score} pts</p>
                      </motion.div>
                      {/* 1st Place */}
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center -mt-4">
                        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold text-2xl mb-2 shadow-lg">👑</div>
                        <p className="font-semibold text-lg">{leaderboard[0].username}</p>
                        <p className="text-sm text-amber-500 font-medium">{leaderboard[0].score} pts</p>
                      </motion.div>
                      {/* 3rd Place */}
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center">
                        <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-amber-700 text-white font-bold text-xl mb-2">3</div>
                        <p className="font-medium">{leaderboard[2].username}</p>
                        <p className="text-sm text-muted-foreground">{leaderboard[2].score} pts</p>
                      </motion.div>
                    </div>
                  </div>
                )}

                {/* Rest of Leaderboard */}
                <div className="divide-y divide-border">
                  {leaderboard.slice(leaderboard.length >= 3 ? 3 : 0).map((entry, index) => (
                    <motion.div
                      key={`${entry.challengeId}-${entry.rank}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                        {entry.rank}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{entry.username}</p>
                        <p className="text-xs text-muted-foreground">{entry.challengeId}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-amber-500 font-medium">
                          <Star className="h-4 w-4" />
                          {entry.score} pts
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


