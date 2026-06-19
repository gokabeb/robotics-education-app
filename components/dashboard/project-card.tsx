"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Blocks, MoreVertical, Pencil, Trash2, Zap, Clock } from "lucide-react"
import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import type { Project } from "@/lib/database.types"

interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}

export function ProjectCard({ project, onDelete, onRename }: ProjectCardProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(project.name)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleRename = () => {
    if (newName.trim() && newName !== project.name) {
      onRename(project.id, newName.trim())
    }
    setIsRenaming(false)
  }

  const handleDelete = () => {
    onDelete(project.id)
    setShowDeleteDialog(false)
  }

  const timeAgo = formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Blocks className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {isRenaming ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename()
                      if (e.key === "Escape") {
                        setNewName(project.name)
                        setIsRenaming(false)
                      }
                    }}
                    className="h-8 w-48 text-sm"
                    autoFocus
                  />
                </div>
              ) : (
                <h3 className="font-semibold truncate">{project.name}</h3>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Updated {timeAgo}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {project.target_board}
                </span>
                {project.generated_code && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Has code
                  </span>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-border"
            asChild
          >
            <Link href={`/playground?project=${project.id}`}>
              <Blocks className="mr-2 h-4 w-4" />
              Edit Blocks
            </Link>
          </Button>
          {project.generated_code && (
            <Button
              size="sm"
              className="flex-1 bg-primary text-primary-foreground"
              onClick={() => {
                sessionStorage.setItem("xylo_code", project.generated_code!)
                sessionStorage.setItem("xylo_project_name", project.name)
              }}
              asChild
            >
              <Link href="/flasher">
                <Zap className="mr-2 h-4 w-4" />
                Flash
              </Link>
            </Button>
          )}
        </div>
      </motion.div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{project.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

