"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Target,
  Play,
  BookOpen,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface LessonViewerProps {
  lesson: {
    id: string
    title: string
    description: string
    content_type: string
    duration_minutes: number
    learning_objectives: string[]
    content: Array<{
      id: string
      content_json: Record<string, unknown>
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
  }
  courseId: string
  onComplete: (score?: number) => Promise<void>
}

export function LessonViewer({ lesson, courseId, onComplete }: LessonViewerProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const isCompleted = lesson.progress?.status === "completed"

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      await onComplete()
      toast.success("Lesson completed! 🎉")
    } catch {
      toast.error("Failed to mark lesson as complete")
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-card px-8 py-6"
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Clock className="h-4 w-4" />
            <span>{lesson.duration_minutes} min</span>
            <span className="mx-2">•</span>
            <Badge variant="outline" className="capitalize">
              {lesson.content_type}
            </Badge>
            {isCompleted && (
              <>
                <span className="mx-2">•</span>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              </>
            )}
          </div>
          <h1 className="text-2xl font-semibold">{lesson.title}</h1>
          <p className="mt-2 text-muted-foreground">{lesson.description}</p>
        </div>
      </motion.div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Learning Objectives */}
        {lesson.learning_objectives?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 rounded-xl border border-border bg-secondary/30 p-6"
          >
            <h3 className="flex items-center gap-2 font-medium mb-4">
              <Target className="h-5 w-5 text-primary" />
              Learning Objectives
            </h3>
            <ul className="space-y-2">
              {lesson.learning_objectives.map((objective, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs text-primary font-medium">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{objective}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Lesson Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="prose prose-invert prose-sm max-w-none"
        >
          {lesson.content?.map((block, index) => (
            <ContentBlock key={block.id} block={block} index={index} />
          ))}

          {/* Fallback if no content */}
          {(!lesson.content || lesson.content.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Lesson content is being prepared.</p>
              <p className="text-sm mt-2">Check back soon!</p>
            </div>
          )}
        </motion.div>

        {/* Activities */}
        {lesson.activities?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <h3 className="font-medium mb-4">Practice Activities</h3>
            <div className="space-y-3">
              {lesson.activities.map((activity) => (
                <Link
                  key={activity.id}
                  href={getActivityLink(activity.type, courseId, lesson.id, activity.id)}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <p className="font-medium group-hover:text-primary transition-colors">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {activity.type} • {activity.points} pts
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Play className="h-4 w-4" />
                  </Button>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        {/* Complete button */}
        {!isCompleted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex justify-center"
          >
            <Button
              size="lg"
              onClick={handleComplete}
              disabled={isCompleting}
              className="bg-primary text-primary-foreground"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              {isCompleting ? "Completing..." : "Mark as Complete"}
            </Button>
          </motion.div>
        )}

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 flex items-center justify-between border-t border-border pt-8"
        >
          {lesson.prev_lesson ? (
            <Link
              href={`/learn/${courseId}/lesson/${lesson.prev_lesson.id}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <div>
                <p className="text-xs text-muted-foreground">Previous</p>
                <p>{lesson.prev_lesson.title}</p>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {lesson.next_lesson ? (
            <Link
              href={`/learn/${courseId}/lesson/${lesson.next_lesson.id}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-right"
            >
              <div>
                <p className="text-xs text-muted-foreground">Next</p>
                <p>{lesson.next_lesson.title}</p>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href={`/learn/${courseId}`}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <span>Back to Course</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </motion.div>
      </div>
    </div>
  )
}

// Content block renderer
function ContentBlock({
  block,
  index,
}: {
  block: { content_json: Record<string, unknown> }
  index: number
}) {
  const json = block.content_json
  const type = json.type as string

  switch (type) {
    case "text": {
      // Support both new schema { content: string } and old { data: string }
      const markdown = (json.content ?? json.data) as string
      return (
        <div
          className="mb-6 prose-headings:font-semibold prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-table:text-sm"
          dangerouslySetInnerHTML={{
            __html: markdownToHtml(markdown ?? ""),
          }}
        />
      )
    }

    case "quiz":
      return <QuizBlock questions={(json.questions as QuizQuestion[]) ?? []} index={index} />

    case "activity": {
      const activityType = json.activityType as string
      const instructions = json.instructions as string
      const config = (json.config ?? {}) as Record<string, string>
      const href = getActivityHref(activityType, config)
      return (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{getActivityEmoji(activityType)}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1 capitalize">
                {activityType} Activity
              </p>
              {instructions && (
                <p className="text-sm text-muted-foreground mb-3">{instructions}</p>
              )}
              <Button size="sm" asChild>
                <Link href={href}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Open {activityType === "simulator" ? "Simulator" : activityType === "blockly" ? "Block Editor" : "Robot Builder"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )
    }

    case "video":
      return (
        <div className="mb-6 aspect-video rounded-xl overflow-hidden bg-secondary">
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Play className="h-12 w-12" />
          </div>
        </div>
      )

    case "blockly":
      return (
        <div className="mb-6 rounded-xl border border-border p-4 bg-secondary/30">
          <p className="text-sm text-muted-foreground mb-2">
            Interactive Block Editor
          </p>
          <Link href="/playground">
            <Button>Open Block Editor</Button>
          </Link>
        </div>
      )

    case "simulator":
      return (
        <div className="mb-6 rounded-xl border border-border p-4 bg-secondary/30">
          <p className="text-sm text-muted-foreground mb-2">
            Robot Simulator Challenge
          </p>
          <Link href="/simulator">
            <Button>Open Simulator</Button>
          </Link>
        </div>
      )

    default:
      return null
  }
}

interface QuizQuestion {
  text: string
  options: string[]
  correct: number
}

function QuizBlock({ questions, index }: { questions: QuizQuestion[]; index: number }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.correct).length
    : 0

  return (
    <div className="mb-6 rounded-xl border border-border bg-secondary/20 p-5">
      <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="text-lg">📝</span> Quiz
      </h4>
      <div className="space-y-6">
        {questions.map((q, qi) => (
          <div key={qi}>
            <p className="text-sm font-medium mb-2">{qi + 1}. {q.text}</p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi
                const isCorrect = q.correct === oi
                let cls = "w-full text-left rounded-lg border px-4 py-2 text-sm transition-colors "
                if (!submitted) {
                  cls += selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                } else {
                  if (isCorrect) cls += "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
                  else if (selected) cls += "border-destructive bg-destructive/10 text-destructive"
                  else cls += "border-border text-muted-foreground"
                }
                return (
                  <button
                    key={oi}
                    className={cls}
                    disabled={submitted}
                    onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {!submitted ? (
        <Button
          size="sm"
          className="mt-4"
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < questions.length}
        >
          Submit Answers
        </Button>
      ) : (
        <div className="mt-4 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-sm text-primary">
          Score: {score} / {questions.length}
          {score === questions.length ? " — Perfect!" : " — Review the highlighted answers above."}
        </div>
      )}
    </div>
  )
}

/** Very simple markdown-to-html for lesson text blocks */
function markdownToHtml(md: string): string {
  return md
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/^\| (.+) \|$/gm, (_, row) => {
      const cells = row.split(" | ").map((c: string) => `<td class="border border-border px-2 py-1">${c}</td>`).join("")
      return `<tr>${cells}</tr>`
    })
    .replace(/(<tr>[\s\S]*?<\/tr>)/g, "<table class='w-full text-sm mb-4 border-collapse'>$1</table>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>(\n|$))+/g, "<ul class='list-disc ml-5 mb-4 space-y-1'>$&</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hup]|<li|<pre|<table)(.+)$/gm, "<p>$1</p>")
}

function getActivityHref(activityType: string, config: Record<string, string>): string {
  switch (activityType) {
    case "simulator": return config.arena ? `/simulator` : "/simulator"
    case "blockly": return "/playground"
    case "builder": return "/builder"
    default: return "/simulator"
  }
}

function getActivityEmoji(activityType: string): string {
  switch (activityType) {
    case "simulator": return "🤖"
    case "blockly": return "🧩"
    case "builder": return "🔧"
    default: return "🎯"
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case "simulator":
      return "🤖"
    case "blockly":
      return "🧩"
    case "code":
      return "💻"
    case "quiz":
      return "📝"
    default:
      return "📚"
  }
}

function getActivityLink(type: string, courseId: string, lessonId: string, activityId: string) {
  switch (type) {
    case "simulator":
      return `/simulator?lesson=${lessonId}&activity=${activityId}`
    case "blockly":
      return `/playground?lesson=${lessonId}&activity=${activityId}`
    default:
      return `/learn/${courseId}/lesson/${lessonId}/activity/${activityId}`
  }
}


