import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Filter, Download } from 'lucide-react';
import { useCostData, useTasks } from '../utils/useSupabase';

export function AnalyticsView({ context }) {
  const { data: costData } = useCostData();
  const { tasks } = useTasks();
  const cTokens = tasks.reduce((sum, task) => sum + Number(task.durationMs || 0), 0);
  const cCost = costData.total || 0;
  const trendData = costData.models.map((model, index) => ({
    day: String(index + 1).padStart(2, '0'),
    usage: Number(model.cost.toFixed(2)),
  }));

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium text-white tracking-tight">Intelligence Usage</h2>
        <div className="flex gap-2 text-sm">
          <button className="spatial-button px-3 py-1.5 flex items-center gap-2">
            <Filter className="w-3 h-3" /> Last 30 Days
          </button>
          <button className="spatial-button px-3 py-1.5 flex items-center gap-2">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-3 gap-6">
        <div className="ui-panel p-6 rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-mono uppercase text-text-muted">Workspace Burn</span>
          <div className="mt-4 flex items-baseline gap-2">
            <h3 className="text-4xl font-light text-text-primary">${cCost}</h3>
            <span className="text-sm text-text-muted">USD</span>
          </div>
        </div>
        
        <div className="ui-panel p-6 rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-mono uppercase text-text-muted">Token Consumption</span>
          <div className="mt-4 flex items-baseline gap-2">
            <h3 className="text-4xl font-light text-text-primary">{cTokens}</h3>
            <span className="text-sm text-text-muted">ms tracked</span>
          </div>
        </div>
        
        <div className="ui-panel p-6 rounded-2xl flex flex-col justify-between border-aurora-teal/20 bg-aurora-teal/[0.04]">
          <span className="text-xs font-mono uppercase text-aurora-teal">Efficiency Score</span>
          <div className="mt-4 flex items-baseline gap-2">
            <h3 className="text-4xl font-light text-text-primary">98.2</h3>
            <span className="text-sm text-aurora-teal">index</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="ui-shell flex-1 rounded-3xl p-8 flex flex-col min-h-[300px]">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h3 className="text-lg font-medium text-text-primary">Consumption Velocity</h3>
            <p className="text-sm text-text-muted mt-1">API usage limits are well within bounds for this billing cycle.</p>
          </div>
        </div>
        
        <div className="flex-1 w-full h-full relative">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12, fontFamily: 'Inter' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12, fontFamily: 'Inter' }} dx={-10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#121212', borderRadius: '12px', border: '1px solid #262626', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  cursor={{ stroke: '#262626', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="usage" stroke="#ffffff" strokeWidth={2} fillOpacity={1} fill="url(#colorUsage)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">
              No analytics data for this account yet.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
