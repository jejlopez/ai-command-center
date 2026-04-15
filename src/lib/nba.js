// Next-best-action (NBA) computation for leads and deals.
// computeNBA(record, { type, sequence, trackingEvents }) → { action, reason, due_at, priority }

function _daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function _hasHotEngagement(trackingEvents = []) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = trackingEvents.filter(
    (e) => new Date(e.created_at || e.timestamp || 0).getTime() >= cutoff
  );
  const opens = recent.filter((e) => e.type === "email_open" || e.event === "open").length;
  const propViews = recent.filter(
    (e) => e.type === "proposal_view" || e.event === "proposal_view"
  ).length;
  return opens >= 3 || propViews >= 2;
}

function _now() {
  return new Date().toISOString();
}

function _hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function _daysFromNow(d) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Compute the next best action for a lead or deal.
 *
 * @param {object} record       Lead or deal object
 * @param {object} opts
 * @param {"lead"|"deal"} opts.type
 * @param {object|null}   opts.sequence      Active sequence object (may have next_fire_at)
 * @param {object[]}      opts.trackingEvents
 * @returns {{ action: string, reason: string, due_at: string, priority: number }}
 */
export function computeNBA(record, { type = "lead", sequence = null, trackingEvents = [] } = {}) {
  // 1. Hot engagement — highest priority regardless of type
  if (_hasHotEngagement(trackingEvents)) {
    return {
      action: "call_now",
      reason: "Hot engagement: multiple opens or proposal views in last 24h",
      due_at: _now(),
      priority: 1,
    };
  }

  const status = (record.status || "").toLowerCase();

  if (type === "lead") {
    // Lead status state machine
    switch (status) {
      case "new":
        return {
          action: "research",
          reason: "New lead — run ICP research before outreach",
          due_at: _daysFromNow(1),
          priority: 5,
        };

      case "researching":
        return {
          action: "wait_research",
          reason: "Research in progress",
          due_at: _daysFromNow(1),
          priority: 8,
        };

      case "ready_to_email":
        return {
          action: "send_email",
          reason: "Lead is researched and ready for first outreach",
          due_at: _now(),
          priority: 3,
        };

      case "discovery_set":
        return {
          action: "prep_call",
          reason: "Discovery call is scheduled — prepare talking points",
          due_at: _now(),
          priority: 2,
        };

      case "qualified":
        return {
          action: "convert",
          reason: "Qualified lead — move to deal pipeline",
          due_at: _now(),
          priority: 2,
        };

      case "sequence_active": {
        const lastTouch =
          record.last_touch || record.last_activity_date || record.last_contacted_at;
        const silent = _daysSince(lastTouch);
        if (silent >= 5) {
          return {
            action: "follow_up",
            reason: `${silent} days silent while sequence is active`,
            due_at: _now(),
            priority: 4,
          };
        }
        break;
      }

      default:
        break;
    }

    // Strike ≥ 5 → nurture or close
    if ((record.strike_count ?? 0) >= 5) {
      return {
        action: "nurture_or_close",
        reason: "5+ strikes — decide to nurture long-term or mark lost",
        due_at: _daysFromNow(1),
        priority: 9,
      };
    }
  }

  if (type === "deal") {
    const stage = (record.stage || record.stage_name || "").toLowerCase();

    // Proposal stage — draft it
    if (stage.includes("proposal_draft") || stage.includes("proposal draft")) {
      return {
        action: "draft_proposal",
        reason: "Deal is in proposal drafting stage",
        due_at: _now(),
        priority: 3,
      };
    }

    // Proposal sent + 4+ days → follow up
    if (stage.includes("proposal_sent") || stage.includes("proposal sent")) {
      const stageEntered = record.stage_entered_at || record.stage_changed_at;
      if (_daysSince(stageEntered) >= 4) {
        return {
          action: "follow_up",
          reason: "Proposal sent 4+ days ago with no response",
          due_at: _now(),
          priority: 3,
        };
      }
    }

    // At-risk deal → rescue
    if (status === "at_risk" || record.attention === "at_risk") {
      return {
        action: "rescue",
        reason: "Deal flagged at-risk — immediate outreach needed",
        due_at: _now(),
        priority: 2,
      };
    }
  }

  // 4. Default: check sequence for next scheduled fire
  if (sequence && sequence.next_fire_at) {
    const fireAt = new Date(sequence.next_fire_at);
    if (fireAt > new Date()) {
      return {
        action: "wait",
        reason: `Sequence fires next on ${fireAt.toLocaleDateString()}`,
        due_at: sequence.next_fire_at,
        priority: 7,
      };
    }
  }

  // Fallback
  return {
    action: "review",
    reason: "No active signals — review record and decide next step",
    due_at: _daysFromNow(1),
    priority: 10,
  };
}
