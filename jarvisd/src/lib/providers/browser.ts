// Browser automation provider — Playwright-based web browsing for JARVIS.
// Skills can navigate pages, extract content, take screenshots, and interact.

import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import { audit } from "../audit.js";

let browser: Browser | null = null;
let context: BrowserContext | null = null;

async function ensureBrowser(): Promise<BrowserContext> {
  if (context) return context;
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    userAgent: "JARVIS-OS/0.1 (Personal Assistant)",
    viewport: { width: 1280, height: 800 },
  });
  return context;
}

export async function closeBrowser(): Promise<void> {
  if (context) { await context.close(); context = null; }
  if (browser) { await browser.close(); browser = null; }
}

export interface BrowseResult {
  url: string;
  title: string;
  text: string;
  links: Array<{ text: string; href: string }>;
  screenshotBase64?: string;
}

/** Navigate to a URL and extract page content. */
export async function browse(url: string, opts: {
  screenshot?: boolean;
  waitFor?: string;
  extractSelector?: string;
  timeoutMs?: number;
} = {}): Promise<BrowseResult> {
  audit({ actor: "browser", action: "browser.navigate", subject: url });

  const ctx = await ensureBrowser();
  const page = await ctx.newPage();

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 15000,
    });

    if (opts.waitFor) {
      await page.waitForSelector(opts.waitFor, { timeout: 5000 }).catch(() => {});
    }

    const title = await page.title();

    // Extract text — either from a specific selector or the whole body
    let text: string;
    if (opts.extractSelector) {
      text = await page.locator(opts.extractSelector).innerText().catch(() => "");
    } else {
      text = await page.evaluate(() => {
        // Remove script/style tags, get clean text
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("script, style, nav, footer, header").forEach(el => el.remove());
        return (clone.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 8000);
      });
    }

    // Extract links
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]"))
        .slice(0, 20)
        .map(a => ({
          text: (a as HTMLAnchorElement).innerText.trim().slice(0, 80),
          href: (a as HTMLAnchorElement).href,
        }))
        .filter(l => l.text && l.href.startsWith("http"));
    });

    // Screenshot
    let screenshotBase64: string | undefined;
    if (opts.screenshot) {
      const buf = await page.screenshot({ type: "png", fullPage: false });
      screenshotBase64 = buf.toString("base64");
    }

    await page.close();

    return { url: page.url(), title, text, links, screenshotBase64 };
  } catch (err: any) {
    await page.close().catch(() => {});
    throw new Error(`Browse failed: ${err.message}`);
  }
}

/** Click an element on the current page. */
export async function clickElement(url: string, selector: string): Promise<BrowseResult> {
  const ctx = await ensureBrowser();
  const page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.click(selector, { timeout: 5000 });
    await page.waitForLoadState("domcontentloaded").catch(() => {});

    const title = await page.title();
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style").forEach(el => el.remove());
      return (clone.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 8000);
    });

    await page.close();
    return { url: page.url(), title, text, links: [] };
  } catch (err: any) {
    await page.close().catch(() => {});
    throw new Error(`Click failed: ${err.message}`);
  }
}

/** Fill a form field and optionally submit. */
export async function fillForm(url: string, fields: Record<string, string>, submitSelector?: string): Promise<BrowseResult> {
  const ctx = await ensureBrowser();
  const page = await ctx.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    for (const [selector, value] of Object.entries(fields)) {
      await page.fill(selector, value, { timeout: 5000 });
    }

    if (submitSelector) {
      await page.click(submitSelector, { timeout: 5000 });
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }

    const title = await page.title();
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style").forEach(el => el.remove());
      return (clone.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 4000);
    });

    await page.close();
    return { url: page.url(), title, text, links: [] };
  } catch (err: any) {
    await page.close().catch(() => {});
    throw new Error(`Form fill failed: ${err.message}`);
  }
}

/** Check if Playwright + Chromium are available. */
export async function isBrowserAvailable(): Promise<boolean> {
  try {
    const b = await chromium.launch({ headless: true });
    await b.close();
    return true;
  } catch {
    return false;
  }
}
