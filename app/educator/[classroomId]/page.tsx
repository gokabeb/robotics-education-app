"use client"

import { useState, useEffect, use } from "react"
import { motion } from "framer-motion"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  Copy,
  BookOpen,
  Flame,
  Star,
  Clock,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import { redirect } from "next/navigation"

interface Student {
  id: string
  student_id: string
  role: string
  status: string
  joined_at: string
  lessons_completed: number
  total_points: number
  current_streak: number
  last_activity: string | null
}

interface Classroom {
  id: string
  name: string
  description: string
  join_code: string
  grade_level: string
  is_active: boolean
  enrollments: Student[]
  assignments: unknown[]
}

export default function ClassroomPage({
  params,
}: {
  params: Promise<{ classroomId: string }>
}) {
  const { classroomId } = use(params)
  const { isSignedIn, isLoaded } = useUser()
  const [classroom, setClassroom] = useState<Classroom | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      redirect("/sign-in")
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    async function fetchData() {
      if (!isSignedIn) return

      try {
        const [classroomRes, studentsRes] = await Promise.all([
          fetch(`/api/educator/classrooms/${classroomId}`),
          fetch(`/api/educator/classrooms/${classroomId}/students`),
        ])

        if (classroomRes.ok) {
          const data = await classroomRes.json()
          setClassroom(data)
        }

        if (studentsRes.ok) {
          const data = await studentsRes.json()
          setStudents(data)
        }
      } catch (error) {
        console.error("Failed to fetch classroom:", error)
      } finally {
        setLoading(false)
      }
    }

    if (isSignedIn) {
      fetchData()
    }
  }, [isSignedIn, classroomId])

  const copyJoinCode = () => {
    if (classroom) {
      navigator.clipboard.writeText(classroom.join_code)
      toast.success("Join code copied!")
    }
  }

  if (!isLoaded || !isSignedIn) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 px-6">
          <div className="max-w-6xl mx-auto py-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-96 mb-8" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!classroom) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 px-6 text-center py-16">
          <h2 className="text-xl font-semibold">Classroom not found</h2>
          <Button asChild className="mt-4">
            <Link href="/educator">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-card pt-20"
      >
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Link
            href="/educator"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{classroom.name}</h1>
              {classroom.description && (
                <p className="text-muted-foreground mt-1">
                  {classroom.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary cursor-pointer hover:bg-secondary/80"
                onClick={copyJoinCode}
              >
                <span className="text-sm text-muted-foreground">Join Code:</span>
                <span className="font-mono font-medium">{classroom.join_code}</span>
                <Copy className="h-4 w-4 text-muted-foreground" />
              </div>
              <Button variant="outline" asChild>
                <Link href={`/educator/${classroomId}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students" className="gap-2">
              <Users className="h-4 w-4" />
              Students ({students.length})
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Students Tab */}
          <TabsContent value="students" className="mt-6">
            {students.length === 0 ? (
              <div className="text-center py-16 rounded-xl border border-dashed border-border">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No students yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Share the join code with your students to get started
                </p>
                <Button onClick={copyJoinCode}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Join Code
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Student
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Progress
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Points
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Streak
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium">
                        Last Active
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map((student) => (
                      <motion.tr
                        key={student.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-secondary/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                              {student.student_id.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                Student {student.student_id.slice(0, 8)}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {student.role}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {student.lessons_completed} lessons
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-amber-500" />
                            <span className="text-sm">{student.total_points}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Flame className="h-4 w-4 text-orange-500" />
                            <span className="text-sm">
                              {student.current_streak} days
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {student.last_activity
                              ? new Date(student.last_activity).toLocaleDateString()
                              : "Never"}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="mt-6">
            <div className="text-center py-16 rounded-xl border border-dashed border-border">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No assignments yet</h3>
              <p className="text-muted-foreground mt-1 mb-4">
                Create assignments to track student work
              </p>
              <Button>Create Assignment</Button>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Class Average Progress</p>
                <p className="text-2xl font-semibold mt-1">
                  {students.length > 0
                    ? Math.round(
                        students.reduce((acc, s) => acc + s.lessons_completed, 0) /
                          students.length
                      )
                    : 0}{" "}
                  lessons
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Total Points Earned</p>
                <p className="text-2xl font-semibold mt-1">
                  {students.reduce((acc, s) => acc + s.total_points, 0)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Active Students</p>
                <p className="text-2xl font-semibold mt-1">
                  {students.filter((s) => s.current_streak > 0).length} /{" "}
                  {students.length}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-medium mb-4">Student Progress</h3>
              <div className="space-y-4">
                {students.slice(0, 5).map((student) => (
                  <div key={student.id} className="flex items-center gap-4">
                    <div className="w-32 text-sm truncate">
                      Student {student.student_id.slice(0, 8)}
                    </div>
                    <Progress
                      value={Math.min(student.lessons_completed * 10, 100)}
                      className="flex-1 h-2"
                    />
                    <span className="text-sm text-muted-foreground w-20 text-right">
                      {student.lessons_completed} lessons
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


