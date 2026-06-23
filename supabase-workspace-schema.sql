-- supabase-workspace-schema.sql
-- Xylo Robotics Platform — /workspace feature
-- Run supabase-schema.sql first (defines update_updated_at_column()).

create table if not exists workspace_projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,  -- Clerk user IDs are strings like "user_..."
  name text not null,
  board text not null default 'arduino-uno',
  components jsonb not null default '[]'::jsonb,
  code jsonb not null default '{"source":"blocks","blocklyXml":null,"generatedCode":""}'::jsonb,
  flashed jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists workspace_projects_user_id_idx on workspace_projects(user_id);
create index if not exists workspace_projects_updated_at_idx on workspace_projects(updated_at desc);

drop trigger if exists update_workspace_projects_updated_at on workspace_projects;
create trigger update_workspace_projects_updated_at
  before update on workspace_projects
  for each row
  execute function update_updated_at_column();

-- Note: no RLS policies — auth/ownership is enforced in API routes via Clerk,
-- matching the existing `projects` table's pattern.
