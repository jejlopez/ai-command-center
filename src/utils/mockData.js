export const agents = [
  { id: 'a1', name: 'Atlas', model: 'claude-opus-4-6', status: 'processing',
    taskCompletion: 78, tokenBurn: [120,145,132,167,154,189,201,178,195,210,185,220],
    latencyMs: 340, color: '#00D9C8' },
  { id: 'a2', name: 'Orion', model: 'gpt-4o', status: 'idle',
    taskCompletion: 100, tokenBurn: [80,90,85,110,95,100,88,92,87,95,91,98],
    latencyMs: 820, color: '#60a5fa' },
  { id: 'a3', name: 'Vega', model: 'claude-opus-4-6', status: 'processing',
    taskCompletion: 42, tokenBurn: [200,210,195,230,245,220,235,250,240,260,255,270],
    latencyMs: 290, color: '#a78bfa' },
  { id: 'a4', name: 'Lyra', model: 'gemini-1.5', status: 'error',
    taskCompletion: 15, tokenBurn: [50,60,55,40,0,0,0,0,0,0,0,0],
    latencyMs: 4200, color: '#fb7185' },
  { id: 'a5', name: 'Nova', model: 'claude-3-sonnet', status: 'processing',
    taskCompletion: 92, tokenBurn: [100,120,110,130,125,140,135,150,145,160,155,170],
    latencyMs: 410, color: '#a78bfa' },
  { id: 'a6', name: 'Sol', model: 'gpt-4o', status: 'idle',
    taskCompletion: 10, tokenBurn: [10,20,15,25,20,30,25,35,30,40,35,45],
    latencyMs: 650, color: '#60a5fa' },
];

export const activityLog = [
  { id: 1,  timestamp: '09:05:12', type: 'SYS', message: 'Atlas context loaded — 4096 tokens' },
  { id: 2,  timestamp: '09:05:14', type: 'NET', message: 'Connecting to lottery.broadwaydirect.com' },
  { id: 3,  timestamp: '09:05:15', type: 'OK',  message: 'Firecrawl scrape complete — 3 shows found' },
  { id: 4,  timestamp: '09:05:18', type: 'OK',  message: 'iMessage sent to +1 (201) 555-0147' },
  { id: 5,  timestamp: '09:05:20', type: 'SYS', message: 'Polling for reply — timeout 11:00 AM' },
  { id: 6,  timestamp: '09:05:22', type: 'NET', message: 'Vega connecting to my.socialtoaster.com' },
  { id: 7,  timestamp: '09:05:25', type: 'ERR', message: 'Lyra: OOMKilled — memory limit exceeded' },
  { id: 8,  timestamp: '09:05:26', type: 'SYS', message: 'Lyra: Awaiting intervention' },
  { id: 9,  timestamp: '09:06:01', type: 'OK',  message: 'Orion: Q3 analysis complete — $0.84' },
  { id: 10, timestamp: '09:06:12', type: 'NET', message: 'Atlas: DB sync complete — 1204 vectors' },
  { id: 11, timestamp: '09:06:18', type: 'OK',  message: 'Vega: Login session established' },
  { id: 12, timestamp: '09:06:22', type: 'SYS', message: 'Rate limit: 85% on claude-opus-4-6' },
  { id: 13, timestamp: '09:06:30', type: 'NET', message: 'Atlas: Fetching luckyseat.com/shows' },
  { id: 14, timestamp: '09:06:35', type: 'OK',  message: 'Playwright: Cookie banner dismissed' },
  { id: 15, timestamp: '09:06:40', type: 'OK',  message: 'Lottery form submitted — Hamilton' },
  { id: 16, timestamp: '09:06:42', type: 'OK',  message: 'Lottery form submitted — Wicked' },
  { id: 17, timestamp: '09:06:50', type: 'SYS', message: 'Total cost this session: $4.83' },
  { id: 18, timestamp: '09:06:55', type: 'OK',  message: 'Confirmation iMessage sent to both recipients' },
];

export const mockSpans = [
  { id: 's1', name: 'Broadway Lottery Run', type: 'agent',     startMs: 0,    durationMs: 4200, parentId: null, model: 'claude-opus-4-6', tokens: 1240, status: 'success' },
  { id: 's2', name: 'Scrape broadwaydirect', type: 'tool',     startMs: 80,   durationMs: 890,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's3', name: 'Parse show list',       type: 'llm',      startMs: 970,  durationMs: 620,  parentId: 's1', model: 'claude-opus-4-6', tokens: 340,  status: 'success' },
  { id: 's4', name: 'Scrape luckyseat',      type: 'tool',     startMs: 1590, durationMs: 740,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's5', name: 'Enter Hamilton lottery',type: 'tool',     startMs: 2330, durationMs: 980,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's6', name: 'Confirm via iMessage',  type: 'tool',     startMs: 3310, durationMs: 210,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
];

export const tasks = [
  { id: 't1', name: 'Scrape Sites',    status: 'completed', parentId: null, agentName: 'Atlas' },
  { id: 't2', name: 'Parse Results',  status: 'completed', parentId: 't1', agentName: 'Atlas' },
  { id: 't3', name: 'Send iMessage',  status: 'completed', parentId: 't2', agentName: 'Atlas' },
  { id: 't4', name: 'Wait for Reply', status: 'running',   parentId: 't3', agentName: 'Atlas' },
  { id: 't5', name: 'Enter Lottery',  status: 'pending',   parentId: 't4', agentName: 'Atlas' },
];

export const memoryChunks = Array.from({ length: 36 }, (_, i) => ({
  key: `mem_chunk_${i.toString().padStart(2,'0')}`,
  recency: i < 12 ? 'recent' : i < 24 ? 'medium' : 'old',
  lastAccessed: new Date(Date.now() - i * 180000).toISOString(),
}));

export const costData = {
  total: 4.83,
  burnRate: 0.42,
  models: [
    { name: 'Claude',  cost: 2.91, percentage: 60 },
    { name: 'GPT-4o',  cost: 1.45, percentage: 30 },
    { name: 'Gemini',  cost: 0.47, percentage: 10 },
  ],
};

export const healthMetrics = [
  { label: 'CPU', value: 72, color: '#00D9C8' },
  { label: 'MEM', value: 58, color: '#a78bfa' },
  { label: 'API', value: 94, color: '#60a5fa' },
];

export const commandItems = [
  { id: 'c1', group: 'Agents',     label: 'Inspect Agent Atlas',        icon: 'Cpu' },
  { id: 'c2', group: 'Agents',     label: 'Halt all running agents',    icon: 'Square' },
  { id: 'c3', group: 'Agents',     label: 'Re-run last failed agent',   icon: 'RefreshCw' },
  { id: 'c4', group: 'Navigation', label: 'Go to Fleet View',           icon: 'Network' },
  { id: 'c5', group: 'Navigation', label: 'Go to Memory Core',          icon: 'BrainCircuit' },
  { id: 'c6', group: 'Navigation', label: 'Go to Intelligence',         icon: 'BarChart3' },
  { id: 'c7', group: 'Actions',    label: 'Export logs as JSON',        icon: 'Download' },
  { id: 'c8', group: 'Actions',    label: 'Set spend alert threshold',  icon: 'Bell' },
  { id: 'c9', group: 'Actions',    label: 'Copy session trace ID',      icon: 'Clipboard' },
  { id: 'c10',group: 'Actions',    label: 'Switch to Production env',   icon: 'Globe' },
];
