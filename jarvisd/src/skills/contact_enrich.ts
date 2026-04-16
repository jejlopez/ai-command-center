// contact_enrich — extracts structured facts about a person from existing
// memory and writes any new facts back as `kind: "fact"` nodes linked to
// the person. Triggered manually, or automatically when a new person
// is remembered (via the memory.remembered event).
// Also runs on cron to enrich new Supabase contacts with role/company context.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { supaFetch, supaUpsert } from "../lib/supabase_client.js";

const manifest: SkillManifest = {
  name: "contact_enrich",
  title: "Contact enrich",
  description:
    "Extract structured facts (role, company, relationships, preferences) about a person from memory.",
  version: "0.1.0",
  scopes: ["memory.read", "memory.write", "llm.cloud"],
  routerHint: "summary",
  triggers: [
    { kind: "manual" },
    { kind: "event", event: "memory.remembered" },
    { kind: "cron", expr: "30 8 * * 1-5" },
  ],
  inputs: [{ name: "name", type: "string", required: true }],
};

interface ExtractedFact {
  label: string;
  body?: string;
}

function tryParseFacts(text: string): ExtractedFact[] {
  // Try JSON first.
  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("[");
  const jsonEnd = trimmed.lastIndexOf("]");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const slice = trimmed.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(slice);
      if (Array.isArray(parsed)) {
        const out: ExtractedFact[] = [];
        for (const item of parsed) {
          if (typeof item === "string" && item.trim()) {
            out.push({ label: item.trim().slice(0, 140) });
          } else if (item && typeof item === "object") {
            const label =
              typeof (item as any).label === "string"
                ? (item as any).label
                : typeof (item as any).fact === "string"
                ? (item as any).fact
                : null;
            if (label) {
              out.push({
                label: label.slice(0, 140),
                body:
                  typeof (item as any).body === "string"
                    ? (item as any).body
                    : undefined,
              });
            }
          }
        }
        if (out.length) return out;
      }
    } catch {
      // fall through to line parse
    }
  }

  // Fallback: one fact per bullet/numbered line.
  return trimmed
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*\d.\s)]+/, "").trim())
    .filter((l) => l.length > 3)
    .slice(0, 10)
    .map((l) => ({ label: l.slice(0, 140) }));
}

async function enrichSupabaseContacts(ctx: any): Promise<{ enriched: number }> {
  const contacts = await supaFetch('contacts', 'select=id,name,company,role,email,notes&role=is.null&order=created_at.desc&limit=5');

  if (contacts.length === 0) {
    ctx.log("contact_enrich.supabase.no_contacts");
    return { enriched: 0 };
  }

  let enriched = 0;
  for (const c of contacts) {
    try {
      const out = await ctx.callModel({
        kind: "summary",
        privacy: "personal",
        prompt: `Research this business contact for a 3PL/shipping sales context:
Name: ${c.name}
Company: ${c.company ?? 'unknown'}
Email: ${c.email ?? 'unknown'}

Based on the company name and email domain, provide:
1. Likely role/title (if not obvious, say "unknown")
2. What the company does (one sentence)
3. Potential shipping/logistics needs
4. Suggested approach for initial outreach

Return as JSON:
{"role": "...", "company_info": "...", "logistics_needs": "...", "approach": "..."}`,
      });

      const jsonMatch = out.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const info = JSON.parse(jsonMatch[0]);

        const enrichedNotes = [
          c.notes,
          info.company_info ? `Company: ${info.company_info}` : null,
          info.logistics_needs ? `Needs: ${info.logistics_needs}` : null,
          info.approach ? `Approach: ${info.approach}` : null,
        ].filter(Boolean).join('\n');

        await supaUpsert('contacts', {
          id: c.id,
          role: info.role !== 'unknown' ? info.role : c.role,
          notes: enrichedNotes,
        }, 'id');

        enriched++;
        ctx.log(`contact_enrich.supabase.enriched`, { name: c.name, company: c.company });
      }
    } catch (e: any) {
      ctx.log(`contact_enrich.supabase.fail`, { name: c.name, error: e?.message ?? String(e) });
    }
  }

  return { enriched };
}

export const contactEnrich: Skill = {
  manifest,
  async run(ctx) {
    // Cron trigger — enrich new Supabase contacts
    if (ctx.triggeredBy === "cron") {
      return enrichSupabaseContacts(ctx);
    }

    let name: string | null = null;

    if (ctx.triggeredBy === "event") {
      const evt = ctx.inputs["event"] as
        | { kind?: string; label?: string; nodeId?: string }
        | undefined;
      if (!evt || evt.kind !== "person" || !evt.label) {
        return { skipped: true, reason: "event not a person remember" };
      }
      name = evt.label;
    } else {
      const raw = ctx.inputs["name"];
      if (typeof raw === "string" && raw.trim()) {
        name = raw.trim();
      }
    }

    if (!name) {
      return { skipped: true, reason: "no name provided" };
    }

    const recalled = await ctx.memory.recall({
      q: name,
      enhanced: true,
      limit: 15,
    });

    const personNode = recalled.nodes.find(
      (n) => n.kind === "person" && n.label.toLowerCase() === name!.toLowerCase()
    );

    const prompt = [
      `Extract structured facts about "${name}" from the notes below.`,
      "Focus on: role, company, relationships to other people, and stated preferences.",
      "Return a JSON array of short fact strings (max 10). No prose. Each fact must be self-contained.",
      "",
      "Notes:",
      recalled.compiled || "(nothing on file)",
    ].join("\n");

    let extracted: ExtractedFact[] = [];
    try {
      const out = await ctx.callModel({
        kind: "summary",
        system:
          "You extract structured facts from messy notes. Output JSON arrays only.",
        prompt,
        maxTokens: 400,
      });
      extracted = tryParseFacts(out.text);
    } catch (err: any) {
      ctx.log("contact_enrich.model.fail", {
        error: err?.message ?? String(err),
      });
      return { name, addedFacts: [], error: err?.message ?? String(err) };
    }

    // De-dupe against existing fact-node labels already recalled.
    const existingLabels = new Set(
      recalled.nodes
        .filter((n) => n.kind === "fact")
        .map((n) => n.label.toLowerCase())
    );

    const added: string[] = [];
    for (const f of extracted) {
      const key = f.label.toLowerCase();
      if (existingLabels.has(key)) continue;
      existingLabels.add(key);
      const links = personNode
        ? [{ toId: personNode.id, relation: "about" }]
        : undefined;
      ctx.memory.remember({
        kind: "fact",
        label: f.label,
        body: f.body,
        trust: 0.5,
        links,
      });
      added.push(f.label);
    }

    return { name, addedFacts: added };
  },
};
