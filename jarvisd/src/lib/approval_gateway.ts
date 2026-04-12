// Approval Gateway — every outbound action MUST pass through here.
// Send/finalize actions require single-use, time-limited approval tokens.
// Delete and forward are BLOCKED at the code level — no config override.

import { randomUUID, createHash } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "./audit.js";
import { bus } from "./events.js";
import { isQuietHours } from "./limits.js";

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Pending approval tokens — in-memory for speed, audit-logged for durability
const pendingTokens = new Map<string, {
  action: string;
  targetId: string;
  expiresAt: number;
  used: boolean;
}>();

// ---------------------------------------------------------------------------
// BLOCKED actions — code-level, cannot be overridden
// ---------------------------------------------------------------------------

const BLOCKED_ACTIONS = new Set(["delete_email", "forward_email", "delete_proposal"]);

// Actions that ALWAYS require approval
const APPROVAL_REQUIRED = new Set(["send_email", "send_proposal"]);

// Actions that can run within limits (no approval needed)
const AUTO_ALLOWED = new Set(["create_draft", "label", "archive", "scan", "classify"]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type GatewayAction =
  | "send_email"
  | "send_proposal"
  | "create_draft"
  | "label"
  | "archive"
  | "scan"
  | "classify"
  | "delete_email"
  | "forward_email"
  | "delete_proposal";

export interface GatewayCheck {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  approvalToken?: string;
}

/** Check if an action is allowed. Returns an approval token if approval is needed. */
export function checkAction(action: GatewayAction, targetId: string): GatewayCheck {
  // Hard block
  if (BLOCKED_ACTIONS.has(action)) {
    audit({
      actor: "gateway",
      action: "gateway.blocked",
      subject: targetId,
      metadata: { action },
      reason: "Action permanently blocked",
    });
    return { allowed: false, reason: `Action "${action}" is permanently blocked`, requiresApproval: false };
  }

  // Quiet hours check for outbound actions
  if ((action === "send_email" || action === "send_proposal" || action === "label" || action === "archive") && isQuietHours()) {
    return { allowed: false, reason: "Quiet hours active — no outbound actions", requiresApproval: false };
  }

  // Auto-allowed within limits
  if (AUTO_ALLOWED.has(action)) {
    return { allowed: true, reason: "Auto-allowed action", requiresApproval: false };
  }

  // Requires approval — generate token
  if (APPROVAL_REQUIRED.has(action)) {
    const token = randomUUID();
    pendingTokens.set(token, {
      action,
      targetId,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      used: false,
    });

    audit({
      actor: "gateway",
      action: "gateway.approval_requested",
      subject: targetId,
      metadata: { action, token: token.slice(0, 8) + "..." },
    });

    bus.emit("approval.new", {
      id: token,
      action,
      targetId,
      expiresIn: TOKEN_TTL_MS / 1000,
    });

    return {
      allowed: false,
      reason: "Approval required",
      requiresApproval: true,
      approvalToken: token,
    };
  }

  return { allowed: false, reason: `Unknown action: ${action}`, requiresApproval: false };
}

/** Validate an approval token. Single-use, time-limited. */
export function validateApproval(token: string, expectedAction: GatewayAction): {
  valid: boolean;
  reason: string;
} {
  const entry = pendingTokens.get(token);

  if (!entry) {
    audit({
      actor: "gateway",
      action: "gateway.invalid_token",
      reason: "Token not found",
    });
    return { valid: false, reason: "Invalid approval token" };
  }

  if (entry.used) {
    audit({
      actor: "gateway",
      action: "gateway.token_reuse_attempt",
      subject: entry.targetId,
      reason: "SECURITY: Approval token reuse attempted",
    });
    // Auto-lockout on reuse attempt
    bus.emit("security.alert", { type: "token_reuse", targetId: entry.targetId });
    return { valid: false, reason: "Token already used — security alert logged" };
  }

  if (Date.now() > entry.expiresAt) {
    pendingTokens.delete(token);
    return { valid: false, reason: "Approval token expired" };
  }

  if (entry.action !== expectedAction) {
    audit({
      actor: "gateway",
      action: "gateway.action_mismatch",
      subject: entry.targetId,
      reason: `Expected ${entry.action}, got ${expectedAction}`,
    });
    return { valid: false, reason: "Token action mismatch" };
  }

  // Mark as used
  entry.used = true;

  audit({
    actor: "user",
    action: "gateway.approved",
    subject: entry.targetId,
    metadata: { action: expectedAction },
  });

  // Clean up expired tokens periodically
  cleanExpiredTokens();

  return { valid: true, reason: "Approved" };
}

/** Revoke all pending tokens (used by panic button). */
export function revokeAllTokens(): number {
  const count = pendingTokens.size;
  pendingTokens.clear();
  audit({ actor: "system", action: "gateway.revoke_all", metadata: { count } });
  return count;
}

function cleanExpiredTokens(): void {
  const now = Date.now();
  for (const [token, entry] of pendingTokens) {
    if (now > entry.expiresAt || entry.used) {
      pendingTokens.delete(token);
    }
  }
}

/** List pending (unresolved) approvals. */
export function listPendingApprovals(): Array<{
  token: string;
  action: string;
  targetId: string;
  expiresIn: number;
}> {
  const now = Date.now();
  const result: Array<{ token: string; action: string; targetId: string; expiresIn: number }> = [];
  for (const [token, entry] of pendingTokens) {
    if (!entry.used && now < entry.expiresAt) {
      result.push({
        token,
        action: entry.action,
        targetId: entry.targetId,
        expiresIn: Math.round((entry.expiresAt - now) / 1000),
      });
    }
  }
  return result;
}
