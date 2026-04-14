// Action executor — parses [ACTION:type]{json}[/ACTION] blocks
// from Claude's response and executes them against jarvisd endpoints.

import { audit } from "./audit.js";
import { sendEmail } from "./providers/gmail_send.js";
import { createEvent, updateEvent, deleteEvent } from "./providers/gcal_actions.js";
import { createDeal, logActivity, addContact, updateDealStage, searchDeals } from "./providers/pipedrive_actions.js";
import { browse } from "./providers/browser.js";

export interface ActionResult {
  action: string;
  success: boolean;
  message: string;
  data?: any;
}

const ACTION_REGEX = /\[ACTION:(\w+)\](.*?)\[\/ACTION\]/gs;

export function parseActions(text: string): Array<{ type: string; payload: any }> {
  const actions: Array<{ type: string; payload: any }> = [];
  let match;
  while ((match = ACTION_REGEX.exec(text)) !== null) {
    try {
      const payload = JSON.parse(match[2]);
      actions.push({ type: match[1], payload });
    } catch {
      // Invalid JSON in action block — skip
    }
  }
  // Reset regex lastIndex for next call
  ACTION_REGEX.lastIndex = 0;
  return actions;
}

export function stripActionBlocks(text: string): string {
  return text.replace(ACTION_REGEX, "").trim();
}

export async function executeActions(actions: Array<{ type: string; payload: any }>): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const { type, payload } of actions) {
    audit({ actor: "jarvis", action: `action.execute`, subject: type, metadata: payload });

    try {
      switch (type) {
        case "email_send": {
          // Emails always go through approval
          results.push({
            action: type,
            success: true,
            message: `Email to ${payload.to} queued for your approval. Check the approval panel to send it.`,
            data: { status: "pending_approval", to: payload.to, subject: payload.subject },
          });
          break;
        }

        case "calendar_create": {
          const event = await createEvent(payload);
          results.push({
            action: type,
            success: true,
            message: `Event "${payload.summary}" created.`,
            data: event,
          });
          break;
        }

        case "calendar_update": {
          const event = await updateEvent(payload.eventId, payload);
          results.push({
            action: type,
            success: true,
            message: `Event updated.`,
            data: event,
          });
          break;
        }

        case "calendar_delete": {
          await deleteEvent(payload.eventId);
          results.push({
            action: type,
            success: true,
            message: `Event deleted.`,
          });
          break;
        }

        case "crm_create_deal": {
          const deal = await createDeal(payload);
          results.push({
            action: type,
            success: true,
            message: `Deal "${deal.title}" created in Pipedrive.`,
            data: deal,
          });
          break;
        }

        case "crm_update_stage": {
          await updateDealStage(payload.dealId, payload.stageName);
          results.push({
            action: type,
            success: true,
            message: `Deal stage updated to "${payload.stageName}".`,
          });
          break;
        }

        case "crm_log_activity": {
          const activity = await logActivity(payload);
          results.push({
            action: type,
            success: true,
            message: `Activity "${payload.subject}" logged.`,
            data: activity,
          });
          break;
        }

        case "crm_add_contact": {
          const contact = await addContact(payload);
          results.push({
            action: type,
            success: true,
            message: `Contact "${payload.name}" added to Pipedrive.`,
            data: contact,
          });
          break;
        }

        case "crm_search": {
          const deals = await searchDeals(payload.query);
          results.push({
            action: type,
            success: true,
            message: `Found ${deals.length} deals.`,
            data: deals,
          });
          break;
        }

        case "browser_research": {
          const page = await browse(`https://www.google.com/search?q=${encodeURIComponent(payload.query)}`);
          results.push({
            action: type,
            success: true,
            message: `Researched "${payload.query}".`,
            data: { title: page.title, text: page.text.slice(0, 500) },
          });
          break;
        }

        case "browser_browse": {
          const page = await browse(payload.url, { screenshot: payload.screenshot });
          results.push({
            action: type,
            success: true,
            message: `Browsed ${page.title}.`,
            data: page,
          });
          break;
        }

        default:
          results.push({
            action: type,
            success: false,
            message: `Unknown action type: ${type}`,
          });
      }
    } catch (err: any) {
      audit({ actor: "jarvis", action: "action.error", subject: type, reason: err.message });
      results.push({
        action: type,
        success: false,
        message: `Failed: ${err.message}`,
      });
    }
  }

  return results;
}
