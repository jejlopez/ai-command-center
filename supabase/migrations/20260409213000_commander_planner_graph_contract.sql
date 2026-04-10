alter table public.tasks
  add column if not exists agent_role text not null default 'executor',
  add column if not exists execution_strategy text not null default 'sequential',
  add column if not exists branch_label text,
  add column if not exists provider_override text,
  add column if not exists model_override text;

create index if not exists idx_tasks_agent_role on public.tasks(agent_role);
create index if not exists idx_tasks_execution_strategy on public.tasks(execution_strategy);
