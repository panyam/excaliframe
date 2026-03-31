import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { exportToCanvas, exportToBlob, hashElementsVersion } from '@excalidraw/excalidraw';
import { VERSION, BUILD_DATE } from '../version';
import { EditorHost, DrawingEnvelope, ExcalidrawDrawingData } from './types';
import { ExcalidrawSyncAdapter } from '../collab/adapters/ExcalidrawSyncAdapter';
import type { SyncActions } from '../collab/sync/SyncAdapter';
import type { EditorHandle, EditorStateCallbacks } from './EditorHandle';

// Excalidraw types (defined locally to avoid module resolution issues)
type ExcalidrawElement = any;
type BinaryFiles = Record<string, any>;
interface AppState {
  viewBackgroundColor?: string;
  gridSize?: number | null;
  [key: string]: any;
}
interface ExcalidrawImperativeAPI {
  getSceneElements: () => readonly ExcalidrawElement[];
  getAppState: () => AppState;
  getFiles: () => BinaryFiles;
  updateScene: (scene: { elements?: readonly ExcalidrawElement[]; appState?: Partial<AppState>; collaborators?: Map<string, any> }) => void;
  addFiles: (files: any[]) => void;
}

export interface ExcalidrawEditorProps {
  host: EditorHost;
  syncActions: SyncActions | null;
  stateCallbacks: EditorStateCallbacks;
  autoSave?: { enabled: boolean; setEnabled: (v: boolean) => void };
}

// Keys that Excalidraw mutates internally on every scene update (version bumps,
// random nonces, timestamps). Excluding these from comparison prevents false
// positive "unsaved changes" when loading existing drawings.
const INTERNAL_KEYS = new Set(['version', 'versionNonce', 'updated', 'seed']);

/** Stable fingerprint of elements excluding Excalidraw's internal versioning fields. */
function fingerprint(elements: readonly any[]): string {
  const stable = elements
    .filter((el: any) => !el.isDeleted)
    .map((el: any) => {
      const out: Record<string, any> = {};
      for (const key of Object.keys(el)) {
        if (!INTERNAL_KEYS.has(key)) out[key] = el[key];
      }
      return out;
    });
  return JSON.stringify(stable);
}

const ExcalidrawEditor = forwardRef<EditorHandle, ExcalidrawEditorProps>(
  ({ host, syncActions, stateCallbacks, autoSave }, ref) => {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<any>(null);
  const [MainMenuComponent, setMainMenuComponent] = useState<any>(null);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [initialData, setInitialData] = useState<{
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const initialFingerprintRef = useRef<string>('[]');

  // Dynamically load Excalidraw components
  useEffect(() => {
    console.log(`Excaliframe v${VERSION} (built ${BUILD_DATE})`);
    import('@excalidraw/excalidraw').then((module) => {
      setExcalidrawComponent(() => module.Excalidraw);
      setMainMenuComponent(() => module.MainMenu);
    });
  }, []);

  // Load existing drawing on mount
  useEffect(() => {
    loadDrawing();
  }, []);

  const loadDrawing = async (): Promise<void> => {
    console.log('Editor - Loading drawing...');
    try {
      const envelope = await host.loadDrawing();

      if (envelope?.data) {
        console.log('Editor - Found existing drawing data');
        const drawingData: ExcalidrawDrawingData = JSON.parse(envelope.data);
        const elements = drawingData.elements || [];
        initialFingerprintRef.current = fingerprint(elements);
        setInitialData({
          elements: elements,
          appState: {
            viewBackgroundColor: drawingData.appState?.viewBackgroundColor || '#ffffff',
          },
          files: drawingData.files || {},
        });
      } else {
        console.log('Editor - No existing drawing, starting fresh');
      }
    } catch (error) {
      console.error('Editor - Error loading drawing:', error);
    }
    setIsLoading(false);
  };

  const saveDrawing = useCallback(async (): Promise<void> => {
    if (!excalidrawApiRef.current || isSaving) return;

    setIsSaving(true);
    stateCallbacks.onSavingChange(true);
    console.log('Editor - Saving drawing...');

    try {
      const elements = excalidrawApiRef.current.getSceneElements();
      const appState = excalidrawApiRef.current.getAppState();
      const files = excalidrawApiRef.current.getFiles();

      const drawingData: ExcalidrawDrawingData = {
        type: 'excalidraw',
        version: 2,
        source: 'excaliframe',
        elements: [...elements],
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files: files,
      };

      // Generate preview images
      let preview = '';
      let thumbnail = '';
      let previewBlob: Blob | undefined;
      if (elements.length > 0) {
        try {
          const exportOpts = {
            elements,
            appState: { ...appState, exportBackground: true },
            files,
          };

          // Full preview as blob for attachment upload (capped at 1920px to keep size sane)
          previewBlob = await exportToBlob({ ...exportOpts, maxWidthOrHeight: 1920, mimeType: 'image/png' });

          // Full preview as data URL (for inline use if small enough)
          const canvas = await exportToCanvas({ ...exportOpts, maxWidthOrHeight: 1920 });
          preview = canvas.toDataURL('image/png');

          // Thumbnail: tiny version for inline macro config (~5-10KB)
          const thumbCanvas = await exportToCanvas({ ...exportOpts, maxWidthOrHeight: 300 });
          thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);
        } catch (e) {
          console.log('Editor - Could not generate preview:', e);
        }
      }

      const now = new Date().toISOString();
      const envelope: DrawingEnvelope = {
        tool: 'excalidraw',
        version: 1,
        data: JSON.stringify(drawingData),
        preview,
        thumbnail,
        previewBlob,
        updatedAt: now,
      };

      console.log('Editor - Saving envelope, elements:', elements.length);
      await host.saveDrawing(envelope);
      console.log('Editor - Save complete');
      setIsSaving(false);
      stateCallbacks.onSavingChange(false);
      setIsDirty(false);
      stateCallbacks.onDirtyChange(false);
      initialFingerprintRef.current = fingerprint(elements);

    } catch (error) {
      console.error('Editor - Error saving:', error);
      alert('Failed to save drawing. Please try again.');
      setIsSaving(false);
      stateCallbacks.onSavingChange(false);
    }
  }, [isSaving, host, stateCallbacks]);

  // Imperative handle for EditorChrome
  useImperativeHandle(ref, () => ({
    save: saveDrawing,
    canClose: () => {
      const appState = excalidrawApiRef.current?.getAppState();
      if (appState?.openMenu || appState?.openPopup || appState?.isResizing ||
          appState?.isRotating || appState?.draggingElement || appState?.editingElement) {
        return false;
      }
      return true;
    },
  }), [saveDrawing]);

  // Track changes to detect dirty state + notify sync engine.
  const syncAdapterRef = useRef<ExcalidrawSyncAdapter | null>(null);
  const syncActionsRef = useRef<SyncActions | null>(null);
  syncActionsRef.current = syncActions;
  const lastNotifiedHash = useRef<number>(0);

  const handleChange = useCallback((elements: readonly ExcalidrawElement[]): void => {
    const dirty = fingerprint(elements) !== initialFingerprintRef.current;
    setIsDirty(dirty);
    stateCallbacks.onDirtyChange(dirty);
    const adapter = syncAdapterRef.current;
    if (adapter && !adapter.isApplyingRemote) {
      const hash = hashElementsVersion(elements);
      if (hash !== lastNotifiedHash.current) {
        console.log('[EXCAL] Element hash changed: %d → %d, notifying sync', lastNotifiedHash.current, hash);
        lastNotifiedHash.current = hash;
        syncActionsRef.current?.notifyLocalChange();
      }
    }
  }, [stateCallbacks]);

  const handleCopyJson = useCallback(async (): Promise<void> => {
    if (!excalidrawApiRef.current) return;

    const elements = excalidrawApiRef.current.getSceneElements();
    const appState = excalidrawApiRef.current.getAppState();
    const files = excalidrawApiRef.current.getFiles();

    const exportData = {
      type: 'excalidraw',
      version: 2,
      source: 'excaliframe',
      elements: [...elements],
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
      },
      files: files,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      alert('Diagram JSON copied to clipboard!');
    } catch (e) {
      console.error('Failed to copy:', e);
      alert('Failed to copy to clipboard');
    }
  }, []);

  const handlePasteJson = useCallback(async (): Promise<void> => {
    if (!excalidrawApiRef.current) return;

    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);

      if (!data.elements || !Array.isArray(data.elements)) {
        alert('Invalid Excalidraw data - no elements array found');
        return;
      }

      excalidrawApiRef.current.updateScene({
        elements: data.elements,
        appState: data.appState || {},
      });

      if (data.files && Object.keys(data.files).length > 0) {
        excalidrawApiRef.current.addFiles(Object.values(data.files));
      }

      console.log('Pasted diagram with', data.elements.length, 'elements');
    } catch (e) {
      console.error('Failed to paste:', e);
      alert('Failed to paste - make sure clipboard contains valid Excalidraw JSON');
    }
  }, []);

  if (!ExcalidrawComponent || isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        backgroundColor: '#fff',
        gap: '16px',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #f3f4f6',
          borderTop: '3px solid #0052cc',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ color: '#172b4d', fontSize: '16px', fontWeight: 500 }}>
          Loading Excalidraw...
        </div>
      </div>
    );
  }

  return (
    <ExcalidrawComponent
      excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
        excalidrawApiRef.current = api;
        (window as any).__EXCALIDRAW_API__ = api;
        if (!syncAdapterRef.current) {
          const adapter = new ExcalidrawSyncAdapter(api);
          syncAdapterRef.current = adapter;
          stateCallbacks.onSyncAdapterReady(adapter);
        }
      }}
      initialData={initialData || {
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff',
          currentItemStrokeColor: '#000000',
          currentItemBackgroundColor: 'transparent',
        },
      }}
      onChange={handleChange}
      onPointerUpdate={(payload: any) => {
        syncAdapterRef.current?.setLocalPointer(payload.pointer, payload.button);
        syncActionsRef.current?.notifyCursorMove();
      }}
      theme="light"
      UIOptions={{
        canvasActions: {
          loadScene: false,
        },
      }}
    >
      {MainMenuComponent && (
        <MainMenuComponent>
          {autoSave && (
            <MainMenuComponent.Item onSelect={saveDrawing}>
              {isSaving ? 'Saving...' : isDirty ? 'Save *' : 'Save'}
            </MainMenuComponent.Item>
          )}
          {autoSave && (
            <MainMenuComponent.Item onSelect={() => autoSave.setEnabled(!autoSave.enabled)}>
              {autoSave.enabled ? '\u2713 Auto-save on' : '  Auto-save off'}
            </MainMenuComponent.Item>
          )}
          {autoSave && <MainMenuComponent.Separator />}
          <MainMenuComponent.DefaultItems.LoadScene />
          <MainMenuComponent.DefaultItems.SaveToActiveFile />
          <MainMenuComponent.DefaultItems.Export />
          <MainMenuComponent.DefaultItems.SaveAsImage />
          <MainMenuComponent.Separator />
          <MainMenuComponent.Item onSelect={handleCopyJson}>
            Copy diagram JSON
          </MainMenuComponent.Item>
          <MainMenuComponent.Item onSelect={handlePasteJson}>
            Paste diagram JSON
          </MainMenuComponent.Item>
          <MainMenuComponent.Separator />
          <MainMenuComponent.DefaultItems.CommandPalette />
          <MainMenuComponent.DefaultItems.Help />
          <MainMenuComponent.Separator />
          <MainMenuComponent.DefaultItems.ClearCanvas />
          <MainMenuComponent.DefaultItems.ToggleTheme />
          <MainMenuComponent.DefaultItems.ChangeCanvasBackground />
        </MainMenuComponent>
      )}
    </ExcalidrawComponent>
  );
});

ExcalidrawEditor.displayName = 'ExcalidrawEditor';
export default ExcalidrawEditor;
