// Gamification and Challenge types

export interface Challenge {
  id: string
  title: string
  description: string
  type: "maze" | "line_follow" | "obstacle" | "speed" | "creative"
  difficulty: "easy" | "medium" | "hard" | "expert"
  arena_id: string
  time_limit_seconds: number | null
  points: number
  badge_id: string | null
  success_criteria: {
    type: string
    params: Record<string, unknown>
  }
  is_premium: boolean
  created_at: string
}

export interface ChallengeAttempt {
  id: string
  user_id: string
  challenge_id: string
  score: number
  time_seconds: number
  completed: boolean
  code_used: string | null
  created_at: string
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  score: number
  time_seconds: number
  completed_at: string
}

// Sample challenges
export const SAMPLE_CHALLENGES: Omit<Challenge, "id" | "created_at">[] = [
  {
    title: "Maze Navigator",
    description: "Guide your robot through the maze to reach the exit",
    type: "maze",
    difficulty: "easy",
    arena_id: "maze",
    time_limit_seconds: 60,
    points: 100,
    badge_id: null,
    success_criteria: { type: "reach_goal", params: {} },
    is_premium: false,
  },
  {
    title: "Line Follower Pro",
    description: "Follow the line track from start to finish as fast as possible",
    type: "line_follow",
    difficulty: "medium",
    arena_id: "line-follow",
    time_limit_seconds: 45,
    points: 150,
    badge_id: null,
    success_criteria: { type: "reach_goal", params: { follow_line: true } },
    is_premium: false,
  },
  {
    title: "Obstacle Master",
    description: "Navigate through the obstacle course without any collisions",
    type: "obstacle",
    difficulty: "medium",
    arena_id: "obstacle-course",
    time_limit_seconds: 90,
    points: 200,
    badge_id: null,
    success_criteria: { type: "reach_goal", params: { no_collisions: true } },
    is_premium: false,
  },
  {
    title: "Speed Demon",
    description: "Complete the open arena checkpoint race in record time",
    type: "speed",
    difficulty: "hard",
    arena_id: "open-arena",
    time_limit_seconds: 30,
    points: 300,
    badge_id: null,
    success_criteria: { type: "time_trial", params: { target_time: 15 } },
    is_premium: true,
  },
]

export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-500/10 text-green-500 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  hard: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  expert: "bg-red-500/10 text-red-500 border-red-500/20",
}

export const DIFFICULTY_POINTS: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  expert: 5,
}

export const CHALLENGE_TYPE_ICONS: Record<string, string> = {
  maze: "🌀",
  line_follow: "➖",
  obstacle: "🚧",
  speed: "⚡",
  creative: "🎨",
}


