import { JarvisHalo } from "./JarvisHalo.jsx";

function JarvisBubble({ text, ts }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        <JarvisHalo size={28} />
      </div>
      <div className="max-w-[75%]">
        <div className="text-[10px] text-jarvis-primary font-semibold tracking-wider uppercase mb-1">
          JARVIS · {ts}
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-jarvis-primary/5 border border-jarvis-primary/15 px-4 py-2.5 text-[13px] text-jarvis-ink leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text, ts }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] text-right">
        <div className="text-[10px] text-jarvis-muted font-semibold tracking-wider uppercase mb-1">
          YOU · {ts}
        </div>
        <div className="inline-block rounded-2xl rounded-tr-sm bg-white/[0.06] border border-white/10 px-4 py-2.5 text-[13px] text-jarvis-ink leading-relaxed text-left">
          {text}
        </div>
      </div>
    </div>
  );
}

export function ConversationThread({ messages = [] }) {
  if (messages.length === 0) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-2 pb-2 border-b border-jarvis-border">
          <div className="w-1.5 h-1.5 rounded-full bg-jarvis-primary pulse-primary" />
          <div className="label">Conversation</div>
        </div>
        <div className="text-jarvis-muted text-sm text-center py-8">
          Ask JARVIS anything below to start a conversation.
        </div>
      </div>
    );
  }
  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-jarvis-border">
        <div className="w-1.5 h-1.5 rounded-full bg-jarvis-primary pulse-primary" />
        <div className="label">Live Conversation</div>
      </div>
      {messages.map((m, i) =>
        m.role === "jarvis" ? (
          <JarvisBubble key={i} text={m.text} ts={m.ts} />
        ) : (
          <UserBubble key={i} text={m.text} ts={m.ts} />
        )
      )}
    </div>
  );
}
