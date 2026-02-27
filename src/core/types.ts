// Core types for multi-hostable Excaliframe
//
// Host interfaces are tool-agnostic. The host stores/retrieves a
// DrawingEnvelope (tool type + opaque payload). Internal format
// of the payload is the tool's concern.

// Tool-agnostic envelope — hosts store/retrieve this
export interface DrawingEnvelope {
  tool: string;       // e.g. "excalidraw", "mermaid"
  version: number;    // envelope schema version
  data: string;       // opaque tool-specific payload (JSON string, markup, etc.)
  preview?: string;   // base64 PNG preview
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}

// Host adapter for the editor (load/save/close)
export interface EditorHost {
  loadDrawing(): Promise<DrawingEnvelope | null>;
  saveDrawing(envelope: DrawingEnvelope): Promise<void>;
  close(): void;
  getTitle?(): string;
  setTitle?(title: string): Promise<void>;
}

// Host adapter for the renderer (load config for display)
export interface RendererHost {
  loadConfig(): Promise<DrawingEnvelope | null>;
}

// Excalidraw-specific drawing format (used by Excalidraw editor/renderer only)
export interface ExcalidrawDrawingData {
  type: string;
  version: number;
  source: string;
  elements: any[];
  appState: {
    viewBackgroundColor?: string;
    gridSize?: number | null;
  };
  files?: Record<string, any>;
}
