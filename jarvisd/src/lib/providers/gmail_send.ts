import { refreshAccessToken } from "./gmail.js";
import { audit } from "../audit.js";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export interface SendEmailOpts {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyToMessageId?: string;
  threadId?: string;
}

export interface SendEmailResult {
  messageId: string;
  threadId: string;
}

function buildMimeMessage(opts: SendEmailOpts): string {
  const lines: string[] = [];

  lines.push(`To: ${opts.to}`);
  lines.push(`Subject: ${opts.subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");

  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`);

  if (opts.replyToMessageId) {
    lines.push(`In-Reply-To: <${opts.replyToMessageId}>`);
    lines.push(`References: <${opts.replyToMessageId}>`);
  }

  lines.push(""); // blank line separating headers from body
  lines.push(opts.body);

  return lines.join("\r\n");
}

function base64url(input: string): string {
  const b64 = Buffer.from(input, "utf-8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendEmail(opts: SendEmailOpts): Promise<SendEmailResult> {
  const token = await refreshAccessToken();

  const raw = buildMimeMessage(opts);
  const encodedMessage = base64url(raw);

  const requestBody: Record<string, unknown> = { raw: encodedMessage };
  if (opts.threadId) {
    requestBody.threadId = opts.threadId;
  }

  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gmail send failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { id: string; threadId: string };

  audit({
    actor: "skill:gmail_send",
    action: "gmail.send",
    subject: data.id,
    metadata: {
      to: opts.to,
      subject: opts.subject,
      threadId: data.threadId,
      isReply: !!opts.replyToMessageId,
    },
  });

  return { messageId: data.id, threadId: data.threadId };
}
