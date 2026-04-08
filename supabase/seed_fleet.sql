-- ============================================================
-- Seed: Fleet Operations dev data (agents + tasks + activity_log)
-- Run AFTER migration 002 and AFTER creating a user.
--
-- Usage:
--   1. Replace 'YOUR_USER_UUID' with your auth.users UUID
--   2. Run in the Supabase SQL editor
-- ============================================================

\set uid '''YOUR_USER_UUID'''

-- ── Agents ───────────────────────────────────────────────────────

INSERT INTO agents (id, user_id, name, model, status, role, parent_id, can_spawn, spawn_pattern,
  task_completion, token_burn, latency_ms, color, temperature, response_length, system_prompt,
  skills, subagents, total_tokens, total_cost, success_rate, task_count,
  uptime_ms, last_heartbeat, restart_count, error_message, error_stack, last_restart,
  token_history_24h, latency_history_24h)
VALUES
  ('a1', :uid::uuid, 'Atlas', 'claude-opus-4-6', 'processing', 'commander', NULL, true, 'fan-out',
   78, '{120,145,132,167,154,189,201,178,195,210,185,220}', 340, '#00D9C8', 0.1, 'medium',
   'You are Atlas, the Commander agent. Delegate research tasks to sub-agents, synthesize results, and report to the user.',
   '{sk1,sk2,sk3,sk4,sk6}', '{a2,a3,a4,a5}', 24800, 1.86, 96, 12,
   3720000, now() - interval '2 seconds', 0, NULL, NULL, NULL,
   '{820,940,1100,1020,890,760,1200,1340,1180,950,1040,1260,1380,1150,980,1070,1290,1410,1200,1050,940,1100,1320,1480}',
   '{310,325,340,330,345,360,340,320,335,350,340,355,370,345,330,340,360,380,350,340,325,340,355,370}'),

  ('a2', :uid::uuid, 'Orion', 'claude-sonnet-4-6', 'idle', 'researcher', 'a1', false, 'sequential',
   100, '{80,90,85,110,95,100,88,92,87,95,91,98}', 820, '#60a5fa', 0.7, 'long',
   'You are Orion, a research agent. Perform deep analysis on assigned topics.',
   '{sk1,sk4,sk5}', '{}', 8200, 0.12, 100, 5,
   3420000, now() - interval '5 seconds', 0, NULL, NULL, NULL,
   '{320,410,380,350,290,0,0,0,420,480,510,390,340,0,0,0,360,440,470,400,350,0,0,0}',
   '{780,800,820,810,830,0,0,0,790,810,840,820,800,0,0,0,810,830,850,820,810,0,0,0}'),

  ('a3', :uid::uuid, 'Vega', 'gemini-3.1', 'processing', 'ui-agent', 'a1', false, 'sequential',
   42, '{200,210,195,230,245,220,235,250,240,260,255,270}', 290, '#a78bfa', 1.2, 'medium',
   'You are Vega, a UI specialist agent using Gemini 3.1.',
   '{sk2,sk3,sk7,sk8}', '{}', 18400, 0.37, 88, 8,
   2880000, now() - interval '4 seconds', 1, NULL, NULL, now() - interval '40 minutes',
   '{680,720,760,810,740,690,780,830,870,750,700,760,820,860,790,730,770,840,890,810,740,690,780,850}',
   '{260,270,280,290,285,275,290,300,310,295,280,290,300,310,295,285,290,305,315,300,290,275,285,300}'),

  ('a4', :uid::uuid, 'Lyra', 'hermes-agent', 'error', 'researcher', 'a1', false, 'sequential',
   15, '{50,60,55,40,0,0,0,0,0,0,0,0}', 4200, '#fb7185', 0.7, 'short',
   'You are Lyra, a lightweight research agent.',
   '{sk1,sk4}', '{}', 1200, 0.00, 40, 5,
   0, now() - interval '120 seconds', 3,
   'OOMKilled — memory limit exceeded (512MB limit, 743MB peak)',
   'Container lyra-agent-worker-02 killed by OOM at vector embedding batch (1204 chunks). Last healthy heartbeat 09:05:22. Recovery attempts: 3/3 exhausted.',
   now() - interval '120 seconds',
   '{180,210,190,160,140,120,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0}',
   '{1200,1800,2400,3100,3800,4200,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0}'),

  ('a5', :uid::uuid, 'Nova', 'claude-sonnet-4-6', 'processing', 'qa', 'a1', false, 'sequential',
   92, '{100,120,110,130,125,140,135,150,145,160,155,170}', 410, '#a78bfa', 0.1, 'medium',
   'You are Nova, the QA agent. Review all outputs for accuracy and quality.',
   '{sk2,sk3,sk5}', '{}', 6100, 0.09, 98, 6,
   3600000, now() - interval '3 seconds', 0, NULL, NULL, NULL,
   '{240,280,310,290,260,230,270,320,340,300,270,250,290,330,350,310,280,260,300,340,360,320,290,270}',
   '{390,400,410,405,415,420,410,395,405,415,410,420,430,415,400,410,425,435,420,410,400,405,420,430}'),

  ('a6', :uid::uuid, 'Sol', 'llama3:70b', 'idle', 'researcher', NULL, false, 'sequential',
   10, '{10,20,15,25,20,30,25,35,30,40,35,45}', 650, '#60a5fa', 0.7, 'medium',
   'You are Sol, a local research agent running on Ollama.',
   '{sk2,sk3}', '{}', 3400, 0.00, 85, 4,
   1200000, now() - interval '10 seconds', 0, NULL, NULL, NULL,
   '{90,110,130,120,100,80,0,0,0,0,140,160,150,130,110,90,0,0,0,0,120,140,130,110}',
   '{620,640,660,650,640,630,0,0,0,0,650,670,680,660,640,630,0,0,0,0,640,660,650,640}')
ON CONFLICT (id) DO NOTHING;

-- ── Tasks ────────────────────────────────────────────────────────

INSERT INTO tasks (id, user_id, name, status, parent_id, agent_id, agent_name, duration_ms, cost_usd)
VALUES
  ('t1', :uid::uuid, 'Scrape Sites',   'completed', NULL, 'a1', 'Atlas', 890,  0.12),
  ('t2', :uid::uuid, 'Parse Results',  'completed', 't1', 'a1', 'Atlas', 620,  0.08),
  ('t3', :uid::uuid, 'Send iMessage',  'completed', 't2', 'a1', 'Atlas', 210,  0.02),
  ('t4', :uid::uuid, 'Wait for Reply', 'running',   't3', 'a1', 'Atlas', 4200, 0.00),
  ('t5', :uid::uuid, 'Enter Lottery',  'pending',   't4', 'a1', 'Atlas', 0,    0.00)
ON CONFLICT (id) DO NOTHING;

-- ── Activity Log ─────────────────────────────────────────────────

INSERT INTO activity_log (user_id, timestamp, type, message, agent_id, parent_log_id, tokens, duration_ms)
VALUES
  (:uid::uuid, now() - interval '5 min',       'SYS', 'Atlas context loaded — 4096 tokens',              'a1', NULL, 4096, 0),
  (:uid::uuid, now() - interval '4 min 58 sec','NET', 'Connecting to lottery.broadwaydirect.com',        'a1', NULL, 0,    890),
  (:uid::uuid, now() - interval '4 min 57 sec','OK',  'Firecrawl scrape complete — 3 shows found',       'a1', NULL, 340,  620),
  (:uid::uuid, now() - interval '4 min 54 sec','OK',  'iMessage sent to +1 (201) 555-0147',             'a1', NULL, 0,    210),
  (:uid::uuid, now() - interval '4 min 52 sec','SYS', 'Polling for reply — timeout 11:00 AM',           'a1', NULL, 0,    0),
  (:uid::uuid, now() - interval '4 min 50 sec','NET', 'Connecting to my.socialtoaster.com',              'a3', NULL, 0,    740),
  (:uid::uuid, now() - interval '4 min 47 sec','ERR', 'OOMKilled — memory limit exceeded',              'a4', NULL, 0,    0),
  (:uid::uuid, now() - interval '4 min 46 sec','SYS', 'Awaiting intervention — agent paused',           'a4', NULL, 0,    0),
  (:uid::uuid, now() - interval '4 min 11 sec','OK',  'Q3 analysis complete — $0.84',                   'a2', NULL, 1240, 3200),
  (:uid::uuid, now() - interval '4 min',       'NET', 'DB sync complete — 1204 vectors',                'a1', NULL, 0,    450),
  (:uid::uuid, now() - interval '3 min 54 sec','OK',  'Login session established',                       'a3', NULL, 0,    980),
  (:uid::uuid, now() - interval '3 min 50 sec','SYS', 'Rate limit: 85% on claude-opus-4-6',             NULL, NULL, 0,    0),
  (:uid::uuid, now() - interval '3 min 42 sec','NET', 'Fetching luckyseat.com/shows',                   'a1', NULL, 0,    340),
  (:uid::uuid, now() - interval '3 min 37 sec','OK',  'Playwright: Cookie banner dismissed',             'a3', NULL, 0,    120),
  (:uid::uuid, now() - interval '3 min 32 sec','OK',  'Lottery form submitted — Hamilton',               'a1', NULL, 0,    280),
  (:uid::uuid, now() - interval '3 min 30 sec','OK',  'Lottery form submitted — Wicked',                 'a1', NULL, 0,    310),
  (:uid::uuid, now() - interval '3 min 22 sec','SYS', 'Total cost this session: $4.83',                 NULL, NULL, 0,    0),
  (:uid::uuid, now() - interval '3 min 17 sec','OK',  'Confirmation iMessage sent to both recipients',  'a1', NULL, 0,    150),
  (:uid::uuid, now() - interval '3 min 11 sec','OK',  'Output review started — checking 3 results',     'a5', NULL, 820,  1800),
  (:uid::uuid, now() - interval '3 min 2 sec', 'OK',  'QA pass — all results verified, no anomalies',  'a5', NULL, 340,  900);
