export const mcpServers = [
  { id: 'mcp1', url: 'localhost:3001', name: 'Local Dev Tools', status: 'connected', tools: 4 },
  { id: 'mcp2', url: 'mcp.example.com:8080', name: 'Production Gateway', status: 'disconnected', tools: 12 },
];

export const knowledgeNamespaces = [
  { id: 'ns1', name: 'intel-market', vectors: 28400, size: '4.8 GB', lastSync: '2 min ago', status: 'active', agents: ['Atlas', 'Orion'], description: 'Market intelligence, pricing data, competitor analysis' },
  { id: 'ns2', name: 'identity', vectors: 12800, size: '2.1 GB', lastSync: '1 hr ago', status: 'active', agents: ['Atlas'], description: 'User sessions, auth tokens, access control' },
  { id: 'ns3', name: 'system-config', vectors: 8900, size: '1.4 GB', lastSync: '3 hrs ago', status: 'active', agents: ['Atlas', 'Nova'], description: 'System prompts, agent configs, override rules' },
  { id: 'ns4', name: 'code-context', vectors: 18200, size: '3.2 GB', lastSync: '15 min ago', status: 'active', agents: ['Vega', 'Nova'], description: 'Codebase embeddings, PR diffs, documentation' },
  { id: 'ns5', name: 'logs-archive', vectors: 15800, size: '2.7 GB', lastSync: '12 hrs ago', status: 'stale', agents: ['Nova'], description: 'Historical agent logs, crash dumps, diagnostics' },
];

export const directiveTemplates = [
  { id: 'd1', name: 'Safety Guardrails', scope: 'all', appliedTo: ['Atlas', 'Orion', 'Vega', 'Lyra', 'Nova', 'Sol'], content: 'Never execute destructive operations without explicit user approval. Always confirm before sending messages, deleting files, or making purchases.', priority: 'critical', icon: 'ShieldCheck' },
  { id: 'd2', name: 'Cost Ceiling', scope: 'all', appliedTo: ['Atlas', 'Orion', 'Vega', 'Lyra', 'Nova', 'Sol'], content: 'Halt execution and alert user if cumulative session cost exceeds $10.00. Prefer cheaper models for research tasks.', priority: 'high', icon: 'DollarSign' },
  { id: 'd3', name: 'Output Format', scope: 'researchers', appliedTo: ['Orion', 'Lyra', 'Sol'], content: 'Return structured JSON for all data results. Include source URLs, confidence scores, and timestamps.', priority: 'normal', icon: 'FileJson' },
  { id: 'd4', name: 'QA Standards', scope: 'qa', appliedTo: ['Nova'], content: 'Verify all outputs against source data. Flag hallucinations, check math, validate URLs. Reject outputs with confidence below 85%.', priority: 'high', icon: 'CheckCircle' },
  { id: 'd5', name: 'Privacy Rules', scope: 'all', appliedTo: ['Atlas', 'Orion', 'Vega', 'Lyra', 'Nova', 'Sol'], content: 'Never log PII to external services. Use local models for any task involving personal data. Redact sensitive info from reports.', priority: 'critical', icon: 'Lock' },
];

export const modelBenchmarks = [
  { model: 'Claude Opus 4.6', provider: 'Anthropic', reasoning: 98, codeGen: 95, extraction: 92, latency: 70, costEfficiency: 40, tokensPerSec: 45, contextWindow: '1M', monthlyTokens: 842000, monthlyCost: 63.15 },
  { model: 'Claude Sonnet 4.6', provider: 'Anthropic', reasoning: 88, codeGen: 85, extraction: 85, latency: 85, costEfficiency: 75, tokensPerSec: 92, contextWindow: '200K', monthlyTokens: 420000, monthlyCost: 6.30 },
  { model: 'GPT-4o', provider: 'OpenAI', reasoning: 85, codeGen: 90, extraction: 88, latency: 60, costEfficiency: 50, tokensPerSec: 58, contextWindow: '128K', monthlyTokens: 310000, monthlyCost: 9.30 },
  { model: 'Gemini 3.1', provider: 'Google', reasoning: 82, codeGen: 80, extraction: 78, latency: 90, costEfficiency: 80, tokensPerSec: 110, contextWindow: '2M', monthlyTokens: 580000, monthlyCost: 11.60 },
  { model: 'Llama 3 70B', provider: 'Ollama', reasoning: 70, codeGen: 65, extraction: 75, latency: 100, costEfficiency: 100, tokensPerSec: 35, contextWindow: '8K', monthlyTokens: 140000, monthlyCost: 0.00 },
  { model: 'DeepSeek Coder', provider: 'Ollama', reasoning: 60, codeGen: 82, extraction: 55, latency: 95, costEfficiency: 100, tokensPerSec: 42, contextWindow: '16K', monthlyTokens: 68000, monthlyCost: 0.00 },
];

export const systemRecommendations = [
  { id: 'rec1', type: 'optimization', title: 'Route research to Sonnet', description: 'Orchestration is still overspending on premium planning paths for routine research. Redirecting those jobs saves monthly spend.', impact: 'high', savings: '$18.40/mo' },
  { id: 'rec2', type: 'performance', title: 'Increase memory for heavy vector jobs', description: 'Large embedding batches should run on workers with more headroom or be chunked more aggressively to avoid OOMs.', impact: 'critical' },
  { id: 'rec3', type: 'directive', title: 'Extract shared formatting rules', description: 'Several agent instructions overlap. Moving common output formatting into shared directives reduces drift.', impact: 'normal' },
];

export const baseCommandItems = [
  { id: 'c1', group: 'Navigation', label: 'Go to Overview', icon: 'LayoutGrid', action: { type: 'navigate', route: 'overview' } },
  { id: 'c3', group: 'Navigation', label: 'Go to Mission Control', icon: 'CheckSquare', action: { type: 'navigate', route: 'missions' } },
  { id: 'c4', group: 'Navigation', label: 'Go to Monthly Reports', icon: 'FileText', action: { type: 'navigate', route: 'reports' } },
  { id: 'c5', group: 'Navigation', label: 'Go to Intelligence', icon: 'BrainCircuit', action: { type: 'navigate', route: 'intelligence' } },
  { id: 'c20', group: 'Panels', label: 'Open Notifications', icon: 'Bell', action: { type: 'panel', panel: 'notifications' } },
  { id: 'c21', group: 'Panels', label: 'Open Settings', icon: 'Settings', action: { type: 'panel', panel: 'settings' } },
  { id: 'c23', group: 'Panels', label: 'Open Profile', icon: 'User', action: { type: 'panel', panel: 'profile' } },
  { id: 'c30', group: 'Actions', label: 'Export logs as JSON', icon: 'Download', action: { type: 'action', id: 'export-logs' } },
  { id: 'c31', group: 'Actions', label: 'Copy session trace ID', icon: 'Clipboard', action: { type: 'action', id: 'copy-trace' } },
];
