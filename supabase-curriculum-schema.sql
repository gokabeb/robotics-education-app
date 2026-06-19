-- Xylo Curriculum Database Schema
-- Run this after the main supabase-schema.sql

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  thumbnail_url TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_hours INTEGER NOT NULL DEFAULT 1,
  grade_range TEXT NOT NULL DEFAULT '6-12',
  standards TEXT[] DEFAULT ARRAY[]::TEXT[],
  prerequisites UUID[] DEFAULT ARRAY[]::UUID[],
  is_premium BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modules table (sections within a course)
CREATE TABLE IF NOT EXISTS modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('video', 'text', 'interactive', 'quiz', 'challenge')),
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  learning_objectives TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lesson content blocks
CREATE TABLE IF NOT EXISTS lesson_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Activities (interactive exercises, quizzes, simulator challenges)
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('simulator', 'blockly', 'code', 'quiz')),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  points INTEGER NOT NULL DEFAULT 10,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- User progress tracking
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Clerk user ID
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  score INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Achievements/Badges
CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏆',
  category TEXT NOT NULL CHECK (category IN ('course', 'skill', 'streak', 'community')),
  criteria_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  points INTEGER NOT NULL DEFAULT 100
);

-- User achievements (earned badges)
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Clerk user ID
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- User points/XP tracking
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE, -- Clerk user ID
  total_points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  lessons_completed INTEGER NOT NULL DEFAULT 0,
  challenges_completed INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_activities_lesson ON activities(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_course ON user_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_stats(user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;
CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample achievements
INSERT INTO achievements (name, description, icon, category, criteria_json, points) VALUES
  ('First Steps', 'Complete your first lesson', '👣', 'course', '{"type": "lessons_completed", "count": 1}', 50),
  ('Getting Started', 'Complete the Introduction to Robotics course', '🎓', 'course', '{"type": "course_completed", "course": "intro"}', 200),
  ('Sensor Master', 'Complete all sensor-related lessons', '📡', 'skill', '{"type": "skill_mastery", "skill": "sensors"}', 150),
  ('Code Ninja', 'Write 10 programs in the Block Editor', '🥷', 'skill', '{"type": "programs_created", "count": 10}', 100),
  ('Week Warrior', 'Maintain a 7-day learning streak', '🔥', 'streak', '{"type": "streak", "days": 7}', 100),
  ('Month Master', 'Maintain a 30-day learning streak', '⚡', 'streak', '{"type": "streak", "days": 30}', 500),
  ('Helper', 'Help 5 students in the community', '🤝', 'community', '{"type": "community_help", "count": 5}', 150),
  ('Challenge Champion', 'Complete 10 simulator challenges', '🏆', 'skill', '{"type": "challenges_completed", "count": 10}', 200)
ON CONFLICT DO NOTHING;

-- Sample courses (will be replaced with real content)
INSERT INTO courses (title, description, difficulty, estimated_hours, grade_range, standards, is_premium, order_index) VALUES
  ('Introduction to Robotics', 'Learn the fundamentals of robotics including basic movements, sensors, and programming concepts. Perfect for beginners with no prior experience.', 'beginner', 8, '6-8', ARRAY['CSTA 2-CS-02', 'CSTA 2-AP-12', 'NGSS MS-ETS1-1'], false, 1),
  ('Sensor Systems & Navigation', 'Master the use of distance sensors, line followers, and color detection to create robots that can navigate complex environments.', 'intermediate', 12, '7-9', ARRAY['CSTA 2-AP-13', 'CSTA 2-AP-16', 'NGSS MS-ETS1-2'], false, 2),
  ('Autonomous Robotics', 'Build fully autonomous robots that can make decisions, plan paths, and complete complex tasks without human intervention.', 'advanced', 16, '9-12', ARRAY['CSTA 3A-AP-17', 'CSTA 3A-AP-18', 'NGSS HS-ETS1-2'], true, 3)
ON CONFLICT DO NOTHING;


