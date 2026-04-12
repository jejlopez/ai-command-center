import { JarvisHalo } from "./JarvisHalo.jsx";

const STUB_THREAD = [
  {
    role: "jarvis",
    text: "Morning. Brief generated. I flagged 2 critical items and 1 approval — want me to start on the Pipedrive push first?",
    ts: "08:02",
  },
  {
    role: "user",
    text: "yes, and summarize what came in overnight",
    ts: "08:02",
  },
  {
    role: "jarvis",
    text: "Scanning inbox now. Holding finance-related threads for review. I'll drop the top 5 in Jarvis Output in about 30s.",
    ts: "08:03",
  },
  {
    role: "user",
    text: "is Alex still waiting on the contract?",
    ts: "08:04",
  },
  {
    role: "jarvis",
    text: "Yes. Last touch was Tuesday. I drafted a reply and queued it for your review.",
    ts: "08:04",
  },
];

function JarvisBubble({ text, ts }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        <JarvisHalo size={28} />
      </div>
      <div className="max-w-[75%]">
        <div className="text-[10px] text-jarvis-cyan font-semibold tracking-wider uppercase mb-1">
          JARVIS · {ts}
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-jarvis-cyan/5 border border-jarvis-cyan/15 px-4 py-2.5 text-[13px] text-jarvis-ink leading-relaxed">
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

export function ConversationThread({ messages = STUB_THREAD }) {
  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-jarvis-border">
        <div className="w-1.5 h-1.5 rounded-full bg-jarvis-cyan pulse-cyan" />
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
