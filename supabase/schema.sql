-- ══════════════════════════════════════════════════════════════
-- Jarvis Dashboard — Supabase Schema (Part 1: Tables)
-- Run this FIRST in your Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Enable uuid generation
create extension if not exists "uuid-ossp";

create table if not exists agents (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  model         text not null,
  status        text not null default 'idle',
  role          text not null default 'researcher',
  role_description text,
  color         text not null default '#60a5fa',
  temperature       real not null default 0.7,
  response_length   text not null default 'medium',
  system_prompt     text,
  parent_id     uuid,
  can_spawn     boolean not null default false,
  spawn_pattern text not null default 'sequential',
  task_completion   int not null default 0,
  latency_ms        int not null default 0,
  total_tokens      bigint not null default 0,
  total_cost        real not null default 0,
  success_rate      int not null default 100,
  task_count        int not null default 0,
  uptime_ms         bigint not null default 0,
  last_heartbeat    timestamptz default now(),
  restart_count     int not null default 0,
  error_message     text,
  error_stack       text,
  last_restart      timestamptz,
  token_burn        jsonb default '[]',
  token_history_24h jsonb default '[]',
  latency_history_24h jsonb default '[]',
  skills            text[] default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists tasks (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  status        text not null default 'pending',
  parent_id     uuid,
  agent_id      uuid references agents(id) on delete set null,
  agent_name    text,
  duration_ms   int not null default 0,
  cost_usd      real not null default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Indexing for performance
create index if not exists idx_agents_user on agents(user_id);
create index if not exists idx_agents_status on agents(status);
create index if not exists idx_agents_parent on agents(parent_id);
create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_tasks_agent on tasks(agent_id);
create index if not exists idx_tasks_status on tasks(status);

-- Enable RLS
alter table agents enable row level security;
alter table tasks enable row level security;

-- Restricted Isolation Policies
create policy "Owners can fully manage their own agents" 
on agents for all 
using (auth.uid() = user_id) 
with check (auth.uid() = user_id);

create policy "Owners can fully manage their own tasks" 
on tasks for all 
using (auth.uid() = user_id) 
with check (auth.uid() = user_id);
