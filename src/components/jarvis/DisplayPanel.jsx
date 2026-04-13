import { useState } from "react";
import { Monitor, Pin, PinOff, ChevronLeft, Layers } from "lucide-react";
import { getWidgetMeta } from "../../lib/widgetRegistry.js";

// Compact primitive renderers for the display panel
function MetricCard({ label, value, color = "text-jarvis-primary", sub }) {
  return (
    <div className="glass p-4">
      <div className="label mb-1">{label}</div>
      <div className={`text-2xl font-display font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-jarvis-muted mt-1">{sub}</div>}
    </div>
  );
}

function DataList({ title, items, emptyText }) {
  return (
    <div className="glass p-4">
      <div className="label mb-2">{title}</div>
      {(!items || items.length === 0) ? (
        <div className="text-xs text-jarvis-muted">{emptyText || "No data"}</div>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 8).map((item, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg border border-jarvis-border bg-jarvis-surface">
              <span className="text-xs text-jarvis-ink truncate flex-1">{item.label}</span>
              {item.value && <span className="text-xs text-jarvis-body tabular-nums ml-2">{item.value}</span>}
              {item.chip && (
                <span className={`chip text-[8px] ml-2 ${item.chipColor || ""}`}>{item.chip}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetRenderer({ widget, data }) {
  const name = widget.widget || widget;

  switch (name) {
    case "pipeline":
      return (
        <div className="space-y-3">
          <MetricCard
            label="Pipeline Value"
            value={`$${((data?.deals ?? []).reduce((s, d) => s + (d.value_usd ?? 0), 0)).toLocaleString()}`}
            color="text-jarvis-primary"
            sub={`${(data?.deals ?? []).length} active deals`}
          />
          <DataList
            title="Deals by Stage"
            items={["prospect", "quoted", "negotiating"].map(stage => {
              const inStage = (data?.deals ?? []).filter(d => d.stage === stage);
              return {
                label: stage.charAt(0).toUpperCase() + stage.slice(1),
                value: `${inStage.length} · $${inStage.reduce((s, d) => s + (d.value_usd ?? 0), 0).toLocaleString()}`,
              };
            })}
          />
        </div>
      );

    case "follow_ups":
      return (
        <DataList
          title="Follow-ups Due"
          items={(data?.followUps ?? []).filter(f => f.status === "pending").slice(0, 8).map(f => ({
            label: f.action,
            value: f.due_date,
            chip: f.priority,
            chipColor: f.priority === "urgent" ? "bg-jarvis-danger/10 text-jarvis-danger" : "",
          }))}
          emptyText="No follow-ups pending"
        />
      );

    case "positions": {
      const totalPnl = (data?.positions ?? []).reduce((s, p) => s + (p.pnl_usd ?? 0), 0);
      return (
        <div className="space-y-3">
          <MetricCard
            label="Open P&L"
            value={`${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toLocaleString()}`}
            color={totalPnl >= 0 ? "text-jarvis-success" : "text-jarvis-danger"}
            sub={`${(data?.positions ?? []).length} open positions`}
          />
          <DataList
            title="Positions"
            items={(data?.positions ?? []).map(p => ({
              label: `${p.ticker} ${p.side}`,
              value: `${(p.pnl_usd ?? 0) >= 0 ? "+" : ""}$${Math.abs(p.pnl_usd ?? 0).toLocaleString()}`,
              chip: p.stop_loss ? `SL $${p.stop_loss}` : "No SL",
              chipColor: p.stop_loss ? "" : "bg-jarvis-danger/10 text-jarvis-danger",
            }))}
          />
        </div>
      );
    }

    case "watchlist":
      return (
        <DataList
          title="Watchlist"
          items={(data?.watchlist ?? []).map(w => ({
            label: w.ticker,
            value: w.alert_price ? `$${w.alert_price}` : "",
            chip: w.direction,
          }))}
          emptyText="Watchlist empty"
        />
      );

    case "scorecard": {
      const sc = data?.scorecard ?? {};
      const today = sc.today ?? {};
      const week = sc.week ?? {};
      return (
        <div className="space-y-3">
          <MetricCard
            label="Today's P&L"
            value={`${(today.pnl ?? 0) >= 0 ? "+" : ""}$${Math.abs(today.pnl ?? 0).toLocaleString()}`}
            color={(today.pnl ?? 0) >= 0 ? "text-jarvis-success" : "text-jarvis-danger"}
            sub={`${today.wins ?? 0}W ${today.losses ?? 0}L`}
          />
          <MetricCard
            label="This Week"
            value={`${(week.pnl ?? 0) >= 0 ? "+" : ""}$${Math.abs(week.pnl ?? 0).toLocaleString()}`}
            color={(week.pnl ?? 0) >= 0 ? "text-jarvis-success" : "text-jarvis-danger"}
            sub={`${week.wins ?? 0}W ${week.losses ?? 0}L`}
          />
        </div>
      );
    }

    case "money_dashboard":
      return (
        <div className="space-y-3">
          <MetricCard
            label="Capital Velocity"
            value={`${(data?.velocity?.daily_net ?? 0) >= 0 ? "+" : ""}$${Math.abs(data?.velocity?.daily_net ?? 0).toLocaleString()}/day`}
            color={(data?.velocity?.daily_net ?? 0) >= 0 ? "text-jarvis-success" : "text-jarvis-danger"}
          />
          <DataList
            title="Money Leaks"
            items={(data?.leaks ?? []).map(l => ({
              label: l.text,
              chip: l.severity,
              chipColor: l.severity === "high"
                ? "bg-jarvis-danger/10 text-jarvis-danger"
                : "bg-jarvis-warning/10 text-jarvis-warning",
            }))}
            emptyText="No leaks detected"
          />
        </div>
      );

    case "velocity":
      return (
        <MetricCard
          label="Capital Velocity"
          value={`${(data?.velocity?.daily_net ?? 0) >= 0 ? "+" : ""}$${Math.abs(data?.velocity?.daily_net ?? 0).toLocaleString()}/day`}
          color={(data?.velocity?.daily_net ?? 0) >= 0 ? "text-jarvis-success" : "text-jarvis-danger"}
          sub={`${(data?.velocity?.vs_last_week_pct ?? 0) >= 0 ? "+" : ""}${(data?.velocity?.vs_last_week_pct ?? 0).toFixed(1)}% vs last week`}
        />
      );

    case "calendar":
      return (
        <DataList
          title="Today's Schedule"
          items={(data?.calendar ?? []).map(e => ({
            label: e.title,
            value: new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            chip: e.kind === "focus" ? "Focus" : e.calendar || "Calendar",
          }))}
          emptyText="No events today"
        />
      );

    case "needle_movers":
      return (
        <DataList
          title="Top 3 Needle Movers"
          items={(data?.topFive ?? []).slice(0, 3).map((t, i) => ({
            label: `${i + 1}. ${t.label}`,
            value: t.value,
            chip: t.role,
            chipColor:
              t.role === "Sales"   ? "bg-blue-500/10 text-blue-400"
              : t.role === "Trading" ? "bg-purple-500/10 text-jarvis-purple"
              : "bg-cyan-500/10 text-jarvis-primary",
          }))}
          emptyText="Add deals and positions to see priorities"
        />
      );

    case "decisions":
      return (
        <DataList
          title="Decision Queue"
          items={(data?.decisions ?? []).filter(d => d.status === "pending").map(d => ({
            label: d.title,
            value: d.cost_per_day ? `$${d.cost_per_day}/day` : "",
            chip: d.role,
          }))}
          emptyText="No decisions pending"
        />
      );

    case "waste_detector":
      return (
        <DataList
          title="Waste Detector"
          items={(data?.wasteAlerts ?? []).map(a => ({
            label: a.text,
            chip: a.severity || a.type,
            chipColor: a.severity === "high"
              ? "bg-jarvis-danger/10 text-jarvis-danger"
              : "bg-jarvis-warning/10 text-jarvis-warning",
          }))}
          emptyText="No waste detected — clean day"
        />
      );

    case "health_dashboard":
      return (
        <div className="space-y-3">
          <MetricCard
            label="Energy"
            value={data?.energyHero?.energy ?? "—"}
            color={
              (data?.energyHero?.energy ?? 0) >= 7 ? "text-jarvis-success"
              : (data?.energyHero?.energy ?? 0) >= 4 ? "text-jarvis-warning"
              : "text-jarvis-danger"
            }
            sub={`Sleep: ${data?.energyHero?.sleep_hours ?? "—"}h`}
          />
        </div>
      );

    case "habits":
      return (
        <DataList
          title="Habits"
          items={(data?.habits ?? []).map(h => {
            const doneToday = h.last_done === new Date().toISOString().slice(0, 10);
            return {
              label: h.name,
              value: `${h.current_streak}d streak`,
              chip: doneToday ? "Done" : "Due",
              chipColor: doneToday
                ? "bg-jarvis-success/10 text-jarvis-success"
                : "bg-jarvis-warning/10 text-jarvis-warning",
            };
          })}
          emptyText="No habits tracked"
        />
      );

    case "home_dashboard":
      return <MetricCard label="Home Life" value="—" sub="Home overview" />;

    case "brain_search":
      return (
        <MetricCard
          label="Knowledge"
          value={`${data?.nodeCount ?? 0} nodes`}
          sub="Search your brain in the Brain tab"
        />
      );

    case "mistakes":
      return (
        <DataList
          title="Recent Mistakes & Lessons"
          items={(data?.mistakes ?? []).slice(0, 5).map(m => ({
            label: m.mistake,
            value: m.lesson?.slice(0, 40),
          }))}
          emptyText="No mistakes logged — or you're perfect"
        />
      );

    case "mental_models":
      return (
        <DataList
          title="Mental Models"
          items={(data?.mentalModels ?? []).slice(0, 5).map(m => ({
            label: m.name,
            value: `Used ${m.times_used}x`,
            chip: m.category,
          }))}
          emptyText="Add mental models in Brain → Journal"
        />
      );

    case "deal_room": {
      const company = widget.entities?.company;
      const deal = (data?.deals ?? []).find(d =>
        d.company?.toLowerCase().includes((company ?? "").toLowerCase())
      );
      if (!deal) return <MetricCard label="Deal Room" value={company || "—"} sub="Deal not found" />;
      return (
        <div className="space-y-3">
          <div className="glass p-4 border-l-4 border-l-jarvis-primary">
            <div className="text-lg font-semibold text-jarvis-ink">{deal.company}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="chip bg-blue-500/15 text-blue-400">{deal.stage}</span>
              <span className="text-sm text-jarvis-body tabular-nums">${(deal.value_usd ?? 0).toLocaleString()}</span>
              <span className="text-xs text-jarvis-muted">{deal.probability}% prob</span>
            </div>
            {deal.contact_name && (
              <div className="text-xs text-jarvis-body mt-2">Contact: {deal.contact_name}</div>
            )}
            {deal.notes && <div className="text-xs text-jarvis-muted mt-1">{deal.notes}</div>}
          </div>
        </div>
      );
    }

    case "position_lookup": {
      const ticker = widget.entities?.ticker;
      const pos = (data?.positions ?? []).find(p => p.ticker === ticker);
      if (!pos) {
        return (
          <MetricCard
            label={ticker || "Position"}
            value="Not found"
            sub="No open position for this ticker"
          />
        );
      }
      return (
        <div className="glass p-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-jarvis-ink">{pos.ticker}</div>
            <span className="chip bg-purple-500/15 text-jarvis-purple">{pos.side}</span>
          </div>
          <div className={`text-2xl font-display font-semibold tabular-nums mt-2 ${pos.pnl_usd >= 0 ? "text-jarvis-success" : "text-jarvis-danger"}`}>
            {pos.pnl_usd >= 0 ? "+" : ""}${Math.abs(pos.pnl_usd ?? 0).toLocaleString()}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div><span className="text-jarvis-muted">Entry:</span> <span className="text-jarvis-ink">${pos.entry_price}</span></div>
            <div><span className="text-jarvis-muted">Size:</span> <span className="text-jarvis-ink">{pos.size}</span></div>
            <div>
              <span className="text-jarvis-muted">Stop:</span>{" "}
              <span className={pos.stop_loss ? "text-jarvis-ink" : "text-jarvis-danger"}>
                {pos.stop_loss ? `$${pos.stop_loss}` : "None"}
              </span>
            </div>
          </div>
        </div>
      );
    }

    case "expenses":
      return (
        <DataList
          title="Expenses Due"
          items={(data?.expenses ?? []).map(e => ({
            label: e.name,
            value: `$${e.amount_usd}`,
            chip: e.frequency,
          }))}
          emptyText="No expenses tracked"
        />
      );

    case "proposals":
      return (
        <DataList
          title="Recent Proposals"
          items={(data?.proposals ?? []).slice(0, 5).map(p => ({
            label: p.name,
            value: p.pricing?.total_per_shipment ? `$${p.pricing.total_per_shipment}` : "",
            chip: p.status,
            chipColor:
              p.status === "accepted" ? "bg-jarvis-success/10 text-jarvis-success"
              : p.status === "sent" ? "bg-blue-500/10 text-blue-400"
              : "",
          }))}
          emptyText="No proposals yet"
        />
      );

    case "forecast":
      return (
        <div className="space-y-3">
          {[30, 60, 90].map(days => {
            const cutoff = new Date(Date.now() + days * 86400000);
            const value = (data?.deals ?? [])
              .filter(d => d.close_date && new Date(d.close_date) <= cutoff)
              .reduce((s, d) => s + (d.value_usd ?? 0) * ((d.probability ?? 50) / 100), 0);
            return (
              <MetricCard
                key={days}
                label={`${days}-Day Forecast`}
                value={`$${Math.round(value).toLocaleString()}`}
                color="text-jarvis-primary"
              />
            );
          })}
        </div>
      );

    default:
      return <MetricCard label={getWidgetMeta(name).label} value="—" sub="Widget loading..." />;
  }
}

export function DisplayPanel({ displayState, data, onBack, history }) {
  const [pinned, setPinned] = useState([]);

  const widgets = displayState?.widgets ?? [];
  const allWidgets = [
    ...pinned.filter(p => !widgets.some(w => (w.widget || w) === (p.widget || p))),
    ...widgets,
  ];

  const togglePin = (widget) => {
    const name = widget.widget || widget;
    setPinned(prev =>
      prev.some(p => (p.widget || p) === name)
        ? prev.filter(p => (p.widget || p) !== name)
        : [...prev, widget]
    );
  };

  const isPinned = (widget) => {
    const name = widget.widget || widget;
    return pinned.some(p => (p.widget || p) === name);
  };

  // Ambient state — show default widgets when no conversation
  if (allWidgets.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-jarvis-border">
          <div className="flex items-center gap-2">
            <Monitor size={14} className="text-jarvis-primary" />
            <span className="label">JARVIS DISPLAY</span>
          </div>
          <div className="flex items-center gap-1">
            <Layers size={12} className="text-jarvis-muted" />
            <span className="text-[10px] text-jarvis-muted">Ambient</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <WidgetRenderer widget="needle_movers" data={data} />
          <WidgetRenderer widget="calendar" data={data} />
          <WidgetRenderer widget={{ widget: "velocity" }} data={data} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-jarvis-border">
        <div className="flex items-center gap-2">
          {history?.length > 1 && (
            <button
              onClick={onBack}
              className="p-1 rounded-lg text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-ghost transition"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          <Monitor size={14} className="text-jarvis-primary" />
          <span className="label">JARVIS DISPLAY</span>
        </div>
        <div className="flex items-center gap-1">
          <Layers size={12} className="text-jarvis-muted" />
          <span className="text-[10px] text-jarvis-muted">
            {allWidgets.length} widget{allWidgets.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {allWidgets.map((w, i) => {
          const name = w.widget || w;
          return (
            <div
              key={`${name}-${i}`}
              className="relative group animate-fadeIn"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition z-10">
                <button
                  onClick={() => togglePin(w)}
                  className="p-1 rounded-lg bg-jarvis-surface border border-jarvis-border text-jarvis-muted hover:text-jarvis-primary transition"
                  title={isPinned(w) ? "Unpin" : "Pin"}
                >
                  {isPinned(w) ? <PinOff size={10} /> : <Pin size={10} />}
                </button>
              </div>
              <WidgetRenderer widget={w} data={data} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
