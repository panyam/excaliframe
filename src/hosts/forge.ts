import { view } from '@forge/bridge';
import { EditorHost, RendererHost, DrawingEnvelope } from '../core/types';
import { uploadAttachment, downloadAttachment } from './forge-attachments';

// V1 macro config (current — no storageVersion field)
interface MacroConfigV1 {
  drawing: string;   // JSON stringified DrawingData
  preview: string;   // Base64 PNG preview
}

// V2 macro config (attachment-based)
interface MacroConfigV2 {
  storageVersion: 2;
  attachmentFilename: string;  // 'excaliframe-{localId}.json'
  preview: string;              // stays inline for instant render
  drawing: string;              // stub: '{"_excaliframe_v2": true}'
}

type MacroConfig = MacroConfigV1 | MacroConfigV2;

const V2_DRAWING_STUB = '{"_excaliframe_v2": true}';

function isV2Config(config: MacroConfig): config is MacroConfigV2 {
  return 'storageVersion' in config && (config as MacroConfigV2).storageVersion === 2;
}

/** Callback for notifying the UI about V2 upgrade issues. */
export type UpgradeWarningCallback = (message: string) => void;

export class ForgeEditorHost implements EditorHost {
  private tool: string;
  private pageId: string | null = null;
  private localId: string | null = null;
  private onUpgradeWarning: UpgradeWarningCallback | null = null;

  constructor(tool: string = 'excalidraw') {
    this.tool = tool;
  }

  setUpgradeWarningCallback(cb: UpgradeWarningCallback): void {
    this.onUpgradeWarning = cb;
  }

  async loadDrawing(): Promise<DrawingEnvelope | null> {
    const context = await view.getContext();
    const ext = (context as any).extension;
    const config = ext?.config as MacroConfig | undefined;

    // Cache IDs for saveDrawing
    this.localId = (context as any).localId || null;
    this.pageId = ext?.content?.id || null;

    console.log(`[V2-FORGE] loadDrawing: pageId=${this.pageId}, localId=${this.localId}, hasConfig=${!!config}`);

    if (!config?.drawing) {
      console.log('[V2-FORGE] loadDrawing: no config or empty drawing, returning null');
      return null;
    }

    // V2: download from attachment
    if (isV2Config(config) && this.pageId) {
      console.log(`[V2-FORGE] loadDrawing: V2 detected, attachment=${config.attachmentFilename}`);
      const data = await downloadAttachment(this.pageId, config.attachmentFilename);
      if (data) {
        console.log(`[V2-FORGE] loadDrawing: V2 attachment loaded, ${(data.length / 1024).toFixed(1)}KB`);
        return {
          tool: this.tool,
          version: 1,
          data,
          preview: config.preview || undefined,
        };
      }
      // Attachment not found (e.g. macro was copied → new localId)
      console.warn('[V2-FORGE] loadDrawing: V2 attachment not found (macro copy?), returning null');
      return null;
    }

    // V1: inline data
    const sizeKB = (config.drawing.length / 1024).toFixed(1);
    console.log(`[V2-FORGE] loadDrawing: V1 inline data, ${sizeKB}KB`);
    return {
      tool: this.tool,
      version: 1,
      data: config.drawing,
      preview: config.preview || undefined,
    };
  }

  async saveDrawing(envelope: DrawingEnvelope): Promise<void> {
    const dataKB = (envelope.data.length / 1024).toFixed(1);
    const previewKB = ((envelope.preview || '').length / 1024).toFixed(1);
    console.log(`[V2-FORGE] saveDrawing: dataSize=${dataKB}KB, previewSize=${previewKB}KB, pageId=${this.pageId}, localId=${this.localId}`);

    // Attempt V2 save if we have page context
    if (this.pageId && this.localId) {
      const filename = `excaliframe-${this.localId}.json`;
      try {
        console.log(`[V2-FORGE] saveDrawing: attempting V2 upload as ${filename}`);
        await uploadAttachment(this.pageId, filename, envelope.data);

        const macroConfig: MacroConfigV2 = {
          storageVersion: 2,
          attachmentFilename: filename,
          preview: envelope.preview || '',
          drawing: V2_DRAWING_STUB,
        };
        const configKB = (JSON.stringify(macroConfig).length / 1024).toFixed(1);
        console.log(`[V2-FORGE] saveDrawing: V2 success! macro config=${configKB}KB (was ${dataKB}KB inline). Submitting...`);
        await view.submit({ config: macroConfig });
        return;
      } catch (err) {
        // V2 failed — fall back to V1 with warning
        console.warn('[V2-FORGE] saveDrawing: V2 failed, falling back to V1:', err);
        this.onUpgradeWarning?.(
          'Drawing saved inline (attachment upload failed). Very large diagrams may not save correctly.',
        );
      }
    } else {
      console.warn(`[V2-FORGE] saveDrawing: missing context (pageId=${this.pageId}, localId=${this.localId}), using V1`);
    }

    // V1 fallback
    console.log(`[V2-FORGE] saveDrawing: V1 fallback, inline ${dataKB}KB`);
    const macroConfig: MacroConfigV1 = {
      drawing: envelope.data,
      preview: envelope.preview || '',
    };
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
    const ext = (context as any).extension;
    const config = ext?.config as MacroConfig | undefined;

    if (!config) return null;

    // V2: preview is inline, no attachment fetch needed for rendering
    if (isV2Config(config)) {
      console.log(`[V2-FORGE] renderer: V2 macro, using inline preview (attachment=${config.attachmentFilename})`);
      return {
        tool: this.tool,
        version: 1,
        data: '', // renderer uses preview, not data
        preview: config.preview || undefined,
      };
    }

    // V1: inline
    console.log(`[V2-FORGE] renderer: V1 macro, inline data ${((config.drawing || '').length / 1024).toFixed(1)}KB`);
    return {
      tool: this.tool,
      version: 1,
      data: config.drawing || '',
      preview: config.preview || undefined,
    };
  }
}
