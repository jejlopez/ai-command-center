create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.tasks
  add column if not exists node_type text not null default 'mission',
  add column if not exists workflow_status text not null default 'intake',
  add column if not exists root_mission_id text,
  add column if not exists routing_policy_id uuid,
  add column if not exists routing_reason text,
  add column if not exists domain text not null default 'general',
  add column if not exists intent_type text not null default 'general',
  add column if not exists budget_class text not null default 'balanced',
  add column if not exists risk_level text not null default 'medium',
  add column if not exists context_pack_ids text[] not null default '{}',
  add column if not exists required_capabilities text[] not null default '{}',
  add column if not exists approval_level text not null default 'risk_weighted',
  add column if not exists depends_on text[] not null default '{}';

update public.tasks
set workflow_status = case
  when status = 'queued' then 'ready'
  when status = 'running' then 'running'
  when status = 'pending' then 'planned'
  when status = 'needs_approval' then 'waiting_on_human'
  when status in ('done', 'completed') then 'completed'
  when status in ('failed', 'error') then 'failed'
  when status = 'blocked' then 'blocked'
  when status = 'cancelled' then 'cancelled'
  else workflow_status
end
where workflow_status = 'intake';

update public.tasks
set root_mission_id = coalesce(root_mission_id, parent_id, id);

create index if not exists idx_tasks_root_mission_id on public.tasks(root_mission_id);
create index if not exists idx_tasks_workflow_status on public.tasks(workflow_status);
create index if not exists idx_tasks_domain_intent on public.tasks(domain, intent_type);
create index if not exists idx_tasks_routing_policy_id on public.tasks(routing_policy_id);

create table if not exists public.routing_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  task_domain text not null default 'general',
  intent_type text not null default 'general',
  risk_level text not null default 'medium',
  budget_class text not null default 'balanced',
  latency_class text not null default 'balanced',
  preferred_provider text,
  preferred_model text,
  preferred_agent_role text not null default 'commander',
  fallback_order jsonb not null default '[]'::jsonb,
  approval_rule text not null default 'risk_weighted',
  context_policy text not null default 'minimal',
  parallelization_policy text not null default 'adaptive',
  evidence_required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add constraint tasks_routing_policy_id_fkey
  foreign key (routing_policy_id)
  references public.routing_policies(id)
  on delete set null;

create unique index if not exists idx_routing_policies_user_default
  on public.routing_policies(user_id)
  where is_default = true;

create index if not exists idx_routing_policies_domain_intent
  on public.routing_policies(user_id, task_domain, intent_type, active);

alter table public.connected_systems
  add column if not exists domain text not null default 'general',
  add column if not exists trust_level text not null default 'standard',
  add column if not exists risk_level text not null default 'medium',
  add column if not exists permission_scope text[] not null default '{}';

update public.connected_systems
set
  domain = case
    when lower(category) like '%model%' then 'build'
    when lower(category) like '%backend%' then 'build'
    when lower(category) like '%crm%' then 'sell'
    when lower(category) like '%comm%' then 'operate'
    when lower(category) like '%finance%' then 'money'
    when lower(category) like '%security%' then 'operate'
    else 'general'
  end,
  trust_level = case
    when lower(category) like '%security%' then 'high'
    when lower(category) like '%finance%' then 'high'
    else 'standard'
  end,
  risk_level = case
    when lower(category) like '%finance%' then 'high'
    when lower(category) like '%security%' then 'high'
    when lower(category) like '%crm%' then 'medium'
    else 'medium'
  end,
  permission_scope = case
    when array_length(capabilities, 1) is not null and array_length(capabilities, 1) > 0 then capabilities
    else '{}'::text[]
  end
where domain = 'general'
  and trust_level = 'standard'
  and risk_level = 'medium'
  and permission_scope = '{}'::text[];

alter table public.routing_policies enable row level security;

create policy "routing_policies_select_own"
  on public.routing_policies
  for select
  using (auth.uid() = user_id);

create policy "routing_policies_insert_own"
  on public.routing_policies
  for insert
  with check (auth.uid() = user_id);

create policy "routing_policies_update_own"
  on public.routing_policies
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "routing_policies_delete_own"
  on public.routing_policies
  for delete
  using (auth.uid() = user_id);

drop trigger if exists routing_policies_set_updated_at on public.routing_policies;
create trigger routing_policies_set_updated_at
before update on public.routing_policies
for each row execute function public.touch_updated_at();
