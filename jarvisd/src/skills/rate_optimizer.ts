// rate_optimizer — weekly analysis of won/lost rates to surface optimal pricing ranges.
// Runs Monday 7am. Reads rate_history, computes win-rate by bracket, stores suggestions.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "rate_optimizer",
  title: "Rate Optimizer",
  description: "Weekly analysis of won vs lost proposal rates. Surfaces optimal pricing ranges and flags off-market quotes.",
  version: "0.1.0",
  scopes: ["llm.cloud", "memory.read", "memory.write"],
  routerHint: "chat",
  triggers: [{ kind: "cron", expr: "0 7 * * 1" }],
  inputs: [
    { name: "userId", type: "string", required: false, description: "User ID to analyze (falls back to JARVIS_USER_ID env)" },
  ],
};

interface RateRow {
  rate_category: string;
  rate_key: string;
  rate_value: number;
  outcome: string | null;
  volume: number | null;
}

interface BracketStats {
  won: number[];
  lost: number[];
  pending: number[];
}

export const rateOptimizer: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    // Pull all rate_history rows — use the configured user_id from env or inputs
    const userId = (ctx.inputs["userId"] as string | undefined) ?? process.env.JARVIS_USER_ID;
    if (!userId) return { error: "No user context — pass userId input or set JARVIS_USER_ID env" };

    // Fetch via Supabase REST (jarvisd has supabase access via environment)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return { error: "Supabase env not configured" };

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/rate_history?user_id=eq.${userId}&select=rate_category,rate_key,rate_value,outcome,volume`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!resp.ok) return { error: `rate_history fetch failed: ${resp.status}` };
    const rows: RateRow[] = await resp.json();

    if (rows.length < 5) {
      return { skipped: true, reason: "Not enough rate history yet (need ≥5 data points)" };
    }

    // Group by category+key
    const grouped: Record<string, BracketStats> = {};
    for (const row of rows) {
      const key = `${row.rate_category}::${row.rate_key}`;
      if (!grouped[key]) grouped[key] = { won: [], lost: [], pending: [] };
      const bucket = row.outcome === "won" ? "won" : row.outcome === "lost" ? "lost" : "pending";
      grouped[key][bucket].push(row.rate_value);
    }

    const suggestions: string[] = [];
    const insights: Record<string, any> = {};

    for (const [key, stats] of Object.entries(grouped)) {
      if (stats.won.length < 2 && stats.lost.length < 2) continue;

      const avgWon = stats.won.length ? stats.won.reduce((a, b) => a + b, 0) / stats.won.length : null;
      const avgLost = stats.lost.length ? stats.lost.reduce((a, b) => a + b, 0) / stats.lost.length : null;

      const wonMin = stats.won.length ? Math.min(...stats.won) : null;
      const wonMax = stats.won.length ? Math.max(...stats.won) : null;

      insights[key] = { avgWon, avgLost, wonMin, wonMax, wonCount: stats.won.length, lostCount: stats.lost.length };

      const [category, rateKey] = key.split("::");
      const displayKey = rateKey.replace(/_/g, " ");

      if (avgWon !== null && avgLost !== null) {
        if (avgLost > avgWon * 1.1) {
          suggestions.push(
            `Rate insight (${category} / ${displayKey}): you win at avg $${avgWon.toFixed(2)} but lose at avg $${avgLost.toFixed(2)}. Quoting high is costing deals — consider ceiling at $${(avgWon * 1.05).toFixed(2)}.`
          );
        } else if (avgWon < avgLost * 0.9) {
          suggestions.push(
            `Rate insight (${category} / ${displayKey}): your winning rate ($${avgWon.toFixed(2)}) is well below lost deals ($${avgLost.toFixed(2)}). You may have room to raise rates and improve margin.`
          );
        }
      }

      if (wonMin !== null && wonMax !== null && stats.won.length >= 3) {
        suggestions.push(
          `Optimal range for ${category} / ${displayKey}: $${wonMin.toFixed(2)} – $${wonMax.toFixed(2)} (${stats.won.length} won deals).`
        );
      }
    }

    // Generate LLM narrative summary
    let narrative = "";
    if (suggestions.length > 0) {
      try {
        const out = await ctx.callModel({
          kind: "chat",
          system: "You are a 3PL pricing analyst. Summarize rate optimization insights concisely. Be direct. No filler.",
          prompt: `Based on rate history analysis, here are the raw insights:\n\n${suggestions.join("\n")}\n\nWrite a 2-3 sentence executive summary of the most important pricing adjustments to make this week.`,
          maxTokens: 200,
        });
        narrative = out.text.trim();
      } catch {
        narrative = suggestions.slice(0, 2).join(" ");
      }
    }

    // Store suggestions in jarvis_suggestions
    if (suggestions.length > 0) {
      const suggestionText = narrative || suggestions[0];
      await fetch(`${supabaseUrl}/rest/v1/jarvis_suggestions`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          type: "rate_optimization",
          suggestion: suggestionText,
          context: { insights, all_suggestions: suggestions, generated_at: new Date().toISOString() },
        }),
      });
    }

    audit({
      actor: "jarvis",
      action: "rate_optimizer.ran",
      subject: userId,
      metadata: { rows_analyzed: rows.length, suggestions_generated: suggestions.length, categories_analyzed: Object.keys(grouped).length },
    });

    return {
      analyzed: rows.length,
      categoriesAnalyzed: Object.keys(grouped).length,
      suggestionsGenerated: suggestions.length,
      narrative,
      insights,
    };
  },
};
