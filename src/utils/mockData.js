// ── Model Registry ──────────────────────────────────────────────
export const modelRegistry = {
  cloud: [
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'Anthropic', costPer1k: 0.075 },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic', costPer1k: 0.015 },
    { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', costPer1k: 0.03 },
    { id: 'gemini-3.1', label: 'Gemini 3.1', provider: 'Google', costPer1k: 0.02 },
  ],
  local: [
    { id: 'llama3:70b', label: 'Llama 3 70B', provider: 'Ollama', costPer1k: 0 },
    { id: 'mistral', label: 'Mistral 7B', provider: 'Ollama', costPer1k: 0 },
    { id: 'deepseek-coder', label: 'DeepSeek Coder', provider: 'Ollama', costPer1k: 0 },
    { id: 'codellama', label: 'Code Llama', provider: 'Ollama', costPer1k: 0 },
  ],
  agents: [
    { id: 'hermes-agent', label: 'Hermes Agent', provider: 'Nous Research', costPer1k: 0 },
  ],
};

// ── Skill Bank (shared across agents) ───────────────────────────
export const skillBank = [
  { id: 'sk1', name: 'Web Scraper', description: 'Navigate DOMs, extract data, handle pagination', icon: 'Globe', source: 'built-in', enabled: true },
  { id: 'sk2', name: 'Code Interpreter', description: 'Execute Python/JS in a sandboxed runtime', icon: 'Terminal', source: 'built-in', enabled: true },
  { id: 'sk3', name: 'File Manager', description: 'Read, write, and organize local files', icon: 'FolderOpen', source: 'built-in', enabled: true },
  { id: 'sk4', name: 'API Caller', description: 'Make HTTP requests to external APIs', icon: 'Zap', source: 'built-in', enabled: true },
  { id: 'sk5', name: 'Vector Search', description: 'Query and store embeddings in vector DBs', icon: 'Database', source: 'github', url: 'https://github.com/example/vector-skill', enabled: true },
  { id: 'sk6', name: 'iMessage Bridge', description: 'Send and receive iMessages programmatically', icon: 'MessageSquare', source: 'local', path: '~/skills/imessage-bridge', enabled: true },
  { id: 'sk7', name: 'Browser Automation', description: 'Control Playwright for complex web interactions', icon: 'Monitor', source: 'github', url: 'https://github.com/example/playwright-skill', enabled: false },
  { id: 'sk8', name: 'Data Visualizer', description: 'Generate charts and visual reports from data', icon: 'BarChart3', source: 'built-in', enabled: false },
];

// ── MCP Servers ─────────────────────────────────────────────────
export const mcpServers = [
  { id: 'mcp1', url: 'localhost:3001', name: 'Local Dev Tools', status: 'connected', tools: 4 },
  { id: 'mcp2', url: 'mcp.example.com:8080', name: 'Production Gateway', status: 'disconnected', tools: 12 },
];

// ── Agents ──────────────────────────────────────────────────────
export const agents = [
  {
    id: 'a1', name: 'Atlas', model: 'claude-opus-4-6', status: 'processing',
    role: 'commander', parentId: null, canSpawn: true, spawnPattern: 'fan-out',
    taskCompletion: 78, tokenBurn: [120, 145, 132, 167, 154, 189, 201, 178, 195, 210, 185, 220],
    latencyMs: 340, color: '#00D9C8',
    temperature: 0.1, responseLength: 'medium',
    systemPrompt: 'You are Atlas, the Commander agent. Delegate research tasks to sub-agents, synthesize results, and report to the user. Prioritize accuracy over speed.',
    skills: ['sk1', 'sk2', 'sk3', 'sk4', 'sk6'],
    subagents: ['a2', 'a3', 'a4', 'a5'],
    totalTokens: 24800, totalCost: 1.86, successRate: 96, taskCount: 12,
    // Health fields
    uptimeMs: 3_720_000, lastHeartbeat: '09:07:58', restartCount: 0,
    errorMessage: null, errorStack: null, lastRestart: null,
    tokenHistory24h: [820,940,1100,1020,890,760,1200,1340,1180,950,1040,1260,1380,1150,980,1070,1290,1410,1200,1050,940,1100,1320,1480],
    latencyHistory24h: [310,325,340,330,345,360,340,320,335,350,340,355,370,345,330,340,360,380,350,340,325,340,355,370],
  },
  {
    id: 'a2', name: 'Orion', model: 'claude-sonnet-4-6', status: 'idle',
    role: 'researcher', parentId: 'a1', canSpawn: false, spawnPattern: 'sequential',
    taskCompletion: 100, tokenBurn: [80, 90, 85, 110, 95, 100, 88, 92, 87, 95, 91, 98],
    latencyMs: 820, color: '#60a5fa',
    temperature: 0.7, responseLength: 'long',
    systemPrompt: 'You are Orion, a research agent. Perform deep analysis on assigned topics and return structured findings to the Commander.',
    skills: ['sk1', 'sk4', 'sk5'],
    subagents: [],
    totalTokens: 8200, totalCost: 0.12, successRate: 100, taskCount: 5,
    uptimeMs: 3_420_000, lastHeartbeat: '09:07:55', restartCount: 0,
    errorMessage: null, errorStack: null, lastRestart: null,
    tokenHistory24h: [320,410,380,350,290,0,0,0,420,480,510,390,340,0,0,0,360,440,470,400,350,0,0,0],
    latencyHistory24h: [780,800,820,810,830,0,0,0,790,810,840,820,800,0,0,0,810,830,850,820,810,0,0,0],
  },
  {
    id: 'a3', name: 'Vega', model: 'gemini-3.1', status: 'processing',
    role: 'ui-agent', parentId: 'a1', canSpawn: false, spawnPattern: 'sequential',
    taskCompletion: 42, tokenBurn: [200, 210, 195, 230, 245, 220, 235, 250, 240, 260, 255, 270],
    latencyMs: 290, color: '#a78bfa',
    temperature: 1.2, responseLength: 'medium',
    systemPrompt: 'You are Vega, a UI specialist agent using Gemini 3.1. Build and refine frontend components with pixel-perfect attention to detail.',
    skills: ['sk2', 'sk3', 'sk7', 'sk8'],
    subagents: [],
    totalTokens: 18400, totalCost: 0.37, successRate: 88, taskCount: 8,
    uptimeMs: 2_880_000, lastHeartbeat: '09:07:56', restartCount: 1,
    errorMessage: null, errorStack: null, lastRestart: '08:22:00',
    tokenHistory24h: [680,720,760,810,740,690,780,830,870,750,700,760,820,860,790,730,770,840,890,810,740,690,780,850],
    latencyHistory24h: [260,270,280,290,285,275,290,300,310,295,280,290,300,310,295,285,290,305,315,300,290,275,285,300],
  },
  {
    id: 'a4', name: 'Lyra', model: 'hermes-agent', status: 'error',
    role: 'researcher', parentId: 'a1', canSpawn: false, spawnPattern: 'sequential',
    taskCompletion: 15, tokenBurn: [50, 60, 55, 40, 0, 0, 0, 0, 0, 0, 0, 0],
    latencyMs: 4200, color: '#fb7185',
    temperature: 0.7, responseLength: 'short',
    systemPrompt: 'You are Lyra, a lightweight research agent. Handle quick lookups and data validation tasks.',
    skills: ['sk1', 'sk4'],
    subagents: [],
    totalTokens: 1200, totalCost: 0.00, successRate: 40, taskCount: 5,
    uptimeMs: 0, lastHeartbeat: '09:05:25', restartCount: 3,
    errorMessage: 'OOMKilled — memory limit exceeded (512MB limit, 743MB peak)',
    errorStack: 'Container lyra-agent-worker-02 killed by OOM at vector embedding batch (1204 chunks). Last healthy heartbeat 09:05:22. Recovery attempts: 3/3 exhausted.',
    lastRestart: '09:05:25',
    tokenHistory24h: [180,210,190,160,140,120,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    latencyHistory24h: [1200,1800,2400,3100,3800,4200,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  },
  {
    id: 'a5', name: 'Nova', model: 'claude-sonnet-4-6', status: 'processing',
    role: 'qa', parentId: 'a1', canSpawn: false, spawnPattern: 'sequential',
    taskCompletion: 92, tokenBurn: [100, 120, 110, 130, 125, 140, 135, 150, 145, 160, 155, 170],
    latencyMs: 410, color: '#a78bfa',
    temperature: 0.1, responseLength: 'medium',
    systemPrompt: 'You are Nova, the QA agent. Review all outputs from other agents for accuracy, completeness, and quality before they reach the user.',
    skills: ['sk2', 'sk3', 'sk5'],
    subagents: [],
    totalTokens: 6100, totalCost: 0.09, successRate: 98, taskCount: 6,
    uptimeMs: 3_600_000, lastHeartbeat: '09:07:57', restartCount: 0,
    errorMessage: null, errorStack: null, lastRestart: null,
    tokenHistory24h: [240,280,310,290,260,230,270,320,340,300,270,250,290,330,350,310,280,260,300,340,360,320,290,270],
    latencyHistory24h: [390,400,410,405,415,420,410,395,405,415,410,420,430,415,400,410,425,435,420,410,400,405,420,430],
  },
  {
    id: 'a6', name: 'Sol', model: 'llama3:70b', status: 'idle',
    role: 'researcher', parentId: null, canSpawn: false, spawnPattern: 'sequential',
    taskCompletion: 10, tokenBurn: [10, 20, 15, 25, 20, 30, 25, 35, 30, 40, 35, 45],
    latencyMs: 650, color: '#60a5fa',
    temperature: 0.7, responseLength: 'medium',
    systemPrompt: 'You are Sol, a local research agent running on Ollama. Handle data processing tasks that require privacy.',
    skills: ['sk2', 'sk3'],
    subagents: [],
    totalTokens: 3400, totalCost: 0.00, successRate: 85, taskCount: 4,
    uptimeMs: 1_200_000, lastHeartbeat: '09:07:50', restartCount: 0,
    errorMessage: null, errorStack: null, lastRestart: null,
    tokenHistory24h: [90,110,130,120,100,80,0,0,0,0,140,160,150,130,110,90,0,0,0,0,120,140,130,110],
    latencyHistory24h: [620,640,660,650,640,630,0,0,0,0,650,670,680,660,640,630,0,0,0,0,640,660,650,640],
  },
];

// ── Activity Log ────────────────────────────────────────────────
export const activityLog = [
  { id: 1,  timestamp: '09:05:12', type: 'SYS', message: 'Atlas context loaded — 4096 tokens', agentId: 'a1', parentLogId: null, tokens: 4096, durationMs: 0 },
  { id: 2,  timestamp: '09:05:14', type: 'NET', message: 'Connecting to lottery.broadwaydirect.com', agentId: 'a1', parentLogId: 1, tokens: 0, durationMs: 890 },
  { id: 3,  timestamp: '09:05:15', type: 'OK',  message: 'Firecrawl scrape complete — 3 shows found', agentId: 'a1', parentLogId: 2, tokens: 340, durationMs: 620 },
  { id: 4,  timestamp: '09:05:18', type: 'OK',  message: 'iMessage sent to +1 (201) 555-0147', agentId: 'a1', parentLogId: 3, tokens: 0, durationMs: 210 },
  { id: 5,  timestamp: '09:05:20', type: 'SYS', message: 'Polling for reply — timeout 11:00 AM', agentId: 'a1', parentLogId: null, tokens: 0, durationMs: 0 },
  { id: 6,  timestamp: '09:05:22', type: 'NET', message: 'Connecting to my.socialtoaster.com', agentId: 'a3', parentLogId: null, tokens: 0, durationMs: 740 },
  { id: 7,  timestamp: '09:05:25', type: 'ERR', message: 'OOMKilled — memory limit exceeded', agentId: 'a4', parentLogId: null, tokens: 0, durationMs: 0 },
  { id: 8,  timestamp: '09:05:26', type: 'SYS', message: 'Awaiting intervention — agent paused', agentId: 'a4', parentLogId: 7, tokens: 0, durationMs: 0 },
  { id: 9,  timestamp: '09:06:01', type: 'OK',  message: 'Q3 analysis complete — $0.84', agentId: 'a2', parentLogId: null, tokens: 1240, durationMs: 3200 },
  { id: 10, timestamp: '09:06:12', type: 'NET', message: 'DB sync complete — 1204 vectors', agentId: 'a1', parentLogId: null, tokens: 0, durationMs: 450 },
  { id: 11, timestamp: '09:06:18', type: 'OK',  message: 'Login session established', agentId: 'a3', parentLogId: 6, tokens: 0, durationMs: 980 },
  { id: 12, timestamp: '09:06:22', type: 'SYS', message: 'Rate limit: 85% on claude-opus-4-6', agentId: null, parentLogId: null, tokens: 0, durationMs: 0 },
  { id: 13, timestamp: '09:06:30', type: 'NET', message: 'Fetching luckyseat.com/shows', agentId: 'a1', parentLogId: null, tokens: 0, durationMs: 340 },
  { id: 14, timestamp: '09:06:35', type: 'OK',  message: 'Playwright: Cookie banner dismissed', agentId: 'a3', parentLogId: 11, tokens: 0, durationMs: 120 },
  { id: 15, timestamp: '09:06:40', type: 'OK',  message: 'Lottery form submitted — Hamilton', agentId: 'a1', parentLogId: 13, tokens: 0, durationMs: 280 },
  { id: 16, timestamp: '09:06:42', type: 'OK',  message: 'Lottery form submitted — Wicked', agentId: 'a1', parentLogId: 13, tokens: 0, durationMs: 310 },
  { id: 17, timestamp: '09:06:50', type: 'SYS', message: 'Total cost this session: $4.83', agentId: null, parentLogId: null, tokens: 0, durationMs: 0 },
  { id: 18, timestamp: '09:06:55', type: 'OK',  message: 'Confirmation iMessage sent to both recipients', agentId: 'a1', parentLogId: null, tokens: 0, durationMs: 150 },
  { id: 19, timestamp: '09:07:01', type: 'OK',  message: 'Output review started — checking 3 results', agentId: 'a5', parentLogId: null, tokens: 820, durationMs: 1800 },
  { id: 20, timestamp: '09:07:10', type: 'OK',  message: 'QA pass — all results verified, no anomalies', agentId: 'a5', parentLogId: 19, tokens: 340, durationMs: 900 },
];

// ── Execution Spans (for trace waterfall) ───────────────────────
export const mockSpans = [
  { id: 's1', name: 'Broadway Lottery Run', type: 'agent',     startMs: 0,    durationMs: 4200, parentId: null, model: 'claude-opus-4-6', tokens: 1240, status: 'success' },
  { id: 's2', name: 'Scrape broadwaydirect', type: 'tool',     startMs: 80,   durationMs: 890,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's3', name: 'Parse show list',       type: 'llm',      startMs: 970,  durationMs: 620,  parentId: 's1', model: 'claude-opus-4-6', tokens: 340,  status: 'success' },
  { id: 's4', name: 'Scrape luckyseat',      type: 'tool',     startMs: 1590, durationMs: 740,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's5', name: 'Enter Hamilton lottery', type: 'tool',     startMs: 2330, durationMs: 980,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's6', name: 'Confirm via iMessage',  type: 'tool',     startMs: 3310, durationMs: 210,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
];

// ── Tasks (DAG) ─────────────────────────────────────────────────
export const tasks = [
  { id: 't1', name: 'Scrape Sites',    status: 'completed', parentId: null, agentName: 'Atlas', agentId: 'a1', durationMs: 890,  costUsd: 0.12 },
  { id: 't2', name: 'Parse Results',   status: 'completed', parentId: 't1', agentName: 'Atlas', agentId: 'a1', durationMs: 620,  costUsd: 0.08 },
  { id: 't3', name: 'Send iMessage',   status: 'completed', parentId: 't2', agentName: 'Atlas', agentId: 'a1', durationMs: 210,  costUsd: 0.02 },
  { id: 't4', name: 'Wait for Reply',  status: 'running',   parentId: 't3', agentName: 'Atlas', agentId: 'a1', durationMs: 4200, costUsd: 0.00 },
  { id: 't5', name: 'Enter Lottery',   status: 'pending',   parentId: 't4', agentName: 'Atlas', agentId: 'a1', durationMs: 0,    costUsd: 0.00 },
];

// ── Memory Chunks ───────────────────────────────────────────────
export const memoryChunks = Array.from({ length: 36 }, (_, i) => ({
  key: `mem_chunk_${i.toString().padStart(2, '0')}`,
  recency: i < 12 ? 'recent' : i < 24 ? 'medium' : 'old',
  lastAccessed: new Date(Date.now() - i * 180000).toISOString(),
}));

// ── Cost Data ───────────────────────────────────────────────────
export const costData = {
  total: 4.83,
  burnRate: 0.42,
  models: [
    { name: 'Claude',  cost: 2.91, percentage: 60 },
    { name: 'GPT-4o',  cost: 1.45, percentage: 30 },
    { name: 'Gemini',  cost: 0.47, percentage: 10 },
  ],
};

// ── Health Metrics ──────────────────────────────────────────────
export const healthMetrics = [
  { label: 'CPU', value: 72, color: '#00D9C8', history24h: [45,48,52,58,62,65,60,55,58,63,68,72,70,68,65,62,67,71,74,72,70,68,70,72] },
  { label: 'MEM', value: 58, color: '#a78bfa', history24h: [32,34,36,38,40,42,44,46,48,50,52,54,55,56,55,54,56,57,58,58,57,56,57,58] },
  { label: 'API', value: 94, color: '#60a5fa', history24h: [99,98,97,96,95,94,93,92,91,90,92,94,95,96,97,98,96,95,94,93,94,95,94,94] },
];

// ── Pending Reviews & Outputs ───────────────────────────────────
export const pendingReviews = [
  {
    id: 'rv1', agentId: 'a3', agentName: 'Vega', urgency: 'high',
    title: 'Navigation Component', outputType: 'code',
    status: 'awaiting_approval', createdAt: '09:07:30', waitingMs: 180000,
    summary: 'Generated animated sidebar navigation with route transitions',
    payload: `import React, { useState } from 'react';
import { motion } from 'framer-motion';

export function Navigation() {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.nav
      animate={{ width: expanded ? 240 : 80 }}
      className="h-screen bg-black border-r border-white/10"
    >
      <button onClick={() => setExpanded(!expanded)}>
        {expanded ? '←' : '→'}
      </button>
      {/* Route links rendered here */}
    </motion.nav>
  );
}`,
  },
  {
    id: 'rv2', agentId: 'a4', agentName: 'Lyra', urgency: 'critical',
    title: 'Agent Crashed — OOMKilled', outputType: 'error',
    status: 'needs_intervention', createdAt: '09:05:25', waitingMs: 420000,
    summary: 'Lyra exceeded memory limit during data processing. Agent paused — needs restart or reallocation.',
    payload: `ERROR: OOMKilled — memory limit exceeded
Container: lyra-agent-worker-02
Memory limit: 512MB | Peak usage: 743MB
Last operation: Vector embedding batch (1204 chunks)

Recommended actions:
  1. Increase memory limit to 1024MB
  2. Reduce batch size from 1204 to 500
  3. Reassign task to a larger instance (Sol)`,
  },
  {
    id: 'rv3', agentId: 'a5', agentName: 'Nova', urgency: 'normal',
    title: 'QA Report — Broadway Lottery Run', outputType: 'report',
    status: 'awaiting_approval', createdAt: '09:07:10', waitingMs: 60000,
    summary: 'Quality review of the lottery automation pipeline — all checks passed',
    payload: `# QA Report: Broadway Lottery Automation

## Summary
All 3 lottery submissions completed successfully. No anomalies detected.

## Checks Performed
- **Form Validation**: All required fields populated correctly
- **Submission Confirmation**: Received confirmation IDs for Hamilton, Wicked, and Dear Evan Hansen
- **iMessage Delivery**: Confirmation messages sent to both recipients
- **Cost Check**: Total session cost $4.83 — within budget

## Result
**PASS** — No issues found. Safe to mark pipeline as complete.`,
  },
  {
    id: 'rv4', agentId: 'a1', agentName: 'Atlas', urgency: 'high',
    title: 'Send iMessage to Contacts', outputType: 'message',
    status: 'awaiting_approval', createdAt: '09:06:55', waitingMs: 240000,
    summary: 'Atlas wants to send lottery confirmation to 2 contacts via iMessage',
    payload: `To: +1 (201) 555-0147, +1 (917) 555-0382
Subject: Broadway Lottery Results

Message:
"Hey! Just submitted lottery entries for Hamilton, Wicked, and Dear Evan Hansen for tonight's shows. I'll let you know if we win any. Fingers crossed! 🎭"

Attachments: None
Estimated cost: $0.00`,
  },
  {
    id: 'rv5', agentId: 'a3', agentName: 'Vega', urgency: 'normal',
    title: 'Dashboard Card Component', outputType: 'code',
    status: 'awaiting_approval', createdAt: '09:08:05', waitingMs: 45000,
    summary: 'New reusable metric card with sparkline and trend indicator',
    payload: `export function MetricCard({ label, value, trend, data }) {
  const isUp = trend > 0;
  return (
    <div className="spatial-panel p-4">
      <span className="text-[10px] text-text-muted uppercase">{label}</span>
      <div className="text-2xl font-mono font-bold">{value}</div>
      <div className={\`text-xs \${isUp ? 'text-aurora-green' : 'text-aurora-rose'}\`}>
        {isUp ? '+' : ''}{trend}%
      </div>
    </div>
  );
}`,
  },
  {
    id: 'rv6', agentId: 'a5', agentName: 'Nova', urgency: 'high',
    title: 'Data Integrity Warning', outputType: 'error',
    status: 'awaiting_approval', createdAt: '09:07:45', waitingMs: 120000,
    summary: 'Nova detected 2 hallucinated URLs in Orion\'s research output that don\'t resolve',
    payload: `QA ALERT: Hallucination Detected

Agent: Orion (a2)
Task: Market competitor research
Severity: High

Flagged items:
  1. URL "https://api.competitor-x.com/v3/pricing" — DNS lookup failed, domain does not exist
  2. Citation "McKinsey Digital Report Q3 2026" — no matching publication found in source database

Recommendation:
  - Reject Orion's output and re-run with stricter grounding directive
  - Consider adding URL validation to Orion's tool chain`,
  },
];

export const completedOutputs = [
  {
    id: 'out1', agentId: 'a1', agentName: 'Atlas', outputType: 'data',
    title: 'Broadway Show Scrape Results', completedAt: '09:05:15',
    summary: 'Scraped 3 active lottery shows from broadwaydirect.com',
    payload: `[
  { "show": "Hamilton", "venue": "Richard Rodgers", "date": "2026-04-07", "status": "open" },
  { "show": "Wicked", "venue": "Gershwin Theatre", "date": "2026-04-07", "status": "open" },
  { "show": "Dear Evan Hansen", "venue": "Music Box", "date": "2026-04-07", "status": "open" }
]`,
  },
  {
    id: 'out2', agentId: 'a2', agentName: 'Orion', outputType: 'report',
    title: 'Q3 Cost Analysis', completedAt: '09:06:01',
    summary: 'Quarterly analysis of API spend across all models — $0.84 total',
    payload: `# Q3 API Cost Analysis

## Totals
- Claude Opus: $0.52 (62%)
- Claude Sonnet: $0.18 (21%)
- Gemini 3.1: $0.14 (17%)

## Trend
Costs decreased 12% from Q2 due to Sonnet migration for research tasks.

## Recommendation
Continue routing research to Sonnet. Reserve Opus for planning and complex synthesis only.`,
  },
];

// ── Approval Audit Trail ───────────────────────────────────────
export const approvalAuditTrail = [
  {
    id: 'aud1', reviewId: 'out1', action: 'approved', decidedBy: 'user',
    decidedAt: '09:05:18', feedback: null,
    agentId: 'a1', agentName: 'Atlas', title: 'Broadway Show Scrape Results',
  },
  {
    id: 'aud2', reviewId: 'out2', action: 'approved', decidedBy: 'user',
    decidedAt: '09:06:05', feedback: null,
    agentId: 'a2', agentName: 'Orion', title: 'Q3 Cost Analysis',
  },
  {
    id: 'aud3', reviewId: 'rv-old1', action: 'rejected', decidedBy: 'user',
    decidedAt: '08:55:30', feedback: 'Reduce batch size to 500 and retry with Sol instead',
    agentId: 'a4', agentName: 'Lyra', title: 'Vector Embedding Batch',
  },
  {
    id: 'aud4', reviewId: 'rv-old2', action: 'approved', decidedBy: 'auto',
    decidedAt: '08:48:12', feedback: null,
    agentId: 'a5', agentName: 'Nova', title: 'QA Pass — Data Pipeline Test',
  },
  {
    id: 'aud5', reviewId: 'rv-old3', action: 'rejected', decidedBy: 'user',
    decidedAt: '08:40:00', feedback: 'Output format doesn\'t match directive d3 — needs structured JSON',
    agentId: 'a2', agentName: 'Orion', title: 'Competitor Pricing Data',
  },
];

// ── Knowledge Namespaces (for Intelligence view) ───────────────
export const knowledgeNamespaces = [
  { id: 'ns1', name: 'intel-market', vectors: 28400, size: '4.8 GB', lastSync: '2 min ago', status: 'active', agents: ['Atlas', 'Orion'], description: 'Market intelligence, pricing data, competitor analysis' },
  { id: 'ns2', name: 'identity', vectors: 12800, size: '2.1 GB', lastSync: '1 hr ago', status: 'active', agents: ['Atlas'], description: 'User sessions, auth tokens, access control' },
  { id: 'ns3', name: 'system-config', vectors: 8900, size: '1.4 GB', lastSync: '3 hrs ago', status: 'active', agents: ['Atlas', 'Nova'], description: 'System prompts, agent configs, override rules' },
  { id: 'ns4', name: 'code-context', vectors: 18200, size: '3.2 GB', lastSync: '15 min ago', status: 'active', agents: ['Vega', 'Nova'], description: 'Codebase embeddings, PR diffs, documentation' },
  { id: 'ns5', name: 'logs-archive', vectors: 15800, size: '2.7 GB', lastSync: '12 hrs ago', status: 'stale', agents: ['Nova'], description: 'Historical agent logs, crash dumps, diagnostics' },
];

// ── Directive Templates (shared instructions) ──────────────────
export const directiveTemplates = [
  { id: 'd1', name: 'Safety Guardrails', scope: 'all', appliedTo: ['Atlas', 'Orion', 'Vega', 'Lyra', 'Nova', 'Sol'], content: 'Never execute destructive operations without explicit user approval. Always confirm before sending messages, deleting files, or making purchases.', priority: 'critical', icon: 'ShieldCheck' },
  { id: 'd2', name: 'Cost Ceiling', scope: 'all', appliedTo: ['Atlas', 'Orion', 'Vega', 'Lyra', 'Nova', 'Sol'], content: 'Halt execution and alert user if cumulative session cost exceeds $10.00. Prefer cheaper models for research tasks.', priority: 'high', icon: 'DollarSign' },
  { id: 'd3', name: 'Output Format', scope: 'researchers', appliedTo: ['Orion', 'Lyra', 'Sol'], content: 'Return structured JSON for all data results. Include source URLs, confidence scores, and timestamps.', priority: 'normal', icon: 'FileJson' },
  { id: 'd4', name: 'QA Standards', scope: 'qa', appliedTo: ['Nova'], content: 'Verify all outputs against source data. Flag hallucinations, check math, validate URLs. Reject outputs with confidence below 85%.', priority: 'high', icon: 'CheckCircle' },
  { id: 'd5', name: 'Privacy Rules', scope: 'all', appliedTo: ['Atlas', 'Orion', 'Vega', 'Lyra', 'Nova', 'Sol'], content: 'Never log PII to external services. Use local models for any task involving personal data. Redact sensitive info from reports.', priority: 'critical', icon: 'Lock' },
];

// ── Model Performance Benchmarks ───────────────────────────────
export const modelBenchmarks = [
  { model: 'Claude Opus 4.6', provider: 'Anthropic', reasoning: 98, codeGen: 95, extraction: 92, latency: 70, costEfficiency: 40, tokensPerSec: 45, contextWindow: '1M', monthlyTokens: 842000, monthlyCost: 63.15 },
  { model: 'Claude Sonnet 4.6', provider: 'Anthropic', reasoning: 88, codeGen: 85, extraction: 85, latency: 85, costEfficiency: 75, tokensPerSec: 92, contextWindow: '200K', monthlyTokens: 420000, monthlyCost: 6.30 },
  { model: 'GPT-4o', provider: 'OpenAI', reasoning: 85, codeGen: 90, extraction: 88, latency: 60, costEfficiency: 50, tokensPerSec: 58, contextWindow: '128K', monthlyTokens: 310000, monthlyCost: 9.30 },
  { model: 'Gemini 3.1', provider: 'Google', reasoning: 82, codeGen: 80, extraction: 78, latency: 90, costEfficiency: 80, tokensPerSec: 110, contextWindow: '2M', monthlyTokens: 580000, monthlyCost: 11.60 },
  { model: 'Llama 3 70B', provider: 'Ollama', reasoning: 70, codeGen: 65, extraction: 75, latency: 100, costEfficiency: 100, tokensPerSec: 35, contextWindow: '8K', monthlyTokens: 140000, monthlyCost: 0.00 },
  { model: 'DeepSeek Coder', provider: 'Ollama', reasoning: 60, codeGen: 82, extraction: 55, latency: 95, costEfficiency: 100, tokensPerSec: 42, contextWindow: '16K', monthlyTokens: 68000, monthlyCost: 0.00 },
];

// ── System Recommendations ─────────────────────────────────────
export const systemRecommendations = [
  { id: 'rec1', type: 'optimization', title: 'Route research to Sonnet', description: 'Orion uses Sonnet at $0.015/1K. Atlas still routes 34% of research through Opus at 5x the cost. Redirect to save ~$18/mo.', impact: 'high', savings: '$18.40/mo' },
  { id: 'rec2', type: 'performance', title: 'Lyra needs more memory', description: 'Lyra has crashed 3 times this week on vector batches >1000 chunks. Increase limit to 1024MB or switch to Sol for heavy jobs.', impact: 'critical' },
  { id: 'rec3', type: 'directive', title: 'Duplicate instructions detected', description: 'Atlas and Orion have overlapping system prompts for JSON formatting. Extract to a shared Output Format directive.', impact: 'normal' },
];

// ── Notifications (generated from agent/review/task state) ──────
export function generateNotifications() {
  const now = Date.now();
  const mins = (m) => new Date(now - m * 60_000);
  const hrs = (h) => new Date(now - h * 3_600_000);

  const notifs = [];

  // Error notifications from agents in error state
  agents.filter(a => a.status === 'error').forEach(a => {
    notifs.push({
      id: `n-err-${a.id}`, category: 'error',
      title: `${a.name} crashed`,
      description: a.errorMessage || `Agent ${a.name} is in error state and requires intervention.`,
      createdAt: mins(2), read: false,
      action: { type: 'agent', agentId: a.id },
    });
  });

  // Approval notifications from pending reviews
  pendingReviews.forEach(rv => {
    notifs.push({
      id: `n-rv-${rv.id}`, category: 'approval',
      title: `${rv.title} — awaiting approval`,
      description: `${rv.agentName}: ${rv.summary}`,
      createdAt: mins(Math.round(rv.waitingMs / 60_000)), read: false,
      action: { type: 'navigate', route: 'review' },
    });
  });

  // Success notifications from completed tasks
  tasks.filter(t => t.status === 'completed').forEach((t, i) => {
    notifs.push({
      id: `n-task-${t.id}`, category: 'success',
      title: `${t.name} completed`,
      description: `${t.agentName} finished in ${t.durationMs}ms — $${t.costUsd.toFixed(3)}`,
      createdAt: mins(15 + i * 8), read: true,
      action: { type: 'agent', agentId: t.agentId },
    });
  });

  // System notifications
  notifs.push({
    id: 'n-sys-rate', category: 'system',
    title: 'Rate limit: 85% on claude-opus-4-6',
    description: 'API rate limit approaching threshold. Consider distributing load to Sonnet.',
    createdAt: mins(12), read: false,
    action: { type: 'navigate', route: 'intelligence' },
  });
  notifs.push({
    id: 'n-sys-cost', category: 'system',
    title: `Session cost: $${costData.total}`,
    description: `Burn rate $${costData.burnRate}/min. ${Math.round(costData.total / 10 * 100)}% of $10 budget ceiling.`,
    createdAt: mins(6), read: false,
    action: { type: 'navigate', route: 'reports' },
  });
  notifs.push({
    id: 'n-sys-mem', category: 'system',
    title: 'Memory Core at 85% capacity',
    description: 'Long-term memory store approaching threshold. Consider archiving stale embeddings.',
    createdAt: hrs(1), read: true,
    action: { type: 'navigate', route: 'intelligence' },
  });

  // Agent restart notification
  agents.filter(a => a.restartCount > 0 && a.status !== 'error').forEach(a => {
    notifs.push({
      id: `n-restart-${a.id}`, category: 'system',
      title: `${a.name} restarted`,
      description: `Agent recovered after restart ${a.restartCount}. Last restart at ${a.lastRestart}.`,
      createdAt: hrs(1.5), read: true,
      action: { type: 'agent', agentId: a.id },
    });
  });

  // Sort newest first
  return notifs.sort((a, b) => b.createdAt - a.createdAt);
}

// ── Command Palette ─────────────────────────────────────────────
export const commandItems = [
  // Navigation
  { id: 'c1',  group: 'Navigation', label: 'Go to Overview',         icon: 'LayoutGrid',   action: { type: 'navigate', route: 'overview' } },
  { id: 'c3',  group: 'Navigation', label: 'Go to Review Room',      icon: 'CheckSquare',   action: { type: 'navigate', route: 'review' } },
  { id: 'c4',  group: 'Navigation', label: 'Go to Monthly Reports',  icon: 'FileText',      action: { type: 'navigate', route: 'reports' } },
  { id: 'c5',  group: 'Navigation', label: 'Go to Intelligence',     icon: 'BrainCircuit',  action: { type: 'navigate', route: 'intelligence' } },

  // Agents
  { id: 'c10', group: 'Agents', label: 'Inspect Atlas',   icon: 'Crown',       action: { type: 'agent', agentId: 'a1' } },
  { id: 'c11', group: 'Agents', label: 'Inspect Orion',   icon: 'Cpu',         action: { type: 'agent', agentId: 'a2' } },
  { id: 'c12', group: 'Agents', label: 'Inspect Vega',    icon: 'Cpu',         action: { type: 'agent', agentId: 'a3' } },
  { id: 'c13', group: 'Agents', label: 'Inspect Lyra',    icon: 'AlertTriangle', action: { type: 'agent', agentId: 'a4' } },
  { id: 'c14', group: 'Agents', label: 'Inspect Nova',    icon: 'Cpu',         action: { type: 'agent', agentId: 'a5' } },
  { id: 'c15', group: 'Agents', label: 'Inspect Sol',     icon: 'Cpu',         action: { type: 'agent', agentId: 'a6' } },

  // Panels
  { id: 'c20', group: 'Panels', label: 'Open Notifications',  icon: 'Bell',        action: { type: 'panel', panel: 'notifications' } },
  { id: 'c21', group: 'Panels', label: 'Open Settings',       icon: 'Settings',    action: { type: 'panel', panel: 'settings' } },
  { id: 'c22', group: 'Panels', label: 'Toggle Doctor Mode',  icon: 'Stethoscope', action: { type: 'panel', panel: 'doctor' } },
  { id: 'c23', group: 'Panels', label: 'Open Profile',        icon: 'User',        action: { type: 'panel', panel: 'profile' } },

  // Actions
  { id: 'c30', group: 'Actions', label: 'Export logs as JSON',       icon: 'Download',  action: { type: 'action', id: 'export-logs' } },
  { id: 'c31', group: 'Actions', label: 'Copy session trace ID',     icon: 'Clipboard', action: { type: 'action', id: 'copy-trace' } },
];
