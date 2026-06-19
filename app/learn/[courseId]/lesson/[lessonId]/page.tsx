"use client"

import { useState, useEffect, use, useCallback } from "react"
import { Navigation } from "@/components/navigation"
import { LessonSidebar } from "@/components/curriculum/lesson-sidebar"
import { LessonViewer } from "@/components/curriculum/lesson-viewer"
import { Skeleton } from "@/components/ui/skeleton"
import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface LessonData {
  id: string
  title: string
  description: string
  content_type: string
  duration_minutes: number
  learning_objectives: string[]
  content: Array<{
    id: string
    content_json: { type: string; data: unknown }
  }>
  activities: Array<{
    id: string
    title: string
    type: string
    points: number
  }>
  progress?: {
    status: string
    score: number | null
  }
  prev_lesson?: { id: string; title: string } | null
  next_lesson?: { id: string; title: string } | null
  module: {
    id: string
    title: string
    course_id: string
  }
}

interface Module {
  id: string
  title: string
  lessons: Array<{
    id: string
    title: string
    duration_minutes: number
    status: "locked" | "available" | "in_progress" | "completed"
  }>
}

interface CourseData {
  id: string
  title: string
  modules: Module[]
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const { courseId, lessonId } = use(params)
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [course, setCourse] = useState<CourseData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [lessonRes, courseRes] = await Promise.all([
          fetch(`/api/curriculum/lessons/${lessonId}`),
          fetch(`/api/curriculum/courses/${courseId}`),
        ])

        if (lessonRes.ok) {
          const lessonData = await lessonRes.json()
          setLesson(lessonData)
        }

        if (courseRes.ok) {
          const courseData = await courseRes.json()
          setCourse(courseData)
        }
      } catch (error) {
        console.error("Failed to fetch lesson:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [courseId, lessonId])

  const handleComplete = useCallback(async (score?: number) => {
    const response = await fetch(`/api/curriculum/lessons/${lessonId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    })

    if (!response.ok) {
      throw new Error("Failed to complete lesson")
    }

    // Update progress
    await fetch("/api/curriculum/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: 10, type: "lesson" }),
    })

    // Update local state
    setLesson((prev) =>
      prev ? { ...prev, progress: { status: "completed", score: score ?? null } } : null
    )
  }, [lessonId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex pt-16 h-screen">
          <div className="w-72 shrink-0 border-r border-border">
            <Skeleton className="h-full" />
          </div>
          <div className="flex-1 p-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-96 mb-8" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!lesson || !course) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 px-6">
          <div className="max-w-4xl mx-auto py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold">Lesson not found</h2>
            <p className="text-muted-foreground mt-2">
              The lesson you're looking for doesn't exist.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/learn/${courseId}`}>Back to Course</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex pt-16 h-screen">
        {/* Sidebar */}
        <div className="w-72 shrink-0 hidden lg:block">
          <LessonSidebar
            courseId={courseId}
            courseTitle={course.title}
            modules={course.modules}
            currentLessonId={lessonId}
          />
        </div>

        {/* Lesson content */}
        <LessonViewer
          lesson={lesson}
          courseId={courseId}
          onComplete={handleComplete}
        />
      </div>
    </div>
  )
}


