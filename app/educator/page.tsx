"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  GraduationCap,
  Plus,
  Users,
  ClipboardList,
  ChevronRight,
  Copy,
  Settings,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useUser } from "@clerk/nextjs"
import { redirect } from "next/navigation"

interface Classroom {
  id: string
  name: string
  description: string
  join_code: string
  grade_level: string
  student_count: number
  assignment_count: number
  is_active: boolean
  created_at: string
}

export default function EducatorDashboard() {
  const { isSignedIn, isLoaded } = useUser()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newClassroom, setNewClassroom] = useState({
    name: "",
    description: "",
    grade_level: "",
  })

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      redirect("/sign-in")
    }
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    async function fetchClassrooms() {
      if (!isSignedIn) return

      try {
        const response = await fetch("/api/educator/classrooms")
        if (response.ok) {
          const data = await response.json()
          setClassrooms(data)
        }
      } catch (error) {
        console.error("Failed to fetch classrooms:", error)
      } finally {
        setLoading(false)
      }
    }

    if (isSignedIn) {
      fetchClassrooms()
    }
  }, [isSignedIn])

  const handleCreateClassroom = async () => {
    if (!newClassroom.name.trim()) {
      toast.error("Please enter a classroom name")
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/educator/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClassroom),
      })

      if (response.ok) {
        const classroom = await response.json()
        setClassrooms([classroom, ...classrooms])
        setDialogOpen(false)
        setNewClassroom({ name: "", description: "", grade_level: "" })
        toast.success("Classroom created!")
      } else {
        toast.error("Failed to create classroom")
      }
    } catch {
      toast.error("Failed to create classroom")
    } finally {
      setIsCreating(false)
    }
  }

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success("Join code copied!")
  }

  if (!isLoaded || !isSignedIn) {
    return null
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
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold">Educator Dashboard</h1>
                <p className="text-muted-foreground">
                  Manage your classrooms and track student progress
                </p>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" />
                  New Classroom
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a Classroom</DialogTitle>
                  <DialogDescription>
                    Create a new classroom and share the join code with your students.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Classroom Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Robotics 101 - Period 3"
                      value={newClassroom.name}
                      onChange={(e) =>
                        setNewClassroom({ ...newClassroom, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade Level</Label>
                    <Input
                      id="grade"
                      placeholder="e.g., 6-8 or High School"
                      value={newClassroom.grade_level}
                      onChange={(e) =>
                        setNewClassroom({ ...newClassroom, grade_level: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the classroom..."
                      value={newClassroom.description}
                      onChange={(e) =>
                        setNewClassroom({ ...newClassroom, description: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateClassroom} disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Classroom"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <GraduationCap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{classrooms.length}</p>
                <p className="text-xs text-muted-foreground">Classrooms</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {classrooms.reduce((acc, c) => acc + c.student_count, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <ClipboardList className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {classrooms.reduce((acc, c) => acc + c.assignment_count, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Assignments</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Classrooms List */}
      <div className="mx-auto max-w-6xl px-6 pb-8">
        <h2 className="text-xl font-semibold mb-4">Your Classrooms</h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : classrooms.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 rounded-xl border border-dashed border-border"
          >
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No classrooms yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Create your first classroom to get started
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Classroom
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {classrooms.map((classroom, index) => (
              <motion.div
                key={classroom.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{classroom.name}</h3>
                      {!classroom.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </div>
                    {classroom.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {classroom.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {classroom.student_count} students
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="h-4 w-4" />
                        {classroom.assignment_count} assignments
                      </span>
                      {classroom.grade_level && (
                        <span>Grades {classroom.grade_level}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Join Code */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary cursor-pointer hover:bg-secondary/80 transition-colors"
                      onClick={() => copyJoinCode(classroom.join_code)}
                      title="Click to copy"
                    >
                      <span className="text-sm font-mono font-medium">
                        {classroom.join_code}
                      </span>
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>

                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/educator/${classroom.id}/settings`}>
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>

                    <Button variant="outline" asChild>
                      <Link href={`/educator/${classroom.id}`}>
                        View
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


