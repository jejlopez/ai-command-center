// browser_actions — JARVIS real-world browser automation routes.
// Book reservations, purchase (cart only), research, screenshot, browse.
// SAFETY: purchase NEVER completes checkout. book only confirms if caller provides confirmSelector.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { browse, clickElement, fillForm, isBrowserAvailable } from "../lib/providers/browser.js";
import { audit } from "../lib/audit.js";

// ── Zod schemas ──────────────────────────────────────────────────────────────

const BrowseBody = z.object({
  url: z.string().url(),
  screenshot: z.boolean().optional().default(false),
  extractSelector: z.string().optional(),
});

const ResearchBody = z.object({
  query: z.string().min(1).max(500),
});

const BookBody = z.object({
  url: z.string().url(),
  fields: z.record(z.string()),
  confirmSelector: z.string().optional(), // Only clicks confirm if explicitly provided
});

const PurchaseBody = z.object({
  url: z.string().url(),
  quantity: z.number().int().positive().optional().default(1),
});

const ScreenshotBody = z.object({
  url: z.string().url(),
});

// ── Common add-to-cart selectors (best-effort heuristics) ────────────────────
const ADD_TO_CART_SELECTORS = [
  "button[id*='add-to-cart']",
  "button[id*='addToCart']",
  "button[name='add']",
  "[data-testid*='add-to-cart']",
  "button[class*='add-to-cart']",
  "button[class*='addToCart']",
  "input[value='Add to Cart']",
  "input[value='Add to Bag']",
  "button:text('Add to Cart')",
  "button:text('Add to Bag')",
  "button:text('Add to cart')",
];

// ── Routes ───────────────────────────────────────────────────────────────────

export async function browserActionsRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /browser/browse ──────────────────────────────────────────────────
  app.post("/browser/browse", async (req, reply) => {
    const parsed = BrowseBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    const { url, screenshot, extractSelector } = parsed.data;

    const available = await isBrowserAvailable();
    if (!available) {
      reply.code(503);
      return { error: "Browser unavailable. Run: npx playwright install chromium" };
    }

    audit({ actor: "route:browser_browse", action: "browser.browse", subject: url });

    try {
      const result = await browse(url, { screenshot, extractSelector });

      audit({ actor: "route:browser_browse", action: "browser.browse.complete", subject: result.url });

      return {
        url: result.url,
        title: result.title,
        text: result.text,
        links: result.links,
        screenshotBase64: result.screenshotBase64,
      };
    } catch (err: any) {
      audit({ actor: "route:browser_browse", action: "browser.browse.error", subject: url, metadata: { error: err?.message } });
      reply.code(500);
      return { error: err?.message ?? String(err) };
    }
  });

  // ── POST /browser/research ────────────────────────────────────────────────
  app.post("/browser/research", async (req, reply) => {
    const parsed = ResearchBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    const { query } = parsed.data;

    const available = await isBrowserAvailable();
    if (!available) {
      reply.code(503);
      return { error: "Browser unavailable. Run: npx playwright install chromium" };
    }

    audit({ actor: "route:browser_research", action: "browser.research", subject: query });

    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const result = await browse(searchUrl, { screenshot: false });

      // Extract structured results from raw text + links
      // Parse Google result snippets: each organic result tends to appear in link list
      const results = result.links.slice(0, 10).map((link) => ({
        title: link.text,
        url: link.href,
        snippet: "", // snippets are embedded in text; surfacing raw links is sufficient
      }));

      // Build a simple summary from page text (first 3000 chars of cleaned content)
      const summaryText = result.text.slice(0, 3000);

      audit({ actor: "route:browser_research", action: "browser.research.complete", subject: query, metadata: { resultsCount: results.length } });

      return {
        results,
        summary: summaryText,
      };
    } catch (err: any) {
      audit({ actor: "route:browser_research", action: "browser.research.error", subject: query, metadata: { error: err?.message } });
      reply.code(500);
      return { error: err?.message ?? String(err) };
    }
  });

  // ── POST /browser/book ────────────────────────────────────────────────────
  // SAFETY: fills form and screenshots BEFORE clicking confirm.
  // Only clicks confirmSelector if explicitly provided by the caller.
  app.post("/browser/book", async (req, reply) => {
    const parsed = BookBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    const { url, fields, confirmSelector } = parsed.data;

    const available = await isBrowserAvailable();
    if (!available) {
      reply.code(503);
      return { error: "Browser unavailable. Run: npx playwright install chromium" };
    }

    audit({
      actor: "route:browser_book",
      action: "browser.book.start",
      subject: url,
      metadata: { fieldCount: Object.keys(fields).length, willConfirm: !!confirmSelector },
    });

    try {
      // Fill form WITHOUT submitting (no confirmSelector passed to fillForm yet)
      const filledResult = await fillForm(url, fields);

      // Take a screenshot of the filled-but-not-submitted state for user verification
      const previewResult = await browse(filledResult.url, { screenshot: true });
      const screenshotBase64 = previewResult.screenshotBase64;

      let finalMessage = "Form filled. Screenshot captured for your review. Confirm selector not triggered.";
      let finalUrl = filledResult.url;

      // Only click confirm if caller explicitly provided a selector — safety gate
      if (confirmSelector) {
        audit({
          actor: "route:browser_book",
          action: "browser.book.confirm",
          subject: url,
          metadata: { confirmSelector },
        });

        const confirmedResult = await clickElement(filledResult.url, confirmSelector);
        finalMessage = `Confirmation clicked. Post-confirm page: "${confirmedResult.title}". Verify screenshot.`;
        finalUrl = confirmedResult.url;
      }

      audit({
        actor: "route:browser_book",
        action: "browser.book.complete",
        subject: finalUrl,
        metadata: { confirmed: !!confirmSelector },
      });

      return {
        success: true,
        message: finalMessage,
        screenshotBase64,
        finalUrl,
      };
    } catch (err: any) {
      audit({ actor: "route:browser_book", action: "browser.book.error", subject: url, metadata: { error: err?.message } });
      reply.code(500);
      return { success: false, message: err?.message ?? String(err) };
    }
  });

  // ── POST /browser/purchase ────────────────────────────────────────────────
  // SAFETY: NEVER completes checkout. Adds to cart, screenshots, returns for approval.
  app.post("/browser/purchase", async (req, reply) => {
    const parsed = PurchaseBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    const { url } = parsed.data;

    const available = await isBrowserAvailable();
    if (!available) {
      reply.code(503);
      return { error: "Browser unavailable. Run: npx playwright install chromium" };
    }

    audit({ actor: "route:browser_purchase", action: "browser.purchase.start", subject: url });

    try {
      // First browse to extract product name and price
      const productPage = await browse(url, { screenshot: false });

      // Extract product name from title
      const productName = productPage.title;

      // Attempt to extract price from page text via simple heuristic
      const priceMatch = productPage.text.match(/\$[\d,]+\.?\d{0,2}/);
      const price = priceMatch ? priceMatch[0] : undefined;

      // Try each add-to-cart selector in order
      let addedToCart = false;
      let cartResult: { url: string; title: string; text: string; links: Array<{ text: string; href: string }> } | null = null;
      let usedSelector = "";

      for (const selector of ADD_TO_CART_SELECTORS) {
        try {
          cartResult = await clickElement(url, selector);
          addedToCart = true;
          usedSelector = selector;
          break;
        } catch {
          // Try next selector
        }
      }

      if (!addedToCart || !cartResult) {
        audit({ actor: "route:browser_purchase", action: "browser.purchase.no_cart_button", subject: url });
        // Return product info with screenshot so user can investigate
        const screenshotResult = await browse(url, { screenshot: true });
        return {
          success: false,
          message: "Could not find an add-to-cart button on this page. Screenshot attached for manual review.",
          productName,
          price,
          screenshotBase64: screenshotResult.screenshotBase64,
        };
      }

      // Screenshot the cart page — NEVER proceed to checkout
      const cartScreenshot = await browse(cartResult.url, { screenshot: true });

      audit({
        actor: "route:browser_purchase",
        action: "browser.purchase.added_to_cart",
        subject: url,
        metadata: { productName, price, cartUrl: cartResult.url, usedSelector },
      });

      return {
        success: true,
        message: `Added to cart. Cart page screenshot captured. CHECKOUT NOT INITIATED — awaiting your approval.`,
        productName,
        price,
        cartUrl: cartResult.url,
        screenshotBase64: cartScreenshot.screenshotBase64,
      };
    } catch (err: any) {
      audit({ actor: "route:browser_purchase", action: "browser.purchase.error", subject: url, metadata: { error: err?.message } });
      reply.code(500);
      return { success: false, message: err?.message ?? String(err) };
    }
  });

  // ── POST /browser/screenshot ──────────────────────────────────────────────
  app.post("/browser/screenshot", async (req, reply) => {
    const parsed = ScreenshotBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    const { url } = parsed.data;

    const available = await isBrowserAvailable();
    if (!available) {
      reply.code(503);
      return { error: "Browser unavailable. Run: npx playwright install chromium" };
    }

    audit({ actor: "route:browser_screenshot", action: "browser.screenshot", subject: url });

    try {
      const result = await browse(url, { screenshot: true });

      audit({ actor: "route:browser_screenshot", action: "browser.screenshot.complete", subject: result.url });

      return {
        screenshotBase64: result.screenshotBase64,
        title: result.title,
        url: result.url,
      };
    } catch (err: any) {
      audit({ actor: "route:browser_screenshot", action: "browser.screenshot.error", subject: url, metadata: { error: err?.message } });
      reply.code(500);
      return { error: err?.message ?? String(err) };
    }
  });
}
