// DealRoom.jsx — unified deal view
// Shows: deal details, all proposals, all documents, all communications,
// contacts, follow-ups, timeline — everything linked to one deal

import { useState, useEffect } from "react";
import { X, FileText, MessageSquare, Users, Clock, DollarSign, Send, Mail } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { jarvis } from "../../lib/jarvis.js";
import { ProposalGenerator } from "./ProposalGenerator.jsx";
import { DealTimeline } from "./DealTimeline.jsx";

export function DealRoom({ dealId, deal, onClose }) {
  const [tab, setTab] = useState("overview");
  const [proposals, setProposals] = useState([]);
  const [docs, setDocs] = useState([]);
  const [comms, setComms] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [showProposalGen, setShowProposalGen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [emailDraft, setEmailDraft] = useState(null);

  useEffect(() => {
    if (!supabase || !dealId) return;
    // Fetch all deal-related data in parallel
    Promise.all([
      supabase.from("proposals").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }),
      supabase.from("documents").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }),
      supabase.from("communications").select("*").eq("deal_id", dealId).order("occurred_at", { ascending: false }),
      supabase.from("follow_ups").select("*").eq("deal_id", dealId).order("due_date"),
    ]).then(([p, d, c, f]) => {
      setProposals(p.data ?? []);
      setDocs(d.data ?? []);
      setComms(c.data ?? []);
      setFollowUps(f.data ?? []);
    });
  }, [dealId]);

  if (!deal) return null;

  const TABS = [
    { id: "overview",   label: "Overview",                          Icon: DollarSign    },
    { id: "proposals",  label: `Proposals (${proposals.length})`,   Icon: FileText      },
    { id: "comms",      label: `Comms (${comms.length})`,           Icon: MessageSquare },
    { id: "docs",       label: `Docs (${docs.length})`,             Icon: FileText      },
    { id: "timeline",   label: "Timeline",                          Icon: Clock         },
  ];

  // Build a unified timeline from all activities
  const timeline = [
    ...proposals.map(p => ({ type: "proposal", date: p.created_at, text: `Proposal "${p.name}" v${p.version} — ${p.status}`, icon: "FileText" })),
    ...comms.map(c => ({ type: "comm", date: c.occurred_at, text: `${c.type}: ${c.subject || c.body?.slice(0, 60)}`, icon: "MessageSquare" })),
    ...followUps.map(f => ({ type: "followup", date: f.created_at, text: `Follow-up: ${f.action} — ${f.status}`, icon: "Clock" })),
    ...docs.map(d => ({ type: "doc", date: d.created_at, text: `Document: ${d.name} (${d.type})`, icon: "FileText" })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const fmtDate = (d) => new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
  const fmtUsd = (n) => `$${(n ?? 0).toLocaleString()}`;

  const draftEmail = async () => {
    setDrafting(true);
    try {
      const draft = await jarvis.emailAiDraft(dealId, "follow_up");
      setEmailDraft({ ...draft, _original: draft.body });
    } catch (e) {
      console.error("Draft failed:", e);
    }
    setDrafting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col glass border border-jarvis-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-jarvis-border">
          <div>
            <div className="text-lg font-semibold text-jarvis-ink">{deal.company}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="chip bg-blue-500/15 text-blue-400">{deal.stage}</span>
              <span className="text-sm text-jarvis-body font-semibold tabular-nums">{fmtUsd(deal.value_usd)}</span>
              {deal.probability && <span className="text-xs text-jarvis-muted">{deal.probability}% prob</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-ghost transition">
            <X size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-jarvis-border">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${tab === t.id ? "bg-jarvis-primary/10 text-jarvis-primary" : "text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-ghost"}`}>
              <t.Icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="label mb-1">Value</div>
                  <div className="text-xl font-semibold text-jarvis-ink tabular-nums">{fmtUsd(deal.value_usd)}</div>
                </div>
                <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="label mb-1">Stage</div>
                  <div className="text-xl font-semibold text-jarvis-ink">{deal.stage}</div>
                </div>
                <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="label mb-1">Contact</div>
                  <div className="text-sm text-jarvis-ink">{deal.contact_name || "—"}</div>
                </div>
                <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="label mb-1">Close Date</div>
                  <div className="text-sm text-jarvis-ink">{deal.close_date ? fmtDate(deal.close_date) : "—"}</div>
                </div>
              </div>
              {deal.notes && (
                <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="label mb-1">Notes</div>
                  <div className="text-sm text-jarvis-body whitespace-pre-wrap">{deal.notes}</div>
                </div>
              )}
              {deal.lanes && deal.lanes.length > 0 && (
                <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="label mb-2">Lanes</div>
                  <div className="space-y-1">
                    {deal.lanes.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-jarvis-body">{l.origin} → {l.destination}</span>
                        <span className="text-jarvis-ink tabular-nums">{l.volume} shipments @ ${l.rate}/mi</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="label">Proposals</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={draftEmail}
                    disabled={drafting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-jarvis-ghost text-jarvis-body text-sm font-semibold hover:bg-jarvis-surface hover:text-jarvis-ink transition disabled:opacity-50"
                  >
                    <Mail size={14} /> {drafting ? "Drafting…" : "Draft Email"}
                  </button>
                  <button
                    onClick={() => setShowProposalGen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-jarvis-primary/15 text-jarvis-primary text-sm font-semibold hover:bg-jarvis-primary/25 transition"
                  >
                    <FileText size={14} /> Create Proposal
                  </button>
                </div>
              </div>

              {emailDraft && (
                <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-4">
                  <div className="label mb-2">AI Draft Email</div>
                  {emailDraft.to && <div className="text-xs text-jarvis-muted mb-1">To: {emailDraft.to}</div>}
                  <div className="text-xs text-jarvis-ink font-semibold mb-3">Subject: {emailDraft.subject}</div>
                  <textarea
                    value={emailDraft.body}
                    onChange={e => setEmailDraft({ ...emailDraft, body: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink outline-none resize-none focus:border-jarvis-primary/40"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={async () => {
                        // Save style edits if user changed the draft
                        if (emailDraft._original && emailDraft.body !== emailDraft._original) {
                          await jarvis.emailStyleLearn(emailDraft._original, emailDraft.body, dealId, null, "follow_up");
                        }
                        // Queue for approval via the ask route
                        await jarvis.ask(
                          `Send email to ${emailDraft.to}: Subject: ${emailDraft.subject}\n\n${emailDraft.body}`,
                          { kind: "chat" }
                        );
                        setEmailDraft(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-jarvis-primary/15 text-jarvis-primary text-xs font-semibold hover:bg-jarvis-primary/25 transition"
                    >
                      Send for Approval
                    </button>
                    <button
                      onClick={() => setEmailDraft(null)}
                      className="px-4 py-2 rounded-xl bg-jarvis-ghost text-jarvis-muted text-xs hover:text-jarvis-ink transition"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="label mb-2">Pending Follow-ups</div>
                {followUps.filter(f => f.status === "pending").length === 0 ? (
                  <div className="text-xs text-jarvis-muted">No pending follow-ups</div>
                ) : (
                  <div className="space-y-1">
                    {followUps.filter(f => f.status === "pending").map(f => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg border border-jarvis-border bg-jarvis-surface px-3 py-2">
                        <span className="text-xs text-jarvis-ink">{f.action}</span>
                        <span className="text-[10px] text-jarvis-muted">{fmtDate(f.due_date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "proposals" && (
            <div className="space-y-2">
              {proposals.length === 0 ? (
                <div className="text-sm text-jarvis-muted">No proposals yet. Create one from the Quote Calculator.</div>
              ) : proposals.map(p => (
                <div key={p.id} className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-jarvis-ink font-semibold">{p.name} <span className="text-jarvis-muted font-normal">v{p.version}</span></div>
                      <div className="text-[10px] text-jarvis-muted mt-0.5">{fmtDate(p.created_at)}</div>
                    </div>
                    <span className={`chip text-[9px] ${p.status === "accepted" ? "bg-jarvis-success/10 text-jarvis-success" : p.status === "rejected" ? "bg-jarvis-danger/10 text-jarvis-danger" : p.status === "sent" ? "bg-blue-500/10 text-blue-400" : "bg-jarvis-ghost text-jarvis-muted"}`}>
                      {p.status}
                    </span>
                  </div>
                  {p.pricing && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-jarvis-muted">Per shipment:</span> <span className="text-jarvis-ink tabular-nums">{fmtUsd(p.pricing.total_per_shipment)}</span></div>
                      <div><span className="text-jarvis-muted">Monthly:</span> <span className="text-jarvis-ink tabular-nums">{fmtUsd(p.pricing.monthly_cost)}</span></div>
                      <div><span className="text-jarvis-muted">Annual:</span> <span className="text-jarvis-ink tabular-nums">{fmtUsd(p.pricing.annual_projection)}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "comms" && (
            <div className="space-y-2">
              {comms.length === 0 ? (
                <div className="text-sm text-jarvis-muted">No communications logged. Add notes from the Sales dashboard.</div>
              ) : comms.map(c => (
                <div key={c.id} className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="chip text-[9px] bg-jarvis-ghost text-jarvis-body">{c.type}</span>
                    <span className="text-[10px] text-jarvis-muted">{fmtDate(c.occurred_at)}</span>
                    {c.subject && <span className="text-xs text-jarvis-ink font-semibold">{c.subject}</span>}
                  </div>
                  <div className="text-xs text-jarvis-body">{c.body}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "docs" && (
            <div className="space-y-2">
              {docs.length === 0 ? (
                <div className="text-sm text-jarvis-muted">No documents attached. Upload from the Document Vault.</div>
              ) : docs.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-jarvis-border bg-jarvis-surface p-3">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-jarvis-muted" />
                    <div>
                      <div className="text-xs text-jarvis-ink font-semibold">{d.name}</div>
                      <div className="text-[10px] text-jarvis-muted">{d.type} · {fmtDate(d.created_at)}</div>
                    </div>
                  </div>
                  <span className={`chip text-[9px] ${d.status === "signed" ? "bg-jarvis-success/10 text-jarvis-success" : "bg-jarvis-ghost text-jarvis-muted"}`}>{d.status}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "timeline" && (
            <DealTimeline
              deal={deal}
              comms={comms}
              proposals={proposals}
              followUps={followUps}
              docs={docs}
            />
          )}
        </div>
      </div>
      {showProposalGen && (
        <ProposalGenerator
          deal={deal}
          onClose={() => setShowProposalGen(false)}
          onSaved={() => {
            setShowProposalGen(false);
            // Re-fetch proposals for this deal
            if (supabase && dealId) {
              supabase.from("proposals").select("*").eq("deal_id", dealId).order("created_at", { ascending: false })
                .then(({ data }) => setProposals(data ?? []));
            }
          }}
        />
      )}
    </div>
  );
}
