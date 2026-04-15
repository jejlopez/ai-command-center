// Deal health scoring utilities.
// dealHealth(deal, { activities, objections, discoveryReqs }) → { score, whale, quality, breakdown }
// whaleQuadrant(whaleScore, healthScore) → quadrant string

function _daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function _activityRecency(deal, activities) {
  const lastTouch = deal.last_touch || deal.last_activity_date || deal.update_time;
  const days = _daysSince(lastTouch);
  if (days <= 1) return 20;
  if (days <= 3) return 16;
  if (days <= 7) return 10;
  if (days <= 10) return 5;
  return 0;
}

function _proposalEngagement(deal) {
  let pts = 0;
  if (deal.pandadoc_viewed || deal.proposal_viewed) pts += 10;
  const views = deal.pandadoc_view_count ?? deal.proposal_view_count ?? 0;
  if (views >= 3) pts += 10;
  else if (views >= 2) pts += 5;
  return Math.min(pts, 20);
}

function _replyBehavior(deal) {
  let pts = 0;
  if (deal.email_replied) pts += 10;
  if (deal.responded_within_24h) pts += 5;
  return Math.min(pts, 15);
}

function _nextStepClarity(deal) {
  if (!deal.next_activity) return 0;
  const isFuture = new Date(deal.next_activity) >= new Date();
  return isFuture ? 15 : 5;
}

function _discoveryCompleteness(discoveryReqs) {
  if (!discoveryReqs || discoveryReqs.length === 0) return 0;
  const complete = discoveryReqs.filter((r) => r.complete || r.completed || r.answered).length;
  return Math.round((complete / discoveryReqs.length) * 10);
}

function _buyerUrgency(deal) {
  const timeline = (deal.timeline || (deal.qualification || {}).timeline || "").toLowerCase();
  if (timeline === "immediate") return 10;
  if (timeline === "30_days") return 7;
  if (timeline === "60_days") return 4;
  return 0;
}

function _objectionStatus(objections) {
  const openCount = (objections || []).filter(
    (o) => !o.resolved && !o.dismissed && o.status !== "resolved"
  ).length;
  return Math.max(0, 10 - openCount * 3);
}

function _stagePenalty(deal) {
  const stageEntered = deal.stage_entered_at || deal.stage_changed_at;
  if (!stageEntered) return 0;
  const days = _daysSince(stageEntered);
  if (days <= 14) return 0;
  const weeksOver = Math.floor((days - 14) / 7);
  return weeksOver * 5;
}

function _qualityLabel(score) {
  if (score >= 90) return "whale";
  if (score >= 75) return "excellent";
  if (score >= 60) return "strong";
  if (score >= 40) return "medium";
  if (score >= 20) return "weak";
  return "bad_fit";
}

function _whaleScore(deal) {
  let pts = 0;

  // Annual value
  const annualVal = deal.annual_value ?? (deal.estimated_monthly_value ?? 0) * 12;
  if (annualVal >= 200000) pts += 30;
  else if (annualVal >= 100000) pts += 22;
  else if (annualVal >= 50000) pts += 15;
  else if (annualVal > 0) pts += 8;

  // Volume
  const vol = deal.daily_orders ?? deal.estimated_volume ?? 0;
  if (vol >= 500) pts += 25;
  else if (vol >= 100) pts += 18;
  else if (vol >= 50) pts += 10;

  // Multi-service count ×5, max 20
  const services = deal.services_needed || [];
  pts += Math.min(services.length * 5, 20);

  // Immediate timeline → +10
  const timeline = (deal.timeline || "").toLowerCase();
  if (timeline === "immediate") pts += 10;

  return Math.min(Math.round(pts), 100);
}

export function dealHealth(deal, { activities = [], objections = [], discoveryReqs = [] } = {}) {
  const activityRecency = _activityRecency(deal, activities);
  const proposalEngagement = _proposalEngagement(deal);
  const replyBehavior = _replyBehavior(deal);
  const nextStep = _nextStepClarity(deal);
  const discovery = _discoveryCompleteness(discoveryReqs);
  const buyerUrgency = _buyerUrgency(deal);
  const objectionStatus = _objectionStatus(objections);
  const stagePenalty = _stagePenalty(deal);

  const raw =
    activityRecency +
    proposalEngagement +
    replyBehavior +
    nextStep +
    discovery +
    buyerUrgency +
    objectionStatus -
    stagePenalty;

  const score = Math.max(0, Math.min(100, raw));
  const whale = _whaleScore(deal);
  const quality = _qualityLabel(score);

  return {
    score,
    whale,
    quality,
    breakdown: {
      activityRecency,
      proposalEngagement,
      replyBehavior,
      nextStep,
      discovery,
      buyerUrgency,
      objectionStatus,
      stagePenalty,
    },
  };
}

/**
 * Classify a deal into a strategic quadrant.
 * @param {number} whaleScore  0-100
 * @param {number} healthScore 0-100
 * @returns {string} quadrant key
 */
export function whaleQuadrant(whaleScore, healthScore) {
  const highWhale = whaleScore >= 60;
  const highHealth = healthScore >= 60;

  if (highWhale && highHealth) return "true_whale";
  if (!highWhale && highHealth) return "strong_regular";
  if (!highWhale && healthScore >= 40) return "fast_close";
  if (highWhale && healthScore < 40) return "longshot_whale";
  return "fake_active";
}
