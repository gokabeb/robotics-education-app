-- Xylo Robotics Platform Database Schema
-- Run this in your Supabase SQL Editor
-- Updated for Clerk Authentication (user_id is text, not uuid)

-- Projects table for saving user work
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,  -- Clerk user IDs are strings like "user_..."
  name text not null,
  blockly_xml text,
  generated_code text,
  target_board text default 'arduino-uno',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes for performance
create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists projects_updated_at_idx on projects(updated_at desc);

-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to call the function
drop trigger if exists update_projects_updated_at on projects;
create trigger update_projects_updated_at
  before update on projects
  for each row
  execute function update_updated_at_column();

-- Note: We don't use RLS policies here because authentication is handled by Clerk
-- Authorization checks are done in the API routes instead
-- This is a common pattern when using external auth providers
