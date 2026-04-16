// Gmail action provider — draft, label, archive, send.
// Every action goes through limits engine + approval gateway.
// Delete and forward are NOT implemented — by design.

import { vault } from "../vault.js";
import { audit } from "../audit.js";
import { assertLimit, recordAction, checkCircuitBreaker, recordCircuitError, recordCircuitSuccess, isProtectedSender } from "../limits.js";
import { checkAction, validateApproval } from "../approval_gateway.js";
import type { GatewayAction } from "../approval_gateway.js";

// ---------------------------------------------------------------------------
// OAuth token management
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  const refreshToken = vault.get("gmail.refresh_token");
  const clientId = vault.get("gmail.client_id");
  const clientSecret = vault.get("gmail.client_secret");

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("Gmail OAuth not configured — set credentials in Settings > Connectors");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`);
  const data = await res.json() as any;
  return data.access_token;
}

async function gmailApi(method: string, path: string, body?: any): Promise<any> {
  // Circuit breaker
  const cb = checkCircuitBreaker("gmail");
  if (cb.open) throw new Error(`Gmail circuit breaker open: ${cb.reason}`);

  const token = await getAccessToken();
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    recordCircuitError("gmail", `${res.status}: ${errText.slice(0, 200)}`);
    throw new Error(`Gmail API ${res.status}: ${errText.slice(0, 200)}`);
  }

  recordCircuitSuccess("gmail");
  return res.json();
}

// ---------------------------------------------------------------------------
// Read (Phase A)
// ---------------------------------------------------------------------------

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  labels: string[];
  isStarred: boolean;
}

export async function listMessages(maxResults = 20, query = "is:unread"): Promise<GmailMessage[]> {
  assertLimit("gmail", "scan");

  const listRes = await gmailApi("GET", `/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`);
  const messageIds: string[] = (listRes.messages ?? []).map((m: any) => m.id);

  const messages: GmailMessage[] = [];
  for (const msgId of messageIds.slice(0, maxResults)) {
    const msg = await gmailApi("GET", `/messages/${msgId}?format=full`);
    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    messages.push({
      id: msg.id,
      threadId: msg.threadId,
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject"),
      snippet: msg.snippet ?? "",
      body: extractBody(msg.payload),
      date: getHeader("Date"),
      labels: msg.labelIds ?? [],
      isStarred: (msg.labelIds ?? []).includes("STARRED"),
    });
  }

  recordAction("gmail", "scan");
  return messages;
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8").slice(0, 4000);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf8").slice(0, 4000);
      }
    }
    for (const part of payload.parts) {
      const body = extractBody(part);
      if (body) return body;
    }
  }
  return "";
}

export async function getMessage(messageId: string): Promise<GmailMessage> {
  assertLimit("gmail", "scan");
  const msg = await gmailApi("GET", `/messages/${messageId}?format=full`);
  const headers = msg.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const message: GmailMessage = {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject"),
    snippet: msg.snippet ?? "",
    body: extractBody(msg.payload),
    date: getHeader("Date"),
    labels: msg.labelIds ?? [],
    isStarred: (msg.labelIds ?? []).includes("STARRED"),
  };

  recordAction("gmail", "scan");
  return message;
}

export async function getThread(threadId: string): Promise<GmailMessage[]> {
  assertLimit("gmail", "scan");
  const thread = await gmailApi("GET", `/threads/${threadId}?format=full`);
  const messages: GmailMessage[] = (thread.messages ?? []).map((msg: any) => {
    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    return {
      id: msg.id,
      threadId: msg.threadId,
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject"),
      snippet: msg.snippet ?? "",
      body: extractBody(msg.payload),
      date: getHeader("Date"),
      labels: msg.labelIds ?? [],
      isStarred: (msg.labelIds ?? []).includes("STARRED"),
    };
  });
  recordAction("gmail", "scan");
  return messages;
}

export async function markAsRead(messageId: string): Promise<void> {
  await gmailApi("POST", `/messages/${messageId}/modify`, {
    removeLabelIds: ["UNREAD"],
  });
  audit({ actor: "user", action: "gmail.mark_read", subject: messageId });
}

// ---------------------------------------------------------------------------
// Draft (Phase B)
// ---------------------------------------------------------------------------

export async function createDraft(to: string, subject: string, body: string, threadId?: string): Promise<{ draftId: string; messageId: string }> {
  
  assertLimit("gmail", "create_draft");

  // Protected sender check
  if (isProtectedSender(to)) {
    audit({ actor: "gmail", action: "gmail.draft.blocked_protected", subject: to });
    throw new Error(`Cannot create draft to protected sender: ${to}`);
  }

  const gate = checkAction("create_draft", `draft:${to}`);
  if (!gate.allowed && !gate.requiresApproval) {
    throw new Error(gate.reason);
  }

  const raw = buildRawEmail(to, subject, body);
  const reqBody: any = { message: { raw, threadId } };

  const res = await gmailApi("POST", "/drafts", reqBody);

  recordAction("gmail", "create_draft");

  audit({
    actor: "jarvis",
    action: "gmail.draft.created",
    subject: res.id,
    metadata: { to, subject: subject.slice(0, 80) },
  });

  return { draftId: res.id, messageId: res.message?.id };
}

export async function updateDraft(draftId: string, to: string, subject: string, body: string): Promise<void> {
  const raw = buildRawEmail(to, subject, body);
  await gmailApi("PUT", `/drafts/${draftId}`, { message: { raw } });

  audit({
    actor: "user",
    action: "gmail.draft.updated",
    subject: draftId,
    metadata: { to, subject: subject.slice(0, 80) },
  });
}

// ---------------------------------------------------------------------------
// Send (Phase C) — REQUIRES APPROVAL
// ---------------------------------------------------------------------------

export async function sendDraft(draftId: string, approvalToken: string): Promise<{ messageId: string }> {
  // Validate approval token — this is the critical security gate
  const approval = validateApproval(approvalToken, "send_email");
  if (!approval.valid) {
    audit({
      actor: "gateway",
      action: "gmail.send.denied",
      subject: draftId,
      reason: approval.reason,
    });
    throw new Error(`Send denied: ${approval.reason}`);
  }

  assertLimit("gmail", "send");

  const res = await gmailApi("POST", `/drafts/send`, { id: draftId });

  recordAction("gmail", "send");

  audit({
    actor: "user",
    action: "gmail.send.completed",
    subject: draftId,
    metadata: { messageId: res.id },
  });

  return { messageId: res.id };
}

// ---------------------------------------------------------------------------
// Label / Archive (Phase D)
// ---------------------------------------------------------------------------

export async function labelMessage(messageId: string, addLabels: string[], removeLabels: string[] = []): Promise<void> {
  
  assertLimit("gmail", "label");

  // Check if starred — never auto-label starred messages
  const msg = await gmailApi("GET", `/messages/${messageId}?format=metadata&metadataHeaders=From`);
  if ((msg.labelIds ?? []).includes("STARRED")) {
    audit({ actor: "gmail", action: "gmail.label.blocked_starred", subject: messageId });
    throw new Error("Cannot label starred message");
  }

  const from = (msg.payload?.headers ?? []).find((h: any) => h.name === "From")?.value ?? "";
  if (from && isProtectedSender(from)) {
    throw new Error(`Cannot label message from protected sender: ${from}`);
  }

  await gmailApi("POST", `/messages/${messageId}/modify`, {
    addLabelIds: addLabels,
    removeLabelIds: removeLabels,
  });

  recordAction("gmail", "label");

  audit({
    actor: "jarvis",
    action: "gmail.label.applied",
    subject: messageId,
    metadata: { addLabels, removeLabels },
  });
}

export async function archiveMessage(messageId: string): Promise<void> {
  
  assertLimit("gmail", "archive");

  // Check starred + protected
  const msg = await gmailApi("GET", `/messages/${messageId}?format=metadata&metadataHeaders=From`);
  if ((msg.labelIds ?? []).includes("STARRED")) {
    throw new Error("Cannot archive starred message");
  }

  const from = (msg.payload?.headers ?? []).find((h: any) => h.name === "From")?.value ?? "";
  if (from && isProtectedSender(from)) {
    throw new Error(`Cannot archive message from protected sender: ${from}`);
  }

  await gmailApi("POST", `/messages/${messageId}/modify`, {
    removeLabelIds: ["INBOX"],
  });

  recordAction("gmail", "archive");

  audit({
    actor: "jarvis",
    action: "gmail.archive.completed",
    subject: messageId,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRawEmail(to: string, subject: string, body: string): string {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(email).toString("base64url");
}

/** Check if Gmail is connected and which phase is available. */
export function gmailPhase(): "none" | "read" | "draft" | "send" | "full" {
  if (vault.isLocked()) return "none";
  const refresh = vault.get("gmail.refresh_token");
  if (!refresh) return "none";
  // We can't detect scopes without making an API call, so default to read
  // and let errors tell us if we need more scopes
  return "read";
}
