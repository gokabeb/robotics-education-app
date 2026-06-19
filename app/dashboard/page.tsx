"use client"

import { useState, useEffect, useCallback } from "react"
import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { ProjectCard } from "@/components/dashboard/project-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, FolderOpen, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Project } from "@/lib/database.types"

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects")
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (error) {
      console.error("Error loading projects:", error)
      toast.error("Failed to load projects")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleCreateProject = async () => {
    setCreating(true)
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Project" }),
      })

      if (response.ok) {
        const newProject = await response.json()
        toast.success("Project created!")
        router.push(`/playground?project=${newProject.id}`)
      } else {
        toast.error("Failed to create project")
      }
    } catch {
      toast.error("Failed to create project")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" })
      if (response.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id))
        toast.success("Project deleted")
      } else {
        toast.error("Failed to delete project")
      }
    } catch {
      toast.error("Failed to delete project")
    }
  }

  const handleRenameProject = async (id: string, name: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      if (response.ok) {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name } : p))
        )
        toast.success("Project renamed")
      } else {
        toast.error("Failed to rename project")
      }
    } catch {
      toast.error("Failed to rename project")
    }
  }

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="pt-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="border-b border-border bg-card"
        >
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    My Projects
                  </h1>
                  <p className="mt-1 text-muted-foreground">
                    Manage your robotics projects
                  </p>
                </div>
              </div>

              <Button
                onClick={handleCreateProject}
                disabled={creating}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                New Project
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-6"
          >
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No projects yet</h3>
              <p className="mt-2 text-muted-foreground max-w-md">
                {search
                  ? "No projects match your search"
                  : "Create your first project to start building robots!"}
              </p>
              {!search && (
                <Button
                  onClick={handleCreateProject}
                  disabled={creating}
                  className="mt-6 bg-primary text-primary-foreground"
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create First Project
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <ProjectCard
                    project={project}
                    onDelete={handleDeleteProject}
                    onRename={handleRenameProject}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
