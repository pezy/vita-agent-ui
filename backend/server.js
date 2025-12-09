require("dotenv").config();
const WebSocket = require("ws");
const http = require("http");
const {
  logWithTimestamp,
  errorWithTimestamp,
  markAlive,
  sendClientListTo,
  broadcastClientList,
  formatMessageForLog,
  attachImageFromUrl,
  safeSend,
} = require("./wsHelpers");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Stream Viewer Backend");
});

// Relax HTTP idle timeouts so WebSocket upgrades are not closed prematurely
const HTTP_IDLE_TIMEOUT_MS = Number(process.env.HTTP_IDLE_TIMEOUT_MS || 300000); // default 5m
const WS_MAX_PAYLOAD_BYTES = Number(
  process.env.WS_MAX_PAYLOAD_BYTES || 10 * 1024 * 1024
); // default 10MB
server.keepAliveTimeout = HTTP_IDLE_TIMEOUT_MS;
server.headersTimeout = HTTP_IDLE_TIMEOUT_MS + 1000; // must be > keepAliveTimeout
server.requestTimeout = 0; // disable per-request timeout

const wss = new WebSocket.Server({ server, maxPayload: WS_MAX_PAYLOAD_BYTES });

const HEARTBEAT_INTERVAL_MS = Number(
  process.env.WS_HEARTBEAT_INTERVAL_MS || 20000
);

const clients = new Map();

wss.on("connection", (ws) => {
  logWithTimestamp("Client connected");

  ws.isAlive = true;
  ws.on("pong", markAlive);

  // Default metadata
  clients.set(ws, {
    id: "anon_" + Date.now(),
    name: "Anonymous",
    type: "viewer", // Default to viewer until they register as source
  });

  safeSend(
    ws,
    JSON.stringify({
      type: "system",
      content: "Connected to Stream Server...\n",
    })
  );
  sendClientListTo(ws, clients);

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      logWithTimestamp("Received:", formatMessageForLog(data));
      await attachImageFromUrl(data, logWithTimestamp, errorWithTimestamp);

      // Handle Registration
      if (data.type === "register") {
        const clientInfo = clients.get(ws);
        clientInfo.id = data.id || clientInfo.id;
        clientInfo.name = data.name || `Agent ${data.id}`;
        clientInfo.type = "source"; // registered clients are sources
        clients.set(ws, clientInfo);

        logWithTimestamp(
          `Client registered: ${clientInfo.name} (${clientInfo.id})`
        );
        broadcastClientList(wss, clients);
        return;
      }

      // For source clients, wrap and broadcast their messages
      const sender = clients.get(ws);
      if (sender.type === "source") {
        const wrappedMessage = {
          type: "broadcast",
          clientId: sender.id,
          clientName: sender.name,
          message: data,
        };

        // Broadcast to ALL connected clients (viewers AND other sources if needed)
        const serialized = JSON.stringify(wrappedMessage);
        wss.clients.forEach((client) => {
          safeSend(client, serialized);
        });
      }
    } catch (e) {
      errorWithTimestamp("Invalid JSON received", e);
    }
  });

  ws.on("close", () => {
    logWithTimestamp("Client disconnected");
    const clientInfo = clients.get(ws);
    // Only broadcast if a SOURCE disconnected
    // If a viewer disconnects, nobody cares (except the server logs)
    if (clientInfo && clientInfo.type === "source") {
      broadcastClientList(wss, clients);
    }
    clients.delete(ws);
  });
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) {
      const clientInfo = clients.get(client);
      logWithTimestamp(
        `Connection missed heartbeat: ${
          clientInfo?.id || "unknown"
        }. Terminating.`
      );
      try {
        client.terminate();
      } catch (err) {
        errorWithTimestamp("Failed to terminate unresponsive client", err);
      }
      clients.delete(client);
      // Only broadcast when a source disappears to keep viewers in sync
      if (clientInfo && clientInfo.type === "source") {
        broadcastClientList(wss, clients);
      }
      return;
    }
    client.isAlive = false;
    try {
      client.ping();
    } catch (err) {
      const clientInfo = clients.get(client);
      errorWithTimestamp("Failed to ping client", err);
      try {
        client.terminate();
      } catch (terminateErr) {
        errorWithTimestamp(
          "Failed to terminate after ping error",
          terminateErr
        );
      }
      clients.delete(client);
      if (clientInfo && clientInfo.type === "source") {
        broadcastClientList(wss, clients);
      }
    }
  });
}, HEARTBEAT_INTERVAL_MS);

wss.on("close", () => {
  clearInterval(heartbeatInterval);
});

const PORT = process.env.PORT || 61111;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  logWithTimestamp(`Server started on port ${PORT}`);
});
