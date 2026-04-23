import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Zap, Mic, MicOff, Volume2, VolumeX, ShieldAlert } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";
import { parseIntent, classifyWithOllama, isConversational } from "../../lib/intentParser.js";
import { speak, stopSpeaking } from "../../lib/tts.js";
import { startListening, stopListening, isListening } from "../../lib/voiceInput.js";
import { useJarvisSocket } from "../../hooks/useJarvisSocket.js";

function Message({ msg }) {
  // System messages (approval decision callbacks, etc.) render centered and subdued.
  if (msg.role === "system") {
    return (
      <div className="flex justify-center my-2">
        <div
          className={`text-[10px] px-2.5 py-1 rounded-full font-medium uppercase tracking-wider ${
            msg.kind === "approved"
              ? "bg-jarvis-green/10 text-jarvis-green"
              : msg.kind === "denied"
              ? "bg-white/5 text-jarvis-muted"
              : "bg-white/5 text-jarvis-muted"
          }`}
        >
          {msg.text}
        </div>
      </div>
    );
  }

  const isUser = msg.role === "user";
  const tools = Array.isArray(msg.tools) ? msg.tools : [];
  // Any tool still in `queued` state means the user has work to do in the rail.
  // Surface that explicitly so the disconnect between "I drafted X" and "X is not done
  // until you approve" feels deliberate, not broken.
  const pendingCount = tools.filter((t) => t.state === "queued").length;

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
        {tools.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {tools.map((t, i) => (
              <span
                key={i}
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  t.state === "error"
                    ? "bg-red-500/10 text-red-400"
                    : t.state === "queued"
                    ? "bg-amber-500/10 text-amber-400"
                    : t.state === "done"
                    ? "bg-jarvis-primary/15 text-jarvis-primary"
                    : "bg-jarvis-muted/10 text-jarvis-muted"
                }`}
              >
                {t.state === "queued" ? "⏸ " : t.state === "error" ? "✗ " : "🔧 "}
                {t.name}
              </span>
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap">
          {msg.text}
          {msg.streaming && <span className="inline-block w-[2px] h-[1em] bg-jarvis-primary ml-0.5 align-middle animate-pulse" />}
        </div>
        {pendingCount > 0 && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-jarvis-amber/10 border border-jarvis-amber/30 px-2.5 py-2">
            <ShieldAlert size={12} className="text-jarvis-amber mt-[1px] shrink-0" />
            <div className="text-[11px] text-jarvis-amber leading-snug">
              <span className="font-semibold">
                {pendingCount === 1 ? "1 action awaiting your approval" : `${pendingCount} actions awaiting your approval`}
              </span>
              <span className="text-jarvis-body">
                {" "}
                — check the right rail. After approving, ask me to continue.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const STORAGE_KEY = "jarvis-chat-history";
const MAX_HISTORY = 100;

function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [{ role: "assistant", text: "Good morning. I'm online and monitoring your systems. What would you like to see?", tier: 0 }];
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  } catch {}
}

export function JarvisChat({ onDisplayUpdate }) {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(
    () => localStorage.getItem('jarvis-tts') !== 'false'
  );
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Persist on every message change
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Stop speaking when TTS is toggled off
  useEffect(() => {
    localStorage.setItem('jarvis-tts', ttsEnabled ? 'true' : 'false');
    if (!ttsEnabled) stopSpeaking();
  }, [ttsEnabled]);

  // When an approval gets decided in the right rail (or anywhere else), find the
  // assistant message that enqueued it and:
  //  - flip its tool chip from ⏸ queued → ✓ done (approved) or ✗ error (denied)
  //  - drop a small system-style message into the chat so the user knows they
  //    can continue the conversation. This is the v1 "disconnect feels
  //    intentional" bridge; full inline resume is Phase 1b.
  useJarvisSocket("approval.decided", (wsMsg) => {
    const approvalId = wsMsg?.payload?.id;
    const decision = wsMsg?.payload?.decision;
    if (!approvalId) return;

    let toolName = null;
    setMessages((prev) => {
      let touched = false;
      const next = prev.map((m) => {
        if (!Array.isArray(m.tools)) return m;
        const tools = m.tools.map((t) => {
          if (t.approvalId === approvalId) {
            touched = true;
            toolName = t.name;
            return { ...t, state: decision === "approve" ? "done" : "error" };
          }
          return t;
        });
        return touched ? { ...m, tools } : m;
      });
      if (!touched) return prev;

      // Append a system notice in the same render so chat history stays consistent.
      const text =
        decision === "approve"
          ? `✓ ${toolName ?? "action"} approved — ready for the next step`
          : `✗ ${toolName ?? "action"} denied`;
      return [
        ...next,
        {
          id: `sys-${approvalId}`,
          role: "system",
          kind: decision === "approve" ? "approved" : "denied",
          text,
        },
      ];
    });
  });

  const addAssistantMessage = (text, tier) => {
    setMessages(prev => [...prev, { role: "assistant", text, tier }]);
    if (ttsEnabled) speak(text);
  };

  /**
   * Call the agentic streaming endpoint and update a placeholder message
   * incrementally as events arrive. Falls back to the non-streaming /ask
   * route on 501 (feature flag off) or network/stream errors.
   * Returns the final assistant text.
   */
  const streamAssistantResponse = async (text, opts = {}, tier = 3) => {
    const msgId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages(prev => [...prev, { id: msgId, role: "assistant", text: "", tier, streaming: true, tools: [] }]);

    const updateMsg = (patch) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, ...patch } : m));
    };
    const patchTool = (id, patch) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const tools = (m.tools || []).map(t => t.id === id ? { ...t, ...patch } : t);
        return { ...m, tools };
      }));
    };
    const addTool = (id, name) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const tools = [...(m.tools || []), { id, name, state: "running" }];
        return { ...m, tools };
      }));
    };

    let fullText = "";
    try {
      for await (const evt of jarvis.askStream(text, opts)) {
        if (evt.type === "text_delta") {
          fullText += evt.text;
          updateMsg({ text: fullText });
        } else if (evt.type === "tool_use_start") {
          addTool(evt.id, evt.name);
        } else if (evt.type === "tool_use_result") {
          patchTool(evt.id, {
            state: evt.isError ? "error" : evt.queued ? "queued" : "done",
            approvalId: evt.approvalId,
          });
        } else if (evt.type === "error") {
          throw new Error(evt.message);
        } else if (evt.type === "done" || evt.type === "result") {
          if (evt.text && !fullText) fullText = evt.text;
        }
      }
    } catch (err) {
      // Fallback: feature flag off (501) or transient stream failure
      const msg = String(err?.message ?? err);
      if (msg.includes("501")) {
        try {
          const result = await jarvis.ask(text, opts);
          fullText = result.text ?? "";
          updateMsg({ text: fullText, streaming: false });
          if (ttsEnabled) speak(fullText);
          return fullText;
        } catch (fallbackErr) {
          updateMsg({ text: `Error: ${fallbackErr.message}`, streaming: false, tier: 0 });
          throw fallbackErr;
        }
      }
      updateMsg({ text: fullText || `Error: ${msg}`, streaming: false, tier: fullText ? tier : 0 });
      throw err;
    }

    updateMsg({ streaming: false });
    if (ttsEnabled && fullText) speak(fullText);
    return fullText;
  };

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      // Step 1: Is this a QUESTION or CONVERSATION? → Send to AI directly
      if (isConversational(text)) {
        // Also check if the question relates to data we can display
        const parsed = parseIntent(text);
        if (parsed?.widgets?.length > 0) {
          const widgetObjects = parsed.widgets.map(w =>
            typeof w === "string" ? { widget: w, entities: parsed.entities } : w
          );
          onDisplayUpdate({ widgets: widgetObjects });
        }

        try {
          await streamAssistantResponse(text, { kind: "chat" }, 3);
        } catch {
          // streamAssistantResponse already rendered an error message in-place
        }
      } else {
        // Step 2: Not a question — it's a DISPLAY COMMAND → Pattern match first
        let parsed = parseIntent(text);
        let tier = 1;

        if (!parsed) {
          // No pattern match — send to AI as conversation
          try {
            await streamAssistantResponse(text, { kind: "chat" }, 3);
          } catch {
            // already rendered inline
          }
        } else {
          // Pattern matched — update display + generate response
          if (parsed.widgets?.length > 0) {
            const widgetObjects = parsed.widgets.map(w =>
              typeof w === "string" ? { widget: w, entities: parsed.entities } : w
            );
            onDisplayUpdate({ widgets: widgetObjects });
          }

          const responseText = generateQuickResponse(parsed, text);
          addAssistantMessage(responseText, tier);
        }
      }
    } catch (e) {
      addAssistantMessage(`Error: ${e.message}`, 0);
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

  const handleMicClick = async () => {
    if (recording) {
      // Stop recording → transcribe → auto-send
      setRecording(false);
      const transcribed = await stopListening();
      if (transcribed) {
        await send(transcribed);
      }
    } else {
      // Start recording
      try {
        await startListening();
        setRecording(true);
      } catch (e) {
        console.error("Mic access denied:", e);
      }
    }
  };

  const handleTtsToggle = () => {
    setTtsEnabled(prev => !prev);
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
          {/* TTS toggle */}
          <button
            onClick={handleTtsToggle}
            title={ttsEnabled ? "Mute JARVIS voice" : "Unmute JARVIS voice"}
            className="p-2 rounded-xl text-jarvis-muted hover:text-jarvis-primary hover:bg-jarvis-primary/10 transition"
          >
            {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask JARVIS anything..."
            className="flex-1 bg-transparent text-sm text-jarvis-ink placeholder-jarvis-muted outline-none px-2"
          />

          {/* Mic button */}
          <button
            onClick={handleMicClick}
            disabled={loading}
            title={recording ? "Stop recording" : "Start voice input"}
            className={`p-2 rounded-xl transition ${
              recording
                ? "bg-red-500/20 text-red-400 animate-pulse"
                : "bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25"
            } disabled:opacity-30`}
          >
            {recording ? <MicOff size={14} /> : <Mic size={14} />}
          </button>

          {/* Send button */}
          <button
            onClick={() => send()}
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
