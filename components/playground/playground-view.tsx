"use client"

import { useState, useEffect } from "react"
import { BlocklyEditor } from "./blockly-editor"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Blocks, Sparkles, BookOpen } from "lucide-react"
import type { Project } from "@/lib/database.types"
import { useUser } from "@clerk/nextjs"

export function PlaygroundView() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project")
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(!!projectId)
  const { isSignedIn } = useUser()

  useEffect(() => {
    if (projectId) {
      const loadProject = async () => {
        try {
          const response = await fetch(`/api/projects/${projectId}`)
          if (response.ok) {
            const data = await response.json()
            setProject(data)
          }
        } catch (error) {
          console.error("Error loading project:", error)
        } finally {
          setLoading(false)
        }
      }
      loadProject()
    }
  }, [projectId])

  const handleSave = async (xml: string, code: string) => {
    if (!isSignedIn) return

    if (project) {
      // Update existing project
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockly_xml: xml,
          generated_code: code,
        }),
      })
    } else {
      // Create new project
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Project",
          blockly_xml: xml,
          generated_code: code,
        }),
      })
      
      if (response.ok) {
        const newProject = await response.json()
        setProject(newProject)
        // Update URL without reload
        window.history.replaceState({}, "", `/playground?project=${newProject.id}`)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading project...</div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-b border-border bg-card"
      >
        <div className="mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Blocks className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Block Editor</h1>
              <p className="text-sm text-muted-foreground">
                Drag and drop blocks to program your robot
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Auto-generates Arduino code</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Kid-friendly blocks</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="mx-auto px-6 py-6">
        <BlocklyEditor
          projectId={project?.id}
          projectName={project?.name || "Untitled Project"}
          initialXml={project?.blockly_xml || undefined}
          onSave={isSignedIn ? handleSave : undefined}
        />
      </div>
    </div>
  )
}
