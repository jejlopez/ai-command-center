// Widget Registry — maps widget names to React components + their data requirements

export const WIDGET_REGISTRY = {
  // Sales
  pipeline:        { label: "Pipeline",         page: "work" },
  follow_ups:      { label: "Follow-ups",        page: "work" },
  proposals:       { label: "Proposals",         page: "work" },
  forecast:        { label: "Revenue Forecast",  page: "work" },
  contacts:        { label: "Key Contacts",      page: "work" },
  deal_room:       { label: "Deal Room",         page: "work" },

  // Trading
  positions:       { label: "Open Positions",    page: "money" },
  watchlist:       { label: "Watchlist",         page: "money" },
  scorecard:       { label: "Trading Scorecard", page: "money" },
  position_lookup: { label: "Position",          page: "money" },

  // Money
  money_dashboard: { label: "Money Overview",    page: "money" },
  velocity:        { label: "Capital Velocity",  page: "money" },
  expenses:        { label: "Expenses",          page: "money" },
  tool_roi:        { label: "Tool ROI",          page: "money" },

  // Today
  calendar:        { label: "Schedule",          page: "today" },
  needle_movers:   { label: "Top Priorities",    page: "today" },
  decisions:       { label: "Decision Queue",    page: "today" },
  waste_detector:  { label: "Waste Detector",    page: "today" },

  // Health
  health_dashboard: { label: "Health Overview",  page: "health" },
  habits:           { label: "Habits",           page: "health" },
  burnout_risk:     { label: "Burnout Risk",     page: "health" },

  // Home
  home_dashboard:  { label: "Home Life",         page: "home" },

  // Brain
  brain_search:    { label: "Knowledge Search",  page: "brain" },
  mistakes:        { label: "Mistake Journal",   page: "brain" },
  mental_models:   { label: "Mental Models",     page: "brain" },

  // Meta
  compose:         { label: "Draft",             page: "compose" },
  analysis:        { label: "Analysis",          page: "analysis" },
};

export function getWidgetMeta(name) {
  return WIDGET_REGISTRY[name] ?? { label: name, page: "unknown" };
}
