# LangChain Stream Viewer

A high-performance, aesthetically "Apple-like" streaming visualization dashboard for LangChain Agent interactions.

## 🚀 Quick Start

### 1. Start the Backend (Relay Server)

The backend acts as a WebSocket relay. It accepts connections from clients (like your Python agent) and broadcasts them to the Frontend.

```bash
cd backend
npm install
node server.js
```

_Server runs on port 3000._

### 2. Start the Frontend (Viewer)

The frontend connects to the backend and renders the stream.

```bash
cd frontend
npm install  # First time only
npm run dev
```

_Open http://localhost:5173 (or the port shown in terminal)._

### 3. Run the Client Example

We provide a Python script to demonstrate streaming.

```bash
# Install dependencies
uv add websockets python-socks

# Run the example
uv run python client_sdk/client_example.py
```

---

## 📡 Streaming Protocol

To stream data to the viewer, connect to `ws://localhost:3000` and send JSON objects. The viewer supports three types of blocks.

### 1. Text Tokens

Standard streaming text. Use `<thinking>` tags to create a collapsible reasoning block.

**Normal Text:**

```json
{
  "type": "token",
  "content": "Hello, I am processing your request..."
}
```

**Reasoning / Thinking:**
Wrap content in tags to trigger the "Thinking Process" UI.

```json
{
  "type": "token",
  "content": "<thinking>Checking weather API for San Francisco...</thinking>"
}
```

### 2. Tool Calls

Trigger a tool visualization card.

```json
{
  "type": "tool_call",
  "name": "vision_analyze",
  "id": "unique_call_id_123",
  "args": {
    "mode": 1,
    "image": "https://example.com/image.jpg",
    "question": "What is in this image?"
  }
}
```

_Note: `image` can be a URL or a Base64 encoded string (`data:image/png;base64,...`)._

### 3. Tool Results

Update a tool card with the result.

```json
{
  "type": "tool_result",
  "id": "unique_call_id_123",
  "result": "The image contains a Golden Gate Bridge."
}
```

## 🛠 Supported Tools

### `vision_analyze`

Visualizes an image analysis task.

- **args**:
  - `mode`: `1` (VQA/Analysis Mode)
  - `image`: URL or Base64 string.
  - `question`: The prompt used for analysis.

## 🧩 Tool Registration & Multimodal Support

### Registering New Tools (Frontend)

The application supports a flexible tool registry. You can register tools statically or dynamically.

**1. Static Registration (`App.tsx`)**
Import your React component and add it to the `TOOLS` map.

```tsx
import { WeatherTool } from "./components/tools/WeatherTool";

const TOOLS = {
  vision_analyze: VisionTool,
  weather_check: WeatherTool, // <--- Added here
  generic_tool: GenericTool,
};
```

**2. Dynamic Registration**
Use the `useToolRegistry` hook within any component under the provider.

```tsx
const { registerTool } = useToolRegistry();

useEffect(() => {
  registerTool("new_dynamic_tool", MyCustomComponent);
}, []);
```

### Multimodal Inputs

The `GenericTool` and `VisionTool` support multimodal inputs via JSON arguments.
To send an image or file, we recommend encoding it as a **Data URI** or receiving a **URL**.

**Example: Sending a Base64 Image**

```json
{
  "type": "tool_call",
  "name": "vision_analyze",
  "args": {
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...",
    "mode": 1
  }
}
```

The frontend component simply renders this string into an `<img>` tag or processes it accordingly.

### Fallback Behavior

If a tool name is sent (`e.g., "unknown_tool"`) that is _not_ in the registry, the system gracefully falls back to the **GenericTool**, which displays the arguments and results in a clean, JSON-formatted card.

## 🔌 How to Register Client-Side Tool Calls

If your client (Python/Node/Agent) sends a new type of tool call (e.g., `web_search`), you need to tell the frontend how to visualize it.

### Step 1: Send the Tool Call from Client

In your client code, use a new `name` for your tool:

```python
{"type": "tool_call", "name": "web_search", "args": {"query": "LangChain docs"}, "id": "call_1"}
```

### Step 2: Create a Visualization Component

Create a new React component in `frontend/src/components/tools/`:

```tsx
// WebSearchTool.tsx
export const WebSearchTool = ({ args, result }) => (
  <div className="p-4 bg-gray-50 border rounded-lg">
    <div className="font-bold">Searching for: {args.query}</div>
    {result && <div>Found: {result}</div>}
  </div>
);
```

### Step 3: Register in `App.tsx`

Add it to the `TOOLS` map:

```tsx
import { WebSearchTool } from "./components/tools/WebSearchTool";

const TOOLS = {
  // ... existing tools
  web_search: WebSearchTool,
};
```

Now, whenever the client sends `web_search`, your custom component will render!
