"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Navigation } from "@/components/navigation"
import { CourseCard } from "@/components/curriculum/course-card"
import { BookOpen, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

interface Course {
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

export default function LearnPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")

  useEffect(() => {
    async function fetchCourses() {
      try {
        const response = await fetch("/api/curriculum/courses")
        if (response.ok) {
          const data = await response.json()
          setCourses(data)
        }
      } catch (error) {
        console.error("Failed to fetch courses:", error)
        // Use sample data if API fails
        setCourses([
          {
            id: "intro",
            title: "Introduction to Robotics",
            description: "Learn the fundamentals of robotics including basic movements, sensors, and programming concepts.",
            difficulty: "beginner",
            estimated_hours: 8,
            grade_range: "6-8",
            is_premium: false,
            total_lessons: 12,
            lessons_completed: 0,
            progress_percentage: 0,
          },
          {
            id: "sensors",
            title: "Sensor Systems & Navigation",
            description: "Master the use of distance sensors, line followers, and color detection.",
            difficulty: "intermediate",
            estimated_hours: 12,
            grade_range: "7-9",
            is_premium: false,
            total_lessons: 16,
            lessons_completed: 0,
            progress_percentage: 0,
          },
          {
            id: "autonomous",
            title: "Autonomous Robotics",
            description: "Build fully autonomous robots that can make decisions and complete complex tasks.",
            difficulty: "advanced",
            estimated_hours: 16,
            grade_range: "9-12",
            is_premium: true,
            total_lessons: 20,
            lessons_completed: 0,
            progress_percentage: 0,
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchCourses()
  }, [])

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(search.toLowerCase()) ||
      course.description.toLowerCase().includes(search.toLowerCase())
    const matchesDifficulty = difficultyFilter === "all" || course.difficulty === difficultyFilter
    return matchesSearch && matchesDifficulty
  })

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
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Learn Robotics
              </h1>
              <p className="mt-1 text-muted-foreground">
                Structured courses from beginner to advanced
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-background border-border">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-12 w-full" />
                <div className="mt-4 flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No courses found</h3>
            <p className="text-muted-foreground mt-1">
              Try adjusting your search or filters
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch("")
                setDifficultyFilter("all")
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course, index) => (
              <CourseCard key={course.id} course={course} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


