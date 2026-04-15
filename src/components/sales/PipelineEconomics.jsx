// PipelineEconomics — financial metrics strip for deal room header.

export function PipelineEconomics({ deal }) {
  // Est. monthly from volumes or deal value
  const monthly = deal.volumes?.monthly_orders
    ? deal.volumes.monthly_orders * 3.5 // rough order processing revenue
    : (deal.value || deal.value_usd || 0) / 12;

  const annual = monthly * 12;

  // Margin estimate based on service mix
  const serviceCount = deal.services_needed?.length || 1;
  const marginPct = serviceCount >= 4 ? 35 : serviceCount >= 3 ? 32 : serviceCount >= 2 ? 28 : 25;

  // Time to close (days since deal created)
  const age = deal.add_time || deal.created_at
    ? Math.floor((Date.now() - new Date(deal.add_time || deal.created_at).getTime()) / 86_400_000)
    : 0;

  const fmt = (v) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`;

  return (
    <div className="flex gap-4 items-center">
      <div className="text-center">
        <div className="text-[7px] text-jarvis-ghost uppercase tracking-wider">Est. Monthly</div>
        <div className="text-sm font-bold text-jarvis-success tabular-nums">{fmt(monthly)}</div>
      </div>
      <div className="w-px h-5 bg-jarvis-border/30" />
      <div className="text-center">
        <div className="text-[7px] text-jarvis-ghost uppercase tracking-wider">Annual</div>
        <div className="text-sm font-bold text-jarvis-ink tabular-nums">{fmt(annual)}</div>
      </div>
      <div className="w-px h-5 bg-jarvis-border/30" />
      <div className="text-center">
        <div className="text-[7px] text-jarvis-ghost uppercase tracking-wider">Est. Margin</div>
        <div className="text-sm font-bold text-jarvis-warning tabular-nums">{marginPct}%</div>
      </div>
      <div className="w-px h-5 bg-jarvis-border/30" />
      <div className="text-center">
        <div className="text-[7px] text-jarvis-ghost uppercase tracking-wider">Deal Age</div>
        <div className={`text-sm font-bold tabular-nums ${age > 25 ? "text-jarvis-danger" : age > 14 ? "text-jarvis-warning" : "text-blue-400"}`}>{age}d</div>
      </div>
    </div>
  );
}
