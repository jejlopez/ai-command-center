// Lead scoring utilities.
// leadScore(lead) → { score, whale, quality, breakdown }

function _icpPoints(lead) {
  const rp = lead.research_packet || {};
  let pts = 0;
  if (rp.ecommerce_signals) pts += 5;
  if (rp.what_they_do) pts += 5;
  if (rp.pain_points) pts += 5;
  if (rp.buying_triggers) pts += 5;
  // +5 if ecommerce signal is truthy/affirmative
  if (rp.ecommerce_signals && rp.ecommerce_signals !== false && rp.ecommerce_signals !== "no") pts += 5;
  return Math.min(pts, 25);
}

function _volumePoints(lead) {
  const rp = lead.research_packet || {};
  const q = lead.qualification || {};
  const vol = rp.estimated_volume ?? q.daily_orders ?? 0;
  if (vol >= 500) return 20;
  if (vol >= 100) return 15;
  if (vol >= 50) return 10;
  if (vol > 0) return 5;
  return 0;
}

function _revenuePoints(lead) {
  const q = lead.qualification || {};
  const val = q.estimated_monthly_value ?? 0;
  if (val >= 20000) return 15;
  if (val >= 10000) return 12;
  if (val >= 5000) return 8;
  if (val > 0) return 4;
  return 0;
}

function _engagementPoints(lead) {
  let pts = 0;
  if ((lead.strike_count ?? 0) >= 1) pts += 3;
  const attn = (lead.attention || "").toLowerCase();
  if (attn === "hot") pts += 15;
  else if (attn === "warm") pts += 8;
  if ((lead.status || "").toLowerCase() === "sequence_active") pts += 4;
  return Math.min(pts, 15);
}

function _decisionMakerPoints(lead) {
  const q = lead.qualification || {};
  const access = (q.decision_maker_access || lead.decision_maker_access || "").toLowerCase();
  if (q.is_decision_maker === true || access === "direct") return 10;
  if (access === "indirect") return 5;
  return 0;
}

function _urgencyPoints(lead) {
  const q = lead.qualification || {};
  const timeline = (q.timeline || lead.timeline || "").toLowerCase();
  if (timeline === "immediate") return 10;
  if (timeline === "30_days") return 7;
  if (timeline === "60_days") return 4;
  if (timeline === "exploring") return 2;
  return 0;
}

function _strategicPoints(lead) {
  let pts = 0;
  const tags = lead.tags || [];
  if (tags.includes("marquee")) pts += 3;
  if ((lead.source || "").toLowerCase() === "referral") pts += 2;
  return pts;
}

function _disqualifications(lead) {
  let penalty = 0;
  const rp = lead.research_packet || {};
  const noWebsite = !lead.website && !rp.website;
  const noEcomm = !rp.ecommerce_signals || rp.ecommerce_signals === false || rp.ecommerce_signals === "no";
  if (noWebsite || noEcomm) penalty -= 15;
  if (lead.bad_fit_reason) penalty -= 20;
  return penalty;
}

function _qualityLabel(score) {
  if (score >= 90) return "whale";
  if (score >= 75) return "excellent";
  if (score >= 60) return "strong";
  if (score >= 40) return "medium";
  if (score >= 20) return "weak";
  return "bad_fit";
}

function _whaleScore(lead) {
  const rp = lead.research_packet || {};
  const q = lead.qualification || {};
  let pts = 0;

  // Revenue ×2, max 30
  const monthlyVal = q.estimated_monthly_value ?? 0;
  const revenueRaw = Math.min((monthlyVal / 20000) * 30, 30);
  pts += revenueRaw;

  // Volume ×1.25, max 25
  const vol = rp.estimated_volume ?? q.daily_orders ?? 0;
  if (vol >= 500) pts += 25;
  else if (vol >= 100) pts += 18;
  else if (vol >= 50) pts += 10;
  else if (vol > 0) pts += 5;

  // Services needed count ×5, max 20
  const services = lead.services_needed || rp.services_needed || [];
  pts += Math.min(services.length * 5, 20);

  // Buying triggers → +15
  if (rp.buying_triggers) pts += 15;

  // Strategic → +10
  if (_strategicPoints(lead) > 0) pts += 10;

  return Math.min(Math.round(pts), 100);
}

export function leadScore(lead) {
  const icp = _icpPoints(lead);
  const volume = _volumePoints(lead);
  const revenue = _revenuePoints(lead);
  const engagement = _engagementPoints(lead);
  const decisionMaker = _decisionMakerPoints(lead);
  const urgency = _urgencyPoints(lead);
  const strategic = _strategicPoints(lead);
  const disqualify = _disqualifications(lead);

  const raw = icp + volume + revenue + engagement + decisionMaker + urgency + strategic + disqualify;
  const score = Math.max(0, Math.min(100, raw));
  const whale = _whaleScore(lead);
  const quality = _qualityLabel(score);

  return {
    score,
    whale,
    quality,
    breakdown: { icp, volume, revenue, engagement, decisionMaker, urgency, strategic, disqualify },
  };
}
