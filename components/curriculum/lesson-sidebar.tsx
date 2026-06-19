"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { CheckCircle2, Circle, Lock, PlayCircle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface Lesson {
  id: string
  title: string
  duration_minutes: number
  status: "locked" | "available" | "in_progress" | "completed"
}

interface Module {
  id: string
  title: string
  lessons: Lesson[]
}

interface LessonSidebarProps {
  courseId: string
  courseTitle: string
  modules: Module[]
  currentLessonId?: string
}

export function LessonSidebar({
  courseId,
  courseTitle,
  modules,
  currentLessonId,
}: LessonSidebarProps) {
  const getStatusIcon = (status: Lesson["status"], isActive: boolean) => {
    if (isActive) {
      return <PlayCircle className="h-4 w-4 text-primary" />
    }
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-primary" />
      case "in_progress":
        return <Circle className="h-4 w-4 text-primary fill-primary/20" />
      case "locked":
        return <Lock className="h-4 w-4 text-muted-foreground" />
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }

  // Find which module contains the current lesson
  const currentModuleId = modules.find((m) =>
    m.lessons.some((l) => l.id === currentLessonId)
  )?.id

  return (
    <div className="h-full flex flex-col border-r border-border bg-card">
      {/* Course header */}
      <div className="p-4 border-b border-border">
        <Link
          href={`/learn/${courseId}`}
          className="text-sm font-medium hover:text-primary transition-colors"
        >
          ← Back to course
        </Link>
        <h2 className="mt-2 font-semibold truncate">{courseTitle}</h2>
      </div>

      {/* Module list */}
      <ScrollArea className="flex-1">
        <Accordion
          type="single"
          collapsible
          defaultValue={currentModuleId}
          className="p-2"
        >
          {modules.map((module, moduleIndex) => (
            <AccordionItem key={module.id} value={module.id} className="border-0">
              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline hover:bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 text-left">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                    {moduleIndex + 1}
                  </span>
                  <span className="font-medium">{module.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1 pl-4">
                  {module.lessons.map((lesson) => {
                    const isActive = lesson.id === currentLessonId
                    const isLocked = lesson.status === "locked"

                    return (
                      <Link
                        key={lesson.id}
                        href={isLocked ? "#" : `/learn/${courseId}/lesson/${lesson.id}`}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : isLocked
                            ? "text-muted-foreground cursor-not-allowed"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        )}
                        onClick={(e) => isLocked && e.preventDefault()}
                      >
                        {getStatusIcon(lesson.status, isActive)}
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{lesson.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {lesson.duration_minutes} min
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>

      {/* Progress footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          {modules.reduce(
            (acc, m) => acc + m.lessons.filter((l) => l.status === "completed").length,
            0
          )}{" "}
          of {modules.reduce((acc, m) => acc + m.lessons.length, 0)} lessons completed
        </div>
      </div>
    </div>
  )
}


