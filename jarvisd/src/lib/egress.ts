// Egress Firewall — every outbound HTTP request from skills goes through here.
//
// This is the enforcement layer that backs the egress-allowlist policy.
// Skills MUST use `secureFetch` instead of raw `fetch`. The policy engine
// evaluates the request; if denied, an error is thrown and the call never fires.

import { policyEngine } from "./policy.js";
import { audit } from "./audit.js";

export class EgressDeniedError extends Error {
  public readonly url: string;
  public readonly policyIds: string[];

  constructor(url: string, policyIds: string[], reason: string) {
    super(`Egress denied for ${url}: ${reason}`);
    this.name = "EgressDeniedError";
    this.url = url;
    this.policyIds = policyIds;
  }
}

/**
 * Fetch wrapper that enforces the egress policy before making any outbound request.
 * Drop-in replacement for `fetch` — same signature, but throws EgressDeniedError on deny.
 */
export async function secureFetch(
  input: string | URL | Request,
  init?: RequestInit,
  meta?: { actor?: string }
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const headers: Record<string, string> = {};

  // Extract headers from init (if provided).
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => { headers[k] = v; });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) { headers[k] = v; }
    } else {
      Object.assign(headers, init.headers);
    }
  }

  const decision = await policyEngine.beforeEgress(url, headers, meta?.actor);

  if (decision.effect === "deny") {
    throw new EgressDeniedError(
      url,
      decision.matched.filter((m) => m.effect === "deny").map((m) => m.policyId),
      decision.reason
    );
  }

  return fetch(input, init);
}

/**
 * Check whether a URL would be allowed by egress policy without making the request.
 * Useful for pre-flight checks in UI.
 */
export async function checkEgress(
  url: string,
  actor?: string
): Promise<{ allowed: boolean; reason: string }> {
  const decision = await policyEngine.beforeEgress(url, {}, actor);
  return { allowed: decision.effect === "allow", reason: decision.reason };
}
