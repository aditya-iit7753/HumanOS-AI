CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN CREATE TYPE taskstatus AS ENUM ('todo', 'in_progress', 'done'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE goalstatus AS ENUM ('active', 'paused', 'complete'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE documentstatus AS ENUM ('uploaded', 'processing', 'ready', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agentstatus AS ENUM ('idle', 'running', 'paused', 'disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(320) UNIQUE NOT NULL,
  clerk_user_id VARCHAR(128) UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role VARCHAR(80) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    ai_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    memory_enabled BOOLEAN NOT NULL DEFAULT true,
    theme VARCHAR(24) NOT NULL DEFAULT 'system',
    dev_api_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings(user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(24) NOT NULL,
  content TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category memorytype NOT NULL DEFAULT 'important_fact',
  content TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 3,
  source VARCHAR(120) NOT NULL DEFAULT 'assistant',
  vector_id VARCHAR(80) UNIQUE,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status taskstatus NOT NULL DEFAULT 'todo',
  priority VARCHAR(16) NOT NULL DEFAULT 'medium',
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  why TEXT NOT NULL DEFAULT '',
  metric VARCHAR(160) NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0,
  status goalstatus NOT NULL DEFAULT 'active',
  target_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS goal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  file_name VARCHAR(260) NOT NULL DEFAULT '',
  mime_type VARCHAR(120) NOT NULL DEFAULT '',
  storage_url TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  status documentstatus NOT NULL DEFAULT 'uploaded',
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company VARCHAR(180) NOT NULL,
  title VARCHAR(220) NOT NULL,
  location VARCHAR(180) NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  match_score INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(80) NOT NULL DEFAULT 'saved',
  notes TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resume_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(220) NOT NULL,
  target_role VARCHAR(180) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  status agentstatus NOT NULL DEFAULT 'idle',
  instructions TEXT NOT NULL DEFAULT '',
  tools JSONB NOT NULL DEFAULT '[]',
  schedule JSONB NOT NULL DEFAULT '{}',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date TIMESTAMPTZ NOT NULL,
  focus VARCHAR(220) NOT NULL DEFAULT '',
  agenda JSONB NOT NULL DEFAULT '[]',
  reflection TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


DO $$ BEGIN
  ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_goal_id_goals
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS career_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_role VARCHAR(160) NOT NULL DEFAULT '',
  target_role VARCHAR(160) NOT NULL DEFAULT '',
  strengths JSONB NOT NULL DEFAULT '[]',
  growth_areas JSONB NOT NULL DEFAULT '[]',
  roadmap JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_career_profiles_user_id ON career_profiles(user_id);
CREATE INDEX IF NOT EXISTS ix_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS ix_memories_user_id ON memories(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_memories_vector_id ON memories(vector_id);
CREATE INDEX IF NOT EXISTS ix_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS ix_tasks_goal_id ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS ix_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS ix_goal_milestones_user_id ON goal_milestones(user_id);
CREATE INDEX IF NOT EXISTS ix_goal_milestones_goal_id ON goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS ix_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS ix_job_matches_user_id ON job_matches(user_id);
CREATE INDEX IF NOT EXISTS ix_resume_versions_user_id ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS ix_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS ix_daily_plans_user_id ON daily_plans(user_id);
CREATE INDEX IF NOT EXISTS ix_daily_plans_plan_date ON daily_plans(plan_date);

