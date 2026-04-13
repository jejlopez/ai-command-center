// CRM action routes — write operations against Pipedrive.
// POST /crm/deals
// PATCH /crm/deals/:id/stage
// POST /crm/activities
// POST /crm/contacts
// GET  /crm/deals/search?q=query

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createDeal,
  updateDealStage,
  logActivity,
  addContact,
  searchDeals,
} from "../lib/providers/pipedrive_actions.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CreateDealBody = z.object({
  title: z.string().min(1),
  value: z.number().optional(),
  currency: z.string().length(3).optional(),
  personName: z.string().optional(),
  orgName: z.string().optional(),
  stageName: z.string().optional(),
});

const UpdateStageBody = z.object({
  stageName: z.string().min(1),
});

const LogActivityBody = z.object({
  dealId: z.number().int().positive().optional(),
  type: z.enum(["call", "email", "meeting", "task"]),
  subject: z.string().min(1),
  note: z.string().optional(),
  done: z.boolean().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD").optional(),
});

const AddContactBody = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  orgName: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function crmActionsRoutes(app: FastifyInstance): Promise<void> {
  // POST /crm/deals — create a deal
  app.post("/crm/deals", async (req, reply) => {
    const parsed = CreateDealBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    try {
      const result = await createDeal(parsed.data);
      reply.code(201);
      return result;
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // PATCH /crm/deals/:id/stage — update deal stage
  app.patch("/crm/deals/:id/stage", async (req, reply) => {
    const { id } = req.params as { id: string };
    const dealId = parseInt(id, 10);
    if (isNaN(dealId)) {
      reply.code(400);
      return { error: "Deal ID must be a number" };
    }

    const parsed = UpdateStageBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    try {
      await updateDealStage(dealId, parsed.data.stageName);
      return { status: "updated", dealId, stageName: parsed.data.stageName };
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // POST /crm/activities — log an activity
  app.post("/crm/activities", async (req, reply) => {
    const parsed = LogActivityBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    try {
      const result = await logActivity(parsed.data);
      reply.code(201);
      return result;
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // POST /crm/contacts — add a contact
  app.post("/crm/contacts", async (req, reply) => {
    const parsed = AddContactBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    try {
      const result = await addContact(parsed.data);
      reply.code(201);
      return result;
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });

  // GET /crm/deals/search?q=query — search deals
  app.get("/crm/deals/search", async (req, reply) => {
    const { q } = req.query as { q?: string };
    if (!q || q.trim().length === 0) {
      reply.code(400);
      return { error: "Query param 'q' is required" };
    }
    try {
      const results = await searchDeals(q.trim());
      return { results };
    } catch (err: any) {
      reply.code(500);
      return { error: err.message };
    }
  });
}
