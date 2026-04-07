export const PROJECTS = [
  { id: 'alpha', name: 'Project Alpha', environment: 'Production' },
  { id: 'beta', name: 'Project Beta', environment: 'Staging' },
  { id: 'internal', name: 'Internal Ops', environment: 'Local' },
];

export const MOCK_PROJECT_DATA = {
  'alpha': {
    agents: [
      { id: 1, name: 'Agent-O1', role: 'Orchestrator', status: 'processing', model: 'GPT-4o' },
      { id: 2, name: 'Agent-D1', role: 'Data Synthesizer', status: 'idle', model: 'Claude 3.5' },
    ],
    tasks: [
      { id: 1, agent: 'Agent-O1', text: 'Processing Q3 Financials', progress: 85, status: 'in-progress' },
      { id: 2, agent: 'Agent-D1', text: 'Scraping competitor data', progress: 100, status: 'completed' }
    ],
    intel: { tokens: 2.1, cost: 42, activeTasks: 1 },
    triage: [
      { id: 'T-01', agent: 'Agent-O1', msg: 'Rate limit approaching on OpenAI API', severity: 'warning', time: '12:45' }
    ]
  },
  'beta': {
    agents: [
      { id: 3, name: 'Agent-B1', role: 'Dev Validator', status: 'offline', model: 'Gemini 1.5' },
    ],
    tasks: [
      { id: 3, agent: 'Agent-B1', text: 'Running e2e test suite', progress: 12, status: 'in-progress' }
    ],
    intel: { tokens: 0.5, cost: 10, activeTasks: 1 },
    triage: [
      { id: 'T-02', agent: 'Agent-B1', msg: 'Container failed to spin up', severity: 'critical', time: '14:20' }
    ]
  },
  'internal': {
    agents: [],
    tasks: [],
    intel: { tokens: 0, cost: 0, activeTasks: 0 },
    triage: []
  }
};

export const AGENT_LOGS = {
  'Agent-O1': [
    '[SYS] 14:00:00 Waking agent context...',
    '[NET] 14:00:05 Syncing vector DB...',
    '[OK] 14:00:08 DB Sync complete. Expanding queries.',
  ],
  'Agent-B1': [
    '[SYS] 14:20:00 Starting container image node:20',
    '[ERR] 14:20:05 OOMKilled: memory limit exceeded',
    '[SYS] 14:20:06 Awaiting intervention.',
  ]
};

export const TREND_DATA = [
  { day: 'Mon', usage: 120 },
  { day: 'Tue', usage: 180 },
  { day: 'Wed', usage: 150 },
  { day: 'Thu', usage: 220 },
  { day: 'Fri', usage: 170 }
];
