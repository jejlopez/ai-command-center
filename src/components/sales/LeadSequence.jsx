// LeadSequence — visual vertical timeline of active sequence steps for a lead.

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

const STATUS_STYLES = {
  completed: { circle: "bg-jarvis-success border-jarvis-success",       text: "text-jarvis-success" },
  current:   { circle: "bg-jarvis-primary border-jarvis-primary",       text: "text-jarvis-primary" },
  skipped:   { circle: "bg-jarvis-muted/20 border-jarvis-muted/30",     text: "text-jarvis-muted/50" },
  upcoming:  { circle: "bg-jarvis-muted/10 border-jarvis-muted/20",     text: "text-jarvis-muted" },
};

function stepStatus(step, sequence) {
  if (step.status === "completed") return "completed";
  if (step.status === "skipped")   return "skipped";
  if (step.id === sequence?.current_step_id) return "current";
  return "upcoming";
}

export function LeadSequence({ leadId }) {
  const [sequence, setSequence]   = useState(null);
  const [steps,    setSteps]      = useState([]);
  const [loading,  setLoading]    = useState(true);

  useEffect(() => {
    if (!leadId) { setLoading(false); return; }

    (async () => {
      const { data: seqs } = await supabase
        .from("sequences")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1);

      const seq = seqs?.[0] ?? null;
      setSequence(seq);

      if (seq) {
        const { data: stepsData } = await supabase
          .from("sequence_steps")
          .select("*")
          .eq("sequence_id", seq.id)
          .order("step_number", { ascending: true });
        setSteps(stepsData || []);
      }
      setLoading(false);
    })();
  }, [leadId]);

  if (loading) {
    return <div className="text-[10px] text-jarvis-muted animate-pulse py-6 text-center">Loading sequence…</div>;
  }

  if (!sequence) {
    return (
      <div className="text-[11px] text-jarvis-muted text-center py-8">
        No active sequence for this lead.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="label">Sequence</span>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
          sequence.status === "active" ? "bg-jarvis-success/10 text-jarvis-success" : "bg-jarvis-muted/10 text-jarvis-muted"
        }`}>
          {sequence.status || "active"}
        </span>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-jarvis-border" />

        <div className="space-y-3">
          {steps.map((step, i) => {
            const status  = stepStatus(step, sequence);
            const styles  = STATUS_STYLES[status] || STATUS_STYLES.upcoming;

            return (
              <div key={step.id} className="flex items-start gap-3 relative">
                {/* Node */}
                <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 z-10 mt-0.5 ${styles.circle}`}>
                  <span className="text-[7px] font-bold text-white/90">S{i}</span>
                </div>

                {/* Content */}
                <div className={`surface p-2 flex-1 ${status === "skipped" ? "opacity-40" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-medium ${styles.text}`}>
                      {step.action || `Step ${i}`}
                    </span>
                    {step.delay_days != null && (
                      <span className="text-[8px] text-jarvis-muted">+{step.delay_days}d</span>
                    )}
                  </div>

                  {step.result && (
                    <div className="text-[9px] text-jarvis-success mt-0.5">
                      Result: {step.result}
                    </div>
                  )}

                  {step.behavioral_override && (
                    <div className="text-[9px] text-jarvis-warning mt-0.5 italic">
                      Override: {step.behavioral_override}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
