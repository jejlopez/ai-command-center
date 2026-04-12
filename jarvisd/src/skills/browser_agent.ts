// browser_agent — JARVIS browses the web on your behalf.
// Navigate, extract content, research, fill forms, take screenshots.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { browse, clickElement, fillForm, isBrowserAvailable, closeBrowser } from "../lib/providers/browser.js";

const manifest: SkillManifest = {
  name: "browser_agent",
  title: "Browser Agent",
  description: "Browse the web — navigate pages, extract content, research topics, fill forms, take screenshots.",
  version: "0.1.0",
  scopes: ["net.out", "llm.cloud"],
  routerHint: "summary",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "action", type: "string", required: true, description: "browse, click, fill, or research" },
    { name: "url", type: "string", required: false, description: "URL to navigate to" },
    { name: "query", type: "string", required: false, description: "Search query (for research action)" },
    { name: "selector", type: "string", required: false, description: "CSS selector for click/extract" },
    { name: "fields", type: "string", required: false, description: "JSON of field selectors to values (for fill action)" },
    { name: "screenshot", type: "boolean", required: false, default: false, description: "Take a screenshot" },
  ],
};

export const browserAgent: Skill = {
  manifest,
  async run(ctx) {
    const action = String(ctx.inputs["action"] ?? "browse");
    const url = ctx.inputs["url"] ? String(ctx.inputs["url"]) : undefined;
    const query = ctx.inputs["query"] ? String(ctx.inputs["query"]) : undefined;
    const selector = ctx.inputs["selector"] ? String(ctx.inputs["selector"]) : undefined;
    const screenshot = Boolean(ctx.inputs["screenshot"]);

    const available = await isBrowserAvailable();
    if (!available) {
      return { error: "Browser not available. Run: npx playwright install chromium" };
    }

    ctx.log("browser_agent.start", { action, url, query });

    try {
      if (action === "research" && query) {
        // Search Google and summarize results
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const result = await browse(searchUrl, { screenshot });

        // Use LLM to summarize the search results
        try {
          const out = await ctx.callModel({
            kind: "summary",
            system: "You are JARVIS. Summarize these search results into 3-5 key findings. Be specific and cite sources.",
            prompt: `Search query: "${query}"\n\nSearch results:\n${result.text}\n\nTop links:\n${result.links.slice(0, 10).map(l => `- ${l.text}: ${l.href}`).join("\n")}`,
            maxTokens: 500,
          });
          await closeBrowser();
          return {
            summary: out.text.trim(),
            query,
            sourcesFound: result.links.length,
            topLinks: result.links.slice(0, 5),
            model: out.model,
            costUsd: out.costUsd,
          };
        } catch {
          await closeBrowser();
          return {
            text: result.text.slice(0, 2000),
            query,
            links: result.links.slice(0, 10),
            fallback: true,
          };
        }
      }

      if (action === "browse" && url) {
        const result = await browse(url, { screenshot, extractSelector: selector });
        await closeBrowser();

        // If text is long, summarize with LLM
        if (result.text.length > 1000) {
          try {
            const out = await ctx.callModel({
              kind: "summary",
              system: "Summarize this web page content into key points. Be concise.",
              prompt: `Page: ${result.title}\nURL: ${result.url}\n\n${result.text}`,
              maxTokens: 400,
            });
            return {
              title: result.title,
              url: result.url,
              summary: out.text.trim(),
              links: result.links.slice(0, 10),
              screenshot: result.screenshotBase64 ? "(captured)" : undefined,
              model: out.model,
            };
          } catch { /* fall through to raw text */ }
        }

        return {
          title: result.title,
          url: result.url,
          text: result.text.slice(0, 3000),
          links: result.links.slice(0, 10),
          screenshot: result.screenshotBase64 ? "(captured)" : undefined,
        };
      }

      if (action === "click" && url && selector) {
        const result = await clickElement(url, selector);
        await closeBrowser();
        return {
          title: result.title,
          url: result.url,
          text: result.text.slice(0, 2000),
        };
      }

      if (action === "fill" && url) {
        const fieldsRaw = ctx.inputs["fields"];
        let fields: Record<string, string> = {};
        try {
          fields = typeof fieldsRaw === "string" ? JSON.parse(fieldsRaw) : (fieldsRaw as any) ?? {};
        } catch {
          return { error: "fields must be valid JSON: { \"#selector\": \"value\" }" };
        }
        const result = await fillForm(url, fields, selector);
        await closeBrowser();
        return {
          title: result.title,
          url: result.url,
          text: result.text.slice(0, 2000),
        };
      }

      return { error: `Unknown action "${action}". Use: browse, click, fill, or research` };
    } catch (err: any) {
      await closeBrowser().catch(() => {});
      ctx.log("browser_agent.fail", { error: err?.message });
      return { error: err?.message ?? String(err) };
    }
  },
};
