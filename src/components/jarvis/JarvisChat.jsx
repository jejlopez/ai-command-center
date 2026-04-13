import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Zap } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";
import { parseIntent, classifyWithOllama } from "../../lib/intentParser.js";

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? "bg-jarvis-primary/10 text-jarvis-ink rounded-br-md"
          : "glass text-jarvis-body rounded-bl-md"
      }`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <Zap size={10} className="text-jarvis-primary" />
            <span className="text-[9px] text-jarvis-primary font-semibold uppercase tracking-wider">JARVIS</span>
            {msg.tier != null && (
              <span className="text-[8px] text-jarvis-muted">· Tier {msg.tier}</span>
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.text}</div>
      </div>
    </div>
  );
}

export function JarvisChat({ onDisplayUpdate }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Good morning. I'm online and monitoring your systems. What would you like to see?",
      tier: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      // Tier 1: Pattern match
      let parsed = parseIntent(text);
      let tier = 1;

      if (!parsed) {
        // Tier 2: Ollama classification
        try {
          parsed = await classifyWithOllama(text, jarvis);
          tier = parsed?.tier ?? 2;
        } catch {
          parsed = { intent: "show_data", widgets: ["needle_movers"], entities: {}, tier: 3 };
          tier = 3;
        }
      }

      // Update display panel with parsed widgets
      if (parsed?.widgets?.length > 0) {
        const widgetObjects = parsed.widgets.map(w =>
          typeof w === "string" ? { widget: w, entities: parsed.entities } : w
        );
        onDisplayUpdate({ widgets: widgetObjects });
      }

      // Get JARVIS response
      let responseText;

      if (parsed.intent === "draft_content" || parsed.intent === "analyze") {
        // Tier 3: Full AI response needed
        try {
          const result = await jarvis.ask(text, { kind: "chat" });
          responseText = result.text;
          tier = 3;
        } catch {
          responseText =
            "I need a language model connection to draft content. Check that Ollama is running or add a provider in Settings.";
        }
      } else {
        // Tier 1/2: Generate response from data
        responseText = generateQuickResponse(parsed, text);

        // If quick response is generic, try a better one from Ollama
        if (responseText.includes("Here's what I found") && tier <= 2) {
          try {
            const result = await jarvis.ask(
              `Briefly answer this question about the user's data. Be concise (2-3 sentences max): "${text}"`,
              { kind: "chat" }
            );
            if (result.text) responseText = result.text;
          } catch {
            // Keep the quick response
          }
        }
      }

      setMessages(prev => [...prev, { role: "assistant", text: responseText, tier }]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", text: `Error: ${e.message}`, tier: 0 },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-jarvis-border">
        <Zap size={14} className="text-jarvis-primary" />
        <span className="label">JARVIS</span>
        <span className="text-[9px] text-jarvis-muted">· Online</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="glass px-4 py-3 rounded-2xl rounded-bl-md">
              <Loader2 size={14} className="animate-spin text-jarvis-primary" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 glass p-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask JARVIS anything..."
            className="flex-1 bg-transparent text-sm text-jarvis-ink placeholder-jarvis-muted outline-none px-2"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="p-2 rounded-xl bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 disabled:opacity-30 transition"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function generateQuickResponse(parsed, _originalText) {
  const widgets = parsed.widgets ?? [];
  const w = widgets[0];

  const responses = {
    pipeline:         "Here's your current pipeline. I've loaded the deal board on the display.",
    follow_ups:       "Showing your pending follow-ups, ordered by urgency.",
    positions:        "Here are your open positions with current P&L.",
    watchlist:        "Your watchlist is on the display.",
    scorecard:        "Trading scorecard loaded — today's and this week's performance.",
    money_dashboard:  "Money overview is up. Showing velocity, leaks, and capital allocation.",
    velocity:         "Capital velocity loaded on the display.",
    calendar:         "Today's schedule is on the display, along with your top priorities.",
    needle_movers:    "Your top 3 needle movers are on the display. These are the highest-impact items today.",
    decisions:        "Decision queue loaded. Items sorted by cost-of-delay.",
    waste_detector:   "Waste detector is up — showing what's leaking time, money, or attention.",
    health_dashboard: "Health overview loaded. Energy, sleep, and workout status.",
    habits:           "Your habits and streaks are on the display.",
    burnout_risk:     "Burnout risk score loaded.",
    home_dashboard:   "Home life overview is up.",
    brain_search:     "Knowledge base loaded. Use the Brain tab for deep search.",
    mistakes:         "Recent mistakes and lessons are on the display.",
    mental_models:    "Mental models library loaded.",
    deal_room:        `Opening deal room${parsed.entities?.company ? ` for ${parsed.entities.company}` : ""}. All related proposals, comms, and follow-ups loaded.`,
    position_lookup:  `Loading position details${parsed.entities?.ticker ? ` for ${parsed.entities.ticker}` : ""}.`,
    proposals:        "Recent proposals loaded on the display.",
    forecast:         "Revenue forecast is up — 30, 60, and 90-day projections.",
    expenses:         "Expenses and subscriptions loaded.",
    contacts:         "Key contacts loaded.",
    tool_roi:         "Tool ROI analysis on the display.",
  };

  return responses[w] ?? "Here's what I found. Check the display panel.";
}
