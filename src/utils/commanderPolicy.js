export const SYNTHETIC_COMMANDER_ID = 'synthetic-commander';
export const DEFAULT_COMMANDER_MODEL = 'Claude Opus 4.6';
export const DEFAULT_COMMANDER_PROVIDER = 'Anthropic';
export const DEFAULT_MODEL_PROVIDER = 'Custom';

export function getCommanderDisplayName(user) {
  const fullName = user?.user_metadata?.full_name?.trim();
  return fullName ? `${fullName} Command` : 'Jarvis Commander';
}

export function normalizeModelProvider(provider = '') {
  const value = String(provider || '').trim();
  const lower = value.toLowerCase();

  if (lower.includes('anthropic') || lower.includes('claude')) return 'Anthropic';
  if (lower.includes('openai') || lower.includes('gpt')) return 'OpenAI';
  if (lower.includes('google') || lower.includes('gemini')) return 'Google';
  if (lower.includes('ollama')) return 'Ollama';
  return value || DEFAULT_MODEL_PROVIDER;
}

export function getCommanderLane() {
  return {
    model: DEFAULT_COMMANDER_MODEL,
    provider: DEFAULT_COMMANDER_PROVIDER,
  };
}

export function isSyntheticCommander(agentOrId) {
  if (!agentOrId) return false;
  if (typeof agentOrId === 'string') return agentOrId === SYNTHETIC_COMMANDER_ID;
  return Boolean(agentOrId.isSyntheticCommander) || agentOrId.id === SYNTHETIC_COMMANDER_ID;
}
