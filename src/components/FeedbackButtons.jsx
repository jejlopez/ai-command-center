import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { jarvis } from "../lib/jarvis.js";

export function FeedbackButtons({ runId, kind = "skill_run", onSubmit }) {
 const [submitted, setSubmitted] = useState(null);
 const [showReason, setShowReason] = useState(false);
 const [reason, setReason] = useState("");

 const submit = async (rating) => {
 try {
 await jarvis.submitFeedback({ runId, kind, rating, reason: reason || undefined });
 setSubmitted(rating);
 onSubmit?.(rating);
 } catch { /* silent */ }
 };

 if (submitted) {
 return (
 <span className="text-[11px] text-jarvis-muted">
 {submitted === "positive" ? "👍" : submitted === "negative" ? "👎" : "—"} Feedback recorded
 </span>
 );
 }

 return (
 <div className="flex items-center gap-2">
 <button
 onClick={() => submit("positive")}
 className="p-1 rounded hover:bg-jarvis-primary/10 text-jarvis-muted hover:text-jarvis-green transition-colors"
 title="Good result"
 >
 <ThumbsUp size={14} />
 </button>
 <button
 onClick={() => submit("negative")}
 className="p-1 rounded hover:bg-jarvis-primary/10 text-jarvis-muted hover:text-jarvis-red transition-colors"
 title="Bad result"
 >
 <ThumbsDown size={14} />
 </button>
 <button
 onClick={() => setShowReason(!showReason)}
 className="p-1 rounded hover:bg-jarvis-primary/10 text-jarvis-muted hover:text-jarvis-primary transition-colors"
 title="Add reason"
 >
 <MessageSquare size={14} />
 </button>
 {showReason && (
 <input
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 onKeyDown={(e) => e.key === "Enter" && reason && submit("neutral")}
 placeholder="Why?"
 className="bg-jarvis-surface border border-jarvis-border rounded px-2 py-0.5 text-xs text-jarvis-ink w-40"
 autoFocus
 />
 )}
 </div>
 );
}

export function WhyThisDrawer({ runId }) {
 const [open, setOpen] = useState(false);
 const [explanation, setExplanation] = useState(null);
 const [loading, setLoading] = useState(false);

 const loadExplanation = async () => {
 if (explanation) { setOpen(!open); return; }
 setLoading(true);
 setOpen(true);
 try {
 const ex = await jarvis.routingExplain("chat");
 setExplanation(ex);
 } catch {
 setExplanation({ reason: "Could not load explanation" });
 } finally {
 setLoading(false);
 }
 };

 return (
 <div>
 <button
 onClick={loadExplanation}
 className="flex items-center gap-1 text-[11px] text-jarvis-muted hover:text-jarvis-purple transition-colors"
 >
 <Brain size={12} />
 Why this?
 {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
 </button>
 {open && (
 <div className="mt-2 p-3 rounded-lg bg-jarvis-surface border border-jarvis-border text-xs">
 {loading ? (
 <span className="text-jarvis-muted">Loading…</span>
 ) : explanation ? (
 <div className="space-y-1">
 <div className="flex items-center gap-2">
 <span className="text-jarvis-purple font-medium">Model:</span>
 <span className="text-jarvis-ink">{explanation.model}</span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-jarvis-purple font-medium">Provider:</span>
 <span className="text-jarvis-ink">{explanation.provider}</span>
 </div>
 <div>
 <span className="text-jarvis-purple font-medium">Reason:</span>{" "}
 <span className="text-jarvis-body">{explanation.reason}</span>
 </div>
 {explanation.learned && (
 <div className="text-jarvis-primary">
 <span className="font-medium">Learned:</span> {explanation.learned}
 </div>
 )}
 {explanation.consecutiveSuccesses > 0 && (
 <div className="text-jarvis-green text-[10px]">
 {explanation.consecutiveSuccesses} consecutive successes at this tier
 </div>
 )}
 {explanation.memoryCited > 0 && (
 <div className="text-jarvis-muted text-[10px]">
 {explanation.memoryCited} memory nodes cited
 </div>
 )}
 </div>
 ) : null}
 </div>
 )}
 </div>
 );
}
