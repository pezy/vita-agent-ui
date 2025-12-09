require("dotenv").config();
const WebSocket = require("ws");
const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Stream Viewer Backend");
});

// Relax HTTP idle timeouts so WebSocket upgrades are not closed prematurely
const HTTP_IDLE_TIMEOUT_MS = Number(process.env.HTTP_IDLE_TIMEOUT_MS || 300000); // default 5m
server.keepAliveTimeout = HTTP_IDLE_TIMEOUT_MS;
server.headersTimeout = HTTP_IDLE_TIMEOUT_MS + 1000; // must be > keepAliveTimeout
server.requestTimeout = 0; // disable per-request timeout

const wss = new WebSocket.Server({ server });

const HEARTBEAT_INTERVAL_MS = Number(
  process.env.WS_HEARTBEAT_INTERVAL_MS || 20000
);

// Map to store connected "agent/source" clients
// Key: WebSocket object, Value: { id: string, name: string, type: 'source' | 'viewer' }
const clients = new Map();

function logWithTimestamp(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function errorWithTimestamp(...args) {
  console.error(`[${new Date().toISOString()}]`, ...args);
}

// Simple ping/pong to keep connections alive
function markAlive() {
  this.isAlive = true;
}

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

  ws.send(
    JSON.stringify({
      type: "system",
      content: "Connected to Stream Server...\n",
    })
  );
  // Send client list ONLY to the new client (don't spam everyone else)
  sendClientListTo(ws);

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      // Log received message (truncate long strings like base64 images)
      logWithTimestamp(
        "Received:",
        JSON.stringify(data, (key, value) => {
          if (
            key === "image_base64" &&
            typeof value === "string" &&
            value.length > 50
          ) {
            return value.substring(0, 20) + "...[TRUNCATED]";
          }
          return value;
        })
      );

      // Handle image fetching for events with image_url
      // "Now for backend, when handle base64 image event. We can optionally handle image_url key in the payload, defaulyt we use image_url. Then we load the image from the image_url."
      if (data.type === "ui_event" && data.event && data.event.image_url) {
        try {
          // Only fetch if image_base64 is missing or we prefer url?
          // User says "defaulyt we use image_url. Then we load the image from the image_url."
          // This implies if URL is present, we load it.
          logWithTimestamp(`Fetching image from URL: ${data.event.image_url}`);
          const response = await fetch(data.event.image_url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            data.event.image_base64 = buffer.toString("base64");
            // We preserve the image_url in the event as well.
          } else {
            console.error(
              `Failed to fetch image from ${data.event.image_url}: ${response.statusText}`
            );
          }
        } catch (fetchErr) {
          console.error(
            `Error fetching image from ${data.event.image_url}:`,
            fetchErr
          );
        }
      }

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
        broadcastClientList();
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
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(wrappedMessage));
          }
        });
      } else {
        // Should viewers be able to send things? Maybe control commands later.
        // For now, ignore or log.
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
      clients.delete(ws);
      broadcastClientList();
    } else {
      clients.delete(ws);
    }
  });
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) {
      console.log(
        `Connection missed heartbeat: ${
          clients.get(client)?.id
        } (Not terminating)`
      );
      // return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

wss.on("close", () => {
  clearInterval(heartbeatInterval);
});

function sendClientListTo(clientSocket) {
  const activeSources = [];
  clients.forEach((info) => {
    if (info.type === "source") {
      activeSources.push({ id: info.id, name: info.name });
    }
  });

  const message = JSON.stringify({
    type: "client_list",
    clients: activeSources,
  });

  if (clientSocket.readyState === WebSocket.OPEN) {
    clientSocket.send(message);
  }
}

function broadcastClientList() {
  const activeSources = [];
  clients.forEach((info) => {
    if (info.type === "source") {
      activeSources.push({ id: info.id, name: info.name });
    }
  });

  const message = JSON.stringify({
    type: "client_list",
    clients: activeSources,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

const PORT = process.env.PORT || 61111;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  logWithTimestamp(`Server started on port ${PORT}`);
});
