import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { exportToCanvas, hashElementsVersion } from '@excalidraw/excalidraw';
import { VERSION, BUILD_DATE } from '../version';
import { EditorHost, DrawingEnvelope, ExcalidrawDrawingData } from './types';
import { useAutoSave, AutoSaveStatus } from './useAutoSave';
import { CollabConfig } from '../collab/types';
import { useCollaboration } from '../collab/useCollaboration';
import { useSync } from '../collab/sync/useSync';
import { ExcalidrawSyncAdapter } from '../collab/adapters/ExcalidrawSyncAdapter';
import type { SyncActions, SyncConnection } from '../collab/sync/SyncAdapter';
import SharePanel from '../collab/SharePanel';
import CollabBadge from '../collab/CollabBadge';
import { resolveRelayUrl } from '../collab/url-params';

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
  updateScene: (scene: { elements?: readonly ExcalidrawElement[]; appState?: Partial<AppState> }) => void;
  addFiles: (files: any[]) => void;
}

interface Props {
  host: EditorHost;
  /** Show the Cancel button and top toolbar. Default true (Forge mode).
   *  When false, Save is in the MainMenu + Cmd/Ctrl+S, no toolbar. */
  showCancel?: boolean;
  /** Optional collab config — opt-in collaboration via dialog. */
  collabConfig?: CollabConfig;
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

const ExcalidrawEditor: React.FC<Props> = ({ host, showCancel = true, collabConfig }) => {
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

      // Generate PNG preview
      let preview = '';
      if (elements.length > 0) {
        try {
          const canvas = await exportToCanvas({
            elements,
            appState: {
              ...appState,
              exportBackground: true,
            },
            files,
          });
          preview = canvas.toDataURL('image/png');
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
        updatedAt: now,
      };

      console.log('Editor - Saving envelope, elements:', elements.length);
      await host.saveDrawing(envelope);
      console.log('Editor - Save complete');
      setIsSaving(false);
      setIsDirty(false);
      initialFingerprintRef.current = fingerprint(elements);

    } catch (error) {
      console.error('Editor - Error saving:', error);
      alert('Failed to save drawing. Please try again.');
      setIsSaving(false);
    }
  }, [isSaving, host]);

  const handleCancel = useCallback((): void => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    host.close();
  }, [isDirty, host]);

  // Track changes to detect dirty state + notify sync engine.
  // Uses fingerprint() to compare only user-visible properties, ignoring
  // Excalidraw's internal versioning fields (version, versionNonce, updated, seed)
  // that mutate on every scene update even without user interaction.
  // Refs keep this callback stable (Excalidraw re-renders on callback identity change).
  const syncAdapterRef = useRef<ExcalidrawSyncAdapter | null>(null);
  const syncActionsRef = useRef<SyncActions | null>(null);
  const lastNotifiedHash = useRef<number>(0);

  const handleChange = useCallback((elements: readonly ExcalidrawElement[]): void => {
    setIsDirty(fingerprint(elements) !== initialFingerprintRef.current);
    const adapter = syncAdapterRef.current;
    if (adapter && !adapter.isApplyingRemote) {
      // Gate on element hash — Excalidraw fires onChange for selections,
      // cursor moves, zoom, etc. which would keep resetting the debounce
      // timer and prevent outgoing updates from ever being sent.
      const hash = hashElementsVersion(elements);
      if (hash !== lastNotifiedHash.current) {
        console.log('[EXCAL] Element hash changed: %d → %d, notifying sync', lastNotifiedHash.current, hash);
        lastNotifiedHash.current = hash;
        syncActionsRef.current?.notifyLocalChange();
      }
    }
  }, []);

  const { autoSaveEnabled, setAutoSaveEnabled, autoSaveStatus } = useAutoSave({
    isDirty,
    isSaving,
    canAutoSave: !showCancel,
    onSave: saveDrawing,
  });

  // Collaboration — ref-based bridge so useSync and useCollaboration don't know about each other
  const onCollabEvent = useCallback((event: any) => {
    syncActionsRef.current?.handleEvent(event);
  }, []);
  const [collabState, collabActions] = useCollaboration('excalidraw', onCollabEvent);

  // Sync adapter — created once when Excalidraw API becomes available
  const [syncAdapter, setSyncAdapter] = useState<ExcalidrawSyncAdapter | null>(null);

  const syncConnection = useMemo<SyncConnection>(() => ({
    isConnected: collabState.isConnected,
    clientId: collabState.clientId,
    isOwner: collabState.isOwner,
    peers: collabState.peers,
    send: collabActions.send,
  }), [collabState.isConnected, collabState.clientId, collabState.isOwner, collabState.peers, collabActions.send]);

  const [, syncActions] = useSync(syncAdapter, syncConnection);
  syncActionsRef.current = syncActions;

  // Auto-open panel if ?connect= param was provided (but don't auto-connect)
  const [showCollabPanel, setShowCollabPanel] = useState(!!collabConfig?.initialRelayUrl);

  // Auto-connect as follower when collabConfig.autoJoin is set
  useEffect(() => {
    if (collabConfig?.autoJoin && !collabState.isConnected && !collabState.isConnecting) {
      const relayUrl = collabConfig.autoJoinRelayUrl || '/relay';
      const sessionId = collabConfig.autoJoinSessionId || '';
      collabActions.connect(resolveRelayUrl(relayUrl), sessionId, '', false, collabConfig.drawingId);
    }
  }, [collabConfig?.autoJoin]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveDrawing();
        return;
      }

      // ESC to cancel (only when toolbar is shown)
      if (showCancel && e.key === 'Escape') {
        const appState = excalidrawApiRef.current?.getAppState();
        if (appState?.openMenu || appState?.openPopup || appState?.isResizing ||
            appState?.isRotating || appState?.draggingElement || appState?.editingElement) {
          return; // Let Excalidraw handle ESC
        }
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleCancel, saveDrawing, showCancel]);

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
      <div className="flex flex-col justify-center items-center h-full bg-white dark:bg-gray-900 gap-4">
        <div className="w-12 h-12 border-[3px] border-gray-100 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin" />
        <div className="text-gray-800 dark:text-gray-200 text-base font-medium">
          Loading Excalidraw...
        </div>
      </div>
    );
  }

  const excalidrawCanvas = (
    <ExcalidrawComponent
      excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
        excalidrawApiRef.current = api;
        if (!syncAdapterRef.current) {
          const adapter = new ExcalidrawSyncAdapter(api);
          syncAdapterRef.current = adapter;
          setSyncAdapter(adapter);
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
      theme="light"
      UIOptions={{
        canvasActions: {
          loadScene: false,
        },
      }}
    >
      {MainMenuComponent && (
        <MainMenuComponent>
          {!showCancel && (
            <MainMenuComponent.Item onSelect={saveDrawing}>
              {isSaving ? 'Saving...' : isDirty ? 'Save *' : 'Save'}
            </MainMenuComponent.Item>
          )}
          {!showCancel && (
            <MainMenuComponent.Item onSelect={() => setAutoSaveEnabled(!autoSaveEnabled)}>
              {autoSaveEnabled ? '\u2713 Auto-save on' : '  Auto-save off'}
            </MainMenuComponent.Item>
          )}
          {!showCancel && <MainMenuComponent.Separator />}
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

  // Toolbar mode (Forge): top bar with Save + Cancel
  if (showCancel) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#f4f5f7',
          borderBottom: '1px solid #dfe1e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>Excalidraw</h3>
            <span style={{ fontSize: '11px', color: '#6b778c' }}>v{VERSION}</span>
            {isDirty && (
              <span style={{ fontSize: '11px', color: '#de350b', fontWeight: 500 }}>
                • Unsaved changes
              </span>
            )}
            <CollabBadge state={collabState} onClick={() => setShowCollabPanel(!showCollabPanel)} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              style={{
                padding: '6px 12px',
                backgroundColor: '#fff',
                border: '1px solid #dfe1e6',
                borderRadius: '3px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveDrawing}
              disabled={isSaving}
              style={{
                padding: '6px 12px',
                backgroundColor: isSaving ? '#84bef7' : '#0052cc',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {showCollabPanel && (
          <SharePanel state={collabState} actions={collabActions} tool="excalidraw"
            drawingId={collabConfig?.drawingId ?? ''} onClose={() => setShowCollabPanel(false)} />
        )}
        <div style={{ flex: 1, width: '100%', height: '100%' }} className="excalidraw-wrapper">
          {excalidrawCanvas}
        </div>
      </div>
    );
  }

  // No-toolbar mode (web/playground): Save in MainMenu + Cmd/Ctrl+S, floating dirty badge
  return (
    <div className="h-full w-full relative bg-white dark:bg-gray-900">
      <div className="w-full h-full excalidraw-wrapper">
        {excalidrawCanvas}
      </div>
      <div className="fixed bottom-4 right-4 z-[1000] flex flex-col items-end gap-2">
        {showCollabPanel && (
          <div className="bg-white/95 dark:bg-gray-800/95 rounded-lg p-3 shadow-lg min-w-[280px]">
            <SharePanel state={collabState} actions={collabActions} tool="excalidraw"
            drawingId={collabConfig?.drawingId ?? ''} onClose={() => setShowCollabPanel(false)} />
          </div>
        )}
        <CollabBadge state={collabState} onClick={() => setShowCollabPanel(!showCollabPanel)} />
      </div>
      {(() => {
        let badgeText: string | null = null;
        let badgeBg = 'rgba(222, 53, 11, 0.9)';

        if (autoSaveStatus === 'saved') {
          badgeText = 'Saved';
          badgeBg = 'rgba(0, 135, 90, 0.9)';
        } else if (autoSaveStatus === 'saving') {
          badgeText = 'Saving\u2026';
          badgeBg = 'rgba(0, 82, 204, 0.9)';
        } else if (isDirty && autoSaveEnabled) {
          badgeText = 'Auto-saving\u2026';
          badgeBg = 'rgba(255, 171, 0, 0.9)';
        } else if (isDirty) {
          badgeText = 'Unsaved changes \u2014 \u2318S to save';
        }

        return badgeText ? (
          <div className="fixed bottom-4 left-4 px-3.5 py-1.5 text-white rounded-full text-xs font-medium z-[1000] pointer-events-none shadow-md"
            style={{ backgroundColor: badgeBg }}>
            {badgeText}
          </div>
        ) : null;
      })()}
    </div>
  );
};

export default ExcalidrawEditor;
