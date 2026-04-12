// WebSocket push — bridges the internal event bus to connected clients.
// Every bus event that clients care about is broadcast as a JSON WsMessage.

import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { bus } from "./events.js";
import type { WsMessage, WsMessageType } from "../../../shared/types.js";

const clients = new Set<WebSocket>();

function broadcast(type: WsMessageType, payload: Record<string, unknown>): void {
  if (clients.size === 0) return;
  const msg: WsMessage = { type, ts: new Date().toISOString(), payload };
  const raw = JSON.stringify(msg);
  for (const ws of clients) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(raw);
    } catch { /* drop silently */ }
  }
}

const BRIDGED_EVENTS: Array<{ bus: string; ws: WsMessageType }> = [
  { bus: "skill.started",      ws: "skill.started" },
  { bus: "skill.completed",    ws: "skill.completed" },
  { bus: "skill.failed",       ws: "skill.failed" },
  { bus: "brief.generated",    ws: "brief.generated" },
  { bus: "cost.alert",         ws: "cost.alert" },
  { bus: "approval.new",       ws: "approval.new" },
  { bus: "approval.decided",   ws: "approval.decided" },
  { bus: "memory.remembered",  ws: "memory.remembered" },
  { bus: "panic",              ws: "panic" as any },
];

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);

    const welcome: WsMessage = {
      type: "connected",
      ts: new Date().toISOString(),
      payload: { clients: clients.size },
    };
    socket.send(JSON.stringify(welcome));

    socket.on("close", () => {
      clients.delete(socket);
    });

    socket.on("error", () => {
      clients.delete(socket);
    });
  });

  for (const { bus: busEvent, ws: wsType } of BRIDGED_EVENTS) {
    bus.on(busEvent, (payload) => {
      broadcast(wsType, payload);
    });
  }
}

export { broadcast, clients };
