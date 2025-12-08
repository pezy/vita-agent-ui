export interface BaseUIEvent {
    event_type: string;
    source?: string;
    timestamp?: string;
}

// === TTS Events ===

export interface TTSStartEvent extends BaseUIEvent {
    event_type: 'tts_start';
    text: string;
    provider: string;
}

export interface TTSEndEvent extends BaseUIEvent {
    event_type: 'tts_end';
    status: 'success' | 'error';
    error_message?: string | null;
    duration_ms?: number | null;
}

// === Vision Common Models ===

export interface CameraPosition {
    pitch: number;
    yaw: number;
}

// === VQA Mode Events ===

export interface VisionVQAStartEvent extends BaseUIEvent {
    event_type: 'vision_vqa_start';
    query: string;
    camera_position: CameraPosition;
}

export interface VisionImageCapturedEvent extends BaseUIEvent {
    event_type: 'vision_image_captured';
    image_base64: string;
    image_format: 'jpeg' | 'png';
    width?: number | null;
    height?: number | null;
}

export interface VisionVQAResultEvent extends BaseUIEvent {
    event_type: 'vision_vqa_result';
    query: string;
    answer: string;
    total_time_ms: number;
}

// === Grounding Mode Events ===

export interface VisionGroundingStartEvent extends BaseUIEvent {
    event_type: 'vision_grounding_start';
    query: string;
    camera_position: CameraPosition;
}

export interface VisionStereoCapturedEvent extends BaseUIEvent {
    event_type: 'vision_stereo_captured';
    image_base64: string;
    image_format: 'png';
    width?: number | null;
    height?: number | null;
}

// === 2D Detection Phase Events ===

export interface Vision2DDetectionStartEvent extends BaseUIEvent {
    event_type: 'vision_2d_detection_start';
    method: 'vlm' | 'sam3';
}

export interface BoundingBox2D {
    label: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence?: number | null;
}

export interface Vision2DDetectionResultEvent extends BaseUIEvent {
    event_type: 'vision_2d_detection_result';
    detections: BoundingBox2D[];
    detection_count: number;
    duration_ms: number;
}

// === Depth/3D Phase Events ===

export interface Vision3DStartEvent extends BaseUIEvent {
    event_type: 'vision_3d_start';
}

export interface Vision3DDepthCompleteEvent extends BaseUIEvent {
    event_type: 'vision_3d_depth_complete';
    duration_ms: number;
}

export interface Object3DPosition {
    label: string;
    x: number;
    y: number;
    z: number;
    distance: number;
    angle_deg: number;
    depth_meters: number;
    pixel_x: number;
    pixel_y: number;
    confidence?: number | null;
}

export interface Vision3DResultEvent extends BaseUIEvent {
    event_type: 'vision_3d_result';
    objects: Object3DPosition[];
    detection_count: number;
    total_time_ms: number;
}

export type UIEvent =
    | TTSStartEvent
    | TTSEndEvent
    | VisionVQAStartEvent
    | VisionImageCapturedEvent
    | VisionVQAResultEvent
    | VisionGroundingStartEvent
    | VisionStereoCapturedEvent
    | Vision2DDetectionStartEvent
    | Vision2DDetectionResultEvent
    | Vision3DStartEvent
    | Vision3DDepthCompleteEvent
    | Vision3DResultEvent;
