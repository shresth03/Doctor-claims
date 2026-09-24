#!/usr/bin/env node
/**
 * Event relay: the bridge between n8n and the frontend's `api.subscribe()` (SSE).
 *
 * n8n workflows are request/response — they have no way to push to open browser tabs on their own.
 * Every workflow POSTs its UI-facing events here (`relay_push` in the Python builder), and this
 * process fans them out over Server-Sent Events to every connected frontend.
 *
 * This is intentionally a thin, stateless relay: it holds no business data, just an in-memory list of
 * open SSE connections and a small ring buffer so a client that reconnects a few seconds later doesn't
 * lose events. The database (schema.sql) is the actual source of truth.
 *
 * Run: EVENT_RELAY_SECRET=... node server.mjs
 * Env: PORT (default 8787), EVENT_RELAY_SECRET (required — matches n8n's Authorization: Bearer header),
 *      ALLOWED_ORIGIN (default http://localhost:5180)
 */
import http from "node:http";
import crypto from "node:crypto";

const PORT = process.env.PORT || 8787;
const SECRET = process.env.EVENT_RELAY_SECRET;
const ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5180";
const BUFFER_SIZE = 200;

if (!SECRET) {
  console.error("EVENT_RELAY_SECRET is required (must match n8n's relay push credential).");
  process.exit(1);
}

const clients = new Set();
const ringBuffer = [];
let nextEventId = 1;

function pushToClients(events) {
  for (const evt of events) {
    const id = nextEventId++;
    ringBuffer.push({ id, evt });
    if (ringBuffer.length > BUFFER_SIZE) ringBuffer.shift();
    const frame = `id: ${id}\ndata: ${JSON.stringify(evt)}\n\n`;
    for (const res of clients) res.write(frame);
  }
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Last-Event-ID");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/events/stream")) {
    // Frontend-facing: no bearer secret here. In production put this behind the same session auth as the rest of the API.
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n");

    const lastId = Number(req.headers["last-event-id"] || 0);
    if (lastId > 0) {
      for (const { id, evt } of ringBuffer) if (id > lastId) res.write(`id: ${id}\ndata: ${JSON.stringify(evt)}\n\n`);
    }

    clients.add(res);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
    return;
  }

  if (req.method === "POST" && req.url === "/events") {
    // n8n-facing: requires the shared secret so only workflows (not browsers) can publish events.
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ") || !timingSafeEqual(auth.slice(7), SECRET)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: "unauthorized", message: "Missing or invalid relay secret." }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const events = Array.isArray(parsed.events) ? parsed.events : [];
        pushToClients(events);
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: events.length, connectedClients: clients.size }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ code: "bad_request", message: "Body must be JSON: { events: [...] }" }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, connectedClients: clients.size, bufferedEvents: ringBuffer.length }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ code: "not_found" }));
});

server.listen(PORT, () => console.log(`event-relay listening on :${PORT}`));
