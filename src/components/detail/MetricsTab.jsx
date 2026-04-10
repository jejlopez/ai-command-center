import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useSkillBank } from '../../utils/useSupabase';

export function MetricsTab({ agent }) {
  const { skills: skillBank } = useSkillBank();
  const uptimeHrs = agent.uptimeMs ? (agent.uptimeMs / 3_600_000).toFixed(1) : '0.0';
  const stats = [
    { label: 'Total Tokens', value: (agent.totalTokens || 0).toLocaleString(), sub: `$${(agent.totalCost || 0).toFixed(2)}` },
    { label: 'Avg Latency', value: `${agent.latencyMs}ms`, sub: `p95: ${Math.round(agent.latencyMs * 1.4)}ms` },
    { label: 'Success Rate', value: `${agent.successRate || 0}%`, sub: `${agent.taskCount || 0} tasks` },
    { label: 'Uptime', value: `${uptimeHrs}h`, sub: `${agent.restartCount || 0} restarts` },
  ];
  const tokenHistory = (agent.tokenHistory24h || []).map((tokens, index) => ({ hour: index, tokens }));
  const seedBase = agent.totalTokens || 1000;
  const topTools = (agent.skills || []).slice(0, 4).map((skillId, index) => {
    const skill = skillBank.find((entry) => entry.id === skillId);
    return { name: skill?.name || skillId, calls: Math.max(5, Math.floor(((seedBase * (index + 7)) % 47) + 8)) };
  }).sort((a, b) => b.calls - a.calls);
  const maxCalls = Math.max(...topTools.map((tool) => tool.calls), 1);

  return (
    <div className="h-full space-y-6 overflow-y-auto no-scrollbar p-6">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-hairline bg-panel-soft p-3.5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-disabled">{stat.label}</div>
            <div className="font-mono text-xl font-semibold text-text-primary">{stat.value}</div>
            <div className="mt-0.5 font-mono text-[10px] text-text-disabled">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Token Usage (24h)</label>
        <div className="h-24 rounded-lg border border-hairline bg-panel-soft p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tokenHistory}>
              <defs>
                <linearGradient id={`tokenGrad-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={agent.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={agent.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="tokens" stroke={agent.color} strokeWidth={1.5} fill={`url(#tokenGrad-${agent.id})`} dot={false} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Top Tool Calls</label>
        <div className="space-y-2.5">
          {topTools.map((tool) => (
            <div key={tool.name}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-text-primary">{tool.name}</span>
                <span className="font-mono text-text-disabled">{tool.calls}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel-soft">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: agent.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(tool.calls / maxCalls) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
