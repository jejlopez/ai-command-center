// Deal age and engagement score utilities.
// Score formula: base stage points + engagement signals - silence penalty.

const STAGE_BASE = {
  "Signing Contract": 30,
  "Demo Scheduled/Site Visit": 25,
  "Negotiations Started": 20,
  "Follow up on proposal": 10,
  "Proposal": 5,
};

export function dealAge(deal) {
  const added = deal.add_time || deal.created_at;
  if (!added) return null;
  return Math.floor((Date.now() - new Date(added).getTime()) / 86_400_000);
}

export function ageColor(days) {
  if (days == null) return "ghost";
  if (days <= 7) return "success";
  if (days <= 21) return "warning";
  return "danger";
}

export function dealScore(deal) {
  let score = 0;

  // Base by stage (normalize trimmed keys)
  const stage = (deal.stage_name || deal.stage || "").trim();
  for (const [key, pts] of Object.entries(STAGE_BASE)) {
    if (stage.startsWith(key) || stage === key) {
      score += pts;
      break;
    }
  }

  // Engagement signals
  if (deal.email_replied) score += 20;
  if (deal.pandadoc_viewed) score += Math.min((deal.pandadoc_view_count || 1) * 15, 30);
  if (deal.next_activity && new Date(deal.next_activity) >= new Date()) score += 15;
  if (deal.meeting_attended) score += 10;
  if (deal.responded_within_24h) score += 10;
  if (deal.stage_advanced_recently) score += 10;

  // Silence penalty
  const lastActivity = deal.last_activity_date || deal.update_time;
  if (lastActivity) {
    const silentDays = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000);
    const silentWeeks = Math.floor(silentDays / 7);
    score -= silentWeeks * 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function scoreColor(score) {
  if (score >= 70) return "success";
  if (score >= 40) return "warning";
  return "danger";
}
