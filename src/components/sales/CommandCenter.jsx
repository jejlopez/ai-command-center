// CommandCenter — Sales command center matching the Claude Design spec.
// Editorial morning brief, KPI bar, unified action feed, pipeline health, hot deals, insights.
// Imports dedicated CSS (command-center.css + tokens).

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { jarvis } from "../../lib/jarvis.js";
import "../../styles/command-center-tokens.css";
import "../../styles/command-center.css";

const DealRoomPanel = lazy(() => import("./DealRoomPanel.jsx").then(m => ({ default: m.DealRoomPanel })));
const EmailDetailModal = lazy(() => import("./EmailDetailModal.jsx").then(m => ({ default: m.EmailDetailModal })));

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(n) {
  if (!n) return "$0";
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h >= 22 || h < 5) return "Late night, Samuel?";
  if (h < 12) return "Good morning, Samuel";
  if (h < 17) return "Good afternoon, Samuel";
  return "Good evening, Samuel";
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function timeSinceLabel(dateStr) {
  if (!dateStr) return null;
  const days = daysSince(dateStr);
  if (days === 0) {
    const hrs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    return hrs < 1 ? "just now" : `${hrs} hrs ago`;
  }
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// ── Icons (inline SVG matching the design) ───────────────────────────────────

function SvgIcon({ name, size = 16, stroke = 1.75, className = "", style = {} }) {
  const paths = {
    zap: <path d="M13 3 4 14h6l-1 7 9-11h-6Z"/>,
    sparkles: <><path d="m12 3 1.8 4.5L18 9.3l-4.2 1.8L12 15.6l-1.8-4.5L6 9.3l4.2-1.8Z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></>,
    phone: <path d="M4 5a2 2 0 0 1 2-2h2l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v2a2 2 0 0 1-2 2A13 13 0 0 1 4 5Z"/>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    check: <path d="m5 12 5 5 9-11"/>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    doc: <><path d="M7 3h8l4 4v14H7Z"/><path d="M15 3v4h4"/><path d="M10 12h6M10 16h6"/></>,
    send: <><path d="M22 3 2 10l8 3 3 8 9-18Z"/><path d="m10 13 6-6"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    chev_r: <path d="m9 6 6 6-6 6"/>,
    trend_up: <><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
    trend_down: <><path d="m3 7 6 6 4-4 8 8"/><path d="M14 17h7v-7"/></>,
    refresh: <><path d="M3 12a9 9 0 0 1 16-5.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-16 5.7L3 16"/><path d="M3 21v-5h5"/></>,
    play: <path d="M7 5v14l12-7Z"/>,
    cal_clock: <><path d="M21 11V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7"/><path d="M3 10h18M8 2v4M16 2v4"/><circle cx="17" cy="17" r="4"/><path d="M17 15.5v1.5l1 1"/></>,
    brain: <><path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 3 3v1a3 3 0 0 0 3 3h3V4H9Z"/><path d="M12 4h3a3 3 0 0 1 3 3v1a3 3 0 0 1 3 3 3 3 0 0 1-3 3v1a3 3 0 0 1-3 3h-3"/></>,
  };
  const p = paths[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true">{p}</svg>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points, color = "var(--text-muted)", width = 40, height = 14 }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(height - ((p - min) / range) * height).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Halo ─────────────────────────────────────────────────────────────────────

function Halo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(6,182,212,0.15)" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(6,182,212,0.45)" />
      <circle cx="16" cy="16" r="5" fill="#06b6d4" opacity="0.85" />
      <circle cx="16" cy="16" r="2.2" fill="#a5f3fc" />
      <circle cx="16" cy="16" r="13" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.6">
        <animate attributeName="r" from="10" to="15" dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.6" to="0" dur="2.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ── Morning Brief ────────────────────────────────────────────────────────────

function MorningBrief({ deals, brief, onOpenDeal }) {
  const findDeal = (name) => deals.find(d => (d.org_name || d.title || "").toLowerCase().includes(name.toLowerCase()));
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);
  const hotDeals = deals.filter(d => daysSince(d.last_activity || d.updated_at) <= 7);
  const coldDeals = deals.filter(d => daysSince(d.last_activity || d.updated_at) > 14);
  const coldValue = coldDeals.reduce((s, d) => s + (d.value || 0), 0);

  const topDeal = deals.reduce((best, d) => (d.value || 0) > (best?.value || 0) ? d : best, deals[0]);
  const riskDeal = coldDeals.filter(d => (d.value || 0) > 0).sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  const mostActive = hotDeals.sort((a, b) => daysSince(a.last_activity) - daysSince(b.last_activity))[0];

  // Deals in negotiations (closest to closing)
  const negotiating = deals.filter(d => (d.stage || "").toLowerCase().includes("negotiat"));
  const negotiatingValue = negotiating.reduce((s, d) => s + (d.value || 0), 0);

  const g = greeting();
  const briefText = brief?.todayBriefing;
  const signalCount = hotDeals.length + coldDeals.length;

  return (
    <section className="brief">
      <div className="brief__head">
        <div className="brief__halo"><Halo size={34} /></div>
        <div>
          <div className="brief__label"><SvgIcon name="zap" size={11} /> Jarvis Morning Intelligence</div>
          <div className="brief__meta">Generated just now · {deals.length} deals scanned · {signalCount} signals detected</div>
        </div>
        <div className="brief__actions">
          <button className="btn btn--ghost btn--sm"><SvgIcon name="refresh" size={11} />Regenerate</button>
        </div>
      </div>
      {briefText ? (
        <p className="brief__body">{briefText}</p>
      ) : (
        <>
          <p className="brief__body">
            {g}. Your pipeline sits at <span className="money">{fmtUsd(totalValue)}</span> across {deals.length} active deals
            {negotiating.length > 0 && <>, with <span className="money">{fmtUsd(negotiatingValue)}</span> in active negotiations</>}.
            {mostActive && <> <a className="entity" style={{cursor:"pointer"}} onClick={()=>onOpenDeal?.(mostActive)}>{mostActive.org_name || mostActive.title}</a> is showing the strongest activity — last touched {timeSinceLabel(mostActive.last_activity)}.</>}
            {topDeal && topDeal !== mostActive && <> <a className="entity" style={{cursor:"pointer"}} onClick={()=>onOpenDeal?.(topDeal)}>{topDeal.org_name || topDeal.title}</a> remains the biggest opportunity at <span className="money">{fmtUsd(topDeal.value)}</span>.</>}
          </p>
          <p className="brief__body">
            {riskDeal ? (
              <>The day needs you here first: <a className="entity" style={{cursor:"pointer"}} onClick={()=>onOpenDeal?.(riskDeal)}>{riskDeal.org_name || riskDeal.title}</a> has been silent {daysSince(riskDeal.last_activity)} days — <span className="risk">churn risk is rising</span> with <span className="money">{fmtUsd(riskDeal.value)}</span> at stake.
              {coldDeals.length > 1 && <> {coldDeals.length} deals total going cold, <span className="money">{fmtUsd(coldValue)}</span> exposed.</>}
              </>
            ) : (
              <>No urgent fires today. Focus on advancing your {negotiating.length > 0 ? `${negotiating.length} negotiations` : "pipeline"} — estimated impact if you close one this week: <span className="money">{fmtUsd(negotiating[0]?.value || topDeal?.value || 0)}</span>.</>
            )}
          </p>
        </>
      )}
      <div className="brief__foot">
        <span className="sparkle"><SvgIcon name="sparkles" size={11} style={{ color: "var(--accent)" }} /> Signal sources: inbox, CRM events, engagement tracking</span>
        <span className="sep">·</span>
        <span>Next re-rank in 58 min</span>
        <span className="sep">·</span>
        <span><span className="sync-dot" />All systems synced</span>
      </div>
    </section>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, unit, delta, deltaTone, variant, spark, sparkColor, onClick }) {
  return (
    <div className={`kpi ${variant ? `kpi--${variant}` : ""}`} onClick={onClick} style={onClick ? {cursor:"pointer"} : {}}>
      <div className="kpi__label">
        <span>{label}</span>
        {spark && <span className="kpi__spark"><Sparkline points={spark} color={sparkColor} /></span>}
      </div>
      <div className="kpi__value">{value}{unit && <span className="unit">{unit}</span>}</div>
      <div className="kpi__delta">
        {deltaTone === "up" && <SvgIcon name="trend_up" size={10} style={{ color: "var(--success)" }} />}
        {deltaTone === "down" && <SvgIcon name="trend_down" size={10} style={{ color: "var(--danger)" }} />}
        <span className={deltaTone || ""}>{delta}</span>
      </div>
    </div>
  );
}

function KPIBar({ deals, onSwitchTab }) {
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);
  // Hot = active in last 7 days (48h too narrow for weekly activity patterns)
  const hotDeals = deals.filter(d => daysSince(d.last_activity || d.updated_at) <= 7);
  // Cold = no activity in 14+ days
  const coldDeals = deals.filter(d => daysSince(d.last_activity || d.updated_at) > 14);
  const atRiskValue = coldDeals.reduce((s, d) => s + (d.value || 0), 0);
  // Overdue = no activity in 7+ days (since days_in_stage isn't populated from Pipedrive)
  const overdue = deals.filter(d => daysSince(d.last_activity || d.updated_at) > 7);
  const closingStages = ["negotiations started", "signing"];
  const closingValue = deals.filter(d => closingStages.some(s => (d.stage || "").toLowerCase().includes(s))).reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div className="kpis">
      <KPI label="Pipeline Value" value={fmtUsd(totalValue)} delta={`${deals.length} deals`} deltaTone="up" spark={[3, 4, 5, 4, 6, 7, 8, 9]} sparkColor="var(--success)" onClick={()=>onSwitchTab?.("deals")} />
      <KPI label="Active Deals" value={deals.length} unit={`across ${new Set(deals.map(d => d.stage)).size} stages`} delta="open" deltaTone="up" />
      <KPI label="Hot Deals" value={hotDeals.length} delta="active this week" deltaTone={hotDeals.length > 5 ? "up" : "down"} spark={[3, 4, 5, 4, 6, 6, 7, hotDeals.length]} />
      <KPI label="At Risk" value={coldDeals.length} unit={`· ${fmtUsd(atRiskValue)}`} variant="danger" delta={`${fmtUsd(atRiskValue)} exposed`} deltaTone="down" spark={[1, 1, 2, 2, 2, 3, 3, coldDeals.length]} sparkColor="var(--danger)" />
      <KPI label="Needs Attention" value={overdue.length} unit="deals" variant={overdue.length > 10 ? "warn" : ""} delta={`silent >7 days`} deltaTone="warn" spark={[6, 7, 8, 10, 11, 11, 12, overdue.length]} sparkColor="var(--warning)" />
      <KPI label="Closing this mo." value={fmtUsd(closingValue)} delta="in negotiations" deltaTone="up" spark={[50, 80, 110, 150, 180, 220, 250, closingValue / 1000]} sparkColor="var(--success)" />
    </div>
  );
}

// ── Feed Item ────────────────────────────────────────────────────────────────

const TYPE_ICONS = {
  call: "phone",
  email: "mail",
  task: "check",
  deal: "target",
};

function FeedItem({ item, onDone, onAction, isDone }) {
  const [whyOpen, setWhyOpen] = useState(false);

  const handleBtn = (btn, e) => {
    e.stopPropagation();
    const l = btn.label.toLowerCase();
    if (l.includes("call")) onAction?.("call", item);
    else if (l.includes("see email") || l.includes("see amend")) onAction?.("email", item);
    else if (l.includes("review draft") || l.includes("review nudge")) onAction?.("draft", item);
    else if (l.includes("draft email")) onAction?.("compose", item);
    else if (l.includes("send calendar") || l.includes("reschedule")) onAction?.("calendar", item);
    else if (l.includes("prep brief") || l.includes("start prep")) onAction?.("brief", item);
    else if (l.includes("send rate")) onAction?.("compose", item);
    else if (l.includes("open doc")) onAction?.("open_deal", item);
    else if (l.includes("update now") || l.includes("confirm") || l.includes("quick thanks")) onAction?.("quick_reply", item);
    else if (l.includes("mark done") || l.includes("skip") || l.includes("not yet")) onDone?.(item.id);
    else onAction?.("open_deal", item);
  };

  return (
    <article className={`fitem ${item.urgent ? "is-urgent" : ""} ${item.pulse ? "is-urgent-pulse" : ""} ${isDone ? "is-done" : ""}`}>
      <div className={`fitem__type fitem__type--${item.type}`}>
        <SvgIcon name={TYPE_ICONS[item.type] || "target"} size={13} />
      </div>
      <div className="fitem__rank">{item.rank}</div>
      <div className="fitem__body">
        <div className="fitem__line1">
          <div className="fitem__line1-left">
            <span className="fitem__title" style={{cursor:"pointer"}} onClick={(e)=>{e.stopPropagation();onAction?.("open_deal",item);}}>{item.title}</span>
            <span className="fitem__sep">·</span>
            <span className={`fitem__kind ${item.kindTone ? `fitem__kind--${item.kindTone}` : ""}`}>{item.kind}</span>
          </div>
          {item.value ? (
            <span className={`fitem__value ${item.valueTone ? `fitem__value--${item.valueTone}` : ""}`}>
              {item.value}{item.valueSub && <span style={{ color: "var(--rf-ink-4)", fontWeight: 400, marginLeft: 4, fontSize: 11 }}>{item.valueSub}</span>}
            </span>
          ) : <span />}
        </div>
        <div className="fitem__action">{item.action}</div>
        <div className={`fitem__why ${whyOpen ? "is-open" : ""}`} onClick={(e) => { e.stopPropagation(); setWhyOpen(o => !o); }}>
          <SvgIcon name="sparkles" size={11} className="fitem__why__icon" style={{ color: "var(--accent)" }} />
          <span className="fitem__why__body">{item.why}</span>
          <SvgIcon name="chev_r" size={10} className="fitem__why__chev" />
        </div>
        <div className="fitem__meta">
          {item.lastTouch && <span className="fitem__meta-time"><SvgIcon name="clock" size={9} />Last {item.lastTouch}</span>}
          {item.respondWithin && <span className={`fitem__meta-time fitem__meta-time--${item.respondWithin.tone}`}><SvgIcon name="clock" size={9} />Respond {item.respondWithin.label}</span>}
          <div className="fitem__meta-tags">
            {(item.tags || []).map((t, i) => <span key={i} className={`pill ${t.tone ? `pill--${t.tone}` : ""}`}>{t.label}</span>)}
          </div>
        </div>
      </div>
      <div className="fitem__right">
        <button className="fitem__check" onClick={(e) => { e.stopPropagation(); onDone?.(item.id); }} title="Mark done">
          <SvgIcon name="check" size={12} />
        </button>
        <div className="fitem__actions">
          {(item.buttons || []).map((b, i) => (
            <button key={i} className={`btn btn--sm ${b.primary ? (item.urgent ? "btn--danger" : "btn--primary") : "btn--ghost"}`}
              onClick={(e) => handleBtn(b, e)}>
              {b.icon && <SvgIcon name={b.icon} size={11} />}{b.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

// ── Action Feed ──────────────────────────────────────────────────────────────

const FILTERS = [
  { id: "all", label: "All", types: null },
  { id: "call", label: "Calls", types: ["call"] },
  { id: "email", label: "Emails", types: ["email"] },
  { id: "task", label: "Tasks", types: ["task"] },
  { id: "deal", label: "Deals", types: ["deal"] },
];

function buildFeedItems(deals) {
  const items = [];
  let rank = 0;

  // Sort deals by urgency
  const scored = deals.map(d => {
    const ds = daysSince(d.last_activity || d.updated_at);
    const daysStage = d.days_in_stage || 0;
    const value = d.value || 0;
    const stage = (d.stage || "").toLowerCase();
    const urgency = Math.min(10, Math.round(
      (value > 200000 ? 4 : value > 50000 ? 2 : 1) +
      (ds > 14 ? 3 : ds > 7 ? 2 : ds < 2 ? 2 : 0) +
      (daysStage > 21 ? 2 : daysStage > 14 ? 1 : 0)
    ));
    return { ...d, urgency, daysSinceActivity: ds, daysInStage: daysStage };
  }).sort((a, b) => b.urgency - a.urgency || (b.value || 0) - (a.value || 0));

  for (const d of scored.slice(0, 12)) {
    rank++;
    const company = d.org_name || d.title || "Unknown";
    const contact = d.contact_name || "";
    const ds = d.daysSinceActivity;
    const stage = (d.stage || "").toLowerCase();
    const value = d.value || 0;

    let type = "deal";
    let kind = d.stage || "Open";
    let kindTone = "";
    let action = "";
    let why = "";
    let tags = [];
    let buttons = [];
    let urgent = false;
    let pulse = false;

    if (ds > 14 && value > 50000) {
      type = "call";
      kind = "Churn Risk";
      kindTone = "danger";
      action = `Re-engage ${contact || company} — ${ds} days silent. ${fmtUsd(value)} at risk.`;
      why = `${ds} days without contact drops close rate to ~23%. Personal call recovers ~40% of cooling deals.`;
      tags = [{ label: "Urgent", tone: "danger" }, { label: `${ds}d silent` }];
      buttons = [{ label: "Call now", icon: "phone", primary: true }, { label: "See email", icon: "mail" }];
      urgent = rank <= 2;
      pulse = rank === 1;
    } else if (ds < 2 && value > 100000) {
      type = "email";
      kind = "High Engagement";
      kindTone = "violet";
      action = `Reply to ${contact || company} — showing strong engagement signals.`;
      why = `Active in the last ${ds || 1} day(s). Same-day reply converts 4× vs next day.`;
      tags = [{ label: "Whale", tone: "whale" }, { label: "Hot" }];
      buttons = [{ label: "Review draft", icon: "doc", primary: true }, { label: "Call instead", icon: "phone" }];
      urgent = rank <= 2;
    } else if (stage.includes("proposal") && d.daysInStage > 7) {
      type = "email";
      kind = "Follow up on proposal";
      kindTone = "warn";
      action = `Follow up with ${contact || company} — proposal pending ${d.daysInStage} days.`;
      why = `Proposals going ${d.daysInStage}+ days without response need a nudge. Push for decision.`;
      tags = [{ label: "Proposal pending" }];
      buttons = [{ label: "Review draft", icon: "doc", primary: true }, { label: "Send calendar", icon: "cal_clock" }];
    } else if (stage.includes("negotiat")) {
      type = "deal";
      kind = "Contract Stage";
      kindTone = "info";
      action = `Advance negotiations with ${contact || company} — close this month.`;
      why = `In negotiations for ${d.daysInStage} days. ${fmtUsd(value)} deal.`;
      tags = [{ label: "Closing" }];
      buttons = [{ label: "Review draft", icon: "doc", primary: true }, { label: "Prep brief", icon: "doc" }];
    } else if (stage.includes("demo") || stage.includes("site")) {
      type = "task";
      kind = "Post-Demo";
      kindTone = "success";
      action = `Schedule next step with ${contact || company} after demo.`;
      why = `Convert interest to proposal this week.`;
      tags = [{ label: "Demo done" }];
      buttons = [{ label: "Send calendar", icon: "cal_clock", primary: true }, { label: "Draft email", icon: "mail" }];
    } else {
      type = "email";
      kind = d.stage || "Open";
      action = `Check in with ${contact || company}.`;
      why = `Routine touch point. Keep deal moving forward.`;
      tags = [];
      buttons = [{ label: "Draft email", icon: "mail", primary: true }];
    }

    items.push({
      id: d.id,
      rank,
      type,
      urgent,
      pulse,
      title: `${company}${contact ? ` — ${contact}` : ""}`,
      kind,
      kindTone,
      value: value > 0 ? fmtUsd(value) : null,
      valueSub: value > 200000 ? "whale" : null,
      valueTone: ds > 14 && value > 50000 ? "danger" : null,
      action,
      why,
      lastTouch: timeSinceLabel(d.last_activity || d.updated_at),
      respondWithin: urgent ? { label: "today", tone: "warn" } : null,
      tags,
      buttons,
      deal: d,
    });
  }

  return items;
}

// ── Collapsible Section ──────────────────────────────────────────────────────

function FeedSection({ title, emoji, count, defaultOpen = false, bulkLabel, onBulk, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: open ? 0 : 8 }}>
      <button
        className={`completed-head ${open ? "is-open" : ""}`}
        onClick={() => setOpen(o => !o)}
        style={{ marginTop: 6, marginBottom: open ? 8 : 0 }}
      >
        <span style={{ fontSize: 13 }}>{emoji}</span>
        <span>{title}</span>
        <span className="completed-head__count">{count} items</span>
        {bulkLabel && !open && (
          <span className="btn btn--sm btn--ghost" style={{ marginLeft: "auto", marginRight: 8 }}
            onClick={(e) => { e.stopPropagation(); onBulk?.(); }}>
            {bulkLabel}
          </span>
        )}
        <SvgIcon name="chev_r" size={11} className="completed-head__chev" />
      </button>
      {open && (
        <div style={{ marginBottom: 12 }}>
          {bulkLabel && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button className="btn btn--sm btn--primary" onClick={onBulk}>{bulkLabel}</button>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

// ── Compact email row for sections 2-4 ───────────────────────────────────────

function CompactEmailRow({ item, onAction }) {
  return (
    <div className="fitem fitem--mini" style={{ gridTemplateColumns: "22px 1fr auto", opacity: 1, cursor: "pointer" }}
      onClick={() => onAction?.("email", item)}>
      <div className="fitem__type fitem__type--email" style={{ width: 22, height: 22 }}>
        <SvgIcon name="mail" size={11} />
      </div>
      <div>
        <div className="fitem__title" style={{ fontSize: 12.5, fontWeight: 500 }}>{item.title}</div>
        <div className="fitem__kind" style={{ fontSize: 10.5 }}>{item.action}</div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {(item.buttons || []).map((b, i) => (
          <button key={i} className={`btn btn--sm ${b.primary ? "btn--primary" : "btn--ghost"}`}
            onClick={(e) => { e.stopPropagation(); onAction?.(b.label.toLowerCase().includes("thanks") || b.label.toLowerCase().includes("confirm") ? "quick_reply" : "email", item); }}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionFeed({ deals, onAction, onSwitchTab }) {
  const [filter, setFilter] = useState("all");
  const [done, setDone] = useState(new Set());
  const [feedItems, setFeedItems] = useState([]);
  const [sections, setSections] = useState({});
  const [totalAll, setTotalAll] = useState(0);
  const [showCompleted, setShowCompleted] = useState(false);

  // Fetch real action feed from jarvisd
  useEffect(() => {
    jarvis.crmActionFeed?.().then(data => {
      if (data?.items) {
        setFeedItems(data.items);
        setSections(data.sections || {});
        setTotalAll(data.totalAll || data.items.length);
      }
    }).catch(() => {
      setFeedItems(buildFeedItems(deals));
    });
  }, [deals.length]);

  const activeItems = feedItems.filter(i => !done.has(i.id));
  const doneItems = feedItems.filter(i => done.has(i.id));

  const counts = FILTERS.reduce((a, f) => ({
    ...a,
    [f.id]: f.types ? activeItems.filter(i => f.types.includes(i.type)).length : activeItems.length,
  }), {});

  const currentFilter = FILTERS.find(f => f.id === filter);
  const visible = currentFilter?.types
    ? activeItems.filter(i => currentFilter.types.includes(i.type))
    : activeItems;

  const totalItems = feedItems.length;
  const handled = doneItems.length;
  const pct = totalItems > 0 ? Math.round((handled / totalItems) * 100) : 0;

  const toggleDone = (id) => {
    // Find the item to get its source info
    const item = feedItems.find(i => i.id === id);
    if (item && !done.has(id)) {
      // Persist to backend so it doesn't reappear
      jarvis.crmActionHandled?.(id, item.source, item.sourceId, "handled").catch(() => {});
    }
    setDone(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <section>
      <div className="feed-head">
        <h2 className="feed-head__title"><SvgIcon name="target" size={11} />Today's Actions</h2>
        <span className="feed-head__sub">{totalAll} items across {1 + (sections.quick_reply?.count ? 1 : 0) + (sections.fyi?.count ? 1 : 0) + (sections.system?.count ? 1 : 0)} sections</span>
        <div className="feed-head__counter">
          <span>{activeItems.length} action items</span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span className="done">{handled} handled</span>
        </div>
      </div>
      <div className="feed-progress"><div className="feed-progress__fill" style={{ width: `${pct}%` }} /></div>
      <div className="feed-filters">
        {FILTERS.map(f => (
          <button key={f.id} className={`feed-filter ${filter === f.id ? "is-active" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label}
            <span className="feed-filter__count">{counts[f.id]}</span>
          </button>
        ))}
      </div>
      <div className="feed">
        {visible.map(it => <FeedItem key={it.id} item={it} onDone={toggleDone} onAction={onAction} isDone={false} />)}
        {visible.length === 0 && (
          <div className="empty">
            <SvgIcon name="check" size={24} style={{ color: "var(--success)" }} />
            <div className="empty__title">All caught up</div>
            <div className="empty__sub">Jarvis will surface the next item when something changes.</div>
          </div>
        )}
      </div>
      {doneItems.length > 0 && (
        <>
          <button className={`completed-head ${showCompleted ? "is-open" : ""}`} onClick={() => setShowCompleted(s => !s)}>
            <span className="completed-head__check"><SvgIcon name="check" size={13} /></span>
            <span>{doneItems.length} items handled today</span>
            <span className="completed-head__count">{showCompleted ? "Hide" : "Show"}</span>
            <SvgIcon name="chev_r" size={11} className="completed-head__chev" />
          </button>
          {showCompleted && (
            <div className="completed-list">
              {doneItems.map(c => (
                <div key={c.id} className="fitem fitem--mini">
                  <div className={`fitem__type fitem__type--${c.type}`} style={{ width: 22, height: 22, fontSize: 11 }}>
                    <SvgIcon name={TYPE_ICONS[c.type] || "target"} size={11} />
                  </div>
                  <div>
                    <div className="fitem__title">{c.title}</div>
                    <div className="fitem__kind">{c.kind}</div>
                  </div>
                  <button className="btn btn--sm btn--ghost" onClick={() => toggleDone(c.id)}>Undo</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Section 2: Quick Replies */}
      {sections.quick_reply?.count > 0 && (
        <FeedSection title="Quick Replies" emoji="✉️" count={sections.quick_reply.count}
          bulkLabel="Send all quick thanks"
          onBulk={() => { /* batch quick reply */ }}>
          <div className="feed" style={{ gap: 2 }}>
            {(sections.quick_reply.items || []).map(it => (
              <CompactEmailRow key={it.id} item={it} onAction={onAction} />
            ))}
          </div>
        </FeedSection>
      )}

      {/* Section 3: FYI — Inbox Scan */}
      {sections.fyi?.count > 0 && (
        <FeedSection title="FYI — Inbox Scan" emoji="📖" count={sections.fyi.count}
          bulkLabel="Mark all as read"
          onBulk={() => { /* batch mark read */ }}>
          <div className="feed" style={{ gap: 2 }}>
            {(sections.fyi.items || []).map(it => (
              <CompactEmailRow key={it.id} item={it} onAction={onAction} />
            ))}
          </div>
        </FeedSection>
      )}

      {/* Section 4: System & Automated */}
      {sections.system?.count > 0 && (
        <FeedSection title="System & Automated" emoji="🔔" count={sections.system.count}
          bulkLabel="Archive all"
          onBulk={() => { /* batch archive */ }}>
          <div className="feed" style={{ gap: 2 }}>
            {(sections.system.items || []).map(it => (
              <CompactEmailRow key={it.id} item={it} onAction={onAction} />
            ))}
          </div>
        </FeedSection>
      )}
    </section>
  );
}

// ── Pipeline Health ──────────────────────────────────────────────────────────

function Stage({ name, value, pct, color, count, sub }) {
  return (
    <div className="stage">
      <div className="stage__head">
        <div className="stage__name"><span className="stage__dot" style={{ background: color }} />{name}</div>
        <div className="stage__value">{fmtUsd(value)}</div>
      </div>
      <div className="stage__bar">
        <div className="stage__bar__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="stage__meta">
        <span>{count} deals · {sub}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

function PipelineHealth({ deals }) {
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);
  const stageOrder = ["Demo Scheduled/Site Visit", "Negotiations Started", "Follow up on proposal", "Proposal", "Send Custom Proposal", "Review Proposal & Get Feedback"];
  const groups = {};
  for (const d of deals) {
    const stage = (d.stage || "Other").trim();
    if (!groups[stage]) groups[stage] = { value: 0, count: 0 };
    groups[stage].value += d.value || 0;
    groups[stage].count++;
  }
  const maxVal = Math.max(1, ...Object.values(groups).map(g => g.value));
  const stageColors = {
    "Demo Scheduled/Site Visit": "var(--success)",
    "Negotiations Started": "var(--accent)",
    "Follow up on proposal": "var(--warning)",
    "Proposal": "var(--violet)",
    "Send Custom Proposal": "var(--text-muted)",
    "Review Proposal & Get Feedback": "var(--info)",
  };

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Pipeline Health</h3>
        <span className="panel__sub">{deals.length} deals · {fmtUsd(totalValue)}</span>
      </div>
      {stageOrder.filter(s => groups[s]).map(s => (
        <Stage
          key={s}
          name={s}
          value={groups[s].value}
          pct={Math.round((groups[s].value / maxVal) * 100)}
          color={stageColors[s] || "var(--text-muted)"}
          count={groups[s].count}
          sub={groups[s].count > 5 ? "Healthy" : "Needs attention"}
        />
      ))}
    </section>
  );
}

// ── Hot Deals ────────────────────────────────────────────────────────────────

function HotDeals({ deals }) {
  const hot = deals
    .filter(d => daysSince(d.last_activity || d.updated_at) <= 7)
    .sort((a, b) => daysSince(a.last_activity || a.updated_at) - daysSince(b.last_activity || b.updated_at))
    .slice(0, 5);

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Hot Deals</h3>
        <span className="panel__sub">This week · {hot.length} active</span>
      </div>
      <div>
        {hot.map((d, i) => (
          <div key={d.id || i} className="hot__row">
            <div className="hot__left">
              <div className="hot__body">
                <div className="hot__name">
                  {d.org_name || d.title}
                  {daysSince(d.last_activity || d.updated_at) <= 3 && <span className="hot__fire">●</span>}
                </div>
                <div className="hot__sub">{d.contact_name || d.stage} · {timeSinceLabel(d.last_activity || d.updated_at)}</div>
              </div>
            </div>
            <div className="hot__right">
              <div className="hot__value">{fmtUsd(d.value)}</div>
              <div className={`hot__status-dot hot__status-dot--${daysSince(d.last_activity) <= 3 ? "hot" : "active"}`} />
            </div>
          </div>
        ))}
        {hot.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 10 }}>No hot signals in last 48h</div>}
      </div>
    </section>
  );
}

// ── Insights ─────────────────────────────────────────────────────────────────

function Insights({ deals }) {
  const coldDeals = deals.filter(d => daysSince(d.last_activity || d.updated_at) > 14);
  const hotDeals = deals.filter(d => daysSince(d.last_activity || d.updated_at) <= 7);
  const coldValue = coldDeals.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Jarvis Insights</h3>
        <span className="panel__sub">This week</span>
      </div>
      <div className="insights">
        {coldDeals.length > 0 && (
          <div className="insight insight--cyan">
            <div className="insight__head"><div className="insight__label"><SvgIcon name="zap" size={10} />Pattern detected</div></div>
            <p className="insight__body">{coldDeals.length} deals have gone cold (14+ days). <span className="emc">{fmtUsd(coldValue)}</span> at risk. Consider batch re-engagement.</p>
            <div className="insight__actions">
              <button className="insight__btn insight__btn--primary">Re-engage all</button>
              <button className="insight__btn">Dismiss</button>
            </div>
          </div>
        )}
        {hotDeals.length > 0 && (
          <div className="insight insight--warn">
            <div className="insight__head"><div className="insight__label"><SvgIcon name="trend_up" size={10} />Opportunity</div></div>
            <p className="insight__body">{hotDeals.length} deals showing engagement in the last 48 hours. Total: <span className="emw">{fmtUsd(hotDeals.reduce((s, d) => s + (d.value || 0), 0))}</span>. Strike now.</p>
            <div className="insight__actions">
              <button className="insight__btn insight__btn--primary">Show deals</button>
              <button className="insight__btn">Dismiss</button>
            </div>
          </div>
        )}
        <div className="insight insight--green">
          <div className="insight__head"><div className="insight__label"><SvgIcon name="brain" size={10} />Coaching note</div></div>
          <p className="insight__body">
            {deals.length > 40
              ? <>Pipeline is wide at {deals.length} deals. Focus on advancing top 10 by value rather than spreading thin.</>
              : <>{deals.length} active deals — manageable. Prioritize stage advancement this week.</>
            }
          </p>
          <div className="insight__actions">
            <button className="insight__btn insight__btn--primary">See top 10</button>
            <button className="insight__btn">Dismiss</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Action Bar ───────────────────────────────────────────────────────────────

function ActionBar({ dealCount, onSwitchTab }) {
  return (
    <div className="actionbar">
      <button className="btn btn--primary"><SvgIcon name="play" size={11} />Start processing</button>
      <button className="btn btn--ghost btn--sm" onClick={() => onSwitchTab?.("deals")}>See all {dealCount} deals</button>
      <button className="btn btn--ghost btn--sm" onClick={() => onSwitchTab?.("inbox")}>Review drafts</button>
      <button className="btn btn--ghost btn--sm">EOD summary</button>
      <div className="actionbar__sub">
        <span><kbd>E</kbd> emails</span>
        <span><kbd>/</kbd> search</span>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function CommandCenter({ ops, crm, onSwitchTab }) {
  const [brief, setBrief] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const rawDeals = crm?.deals?.length > 0 ? crm.deals : (ops?.deals || []);

  // Filter to New pipeline active deals (no lead stages)
  const LEAD_STAGES = ["new lead", "new leads", "pipedrive leads", "gather info"];
  const deals = rawDeals.filter(d =>
    (d.pipeline || "").trim() === "New pipeline" &&
    d.status === "open" &&
    !LEAD_STAGES.some(ls => (d.stage || "").toLowerCase().includes(ls))
  );

  useEffect(() => {
    jarvis.brief?.().then(b => setBrief(b)).catch(() => {});
  }, []);

  // Central action handler for all buttons
  const handleAction = useCallback((action, item) => {
    const deal = item?.deal || item;
    switch (action) {
      case "open_deal":
        setSelectedDeal(deal);
        break;
      case "call":
        // Log call attempt, open deal panel to timeline
        if (deal?.contact_phone) {
          window.open(`tel:${deal.contact_phone}`, "_self");
        }
        // Log the call activity
        jarvis.learningLog?.("deal_judgment", {
          action: "call_initiated",
          company: deal?.org_name || deal?.title,
          contact: deal?.contact_name,
        }, deal?.id).catch(() => {});
        setSelectedDeal(deal);
        break;
      case "email":
        // Open email modal — use real email data if available from feed item
        const emailData = item?.email;
        if (emailData?.message_id) {
          setSelectedEmail({
            message_id: emailData.message_id,
            from_addr: emailData.from_addr,
            subject: emailData.subject,
            snippet: emailData.snippet,
            category: emailData.category || "fyi",
            thread_id: emailData.thread_id || item?.threadId,
            created_at: emailData.created_at,
          });
        } else if (item?.sourceId) {
          setSelectedEmail({
            message_id: item.sourceId,
            from_addr: item.title || "",
            subject: item.action || "",
            snippet: "",
            category: "fyi",
            thread_id: item.threadId,
            created_at: new Date().toISOString(),
          });
        } else if (deal?.contact_email) {
          setSelectedEmail({
            message_id: null,
            from_addr: deal.contact_email,
            subject: "",
            snippet: "",
            category: "fyi",
            thread_id: null,
            created_at: new Date().toISOString(),
          });
        } else {
          setSelectedDeal(deal);
        }
        break;
      case "draft":
      case "compose":
        // Open email compose via the draft skill
        if (deal?.contact_email) {
          jarvis.emailAiDraft?.(deal.id, "follow_up", {
            originalFrom: deal.contact_email,
            originalSubject: deal.org_name || deal.title,
          }).catch(() => {});
        }
        setSelectedDeal(deal);
        break;
      case "calendar":
        // Open Google Calendar with pre-filled invite
        const calTitle = encodeURIComponent(`Meeting with ${deal?.contact_name || deal?.org_name || "Contact"}`);
        const calDetails = encodeURIComponent(`Re: ${deal?.org_name || deal?.title}`);
        window.open(`https://calendar.google.com/calendar/u/0/r/eventedit?text=${calTitle}&details=${calDetails}`, "_blank");
        break;
      case "brief":
        // Open deal with timeline tab (shows all context)
        setSelectedDeal(deal);
        break;
      case "quick_reply":
        // Quick action — mark as handled
        jarvis.learningLog?.("deal_judgment", {
          action: "quick_reply",
          company: deal?.org_name || deal?.title,
        }, deal?.id).catch(() => {});
        break;
      case "stage_update":
        setSelectedDeal(deal);
        break;
      default:
        setSelectedDeal(deal);
    }
  }, []);

  return (
    <main className="main">
      <MorningBrief deals={deals} brief={brief} onOpenDeal={setSelectedDeal} />
      <KPIBar deals={deals} onSwitchTab={onSwitchTab} />
      <div className="grid">
        <ActionFeed deals={deals} onAction={handleAction} onSwitchTab={onSwitchTab} />
        <div className="rail">
          <PipelineHealth deals={deals} />
          <HotDeals deals={deals} />
          <Insights deals={deals} />
        </div>
      </div>
      <ActionBar dealCount={deals.length} onSwitchTab={onSwitchTab} />

      {/* Deal detail panel */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {selectedDeal && (
            <DealRoomPanel deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Email detail modal */}
      {selectedEmail && (
        <Suspense fallback={null}>
          <EmailDetailModal triageEmail={selectedEmail} onClose={() => setSelectedEmail(null)} />
        </Suspense>
      )}
    </main>
  );
}
