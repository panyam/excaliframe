import { EditorHost, RendererHost, DrawingEnvelope } from '../core/types';

const STORAGE_KEY = 'excaliframe:drawing';

export class WebEditorHost implements EditorHost {
  async loadDrawing(): Promise<DrawingEnvelope | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DrawingEnvelope;
    } catch {
      return null;
    }
  }

  async saveDrawing(envelope: DrawingEnvelope): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }

  close(): void {
    // No-op in standalone web mode
  }
}

export class WebRendererHost implements RendererHost {
  async loadConfig(): Promise<DrawingEnvelope | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DrawingEnvelope;
    } catch {
      return null;
    }
  }
}
