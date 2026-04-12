// WebSocket hook — connects to jarvisd /ws and dispatches events to subscribers.
// Auto-reconnects with exponential backoff. Components subscribe to specific
// message types and get re-rendered only when their type fires.

import { useEffect, useRef, useCallback, useState } from "react";

const WS_URL = (import.meta.env.VITE_JARVIS_URL ?? "http://127.0.0.1:8787")
  .replace(/^http/, "ws") + "/ws";

const subscribers = new Map(); // type -> Set<callback>
let globalWs = null;
let reconnectTimer = null;
let reconnectDelay = 1000;

function notifySubscribers(msg) {
  const set = subscribers.get(msg.type);
  if (set) for (const fn of set) fn(msg);
  const allSet = subscribers.get("*");
  if (allSet) for (const fn of allSet) fn(msg);
}

function connect() {
  if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) return;

  try {
    globalWs = new WebSocket(WS_URL);

    globalWs.onopen = () => {
      reconnectDelay = 1000;
    };

    globalWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        notifySubscribers(msg);
      } catch { /* ignore malformed */ }
    };

    globalWs.onclose = () => {
      globalWs = null;
      scheduleReconnect();
    };

    globalWs.onerror = () => {
      globalWs?.close();
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
    connect();
  }, reconnectDelay);
}

function subscribe(type, callback) {
  let set = subscribers.get(type);
  if (!set) {
    set = new Set();
    subscribers.set(type, set);
  }
  set.add(callback);
  connect(); // ensure connected

  return () => {
    set.delete(callback);
    if (set.size === 0) subscribers.delete(type);
  };
}

/** Subscribe to a specific WsMessage type. Callback receives the full WsMessage. */
export function useJarvisSocket(type, callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const handler = (msg) => cbRef.current(msg);
    return subscribe(type, handler);
  }, [type]);
}

/** Subscribe to all WsMessage types. Returns the latest message. */
export function useJarvisSocketAll() {
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    return subscribe("*", setLastMessage);
  }, []);

  return lastMessage;
}

/** Returns WebSocket connection status. */
export function useSocketStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const check = () => {
      setConnected(globalWs?.readyState === WebSocket.OPEN);
    };
    check();
    const timer = setInterval(check, 2000);
    return () => clearInterval(timer);
  }, []);

  return connected;
}
