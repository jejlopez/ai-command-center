// Calendar action routes — CRUD for Google Calendar events + free-slot finder.
//
// POST   /calendar/create               — create an event
// POST   /calendar/update/:eventId      — patch an event
// DELETE /calendar/delete/:eventId      — delete an event
// GET    /calendar/free-slots           — find open time slots
//   query: duration (minutes), start (YYYY-MM-DD), end (YYYY-MM-DD)

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  findFreeSlots,
} from "../lib/providers/gcal_actions.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const isoDatetime = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
  "must be ISO datetime (YYYY-MM-DDTHH:MM...)",
);

const isoDate = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "must be ISO date (YYYY-MM-DD)",
);

const CreateBody = z.object({
  summary: z.string().min(1),
  start: isoDatetime,
  end: isoDatetime,
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

const UpdateBody = z.object({
  summary: z.string().min(1).optional(),
  start: isoDatetime.optional(),
  end: isoDatetime.optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

const FreeSlotsQuery = z.object({
  duration: z.coerce.number().int().positive(),
  start: isoDate,
  end: isoDate,
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function calendarActionRoutes(app: FastifyInstance) {
  // POST /calendar/create
  app.post("/calendar/create", async (req, reply) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const result = await createEvent(parsed.data);
      return reply.code(201).send(result);
    } catch (err: any) {
      return reply.code(502).send({ error: err.message });
    }
  });

  // POST /calendar/update/:eventId
  app.post<{ Params: { eventId: string } }>(
    "/calendar/update/:eventId",
    async (req, reply) => {
      const { eventId } = req.params;
      if (!eventId) return reply.code(400).send({ error: "eventId required" });

      const parsed = UpdateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      if (Object.keys(parsed.data).length === 0) {
        return reply.code(400).send({ error: "at least one field required to update" });
      }
      try {
        const result = await updateEvent(eventId, parsed.data);
        return reply.send(result);
      } catch (err: any) {
        return reply.code(502).send({ error: err.message });
      }
    },
  );

  // DELETE /calendar/delete/:eventId
  app.delete<{ Params: { eventId: string } }>(
    "/calendar/delete/:eventId",
    async (req, reply) => {
      const { eventId } = req.params;
      if (!eventId) return reply.code(400).send({ error: "eventId required" });
      try {
        await deleteEvent(eventId);
        return reply.code(204).send();
      } catch (err: any) {
        return reply.code(502).send({ error: err.message });
      }
    },
  );

  // GET /calendar/free-slots?duration=30&start=2026-04-13&end=2026-04-14
  app.get("/calendar/free-slots", async (req, reply) => {
    const parsed = FreeSlotsQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const slots = await findFreeSlots({
        durationMinutes: parsed.data.duration,
        startDate: parsed.data.start,
        endDate: parsed.data.end,
      });
      return reply.send({ slots });
    } catch (err: any) {
      return reply.code(502).send({ error: err.message });
    }
  });
}
