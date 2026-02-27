import { view } from '@forge/bridge';
import { EditorHost, RendererHost, DrawingEnvelope } from '../core/types';

// Forge macro config shape (what Forge stores)
interface MacroConfig {
  drawing: string;   // JSON stringified DrawingData
  preview: string;   // Base64 PNG preview
}

export class ForgeEditorHost implements EditorHost {
  private tool: string;

  constructor(tool: string = 'excalidraw') {
    this.tool = tool;
  }

  async loadDrawing(): Promise<DrawingEnvelope | null> {
    const context = await view.getContext();
    const config = (context as any).extension?.config as MacroConfig | undefined;

    if (!config?.drawing) return null;

    return {
      tool: this.tool,
      version: 1,
      data: config.drawing,
      preview: config.preview || undefined,
    };
  }

  async saveDrawing(envelope: DrawingEnvelope): Promise<void> {
    const macroConfig: MacroConfig = {
      drawing: envelope.data,
      preview: envelope.preview || '',
    };
    // view.submit() saves config AND closes the config panel
    await view.submit({ config: macroConfig });
  }

  close(): void {
    view.close();
  }
}

export class ForgeRendererHost implements RendererHost {
  private tool: string;

  constructor(tool: string = 'excalidraw') {
    this.tool = tool;
  }

  async loadConfig(): Promise<DrawingEnvelope | null> {
    const context = await view.getContext();
    const config = (context as any).extension?.config as MacroConfig | undefined;

    if (!config) return null;

    return {
      tool: this.tool,
      version: 1,
      data: config.drawing || '',
      preview: config.preview || undefined,
    };
  }
}
