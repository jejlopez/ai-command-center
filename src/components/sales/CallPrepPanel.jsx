// CallPrepPanel — pre-call summary with talking points.

import { Phone, AlertCircle, HelpCircle, Target, Clock } from "lucide-react";

function Section({ icon: Icon, title, children, color }) {
  if (!children) return null;
  return (
    <div className="surface p-3">
      <div className={`flex items-center gap-1.5 mb-1.5 ${color || "text-jarvis-muted"}`}>
        <Icon size={11} />
        <span className="text-[9px] font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-[11px] text-jarvis-body leading-relaxed">{children}</div>
    </div>
  );
}

export function CallPrepPanel({ lead, deal }) {
  const record = deal || lead;
  if (!record) return null;

  const contact = record.contacts || {};
  const rp = lead?.research_packet || {};
  const qual = lead?.qualification || {};

  // Talking points
  const talkingPoints = [];
  if (rp.pain_points) talkingPoints.push(`Pain point: ${rp.pain_points}`);
  if (rp.buying_triggers) talkingPoints.push(`Trigger: ${rp.buying_triggers}`);
  if (rp.recommended_angle) talkingPoints.push(`Angle: ${rp.recommended_angle}`);
  if (deal?.switch_reason) talkingPoints.push(`Why switching: ${deal.switch_reason}`);
  if (deal?.current_provider) talkingPoints.push(`Current provider: ${deal.current_provider}`);

  // Unanswered questions
  const questions = [];
  if (!qual.daily_orders && !deal?.volumes) questions.push("What's your daily order volume?");
  if (!qual.current_provider && !deal?.current_provider) questions.push("Who handles fulfillment now?");
  if (!qual.timeline && !deal?.timeline) questions.push("What's your timeline?");
  if (!qual.services_needed && !deal?.services_needed?.length) questions.push("Which services do you need?");
  if (!qual.decision_maker_access) questions.push("Are you the decision maker?");

  // Open objections (deals only)
  const objections = deal?._openObjections || [];

  // Recent activity summary
  const lastTouch = record.last_touch || record.updated_at;
  const daysSince = lastTouch ? Math.floor((Date.now() - new Date(lastTouch).getTime()) / 86_400_000) : null;

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Phone size={14} className="text-jarvis-primary" />
        <div>
          <div className="text-xs font-bold text-jarvis-ink">Call Prep: {record.company || contact.company}</div>
          <div className="text-[10px] text-jarvis-muted">{contact.name} · {contact.phone || contact.email || "no contact info"}</div>
        </div>
      </div>

      {daysSince != null && (
        <div className="flex items-center gap-1.5 text-[10px] text-jarvis-muted">
          <Clock size={10} />
          Last contact: {daysSince === 0 ? "today" : `${daysSince} days ago`}
        </div>
      )}

      <Section icon={Target} title="Key Talking Points" color="text-jarvis-success">
        {talkingPoints.length > 0 ? (
          <ul className="list-disc list-inside space-y-0.5">
            {talkingPoints.map((tp, i) => <li key={i}>{tp}</li>)}
          </ul>
        ) : (
          <span className="text-jarvis-ghost">No research data yet. Ask discovery questions.</span>
        )}
      </Section>

      <Section icon={HelpCircle} title="Questions to Ask" color="text-jarvis-warning">
        {questions.length > 0 ? (
          <ul className="list-disc list-inside space-y-0.5">
            {questions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        ) : (
          <span className="text-jarvis-success">All key questions answered.</span>
        )}
      </Section>

      {objections.length > 0 && (
        <Section icon={AlertCircle} title="Open Objections to Address" color="text-jarvis-danger">
          <ul className="list-disc list-inside space-y-0.5">
            {objections.map((o, i) => <li key={i}>{typeof o === "string" ? o : o.objection}</li>)}
          </ul>
        </Section>
      )}

      {rp.company_overview && (
        <Section icon={Target} title="Company Background" color="text-blue-400">
          {rp.company_overview}
        </Section>
      )}
    </div>
  );
}
