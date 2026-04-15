// Deal Room — slide-out panel showing everything about a deal.
// Connected to Supabase for real proposals, communications, and follow-ups.

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, FileText, Mail, StickyNote, Eye, Link2, Send, Trash2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { jarvis } from "../../lib/jarvis.js";
import { ProposalGenerator } from "../ops/ProposalGenerator.jsx";
import { BadgeZone } from "../shared/BadgeZone.jsx";
import { ScoreZone } from "../shared/ScoreZone.jsx";
import { NBAModule } from "../shared/NBAModule.jsx";
import { DealDiscovery } from "./DealDiscovery.jsx";
import { DealObjections } from "./DealObjections.jsx";
import { ApprovalQueue } from "./ApprovalQueue.jsx";
import { AuditLogViewer } from "./AuditLogViewer.jsx";
import { dealHealth, whaleQuadrant } from "../../lib/dealHealth.js";
import { PipelineEconomics } from "./PipelineEconomics.jsx";
import { VoiceToCRM } from "./VoiceToCRM.jsx";

function Tab({ label, icon: Icon, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
        active
          ? "bg-jarvis-primary/10 text-jarvis-primary"
          : "text-jarvis-muted hover:text-jarvis-ink"
      }`}
    >
      <Icon size={11} />
      {label}{count > 0 ? ` (${count})` : ""}
    </button>
  );
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtUsd(n) {
  return `$${(n ?? 0).toLocaleString()}`;
}

export function DealRoomPanel({ deal: initialDeal, onClose }) {
  const [tab, setTab] = useState("proposal");
  const [deal, setDeal] = useState(initialDeal);
  const [proposals, setProposals] = useState([]);
  const [comms, setComms] = useState([]);
  const [expandedProposal, setExpandedProposal] = useState(null);
  const [showProposalGen, setShowProposalGen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [emailDraft, setEmailDraft] = useState(null);
  const [loading, setLoading] = useState(true);

  // Map deal to a Supabase deal_id — may be a Pipedrive ID
  const dealId = deal?.supabase_id ?? deal?.id;

  // Health scores
  const { score: health, whale, quality, breakdown } = dealHealth(deal ?? {});
  const quadrant = whaleQuadrant(whale, health);

  useEffect(() => {
    if (!supabase || !dealId) { setLoading(false); return; }

    // Try to find this deal in Supabase
    const findAndFetch = async () => {
      setLoading(true);

      // If dealId is a UUID, use it directly. If it's a number (Pipedrive), look up by pipedrive_id
      let supabaseDealId = dealId;
      if (typeof dealId === "number" || /^\d+$/.test(dealId)) {
        const { data: found } = await supabase
          .from("deals")
          .select("id")
          .eq("pipedrive_id", parseInt(dealId))
          .maybeSingle();
        if (found) supabaseDealId = found.id;
        else { setLoading(false); return; }
      }

      const [p, c] = await Promise.all([
        supabase.from("proposals").select("*").eq("deal_id", supabaseDealId).order("created_at", { ascending: false }),
        supabase.from("communications").select("*").eq("deal_id", supabaseDealId).order("occurred_at", { ascending: false }),
      ]);

      setProposals(p.data ?? []);
      setComms(c.data ?? []);
      setLoading(false);
    };

    findAndFetch();
  }, [dealId]);

  // Also try to load from CRM API for deal details
  useEffect(() => {
    if (initialDeal?.id) {
      jarvis.crmDeal?.(initialDeal.id)?.then(d => { if (d) setDeal(prev => ({ ...prev, ...d })); }).catch(() => {});
    }
  }, [initialDeal?.id]);

  const draftEmail = async () => {
    setDrafting(true);
    try {
      const draft = await jarvis.emailAiDraft(dealId, "follow_up");
      setEmailDraft({ ...draft, _original: draft.body });
    } catch (e) {
      console.error("Draft failed:", e);
      setEmailDraft({ to: deal.contact_email ?? "", subject: `Following up — ${deal.title || deal.org_name}`, body: "", _original: "" });
    }
    setDrafting(false);
  };

  if (!deal) return null;

  const pricing = deal.pricing_model ? (typeof deal.pricing_model === "string" ? JSON.parse(deal.pricing_model) : deal.pricing_model) : null;

  return (
    <>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 w-[420px] bg-jarvis-bg border-l border-jarvis-border z-40 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-jarvis-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[14px] text-jarvis-ink font-semibold truncate">{deal.title || deal.org_name || deal.company}</h2>
            <button onClick={onClose} className="text-jarvis-muted hover:text-jarvis-ink"><X size={16} /></button>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            {deal.value > 0 && <span className="text-jarvis-primary font-semibold">{fmtUsd(deal.value || deal.value_usd)}</span>}
            {deal.stage && (
              <span className="chip text-[8px] bg-jarvis-primary/10 text-jarvis-primary">{deal.stage}</span>
            )}
          </div>
          {(deal.contact_name || deal.contact_email) && (
            <div className="mt-2 text-[10px]">
              <span className="text-jarvis-muted">Contact: </span>
              <span className="text-jarvis-ink">{deal.contact_name}</span>
              {deal.contact_email && <span className="text-jarvis-primary ml-2">{deal.contact_email}</span>}
            </div>
          )}
          {deal.engagement && (
            <div className="mt-2">
              <span className={`text-[8px] px-2 py-0.5 rounded-full ${
                deal.engagement === "hot" ? "text-jarvis-danger bg-jarvis-danger/8" :
                deal.engagement === "cold" ? "text-jarvis-muted bg-white/5" :
                "text-jarvis-warning bg-jarvis-warning/8"
              }`}>{deal.engagement}</span>
            </div>
          )}
          <div className="mt-2">
            <BadgeZone record={{ ...deal, quality, attention: deal.attention }} type="deal" />
          </div>
          <div className="mt-2">
            <ScoreZone score={health} whale={whale} breakdown={breakdown} labels={{ score: "Health", whale: "Whale" }} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <PipelineEconomics deal={deal} />
            <VoiceToCRM dealId={dealId} contactId={deal.contact_id} onComplete={() => {}} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-jarvis-border">
          <Tab label="Proposal" icon={FileText} active={tab === "proposal"} onClick={() => setTab("proposal")} count={proposals.length} />
          <Tab label="Emails" icon={Mail} active={tab === "emails"} onClick={() => setTab("emails")} count={comms.filter(c => c.type === "email").length} />
          <Tab label="Notes" icon={StickyNote} active={tab === "notes"} onClick={() => setTab("notes")} count={comms.filter(c => c.type !== "email").length} />
          <Tab label="Discovery" icon={Eye} active={tab === "discovery"} onClick={() => setTab("discovery")} count={0} />
          <Tab label="Objections" icon={Sparkles} active={tab === "objections"} onClick={() => setTab("objections")} count={0} />
          <Tab label="Approvals" icon={Eye} active={tab === "approvals"} onClick={() => setTab("approvals")} count={0} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-jarvis-primary" /></div>
          ) : tab === "proposal" ? (
            <div className="space-y-3">
              {/* Pricing breakdown from CRM */}
              {pricing && (
                <div className="space-y-2">
                  <div className="label">Monthly Breakdown</div>
                  {pricing.storage && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-jarvis-muted">Storage ({pricing.storage.pallets} pallets × ${pricing.storage.rate})</span>
                      <span className="text-jarvis-ink">${pricing.storage.monthly?.toFixed(2)}</span>
                    </div>
                  )}
                  {pricing.receiving && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-jarvis-muted">Receiving ({pricing.receiving.pallets} × ${pricing.receiving.rate})</span>
                      <span className="text-jarvis-ink">${pricing.receiving.monthly?.toFixed(2)}</span>
                    </div>
                  )}
                  {pricing.monthlyTotal && (
                    <>
                      <div className="flex justify-between text-[11px] pt-2 border-t border-jarvis-border">
                        <span className="text-jarvis-ink font-medium">Monthly Total</span>
                        <span className="text-jarvis-primary font-medium">${pricing.monthlyTotal?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-jarvis-muted">Annual Estimate</span>
                        <span className="text-jarvis-ink">${pricing.annualTotal?.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Proposals from Supabase */}
              <div className="label mt-4">Proposals</div>
              {proposals.length === 0 ? (
                <div className="text-[11px] text-jarvis-muted">No proposals yet. Click "Create Proposal" below.</div>
              ) : proposals.map(p => (
                <div key={p.id} className="surface overflow-hidden">
                  {/* Clickable header */}
                  <button
                    onClick={() => setExpandedProposal(expandedProposal === p.id ? null : p.id)}
                    className="w-full flex items-center justify-between p-2.5 text-left hover:bg-jarvis-ghost/30 transition"
                  >
                    <div>
                      <div className="text-[11px] text-jarvis-ink font-medium">{p.name || p.company_name}</div>
                      <div className="text-[9px] text-jarvis-muted">{fmtDate(p.created_at)} · v{p.version}{p.pricing?.annual_projection ? ` · ${fmtUsd(p.pricing.annual_projection)}/yr` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.view_count > 0 && <span className="text-[8px] text-jarvis-muted">{p.view_count} views</span>}
                      <span className={`text-[8px] uppercase tracking-wider ${
                        p.status === "accepted" ? "text-jarvis-success" :
                        p.status === "sent" ? "text-jarvis-primary" :
                        p.status === "rejected" ? "text-jarvis-danger" :
                        "text-jarvis-warning"
                      }`}>{p.client_response === "changes_requested" ? "Changes Requested" : p.status}</span>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expandedProposal === p.id && (
                    <div className="p-2.5 pt-0 border-t border-jarvis-border space-y-2">
                      {/* Pricing */}
                      {p.pricing && (
                        <div className="grid grid-cols-3 gap-2 text-center mt-2">
                          <div className="rounded-lg bg-jarvis-ghost p-2">
                            <div className="text-[8px] text-jarvis-muted uppercase">Per Ship</div>
                            <div className="text-[11px] font-semibold text-jarvis-ink tabular-nums">{fmtUsd(p.pricing.total_per_shipment)}</div>
                          </div>
                          <div className="rounded-lg bg-jarvis-ghost p-2">
                            <div className="text-[8px] text-jarvis-muted uppercase">Monthly</div>
                            <div className="text-[11px] font-semibold text-jarvis-primary tabular-nums">{fmtUsd(p.pricing.monthly_cost)}</div>
                          </div>
                          <div className="rounded-lg bg-jarvis-ghost p-2">
                            <div className="text-[8px] text-jarvis-muted uppercase">Annual</div>
                            <div className="text-[11px] font-semibold text-jarvis-success tabular-nums">{fmtUsd(p.pricing.annual_projection)}</div>
                          </div>
                        </div>
                      )}

                      {/* Lanes */}
                      {p.lanes?.length > 0 && (
                        <div>
                          <div className="text-[8px] text-jarvis-muted uppercase mb-1">Lanes</div>
                          {p.lanes.map((l, i) => (
                            <div key={i} className="flex justify-between text-[10px] py-0.5">
                              <span className="text-jarvis-body">{l.origin} → {l.destination}</span>
                              <span className="text-jarvis-ink tabular-nums">{l.volume}× ${l.per_shipment}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Summary */}
                      {p.executive_summary && (
                        <div className="text-[10px] text-jarvis-body leading-relaxed">{p.executive_summary}</div>
                      )}

                      {/* Client feedback */}
                      {p.client_notes && (
                        <div className="rounded-lg border border-jarvis-warning/30 bg-jarvis-warning/5 p-2">
                          <div className="text-[8px] text-jarvis-warning uppercase">Client Feedback</div>
                          <div className="text-[10px] text-jarvis-body mt-1">{p.client_notes}</div>
                        </div>
                      )}

                      {/* Signature */}
                      {p.signature && (
                        <div className="rounded-lg border border-jarvis-success/30 bg-jarvis-success/5 p-2">
                          <div className="text-[8px] text-jarvis-success uppercase">Signed</div>
                          <div className="text-[10px] text-jarvis-body">{p.signature.name} · {p.signature.title}</div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {p.share_token && (
                          <>
                            <button
                              onClick={() => window.open(`http://127.0.0.1:8787/proposal/${p.share_token}`, "_blank")}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jarvis-ghost text-jarvis-body text-[9px] hover:text-jarvis-ink transition"
                            >
                              <Eye size={10} /> Preview
                            </button>
                            <button
                              onClick={(e) => {
                                navigator.clipboard.writeText(`http://127.0.0.1:8787/proposal/${p.share_token}`);
                                e.currentTarget.textContent = "✓ Copied";
                                setTimeout(() => { e.currentTarget.textContent = "Copy Link"; }, 2000);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jarvis-ghost text-jarvis-body text-[9px] hover:text-jarvis-ink transition"
                            >
                              <Link2 size={10} /> Copy Link
                            </button>
                          </>
                        )}
                        {p.status === "draft" && p.share_token && (
                          <button
                            onClick={async () => {
                              if (!supabase) return;
                              await supabase.from("proposals").update({ status: "sent" }).eq("id", p.id);
                              setProposals(prev => prev.map(pp => pp.id === p.id ? { ...pp, status: "sent" } : pp));
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[9px] font-semibold hover:bg-jarvis-primary/25 transition"
                          >
                            <Send size={10} /> Mark Sent
                          </button>
                        )}
                        {!p.share_token && (
                          <button
                            onClick={async () => {
                              if (!supabase) return;
                              const token = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(36)).join("").slice(0, 12);
                              await supabase.from("proposals").update({ share_token: token }).eq("id", p.id);
                              setProposals(prev => prev.map(pp => pp.id === p.id ? { ...pp, share_token: token } : pp));
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[9px] font-semibold hover:bg-jarvis-primary/25 transition"
                          >
                            <Link2 size={10} /> Generate Link
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (!supabase || !confirm("Delete this proposal?")) return;
                            await supabase.from("proposals").delete().eq("id", p.id);
                            setProposals(prev => prev.filter(pp => pp.id !== p.id));
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-jarvis-danger/60 text-[9px] hover:bg-jarvis-danger/10 hover:text-jarvis-danger transition ml-auto"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : tab === "emails" ? (
            <div className="space-y-2">
              {comms.filter(c => c.type === "email").length === 0 ? (
                <div className="text-[11px] text-jarvis-muted">No email history. Emails sync 3x/day from Gmail.</div>
              ) : comms.filter(c => c.type === "email").map(c => (
                <div key={c.id} className="surface p-2.5 text-[10px]">
                  {c.subject && <div className="text-jarvis-ink font-medium truncate">{c.subject}</div>}
                  <div className="text-jarvis-body mt-1 text-[9px] leading-relaxed">{(c.body ?? "").slice(0, 200)}</div>
                  <div className="text-[8px] text-jarvis-muted mt-1">{fmtDate(c.occurred_at)}</div>
                </div>
              ))}
              {/* Non-email comms */}
              {comms.filter(c => c.type !== "email").length > 0 && (
                <>
                  <div className="label mt-3">Other Communications</div>
                  {comms.filter(c => c.type !== "email").map(c => (
                    <div key={c.id} className="surface p-2.5 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="chip text-[8px] bg-jarvis-ghost text-jarvis-body">{c.type}</span>
                        <span className="text-[8px] text-jarvis-muted">{fmtDate(c.occurred_at)}</span>
                      </div>
                      <div className="text-jarvis-body mt-1 text-[9px]">{(c.body ?? "").slice(0, 200)}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : tab === "notes" ? (
            <div className="space-y-2">
              {deal.notes_summary ? (
                <div className="text-[11px] text-jarvis-body leading-relaxed whitespace-pre-wrap">{deal.notes_summary}</div>
              ) : comms.filter(c => c.type === "note").length > 0 ? (
                comms.filter(c => c.type === "note").map(c => (
                  <div key={c.id} className="surface p-2.5 text-[10px]">
                    <div className="text-jarvis-body text-[9px] leading-relaxed">{c.body}</div>
                    <div className="text-[8px] text-jarvis-muted mt-1">{fmtDate(c.occurred_at)}</div>
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-jarvis-muted">No notes. Notes sync from Pipedrive automatically.</div>
              )}
            </div>
          ) : tab === "discovery" ? (
            <DealDiscovery dealId={dealId} />
          ) : tab === "objections" ? (
            <DealObjections dealId={dealId} />
          ) : tab === "approvals" ? (
            <div className="p-4 space-y-4">
              <ApprovalQueue dealId={dealId} />
              <AuditLogViewer dealId={dealId} />
            </div>
          ) : null}

          {/* Email draft (shown in any tab) */}
          {emailDraft && (
            <div className="mt-4 surface p-3 space-y-2">
              <div className="label">AI Draft Email</div>
              {emailDraft.to && <div className="text-[9px] text-jarvis-muted">To: {emailDraft.to}</div>}
              <div className="text-[10px] text-jarvis-ink font-medium">Subject: {emailDraft.subject}</div>
              <textarea
                value={emailDraft.body}
                onChange={e => setEmailDraft({ ...emailDraft, body: e.target.value })}
                rows={5}
                className="w-full px-2 py-1.5 rounded-lg bg-jarvis-ghost border border-jarvis-border text-[10px] text-jarvis-ink outline-none resize-none focus:border-jarvis-primary/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (emailDraft._original && emailDraft.body !== emailDraft._original) {
                      await jarvis.emailStyleLearn?.(emailDraft._original, emailDraft.body, dealId);
                    }
                    await jarvis.ask(`Send email to ${emailDraft.to}: Subject: ${emailDraft.subject}\n\n${emailDraft.body}`, { kind: "chat" });
                    setEmailDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[9px] font-semibold"
                >
                  Send for Approval
                </button>
                <button onClick={() => setEmailDraft(null)} className="px-3 py-1.5 rounded-lg bg-jarvis-ghost text-jarvis-muted text-[9px]">
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="p-3 border-t border-jarvis-border flex gap-2">
          <button
            onClick={draftEmail}
            disabled={drafting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/15 hover:bg-jarvis-primary/15 transition disabled:opacity-40"
          >
            {drafting ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
            {drafting ? "Drafting..." : "Draft Email"}
          </button>
          <button
            onClick={() => setShowProposalGen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/15 hover:bg-jarvis-purple/15 transition"
          >
            <FileText size={11} /> Create Proposal
          </button>
        </div>
      </motion.div>

      {/* Proposal Generator Modal */}
      {showProposalGen && (
        <ProposalGenerator
          deal={{ ...deal, id: dealId, company: deal.title || deal.org_name || deal.company }}
          onClose={() => setShowProposalGen(false)}
          onSaved={() => {
            setShowProposalGen(false);
            if (supabase && dealId) {
              supabase.from("proposals").select("*").eq("deal_id", dealId).order("created_at", { ascending: false })
                .then(({ data }) => setProposals(data ?? []));
            }
          }}
        />
      )}
    </>
  );
}
