import { view } from '@forge/bridge';
import { EditorHost, RendererHost, DrawingEnvelope } from '../core/types';
import { uploadAttachment, uploadBlobAttachment, downloadAttachment, downloadAttachmentAsDataUrl } from './forge-attachments';

const LOG = '[FORGE]';

// ── Macro config versions ────────────────────────────────────────────

// V1: everything inline (legacy)
interface MacroConfigV1 {
  drawing: string;   // JSON stringified DrawingData
  preview: string;   // Base64 PNG/SVG preview
}

// V2: drawing in attachment, preview inline
interface MacroConfigV2 {
  storageVersion: 2;
  attachmentFilename: string;
  preview: string;
  drawing: string;   // stub
}

// V3: drawing + preview in attachments, only tiny thumbnail inline
interface MacroConfigV3 {
  storageVersion: 3;
  attachmentFilename: string;           // 'excaliframe-{localId}.json'
  previewAttachmentFilename: string;    // 'excaliframe-{localId}-preview.png' (empty if upload failed)
  thumbnail: string;                    // tiny base64 (~300px, 5-10KB)
  preview: string;                      // same as thumbnail (V2 renderer backward compat)
  drawing: string;                      // stub
}

type MacroConfig = MacroConfigV1 | MacroConfigV2 | MacroConfigV3;

const V3_DRAWING_STUB = '{"_excaliframe_v3": true}';

function isV3Config(config: MacroConfig): config is MacroConfigV3 {
  return 'storageVersion' in config && (config as any).storageVersion === 3;
}

function isV2Config(config: MacroConfig): config is MacroConfigV2 {
  return 'storageVersion' in config && (config as any).storageVersion === 2;
}

/** Callback for notifying the UI about upgrade issues. */
export type UpgradeWarningCallback = (message: string) => void;

// ── Editor Host ──────────────────────────────────────────────────────

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

    this.localId = (context as any).localId || null;
    this.pageId = ext?.content?.id || null;

    console.log(`${LOG} loadDrawing: pageId=${this.pageId}, localId=${this.localId}, hasConfig=${!!config}`);

    if (!config?.drawing) {
      console.log(`${LOG} loadDrawing: no config or empty drawing, returning null`);
      return null;
    }

    // V3: download drawing JSON from attachment (same as V2)
    if (isV3Config(config) && this.pageId) {
      console.log(`${LOG} loadDrawing: V3 detected, attachment=${config.attachmentFilename}`);
      const data = await downloadAttachment(this.pageId, config.attachmentFilename);
      if (data) {
        console.log(`${LOG} loadDrawing: V3 attachment loaded, ${(data.length / 1024).toFixed(1)}KB`);
        return { tool: this.tool, version: 1, data };
      }
      console.warn(`${LOG} loadDrawing: V3 attachment not found (macro copy?), returning null`);
      return null;
    }

    // V2: download drawing JSON from attachment
    if (isV2Config(config) && this.pageId) {
      console.log(`${LOG} loadDrawing: V2 detected, attachment=${config.attachmentFilename}`);
      const data = await downloadAttachment(this.pageId, config.attachmentFilename);
      if (data) {
        console.log(`${LOG} loadDrawing: V2 attachment loaded, ${(data.length / 1024).toFixed(1)}KB`);
        return { tool: this.tool, version: 1, data, preview: config.preview || undefined };
      }
      console.warn(`${LOG} loadDrawing: V2 attachment not found (macro copy?), returning null`);
      return null;
    }

    // V1: inline data
    const sizeKB = (config.drawing.length / 1024).toFixed(1);
    console.log(`${LOG} loadDrawing: V1 inline data, ${sizeKB}KB`);
    return {
      tool: this.tool,
      version: 1,
      data: config.drawing,
      preview: config.preview || undefined,
    };
  }

  async saveDrawing(envelope: DrawingEnvelope): Promise<void> {
    const dataKB = (envelope.data.length / 1024).toFixed(1);
    const previewBlobKB = envelope.previewBlob ? (envelope.previewBlob.size / 1024).toFixed(1) : '0';
    const thumbnailKB = ((envelope.thumbnail || '').length / 1024).toFixed(1);
    console.log(`${LOG} saveDrawing: data=${dataKB}KB, previewBlob=${previewBlobKB}KB, thumbnail=${thumbnailKB}KB, pageId=${this.pageId}, localId=${this.localId}`);

    if (!this.pageId || !this.localId) {
      console.warn(`${LOG} saveDrawing: missing context, using V1 fallback`);
      return this._saveV1(envelope);
    }

    const jsonFilename = `excaliframe-${this.localId}.json`;
    const previewFilename = `excaliframe-${this.localId}-preview.png`;

    try {
      // Upload drawing JSON + preview blob in parallel
      // Preview always goes to attachment — nothing large is ever stored inline
      const previewBlob = envelope.previewBlob;
      const uploads: Promise<void>[] = [
        uploadAttachment(this.pageId!, jsonFilename, envelope.data),
      ];
      if (previewBlob) {
        uploads.push(uploadBlobAttachment(this.pageId!, previewFilename, previewBlob));
      }

      console.log(`${LOG} saveDrawing: V3 uploading ${uploads.length} attachment(s)...`);
      const results = await Promise.allSettled(uploads);

      // JSON upload must succeed
      if (results[0].status === 'rejected') {
        throw results[0].reason;
      }

      // Preview upload is best-effort
      const previewUploaded = uploads.length > 1 && results[1].status === 'fulfilled';
      if (!previewUploaded && previewBlob) {
        console.warn(`${LOG} saveDrawing: preview upload failed, thumbnail-only mode`);
      }

      // Only thumbnail goes inline — never the full preview
      const thumbnail = envelope.thumbnail || '';
      const macroConfig: MacroConfigV3 = {
        storageVersion: 3,
        attachmentFilename: jsonFilename,
        previewAttachmentFilename: previewUploaded ? previewFilename : '',
        thumbnail,
        preview: thumbnail,  // backward compat: old renderers show thumbnail
        drawing: V3_DRAWING_STUB,
      };

      const configKB = (JSON.stringify(macroConfig).length / 1024).toFixed(1);
      console.log(`${LOG} saveDrawing: V3 success! config=${configKB}KB, previewInAttachment=${previewUploaded}. Submitting...`);
      await view.submit({ config: macroConfig });
    } catch (err) {
      console.warn(`${LOG} saveDrawing: V3 failed, falling back to V1:`, err);
      this.onUpgradeWarning?.(
        'Drawing saved inline (attachment upload failed). Very large diagrams may not save correctly.',
      );
      return this._saveV1(envelope);
    }
  }

  private async _saveV1(envelope: DrawingEnvelope): Promise<void> {
    const dataKB = (envelope.data.length / 1024).toFixed(1);
    console.log(`${LOG} saveDrawing: V1 fallback, inline ${dataKB}KB`);
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

// ── Renderer Host ────────────────────────────────────────────────────

export class ForgeRendererHost implements RendererHost {
  private tool: string;
  private pageId: string | null = null;
  private previewAttachmentFilename: string | null = null;

  constructor(tool: string = 'excalidraw') {
    this.tool = tool;
  }

  async loadConfig(): Promise<DrawingEnvelope | null> {
    const context = await view.getContext();
    const ext = (context as any).extension;
    const config = ext?.config as MacroConfig | undefined;

    this.pageId = ext?.content?.id || null;

    if (!config) return null;

    // V3: thumbnail inline, full preview in attachment
    if (isV3Config(config)) {
      this.previewAttachmentFilename = config.previewAttachmentFilename || null;
      console.log(`${LOG} renderer: V3 macro, thumbnail inline, previewAttachment=${this.previewAttachmentFilename || 'none'}`);
      return {
        tool: this.tool,
        version: 1,
        data: '',
        thumbnail: config.thumbnail || undefined,
        preview: config.preview || config.thumbnail || undefined,
      };
    }

    // V2: preview is inline
    if (isV2Config(config)) {
      console.log(`${LOG} renderer: V2 macro, inline preview (attachment=${config.attachmentFilename})`);
      return {
        tool: this.tool,
        version: 1,
        data: '',
        preview: config.preview || undefined,
      };
    }

    // V1: inline
    console.log(`${LOG} renderer: V1 macro, inline data ${((config.drawing || '').length / 1024).toFixed(1)}KB`);
    return {
      tool: this.tool,
      version: 1,
      data: config.drawing || '',
      preview: config.preview || undefined,
    };
  }

  async loadFullPreview(): Promise<string | null> {
    if (!this.previewAttachmentFilename || !this.pageId) return null;
    console.log(`${LOG} renderer: fetching full preview from ${this.previewAttachmentFilename}`);
    try {
      const dataUrl = await downloadAttachmentAsDataUrl(this.pageId, this.previewAttachmentFilename);
      if (dataUrl) {
        console.log(`${LOG} renderer: full preview loaded, ${(dataUrl.length / 1024).toFixed(1)}KB`);
      }
      return dataUrl;
    } catch (err) {
      console.warn(`${LOG} renderer: failed to load full preview:`, err);
      return null;
    }
  }
}
