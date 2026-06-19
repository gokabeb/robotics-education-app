"use client"

import { useState, useEffect, use } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BookOpen,
  Clock,
  Target,
  ChevronRight,
  CheckCircle2,
  Circle,
  Lock,
  Play,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Lesson {
  id: string
  title: string
  description: string
  duration_minutes: number
  content_type: string
  status: "locked" | "available" | "in_progress" | "completed"
  score: number | null
}

interface Module {
  id: string
  title: string
  description: string
  lessons: Lesson[]
}

interface Course {
  id: string
  title: string
  description: string
  difficulty: string
  estimated_hours: number
  grade_range: string
  standards: string[]
  is_premium: boolean
  modules: Module[]
  total_lessons: number
  lessons_completed: number
  progress_percentage: number
}

export default function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = use(params)
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCourse() {
      try {
        const response = await fetch(`/api/curriculum/courses/${courseId}`)
        if (response.ok) {
          const data = await response.json()
          setCourse(data)
        }
      } catch (error) {
        console.error("Failed to fetch course:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCourse()
  }, [courseId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 px-6">
          <div className="max-w-4xl mx-auto py-8">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-6 w-96 mb-8" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 px-6">
          <div className="max-w-4xl mx-auto py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold">Course not found</h2>
            <p className="text-muted-foreground mt-2">
              The course you're looking for doesn't exist.
            </p>
            <Button asChild className="mt-4">
              <Link href="/learn">Back to Courses</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Find the first available lesson to continue
  const nextLesson = course.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.status === "available" || l.status === "in_progress")

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-b border-border bg-card pt-20"
      >
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="capitalize">
                  {course.difficulty}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Grades {course.grade_range}
                </span>
              </div>
              <h1 className="text-3xl font-semibold">{course.title}</h1>
              <p className="mt-2 text-muted-foreground max-w-2xl">
                {course.description}
              </p>

              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{course.estimated_hours} hours</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  <span>{course.total_lessons} lessons</span>
                </div>
              </div>
            </div>

            {nextLesson && (
              <Button size="lg" className="shrink-0" asChild>
                <Link href={`/learn/${courseId}/lesson/${nextLesson.id}`}>
                  <Play className="mr-2 h-4 w-4" />
                  {course.lessons_completed > 0 ? "Continue" : "Start Learning"}
                </Link>
              </Button>
            )}
          </div>

          {/* Progress */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your Progress</span>
              <span className="font-medium">
                {course.lessons_completed} of {course.total_lessons} lessons ({course.progress_percentage}%)
              </span>
            </div>
            <Progress value={course.progress_percentage} className="h-2" />
          </div>
        </div>
      </motion.div>

      {/* Modules */}
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h2 className="text-xl font-semibold mb-6">Course Content</h2>

        <div className="space-y-6">
          {course.modules?.map((module, moduleIndex) => (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: moduleIndex * 0.1 }}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Module header */}
              <div className="flex items-center gap-4 p-4 border-b border-border bg-secondary/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
                  {moduleIndex + 1}
                </div>
                <div>
                  <h3 className="font-medium">{module.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {module.lessons?.length || 0} lessons
                  </p>
                </div>
              </div>

              {/* Lessons */}
              <div className="divide-y divide-border">
                {module.lessons?.map((lesson) => {
                  const isLocked = lesson.status === "locked"
                  const isCompleted = lesson.status === "completed"
                  const isInProgress = lesson.status === "in_progress"

                  return (
                    <Link
                      key={lesson.id}
                      href={isLocked ? "#" : `/learn/${courseId}/lesson/${lesson.id}`}
                      className={cn(
                        "flex items-center gap-4 p-4 transition-colors",
                        isLocked
                          ? "cursor-not-allowed opacity-60"
                          : "hover:bg-secondary/30"
                      )}
                      onClick={(e) => isLocked && e.preventDefault()}
                    >
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : isLocked ? (
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        ) : isInProgress ? (
                          <Circle className="h-5 w-5 text-primary fill-primary/20" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{lesson.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{lesson.duration_minutes} min</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {lesson.content_type}
                          </Badge>
                          {lesson.score !== null && (
                            <>
                              <span>•</span>
                              <span className="text-primary">{lesson.score}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      {!isLocked && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Standards */}
        {course.standards?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 rounded-xl border border-border bg-card p-6"
          >
            <h3 className="flex items-center gap-2 font-medium mb-4">
              <Target className="h-5 w-5 text-primary" />
              Educational Standards Alignment
            </h3>
            <div className="flex flex-wrap gap-2">
              {course.standards.map((standard) => (
                <Badge key={standard} variant="outline">
                  {standard}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}


