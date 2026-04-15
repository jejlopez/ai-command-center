-- Contract intelligence — rate optimization, negotiation tracking

create table if not exists rate_history (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proposal_id uuid references proposals(id),
  deal_id     uuid references deals(id),
  rate_category text not null,     -- storage, receiving, outbound, etc.
  rate_key    text not null,       -- e.g. 'standard_40x48x60'
  rate_value  real not null,
  outcome     text,                -- won, lost, pending
  volume      int,                 -- estimated volume at this rate
  created_at  timestamptz default now()
);
alter table rate_history enable row level security;
create policy "rate_history_owner" on rate_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists negotiation_log (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proposal_id   uuid references proposals(id),
  deal_id       uuid references deals(id),
  original_rate real not null,
  requested_rate real,
  final_rate    real,
  rate_category text not null,
  concession_pct real,            -- how much % was conceded
  notes         text,
  created_at    timestamptz default now()
);
alter table negotiation_log enable row level security;
create policy "negotiation_log_owner" on negotiation_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rate floor configuration + renewal tracking
alter table proposals add column if not exists rate_floor jsonb default '{}';
alter table proposals add column if not exists volume_tiers jsonb default '[]';
alter table proposals add column if not exists renewal_of uuid references proposals(id);
alter table proposals add column if not exists margin_estimate real;
alter table proposals add column if not exists client_phone text;
alter table proposals add column if not exists business_address text;
alter table proposals add column if not exists accounting_contact jsonb default '{}';
