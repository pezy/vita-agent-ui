const WebSocket = require("ws");

function logWithTimestamp(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function errorWithTimestamp(...args) {
  console.error(`[${new Date().toISOString()}]`, ...args);
}

function markAlive() {
  this.isAlive = true;
}

function safeSend(clientSocket, message) {
  if (clientSocket.readyState !== WebSocket.OPEN) return;

  try {
    clientSocket.send(message);
  } catch (err) {
    errorWithTimestamp("Failed to send message. Terminating socket.", err);
    try {
      clientSocket.terminate();
    } catch (terminateErr) {
      errorWithTimestamp("Failed to terminate socket after send error.", terminateErr);
    }
  }
}

function getActiveSources(clients) {
  const activeSources = [];
  clients.forEach((info) => {
    if (info.type === "source") {
      activeSources.push({ id: info.id, name: info.name });
    }
  });
  return activeSources;
}

function sendClientListTo(clientSocket, clients) {
  const message = JSON.stringify({
    type: "client_list",
    clients: getActiveSources(clients),
  });

  safeSend(clientSocket, message);
}

function broadcastClientList(wss, clients) {
  const message = JSON.stringify({
    type: "client_list",
    clients: getActiveSources(clients),
  });

  wss.clients.forEach((client) => {
    safeSend(client, message);
  });
}

function formatMessageForLog(data) {
  return JSON.stringify(data, (key, value) => {
    if (
      key === "image_base64" &&
      typeof value === "string" &&
      value.length > 50
    ) {
      return value.substring(0, 20) + "...[TRUNCATED]";
    }
    return value;
  });
}

async function attachImageFromUrl(data, logger, errorLogger) {
  if (!(data.type === "ui_event" && data.event && data.event.image_url)) {
    return;
  }

  try {
    logger(`Fetching image from URL: ${data.event.image_url}`);
    const response = await fetch(data.event.image_url);
    if (!response.ok) {
      errorLogger(
        `Failed to fetch image from ${data.event.image_url}: ${response.statusText}`
      );
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    data.event.image_base64 = buffer.toString("base64");
  } catch (err) {
    errorLogger(`Error fetching image from ${data.event.image_url}:`, err);
  }
}

module.exports = {
  logWithTimestamp,
  errorWithTimestamp,
  markAlive,
  safeSend,
  sendClientListTo,
  broadcastClientList,
  formatMessageForLog,
  attachImageFromUrl,
};
