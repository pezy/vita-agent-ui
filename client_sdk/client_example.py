import asyncio
import websockets
import json
import sys
import uuid
import os


async def stream_data():
    uri = os.getenv("WS_URI", "ws://localhost:61111")

    # Generate or read Client ID
    client_id = sys.argv[1] if len(sys.argv) > 1 else f"agent_{str(uuid.uuid4())[:8]}"
    client_name = f"Agent {client_id}"

    steps = [
        # TTS Start
        {"type": "ui_event", "event": {"event_type": "tts_start", "text": "Hello! I will check that for you.", "provider": "bridge"}},
        {"type": "token", "content": "Hello! "},
        {"type": "token", "content": "I "},
        {"type": "token", "content": "will "},
        {"type": "token", "content": "check "},
        {"type": "token", "content": "that "},
        {"type": "token", "content": "for "},
        {"type": "token", "content": "you.\n"},
        # TTS End
        {"type": "ui_event", "event": {"event_type": "tts_end", "status": "success", "duration_ms": 1000}},
        
        {"type": "user_request", "content": "Can you analyze this image for me?"},
        
        {"type": "token", "content": "<thinking>"},
        {"type": "token", "content": "Checking "},
        {"type": "token", "content": "vision "},
        {"type": "token", "content": "tools... "},
        {"type": "token", "content": "</thinking>"},
        
        # VisionAnalyze - VQA mode
        {
            "type": "tool_call",
            "name": "vision_analyze",
            "id": "call_py_vqa_1",
            "args": {
                "mode": 1,
                # No image provided (simulate live capture)
                "question": "What is the weather like?"
            }
        },
        # VQA Events
        {"type": "ui_event", "event": {"event_type": "vision_vqa_start", "query": "What is the weather like?", "camera_position": {"pitch":0, "yaw":0}}},
        {"type": "ui_event", "event": {
            "event_type": "vision_image_captured", 
            "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", 
            "image_format": "png",
            "width": 1, "height": 1
        }},
        {"type": "ui_event", "event": {
            "event_type": "vision_vqa_result", 
            "query": "What is the weather like?", 
            "answer": "It looks like a clear, sunny day with calm water.", 
            "total_time_ms": 500
        }},
        {
            "type": "tool_result",
            "id": "call_py_vqa_1",
            "result": {
                "status": "ok",
                "data": {
                    "answer": "It looks like a clear, sunny day with calm water."
                },
                "message": "Vision VQA analysis completed from Python client."
            }
        },

        # VisionAnalyze - Grounding mode
        {
            "type": "tool_call",
            "name": "vision_analyze",
            "id": "call_py_ground_1",
            "args": {
                "mode": 2,
                # No image (simulate live capture)
                "question": "Where is the bridge?"
            }
        },
        # Grounding Events
        {"type": "ui_event", "event": {"event_type": "vision_grounding_start", "query": "Where is the bridge?", "camera_position": {"pitch":0, "yaw":0}}},
        {"type": "ui_event", "event": {
            "event_type": "vision_stereo_captured", 
            "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", 
            "image_format": "png",
            "width": 1, "height": 1
        }},
        # Parallel detection and depth
        {"type": "ui_event", "event": {"event_type": "vision_2d_detection_start", "method": "vlm"}},
        {"type": "ui_event", "event": {"event_type": "vision_3d_start"}},
        {"type": "ui_event", "event": {"event_type": "vision_3d_depth_complete", "duration_ms": 200}},
        {"type": "ui_event", "event": {
            "event_type": "vision_2d_detection_result", 
            "detections": [{"label": "bridge", "x1": 0.1, "y1": 0.2, "x2": 0.5, "y2": 0.6}], 
            "detection_count": 1, 
            "duration_ms": 300
        }},
        {"type": "ui_event", "event": {
            "event_type": "vision_3d_result", 
            "objects": [{
                "label": "bridge", 
                "x": 25.0, "y": 0.0, "z": 0.0, 
                "distance": 25.0, "angle_deg": 0.0, 
                "depth_meters": 25.0, "pixel_x": 900, "pixel_y": 450, 
                "confidence": 0.98
            }], 
            "detection_count": 1, 
            "total_time_ms": 600
        }},

        {
            "type": "tool_result",
            "id": "call_py_ground_1",
            "result": {
                "status": "ok",
                "data": {
                    "objects": [
                        { "label": "bridge", "distance": 25.0, "angle_deg": 0.0 }
                    ]
                },
                "message": "Located the bridge in the scene."
            }
        },
        
        # TakeAction
        {
            "type": "tool_call",
            "name": "take_action",
            "id": "call_py_action_1",
            "args": {"action_name": "Wave"}
        },
        {
            "type": "tool_result",
            "id": "call_py_action_1",
            "result": {
                "status": "ok",
                "data": {"action_name": "Wave"},
                "message": "Successfully executed action 'Wave'."
            }
        },

        # ControlNav Tool - Navigation
        {
            "type": "tool_call",
            "name": "control_nav",
            "id": "call_py_nav_1",
            "args": {"x": 2.5, "y": 1.0}
        },
        {"type": "token", "content": "Navigating "},
        {"type": "token", "content": "to "},
        {"type": "token", "content": "target... "},
        {
            "type": "tool_result",
            "id": "call_py_nav_1",
            "result": "✅ Navigating to (x=2.5m forward, y=1.0m left)"
        },

        # ControlNav Tool - Rotation
        {
            "type": "tool_call",
            "name": "control_nav",
            "id": "call_py_rot_1",
            "args": {"angle": -45}
        },
        {
            "type": "tool_result",
            "id": "call_py_rot_1",
            "result": "✅ Rotated 45° Right"
        },

        # TTS End (just in case)
        {"type": "ui_event", "event": {"event_type": "tts_start", "text": "The weather is sunny.", "provider": "bridge"}},
        {"type": "token", "content": "The "},
        {"type": "token", "content": "weather "},
        {"type": "token", "content": "is "},
        {"type": "token", "content": "sunny." },
        {"type": "ui_event", "event": {"event_type": "tts_end", "status": "success", "duration_ms": 1000}},
    ]

    async with websockets.connect(uri, ping_interval=None) as websocket:
        print(f"Connected to {uri}")

        # Register message
        register_msg = {"type": "register", "id": client_id, "name": client_name}
        await websocket.send(json.dumps(register_msg))
        print(f"Sent: {register_msg}")

        last_ping = asyncio.get_running_loop().time()

        for step in steps:
            await websocket.send(json.dumps(step))
            print(f"Sent: {step}")
            # Periodically send pings to maintain the long-lived connection
            now = asyncio.get_running_loop().time()
            if now - last_ping > 20:
                await websocket.ping()
                last_ping = now
            await asyncio.sleep(0.2)

        # Example for maintaining a long-lived connection
        while True:
            await asyncio.sleep(20)
            await websocket.ping()
            print("Sent heartbeat ping")


if __name__ == "__main__":
    try:
        asyncio.run(stream_data())
    except KeyboardInterrupt:
        print("Stream stopped")
    except Exception as e:
        print(f"Error: {e}")
