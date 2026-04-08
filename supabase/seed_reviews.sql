-- ============================================================
-- Seed: Review Room dev data
-- Run AFTER migration 001 and AFTER creating a user.
--
-- Usage:
--   1. Sign up or create a user in Supabase Auth
--   2. Copy the user's UUID from auth.users
--   3. Replace 'YOUR_USER_UUID' below with the real UUID
--   4. Run this in the Supabase SQL editor
-- ============================================================

-- Replace this with your actual auth.users UUID:
\set uid '''YOUR_USER_UUID'''

INSERT INTO pending_reviews (id, user_id, agent_id, agent_name, urgency, title, output_type, status, summary, payload, waiting_since)
VALUES
  ('rv1', :uid::uuid, 'a3', 'Vega', 'high', 'Navigation Component', 'code', 'awaiting_approval',
   'Generated animated sidebar navigation with route transitions',
   E'import React, { useState } from ''react'';\nimport { motion } from ''framer-motion'';\n\nexport function Navigation() {\n  const [expanded, setExpanded] = useState(false);\n  return (\n    <motion.nav animate={{ width: expanded ? 240 : 80 }} className="h-screen bg-black border-r border-white/10">\n      <button onClick={() => setExpanded(!expanded)}>\n        {expanded ? ''←'' : ''→''}\n      </button>\n    </motion.nav>\n  );\n}',
   now() - interval '3 minutes'),

  ('rv2', :uid::uuid, 'a4', 'Lyra', 'critical', 'Agent Crashed — OOMKilled', 'error', 'needs_intervention',
   'Lyra exceeded memory limit during data processing. Agent paused — needs restart or reallocation.',
   E'ERROR: OOMKilled — memory limit exceeded\nContainer: lyra-agent-worker-02\nMemory limit: 512MB | Peak usage: 743MB\nLast operation: Vector embedding batch (1204 chunks)\n\nRecommended actions:\n  1. Increase memory limit to 1024MB\n  2. Reduce batch size from 1204 to 500\n  3. Reassign task to a larger instance (Sol)',
   now() - interval '7 minutes'),

  ('rv3', :uid::uuid, 'a5', 'Nova', 'normal', 'QA Report — Broadway Lottery Run', 'report', 'awaiting_approval',
   'Quality review of the lottery automation pipeline — all checks passed',
   E'# QA Report: Broadway Lottery Automation\n\n## Summary\nAll 3 lottery submissions completed successfully. No anomalies detected.\n\n## Result\n**PASS** — No issues found.',
   now() - interval '1 minute'),

  ('rv4', :uid::uuid, 'a1', 'Atlas', 'high', 'Send iMessage to Contacts', 'message', 'awaiting_approval',
   'Atlas wants to send lottery confirmation to 2 contacts via iMessage',
   E'To: +1 (201) 555-0147, +1 (917) 555-0382\nSubject: Broadway Lottery Results\n\nMessage:\n"Hey! Just submitted lottery entries for Hamilton, Wicked, and Dear Evan Hansen. Fingers crossed! 🎭"\n\nAttachments: None\nEstimated cost: $0.00',
   now() - interval '4 minutes'),

  ('rv5', :uid::uuid, 'a3', 'Vega', 'normal', 'Dashboard Card Component', 'code', 'awaiting_approval',
   'New reusable metric card with sparkline and trend indicator',
   E'export function MetricCard({ label, value, trend, data }) {\n  const isUp = trend > 0;\n  return (\n    <div className="spatial-panel p-4">\n      <span className="text-[10px] text-text-muted uppercase">{label}</span>\n      <div className="text-2xl font-mono font-bold">{value}</div>\n    </div>\n  );\n}',
   now() - interval '45 seconds'),

  ('rv6', :uid::uuid, 'a5', 'Nova', 'high', 'Data Integrity Warning', 'error', 'awaiting_approval',
   E'Nova detected 2 hallucinated URLs in Orion''s research output that don''t resolve',
   E'QA ALERT: Hallucination Detected\n\nAgent: Orion (a2)\nTask: Market competitor research\nSeverity: High\n\nFlagged items:\n  1. URL "https://api.competitor-x.com/v3/pricing" — DNS lookup failed\n  2. Citation "McKinsey Digital Report Q3 2026" — no matching publication\n\nRecommendation:\n  - Reject Orion''s output and re-run with stricter grounding directive',
   now() - interval '2 minutes')
ON CONFLICT (id) DO NOTHING;
