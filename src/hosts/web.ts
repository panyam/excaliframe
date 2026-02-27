import { EditorHost, RendererHost, DrawingEnvelope } from '../core/types';
import { PlaygroundStore } from './playground-store';

export class WebEditorHost implements EditorHost {
  private drawingId: string;
  private store: PlaygroundStore;
  private title: string = 'Untitled Drawing';

  constructor(drawingId: string, store: PlaygroundStore) {
    this.drawingId = drawingId;
    this.store = store;
  }

  async loadDrawing(): Promise<DrawingEnvelope | null> {
    const drawing = await this.store.getById(this.drawingId);
    if (!drawing) return null;
    this.title = drawing.title;
    return drawing.envelope;
  }

  async saveDrawing(envelope: DrawingEnvelope): Promise<void> {
    await this.store.save({
      id: this.drawingId,
      title: this.title,
      envelope,
    });
  }

  close(): void {
    window.location.href = '/playground/';
  }
}

export class WebRendererHost implements RendererHost {
  private drawingId: string;
  private store: PlaygroundStore;

  constructor(drawingId: string, store: PlaygroundStore) {
    this.drawingId = drawingId;
    this.store = store;
  }

  async loadConfig(): Promise<DrawingEnvelope | null> {
    const drawing = await this.store.getById(this.drawingId);
    return drawing?.envelope ?? null;
  }
}
