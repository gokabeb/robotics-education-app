"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Clock, BookOpen, Star, Lock, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface CourseCardProps {
  course: {
    id: string
    title: string
    description: string
    difficulty: "beginner" | "intermediate" | "advanced"
    estimated_hours: number
    grade_range: string
    is_premium: boolean
    total_lessons: number
    lessons_completed: number
    progress_percentage: number
  }
  index: number
}

const difficultyColors = {
  beginner: "bg-green-500/10 text-green-500 border-green-500/20",
  intermediate: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  advanced: "bg-red-500/10 text-red-500 border-red-500/20",
}

const difficultyIcons = {
  beginner: "🌱",
  intermediate: "🌿",
  advanced: "🌳",
}

export function CourseCard({ course, index }: CourseCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link href={`/learn/${course.id}`}>
        <div className="group relative rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
          {/* Premium badge */}
          {course.is_premium && (
            <div className="absolute -top-2 -right-2">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                <Star className="mr-1 h-3 w-3" />
                Premium
              </Badge>
            </div>
          )}

          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
              {difficultyIcons[course.difficulty]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                {course.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={cn("text-xs capitalize", difficultyColors[course.difficulty])}
                >
                  {course.difficulty}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Grades {course.grade_range}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
            {course.description}
          </p>

          {/* Stats */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{course.estimated_hours}h</span>
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{course.total_lessons} lessons</span>
            </div>
          </div>

          {/* Progress */}
          {course.lessons_completed > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-primary font-medium">
                  {course.progress_percentage}%
                </span>
              </div>
              <Progress value={course.progress_percentage} className="h-1.5" />
            </div>
          )}

          {/* Action hint */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {course.lessons_completed === 0
                ? "Start learning"
                : course.progress_percentage === 100
                ? "Completed!"
                : "Continue learning"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}


