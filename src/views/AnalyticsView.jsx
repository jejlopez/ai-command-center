import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
// TODO: This view is not routed — migrate to Supabase analytics queries when activated
import { TREND_DATA, MOCK_PROJECT_DATA } from '../utils/mockData';
import { Filter, Download } from 'lucide-react';

export function AnalyticsView({ context }) {
  const cTokens = context.intel?.tokens || 0;
  const cCost = context.intel?.cost || 0;

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
        <div className="spatial-panel p-6 rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-mono uppercase text-modern-muted">Workspace Burn</span>
          <div className="mt-4 flex items-baseline gap-2">
            <h3 className="text-4xl font-light text-white">${cCost}</h3>
            <span className="text-sm text-modern-muted">USD</span>
          </div>
        </div>
        
        <div className="spatial-panel p-6 rounded-2xl flex flex-col justify-between">
          <span className="text-xs font-mono uppercase text-modern-muted">Token Consumption</span>
          <div className="mt-4 flex items-baseline gap-2">
            <h3 className="text-4xl font-light text-white">{cTokens}M</h3>
            <span className="text-sm text-modern-muted">tokens</span>
          </div>
        </div>
        
        <div className="spatial-panel p-6 rounded-2xl flex flex-col justify-between bg-modern-highlight/5 border-modern-highlight/20">
          <span className="text-xs font-mono uppercase text-modern-highlight">Efficiency Score</span>
          <div className="mt-4 flex items-baseline gap-2">
            <h3 className="text-4xl font-light text-white">98.2</h3>
            <span className="text-sm text-modern-highlight">index</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="spatial-panel flex-1 rounded-3xl p-8 flex flex-col min-h-[300px]">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h3 className="text-lg font-medium text-white">Consumption Velocity</h3>
            <p className="text-sm text-modern-muted mt-1">API usage limits are well within bounds for this billing cycle.</p>
          </div>
        </div>
        
        <div className="flex-1 w-full h-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={TREND_DATA}>
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
        </div>
      </div>

    </div>
  );
}
