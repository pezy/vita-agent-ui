require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Stream Viewer Backend');
});

// Relax HTTP idle timeouts so WebSocket upgrades are not closed prematurely
const HTTP_IDLE_TIMEOUT_MS = Number(process.env.HTTP_IDLE_TIMEOUT_MS || 300000); // default 5m
server.keepAliveTimeout = HTTP_IDLE_TIMEOUT_MS;
server.headersTimeout = HTTP_IDLE_TIMEOUT_MS + 1000; // must be > keepAliveTimeout
server.requestTimeout = 0; // disable per-request timeout

const wss = new WebSocket.Server({ server });

const HEARTBEAT_INTERVAL_MS = Number(process.env.WS_HEARTBEAT_INTERVAL_MS || 30000);

// Map to store connected "agent/source" clients
// Key: WebSocket object, Value: { id: string, name: string, type: 'source' | 'viewer' }
const clients = new Map();

// Simple ping/pong to keep connections alive
function markAlive() {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.isAlive = true;
    ws.on('pong', markAlive);

    // Default metadata
    clients.set(ws, {
        id: 'anon_' + Date.now(),
        name: 'Anonymous',
        type: 'viewer' // Default to viewer until they register as source
    });

    ws.send(JSON.stringify({ type: 'system', content: 'Connected to Stream Server...\n' }));
    // Send client list ONLY to the new client (don't spam everyone else)
    sendClientListTo(ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Handle Registration
            if (data.type === 'register') {
                const clientInfo = clients.get(ws);
                clientInfo.id = data.id || clientInfo.id;
                clientInfo.name = data.name || `Agent ${data.id}`;
                clientInfo.type = 'source'; // registered clients are sources
                clients.set(ws, clientInfo);

                console.log(`Client registered: ${clientInfo.name} (${clientInfo.id})`);
                broadcastClientList();
                return;
            }

            // For source clients, wrap and broadcast their messages
            const sender = clients.get(ws);
            if (sender.type === 'source') {
                const wrappedMessage = {
                    type: 'broadcast',
                    clientId: sender.id,
                    clientName: sender.name,
                    message: data
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
            console.error("Invalid JSON received", e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        const clientInfo = clients.get(ws);

        // Only broadcast if a SOURCE disconnected
        // If a viewer disconnects, nobody cares (except the server logs)
        if (clientInfo && clientInfo.type === 'source') {
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
            return client.terminate();
        }
        client.isAlive = false;
        client.ping();
    });
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

function sendClientListTo(clientSocket) {
    const activeSources = [];
    clients.forEach((info) => {
        if (info.type === 'source') {
            activeSources.push({ id: info.id, name: info.name });
        }
    });

    const message = JSON.stringify({
        type: 'client_list',
        clients: activeSources
    });

    if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(message);
    }
}

function broadcastClientList() {
    const activeSources = [];
    clients.forEach((info) => {
        if (info.type === 'source') {
            activeSources.push({ id: info.id, name: info.name });
        }
    });

    const message = JSON.stringify({
        type: 'client_list',
        clients: activeSources
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Mock Producer logic to simulate LangChain stream
// Mock Producer logic to simulate LangChain stream
function broadcastMock(data, mockId = 'mock_1', mockName = 'Mock Agent') {
    const wrapped = {
        type: 'broadcast',
        clientId: mockId,
        clientName: mockName,
        message: data
    };
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(wrapped));
        }
    });
}

// Endpoint or Trigger to start a mock stream
// specific to "Simulating LangChain"
// We will expose a simple interval loop to test the frontend
const startMockStream = () => {
    console.log("Starting mock stream...");

    const steps = [
        // TTS Start
        { type: 'ui_event', event: { event_type: 'tts_start', text: "Hello! I will check that for you.", provider: 'bridge' } },
        { type: 'token', content: "Hello! " },
        { type: 'token', content: "I " },
        { type: 'token', content: "will " },
        { type: 'token', content: "check " },
        { type: 'token', content: "that " },
        { type: 'token', content: "for " },
        { type: 'token', content: "you.\n" },
        // TTS End
        { type: 'ui_event', event: { event_type: 'tts_end', status: 'success', duration_ms: 1000 } },

        { type: 'token', content: "<thinking>" },
        { type: 'token', content: "Checking " },
        { type: 'token', content: "weather " },
        { type: 'token', content: "API " },
        { type: 'token', content: "for " },
        { type: 'token', content: "San " },
        { type: 'token', content: "Francisco." },
        { type: 'token', content: "</thinking>" },
        { type: 'token', content: "\nI will verify this.\n" },

        // VisionAnalyze - VQA mode
        {
            type: 'tool_call',
            name: 'vision_analyze',
            id: 'call_vqa_1',
            args: {
                mode: 1,
                // No image provided (simulate live capture)
                question: 'What is the weather like?'
            }
        },
        // VQA Events
        { type: 'ui_event', event: { event_type: 'vision_vqa_start', query: "What is the weather like?", camera_position: { pitch: 0, yaw: 0 } } },
        {
            type: 'ui_event', event: {
                event_type: 'vision_image_captured',
                image_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
                image_format: "png",
                width: 1, height: 1
            }
        },
        {
            type: 'ui_event', event: {
                event_type: 'vision_vqa_result',
                query: "What is the weather like?",
                answer: "It looks like a clear, sunny day with calm water.",
                total_time_ms: 500
            }
        },
        {
            type: 'tool_result',
            id: 'call_vqa_1',
            result: {
                status: 'ok',
                data: {
                    answer: 'It looks like a clear, sunny day with calm water.'
                },
                message: 'Vision VQA analysis completed.'
            }
        },

        // VisionAnalyze - Grounding mode
        {
            type: 'tool_call',
            name: 'vision_analyze',
            id: 'call_ground_1',
            args: {
                mode: 2,
                // No image (simulate live capture)
                question: 'Where is the bridge?'
            }
        },
        // Grounding Events
        { type: 'ui_event', event: { event_type: 'vision_grounding_start', query: "Where is the bridge?", camera_position: { pitch: 0, yaw: 0 } } },
        {
            type: 'ui_event', event: {
                event_type: 'vision_stereo_captured',
                image_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
                image_format: "png",
                width: 1, height: 1
            }
        },
        // Parallel detection and depth
        { type: 'ui_event', event: { event_type: 'vision_2d_detection_start', method: 'vlm' } },
        { type: 'ui_event', event: { event_type: 'vision_3d_start' } },
        { type: 'ui_event', event: { event_type: 'vision_3d_depth_complete', duration_ms: 200 } },
        {
            type: 'ui_event', event: {
                event_type: 'vision_2d_detection_result',
                detections: [{ label: 'bridge', x1: 0.1, y1: 0.2, x2: 0.5, y2: 0.6 }],
                detection_count: 1,
                duration_ms: 300
            }
        },
        {
            type: 'ui_event', event: {
                event_type: 'vision_3d_result',
                objects: [{
                    label: 'bridge',
                    x: 25.0, y: 0.0, z: 0.0,
                    distance: 25.0, angle_deg: 0.0,
                    depth_meters: 25.0, pixel_x: 900, pixel_y: 450,
                    confidence: 0.98
                }],
                detection_count: 1,
                total_time_ms: 600
            }
        },

        {
            type: 'tool_result',
            id: 'call_ground_1',
            result: {
                status: 'ok',
                data: {
                    objects: [
                        { label: 'bridge', distance: 25.0, angle_deg: 0.0 }
                    ]
                },
                message: "Located the bridge in the scene."
            }
        },
        // TTS End (just in case)
        { type: 'ui_event', event: { event_type: 'tts_start', text: "The weather is sunny.", provider: 'bridge' } },
        { type: 'token', content: "The " },
        { type: 'token', content: "weather " },
        { type: 'token', content: "is " },
        { type: 'token', content: "sunny." },
        { type: 'ui_event', event: { event_type: 'tts_end', status: 'success', duration_ms: 1000 } },

    ];

    let i = 0;
    const interval = setInterval(() => {
        if (i >= steps.length) {
            clearInterval(interval);
            return;
        }
        broadcastMock(steps[i]);
        i++;
    }, 200); // 200ms delay between chunks
};

// Start mock stream after 5 seconds automatically for testing (or loop it)
setInterval(() => {
    if (wss.clients.size > 0) {
        // Only start if someone is listening and we haven't flooded them recently?
        // For now, let's just expose a way to trigger it? 
        // Or just run it once a client connects?
    }
    // Simple auto-trigger for demo purposes every 10s if clients connected?
    // startMockStream(); 
}, 15000);

// The previous second wss.on('connection') block is now integrated into the first one.
// The setTimeout(startMockStream, 2000); call is removed as it was not part of the requested change.

const PORT = process.env.PORT || 61111;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Server started on port ${PORT}`);
});

