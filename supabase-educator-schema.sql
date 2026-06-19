-- Xylo Educator/Classroom Schema
-- Run this after supabase-curriculum-schema.sql

-- Classrooms table
CREATE TABLE IF NOT EXISTS classrooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id TEXT NOT NULL, -- Clerk user ID
  name TEXT NOT NULL,
  description TEXT,
  join_code TEXT UNIQUE NOT NULL,
  grade_level TEXT,
  subject TEXT DEFAULT 'Robotics',
  max_students INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Classroom enrollments
CREATE TABLE IF NOT EXISTS classroom_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT NOT NULL, -- Clerk user ID
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'assistant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'removed')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(classroom_id, student_id)
);

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE NOT NULL,
  teacher_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('lesson', 'project', 'challenge', 'quiz')),
  content_id UUID, -- Reference to lesson, project, etc.
  due_date TIMESTAMP WITH TIME ZONE,
  points INTEGER DEFAULT 100,
  is_published BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignment submissions
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
  student_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded', 'returned')),
  content JSONB, -- Submission content (code, answers, etc.)
  score INTEGER,
  feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- Educator profiles (additional info for teachers)
CREATE TABLE IF NOT EXISTS educator_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  school_name TEXT,
  school_district TEXT,
  position TEXT,
  verified BOOLEAN DEFAULT false,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'education')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_join_code ON classrooms(join_code);
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom ON classroom_enrollments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON classroom_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_classroom ON assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);

-- Generate unique join code function
CREATE OR REPLACE FUNCTION generate_join_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate join code
CREATE OR REPLACE FUNCTION set_join_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.join_code IS NULL THEN
    NEW.join_code := generate_join_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS classrooms_set_join_code ON classrooms;
CREATE TRIGGER classrooms_set_join_code
  BEFORE INSERT ON classrooms
  FOR EACH ROW
  EXECUTE FUNCTION set_join_code();

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_classrooms_updated_at ON classrooms;
CREATE TRIGGER update_classrooms_updated_at
  BEFORE UPDATE ON classrooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


