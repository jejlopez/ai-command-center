// ConvertToDeal — one-click lead-to-deal conversion with default discovery requirements.

import { useState } from "react";
import { Loader2, ArrowRightCircle, CheckCircle } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const DEFAULT_DISCOVERY_CATEGORIES = [
  "volume",
  "services",
  "timeline",
  "budget",
  "decision_process",
  "current_provider",
];

export function ConvertToDeal({ lead, onRefresh, onConverted }) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const alreadyConverted = lead?.status === "converted" && lead?.deal_id;

  if (alreadyConverted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-jarvis-success/10 text-jarvis-success text-[10px] font-medium border border-jarvis-success/20">
        <CheckCircle size={13} />
        Converted to deal
      </div>
    );
  }

  const convert = async () => {
    setLoading(true);
    setError(null);
    try {
      const qual = lead.qualification || {};

      // 1. Create deal
      const { data: deal, error: dealErr } = await supabase
        .from("deals")
        .insert({
          title:              lead.org_name || lead.title || lead.contact_name,
          contact_id:         lead.contact_id,
          lead_id:            lead.id,
          status:             "discovery",
          source:             lead.source,
          estimated_value:    qual.estimated_monthly_value || null,
          current_provider:   qual.current_provider || null,
          daily_orders:       qual.daily_orders || null,
          monthly_spend:      qual.monthly_spend || null,
          services_needed:    qual.services_needed || null,
          timeline:           qual.timeline || null,
          research_packet:    lead.research_packet || null,
          converted_at:       new Date().toISOString(),
        })
        .select()
        .single();

      if (dealErr) throw dealErr;

      // 2. Default discovery requirements
      const discoveryRows = DEFAULT_DISCOVERY_CATEGORIES.map(category => ({
        deal_id:  deal.id,
        category,
        status:   "pending",
      }));
      await supabase.from("discovery_requirements").insert(discoveryRows);

      // 3. Copy activities
      const { data: activities } = await supabase
        .from("activities")
        .select("*")
        .eq("lead_id", lead.id);

      if (activities?.length) {
        await supabase.from("activities").insert(
          activities.map(({ id, ...a }) => ({ ...a, deal_id: deal.id }))
        );
      }

      // 4. Cancel active sequences
      await supabase
        .from("sequences")
        .update({ status: "cancelled" })
        .eq("lead_id", lead.id)
        .eq("status", "active");

      // 5. Mark lead converted
      await supabase
        .from("leads")
        .update({ status: "converted", deal_id: deal.id })
        .eq("id", lead.id);

      onRefresh?.();
      onConverted?.(deal);
    } catch (err) {
      setError(err?.message || "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={convert}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-medium bg-jarvis-success/10 text-jarvis-success border border-jarvis-success/20 hover:bg-jarvis-success/20 disabled:opacity-40 transition-all"
      >
        {loading
          ? <Loader2 size={12} className="animate-spin" />
          : <ArrowRightCircle size={12} />
        }
        {loading ? "Converting…" : "Convert to Deal"}
      </button>
      {error && <div className="text-[9px] text-jarvis-danger text-center">{error}</div>}
    </div>
  );
}
