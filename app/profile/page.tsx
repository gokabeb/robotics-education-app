"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Navigation } from "@/components/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  User,
  Trophy,
  Flame,
  Target,
  BookOpen,
  Zap,
  Calendar,
  Star,
  Award,
} from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

interface UserStats {
  total_points: number
  current_streak: number
  longest_streak: number
  lessons_completed: number
  challenges_completed: number
  last_activity_at: string
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  points: number
}

interface RecentProgress {
  id: string
  status: string
  updated_at: string
  lesson: { id: string; title: string }
  course: { id: string; title: string }
}

interface ProfileData {
  stats: UserStats
  achievements: Achievement[]
  recent_progress: RecentProgress[]
  course_progress: Record<string, { total: number; completed: number }>
}

export default function ProfilePage() {
  const { isSignedIn, isLoaded, user } = useUser()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      redirect("/sign-in")
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    async function fetchProgress() {
      if (!isSignedIn) return

      try {
        const response = await fetch("/api/curriculum/progress")
        if (response.ok) {
          const progressData = await response.json()
          setData(progressData)
        }
      } catch (error) {
        console.error("Failed to fetch progress:", error)
      } finally {
        setLoading(false)
      }
    }

    if (isSignedIn) {
      fetchProgress()
    }
  }, [isSignedIn])

  if (!isLoaded || !isSignedIn) {
    return null
  }

  const stats = data?.stats || {
    total_points: 0,
    current_streak: 0,
    longest_streak: 0,
    lessons_completed: 0,
    challenges_completed: 0,
  }

  const StatCard = ({
    icon: Icon,
    label,
    value,
    color,
    delay,
  }: {
    icon: React.ElementType
    label: string
    value: number | string
    color: string
    delay: number
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-card pt-20"
      >
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="relative">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User"}
                  className="h-20 w-20 rounded-full border-4 border-primary/20"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-4 border-primary/20">
                  <User className="h-10 w-10 text-primary" />
                </div>
              )}
              {stats.current_streak > 0 && (
                <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white text-sm font-bold">
                  🔥
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">
                {user?.fullName || user?.username || "Student"}
              </h1>
              <p className="text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-primary">
                  <Star className="h-4 w-4" />
                  {stats.total_points} points
                </span>
                <span className="flex items-center gap-1 text-orange-500">
                  <Flame className="h-4 w-4" />
                  {stats.current_streak} day streak
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Star}
            label="Total Points"
            value={stats.total_points}
            color="#eab308"
            delay={0.1}
          />
          <StatCard
            icon={Flame}
            label="Current Streak"
            value={`${stats.current_streak} days`}
            color="#f97316"
            delay={0.15}
          />
          <StatCard
            icon={BookOpen}
            label="Lessons Completed"
            value={stats.lessons_completed}
            color="#22c55e"
            delay={0.2}
          />
          <StatCard
            icon={Target}
            label="Challenges Won"
            value={stats.challenges_completed}
            color="#3b82f6"
            delay={0.25}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Achievements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Trophy className="h-5 w-5 text-amber-500" />
                Achievements
              </h2>
              <span className="text-sm text-muted-foreground">
                {data?.achievements?.length || 0} earned
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : data?.achievements && data.achievements.length > 0 ? (
              <div className="space-y-3">
                {data.achievements.slice(0, 5).map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-xl">
                      {achievement.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {achievement.description}
                      </p>
                    </div>
                    <span className="text-xs text-amber-500 font-medium">
                      +{achievement.points}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No achievements yet</p>
                <p className="text-xs mt-1">Complete lessons to earn badges!</p>
              </div>
            )}
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Calendar className="h-5 w-5 text-blue-500" />
                Recent Activity
              </h2>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.recent_progress && data.recent_progress.length > 0 ? (
              <div className="space-y-3">
                {data.recent_progress.slice(0, 5).map((progress) => (
                  <Link
                    key={progress.id}
                    href={`/learn/${progress.course.id}/lesson/${progress.lesson.id}`}
                    className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        progress.status === "completed"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}
                    >
                      {progress.status === "completed" ? (
                        <Zap className="h-4 w-4" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {progress.lesson.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {progress.course.title}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {progress.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No activity yet</p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/learn">Start Learning</Link>
                </Button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Course Progress */}
        {data?.course_progress && Object.keys(data.course_progress).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 rounded-xl border border-border bg-card p-6"
          >
            <h2 className="flex items-center gap-2 font-semibold mb-4">
              <Target className="h-5 w-5 text-green-500" />
              Course Progress
            </h2>
            <div className="space-y-4">
              {Object.entries(data.course_progress).map(([courseId, progress]) => {
                const percentage = Math.round(
                  (progress.completed / progress.total) * 100
                )
                return (
                  <div key={courseId}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Course {courseId.slice(0, 8)}...</span>
                      <span className="text-muted-foreground">
                        {progress.completed} / {progress.total} lessons
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}


