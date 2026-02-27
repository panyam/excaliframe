import { EditorHost, RendererHost, DrawingEnvelope } from '../core/types';
import { PlaygroundStore } from './playground-store';

export class WebEditorHost implements EditorHost {
  private drawingId: string;
  private store: PlaygroundStore;
  private title: string = 'Untitled Drawing';
  private createdAt: string | undefined;

  constructor(drawingId: string, store: PlaygroundStore) {
    this.drawingId = drawingId;
    this.store = store;
  }

  async loadDrawing(): Promise<DrawingEnvelope | null> {
    const drawing = await this.store.getById(this.drawingId);
    if (!drawing) return null;
    this.title = drawing.title;
    this.createdAt = drawing.envelope.createdAt;
    return drawing.envelope;
  }

  async saveDrawing(envelope: DrawingEnvelope): Promise<void> {
    // Preserve createdAt from the original drawing
    if (this.createdAt && !envelope.createdAt) {
      envelope.createdAt = this.createdAt;
    }
    await this.store.save({
      id: this.drawingId,
      title: this.title,
      envelope,
    });
  }

  close(): void {
    window.location.href = '/playground/';
  }

  getTitle(): string {
    return this.title;
  }

  async setTitle(title: string): Promise<void> {
    this.title = title;
    const drawing = await this.store.getById(this.drawingId);
    if (drawing) {
      await this.store.save({ ...drawing, title });
    }
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
