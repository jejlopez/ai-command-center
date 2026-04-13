// Intent parser — routes user input to display widgets
// Tier 1: keyword pattern matching (instant, free)
// Tier 2: Ollama classification (if no pattern match)

const PATTERNS = [
  // Sales
  { match: /\b(pipeline|deals|funnel|sales)\b/i, widgets: ["pipeline"], intent: "show_data" },
  { match: /\b(follow.?ups?|overdue|pending)\b/i, widgets: ["follow_ups"], intent: "show_data" },
  { match: /\b(proposal|quote|pricing)\b/i, widgets: ["proposals"], intent: "show_data" },
  { match: /\b(forecast|revenue|projection)\b/i, widgets: ["forecast"], intent: "show_data" },
  { match: /\b(contacts?|people|crm)\b/i, widgets: ["contacts"], intent: "show_data" },
  { match: /\bopen\s+(\w+)/i, widgets: ["deal_room"], intent: "open_deal", extract: "company" },

  // Trading
  { match: /\b(positions?|trades?|p&?l|pnl)\b/i, widgets: ["positions"], intent: "show_data" },
  { match: /\b(watchlist|watch\s?list|alerts?)\b/i, widgets: ["watchlist"], intent: "show_data" },
  { match: /\b(scorecard|win.?rate|trading\s+score)\b/i, widgets: ["scorecard"], intent: "show_data" },
  { match: /^[A-Z]{1,5}$/m, widgets: ["position_lookup"], intent: "show_data", extract: "ticker" },

  // Money
  { match: /\b(money|budget|spend|cost|burn)\b/i, widgets: ["money_dashboard"], intent: "show_data" },
  { match: /\b(velocity|capital|flow)\b/i, widgets: ["velocity"], intent: "show_data" },
  { match: /\b(expense|subscription|recurring)\b/i, widgets: ["expenses"], intent: "show_data" },
  { match: /\b(roi|return\s+on)\b/i, widgets: ["tool_roi"], intent: "show_data" },

  // Today
  { match: /\b(today|schedule|calendar|agenda)\b/i, widgets: ["calendar", "needle_movers"], intent: "show_data" },
  { match: /\b(focus|priorities?|important)\b/i, widgets: ["needle_movers"], intent: "show_data" },
  { match: /\b(decision|decide)\b/i, widgets: ["decisions"], intent: "show_data" },
  { match: /\b(waste|leak|bottleneck)\b/i, widgets: ["waste_detector"], intent: "show_data" },

  // Health
  { match: /\b(health|energy|sleep|workout|exercise)\b/i, widgets: ["health_dashboard"], intent: "show_data" },
  { match: /\b(habit|streak|routine)\b/i, widgets: ["habits"], intent: "show_data" },
  { match: /\b(burnout|stress|recovery)\b/i, widgets: ["burnout_risk"], intent: "show_data" },

  // Home
  { match: /\b(home|house|maintenance|vendor)\b/i, widgets: ["home_dashboard"], intent: "show_data" },

  // Brain
  { match: /\b(brain|memory|remember|knowledge)\b/i, widgets: ["brain_search"], intent: "show_data" },
  { match: /\b(mistake|lesson|learned)\b/i, widgets: ["mistakes"], intent: "show_data" },
  { match: /\b(model|framework|mental)\b/i, widgets: ["mental_models"], intent: "show_data" },

  // Actions
  { match: /\b(draft|write|compose|email)\b/i, widgets: ["compose"], intent: "draft_content" },
  { match: /\b(analyze|analysis|pattern|trend)\b/i, widgets: ["analysis"], intent: "analyze" },
];

export function parseIntent(input) {
  const text = input.trim();

  for (const p of PATTERNS) {
    const m = text.match(p.match);
    if (m) {
      const result = { intent: p.intent, widgets: [...p.widgets], entities: {}, tier: 1 };

      // Extract entities
      if (p.extract === "company") {
        const companyMatch = text.match(/open\s+(\w+)/i);
        if (companyMatch) result.entities.company = companyMatch[1];
      }
      if (p.extract === "ticker") {
        result.entities.ticker = m[0];
      }

      return result;
    }
  }

  // No pattern match — return null (caller should try Tier 2)
  return null;
}

// Tier 2: Ask Ollama to classify (called when pattern match fails)
export async function classifyWithOllama(input, jarvisClient) {
  try {
    const result = await jarvisClient.ask(
      `Classify this user request. Return ONLY a JSON object with no other text:
{"intent": "show_data|ask_question|take_action|draft_content", "widgets": ["widget_name"], "entities": {}}

Available widgets: pipeline, follow_ups, proposals, forecast, contacts, deal_room, positions, watchlist, scorecard, money_dashboard, velocity, expenses, tool_roi, calendar, needle_movers, decisions, waste_detector, health_dashboard, habits, burnout_risk, home_dashboard, brain_search, mistakes, mental_models, analysis

User request: "${input}"`,
      { kind: "classification", privacy: "public" }
    );

    const jsonMatch = result.text?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { ...JSON.parse(jsonMatch[0]), tier: 2 };
    }
  } catch (e) {
    console.warn("[intentParser] Ollama classification failed:", e.message);
  }

  // Fallback: show a general dashboard
  return { intent: "show_data", widgets: ["needle_movers", "calendar"], entities: {}, tier: 3 };
}
