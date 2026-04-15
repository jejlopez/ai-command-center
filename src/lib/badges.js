// Badge computation and color/label maps for the Jarvis design system.

function _daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

/**
 * Compute attention badge for a lead or deal.
 * @param {object} record
 * @param {{ activities: object[], trackingEvents: object[] }} context
 * @returns {"hot"|"warm"|"stale"|"at_risk"|"blocked"}
 */
export function computeAttention(record, { activities = [], trackingEvents = [] } = {}) {
  // Blocked status wins immediately
  if ((record.status || "").toLowerCase() === "blocked") return "blocked";

  // Hot: check tracking events in last 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = trackingEvents.filter(
    (e) => new Date(e.created_at || e.timestamp || 0).getTime() >= cutoff
  );

  const opens = recent.filter((e) => e.type === "email_open" || e.event === "open").length;
  const replies = recent.filter((e) => e.type === "email_reply" || e.event === "reply").length;
  const propViews = recent.filter(
    (e) => e.type === "proposal_view" || e.event === "proposal_view"
  ).length;

  if (opens >= 2 || replies >= 1 || propViews >= 2) return "hot";

  // Compute days silent from record
  const lastTouch =
    record.last_touch ||
    record.last_activity_date ||
    record.last_contacted_at ||
    record.update_time;
  const daysSilent = _daysSince(lastTouch);

  if (daysSilent <= 3) return "warm";
  if (daysSilent <= 10) return "stale";

  // at_risk: >10 days silent OR unresolved objections
  const hasObjections =
    record.objections &&
    record.objections.some(
      (o) => !o.resolved && !o.dismissed && o.status !== "resolved"
    );

  if (daysSilent > 10 || hasObjections) return "at_risk";

  return "stale";
}

// ─── Process status colors ────────────────────────────────────────────────────
export const PROCESS_COLORS = {
  // Lead statuses
  new:               "bg-jarvis-surface text-jarvis-muted border border-jarvis-ghost",
  researching:       "bg-jarvis-purple/20 text-jarvis-purple border border-jarvis-purple/30",
  ready_to_email:    "bg-jarvis-primary/20 text-jarvis-primary border border-jarvis-primary/30",
  sequence_active:   "bg-jarvis-primary text-white",
  waiting:           "bg-jarvis-surface text-jarvis-muted border border-jarvis-ghost",
  discovery_set:     "bg-jarvis-warning/20 text-jarvis-warning border border-jarvis-warning/30",
  qualified:         "bg-jarvis-success/20 text-jarvis-success border border-jarvis-success/30",
  converted:         "bg-jarvis-success text-white",
  nurture:           "bg-jarvis-ink/10 text-jarvis-muted border border-jarvis-ghost",
  dead:              "bg-jarvis-danger/10 text-jarvis-danger border border-jarvis-danger/20",
  // Deal statuses
  discovery:         "bg-jarvis-warning/20 text-jarvis-warning border border-jarvis-warning/30",
  proposal_drafting: "bg-jarvis-purple/20 text-jarvis-purple border border-jarvis-purple/30",
  proposal_sent:     "bg-jarvis-primary/20 text-jarvis-primary border border-jarvis-primary/30",
  negotiating:       "bg-jarvis-warning text-white",
  closing:           "bg-jarvis-success/30 text-jarvis-success border border-jarvis-success/40",
  won:               "bg-jarvis-success text-white",
  lost:              "bg-jarvis-danger text-white",
};

// ─── Quality / score tier colors ─────────────────────────────────────────────
export const QUALITY_COLORS = {
  whale:     "bg-jarvis-purple text-white",
  excellent: "bg-jarvis-success text-white",
  strong:    "bg-jarvis-success/20 text-jarvis-success border border-jarvis-success/30",
  medium:    "bg-jarvis-warning/20 text-jarvis-warning border border-jarvis-warning/30",
  weak:      "bg-jarvis-danger/20 text-jarvis-danger border border-jarvis-danger/30",
  bad_fit:   "bg-jarvis-danger/10 text-jarvis-danger border border-jarvis-danger/20",
};

// ─── Attention badge colors ───────────────────────────────────────────────────
export const ATTENTION_COLORS = {
  hot:     "bg-jarvis-danger text-white",
  warm:    "bg-jarvis-warning text-white",
  stale:   "bg-jarvis-surface text-jarvis-muted border border-jarvis-ghost",
  at_risk: "bg-jarvis-danger/20 text-jarvis-danger border border-jarvis-danger/30",
  blocked: "bg-jarvis-ink text-jarvis-ghost",
};

// ─── Quality labels ───────────────────────────────────────────────────────────
export const QUALITY_LABELS = {
  whale:     "🐋 WHALE",
  excellent: "EXCELLENT",
  strong:    "STRONG",
  medium:    "MEDIUM",
  weak:      "WEAK",
  bad_fit:   "BAD FIT",
};

// ─── Attention labels ─────────────────────────────────────────────────────────
export const ATTENTION_LABELS = {
  hot:     "🔥 HOT",
  warm:    "WARM",
  stale:   "STALE",
  at_risk: "AT RISK",
  blocked: "BLOCKED",
};
