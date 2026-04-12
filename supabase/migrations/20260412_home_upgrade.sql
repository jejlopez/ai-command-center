create table if not exists vendors (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  category    text not null default 'general', -- plumber, electrician, landscaping, cleaning, etc
  phone       text,
  email       text,
  rating      int,                    -- 1-5
  cost_level  text,                   -- low, medium, high
  contract_end date,
  notes       text,
  created_at  timestamptz default now()
);
alter table vendors enable row level security;
create policy "vendors_owner" on vendors for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists home_decisions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  impact      text default 'medium',  -- low, medium, high
  estimated_cost real,
  status      text default 'pending', -- pending, decided, deferred
  decided_at  timestamptz,
  outcome     text,
  created_at  timestamptz default now()
);
alter table home_decisions enable row level security;
create policy "home_decisions_owner" on home_decisions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists home_assets (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  category    text default 'appliance', -- appliance, vehicle, electronics, furniture
  purchase_date date,
  purchase_price real,
  warranty_end date,
  replacement_date date,
  notes       text,
  created_at  timestamptz default now()
);
alter table home_assets enable row level security;
create policy "home_assets_owner" on home_assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table vendors;
alter publication supabase_realtime add table home_assets;
