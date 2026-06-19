// Curriculum system types

export type DifficultyLevel = "beginner" | "intermediate" | "advanced"
export type ContentType = "video" | "text" | "interactive" | "quiz" | "challenge"
export type LessonStatus = "locked" | "available" | "in_progress" | "completed"

export interface Course {
  id: string
  title: string
  description: string
  thumbnail_url: string | null
  difficulty: DifficultyLevel
  estimated_hours: number
  grade_range: string
  standards: string[] // e.g., ["CSTA 2-CS-02", "NGSS MS-ETS1-1"]
  prerequisites: string[] // course IDs
  is_premium: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string
  order_index: number
  created_at: string
}

export interface Lesson {
  id: string
  module_id: string
  course_id: string
  title: string
  description: string
  content_type: ContentType
  duration_minutes: number
  order_index: number
  is_premium: boolean
  learning_objectives: string[]
  created_at: string
  updated_at: string
}

export interface LessonContent {
  id: string
  lesson_id: string
  content_json: {
    type: "text" | "video" | "blockly" | "simulator" | "quiz"
    data: unknown
  }
  order_index: number
}

export interface Activity {
  id: string
  lesson_id: string
  title: string
  description: string
  type: "simulator" | "blockly" | "code" | "quiz"
  config_json: {
    arena?: string
    initial_code?: string
    success_criteria?: SuccessCriteria
    questions?: QuizQuestion[]
  }
  points: number
  order_index: number
}

export interface SuccessCriteria {
  type: "reach_goal" | "avoid_obstacles" | "follow_line" | "custom"
  params?: Record<string, unknown>
}

export interface QuizQuestion {
  id: string
  question: string
  type: "multiple_choice" | "true_false" | "code"
  options?: string[]
  correct_answer: string | number
  explanation?: string
  points: number
}

export interface UserProgress {
  id: string
  user_id: string
  course_id: string
  lesson_id: string
  status: LessonStatus
  score: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: "course" | "skill" | "streak" | "community"
  criteria_json: {
    type: string
    params: Record<string, unknown>
  }
  points: number
}

export interface UserAchievement {
  id: string
  user_id: string
  achievement_id: string
  earned_at: string
}

// Expanded types for UI
export interface CourseWithProgress extends Course {
  modules: ModuleWithLessons[]
  progress_percentage: number
  lessons_completed: number
  total_lessons: number
}

export interface ModuleWithLessons extends Module {
  lessons: LessonWithProgress[]
}

export interface LessonWithProgress extends Lesson {
  status: LessonStatus
  score: number | null
  activities: Activity[]
}

// Sample curriculum data for seeding
export const SAMPLE_COURSES: Omit<Course, "id" | "created_at" | "updated_at">[] = [
  {
    title: "Introduction to Robotics",
    description: "Learn the fundamentals of robotics including basic movements, sensors, and programming concepts. Perfect for beginners with no prior experience.",
    thumbnail_url: null,
    difficulty: "beginner",
    estimated_hours: 8,
    grade_range: "6-8",
    standards: ["CSTA 2-CS-02", "CSTA 2-AP-12", "NGSS MS-ETS1-1"],
    prerequisites: [],
    is_premium: false,
    order_index: 1,
  },
  {
    title: "Sensor Systems & Navigation",
    description: "Master the use of distance sensors, line followers, and color detection to create robots that can navigate complex environments.",
    thumbnail_url: null,
    difficulty: "intermediate",
    estimated_hours: 12,
    grade_range: "7-9",
    standards: ["CSTA 2-AP-13", "CSTA 2-AP-16", "NGSS MS-ETS1-2"],
    prerequisites: [],
    is_premium: false,
    order_index: 2,
  },
  {
    title: "Autonomous Robotics",
    description: "Build fully autonomous robots that can make decisions, plan paths, and complete complex tasks without human intervention.",
    thumbnail_url: null,
    difficulty: "advanced",
    estimated_hours: 16,
    grade_range: "9-12",
    standards: ["CSTA 3A-AP-17", "CSTA 3A-AP-18", "NGSS HS-ETS1-2"],
    prerequisites: [],
    is_premium: true,
    order_index: 3,
  },
]

export const SAMPLE_MODULES: Record<string, Omit<Module, "id" | "course_id" | "created_at">[]> = {
  "Introduction to Robotics": [
    { title: "What is a Robot?", description: "Understand what defines a robot and explore real-world applications", order_index: 1 },
    { title: "Basic Movements", description: "Learn to program your robot to move forward, backward, and turn", order_index: 2 },
    { title: "Understanding Sensors", description: "Discover how robots sense and interact with their environment", order_index: 3 },
    { title: "Your First Challenge", description: "Apply what you've learned to complete a navigation challenge", order_index: 4 },
  ],
  "Sensor Systems & Navigation": [
    { title: "Distance Sensors", description: "Master ultrasonic and infrared sensors for obstacle detection", order_index: 1 },
    { title: "Line Following", description: "Build a robot that can follow a path using line sensors", order_index: 2 },
    { title: "Color Detection", description: "Use color sensors for object recognition and sorting", order_index: 3 },
    { title: "Navigation Strategies", description: "Combine sensors for complex navigation behaviors", order_index: 4 },
  ],
  "Autonomous Robotics": [
    { title: "Sensor Fusion", description: "Combine multiple sensor inputs for better decision making", order_index: 1 },
    { title: "Path Planning", description: "Algorithms for finding optimal routes in complex environments", order_index: 2 },
    { title: "State Machines", description: "Design robot behaviors using finite state machines", order_index: 3 },
    { title: "Capstone Project", description: "Build a fully autonomous robot to complete a complex mission", order_index: 4 },
  ],
}


