import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VERSION } from '../version';
import { EditorHost } from './types';
import { useAutoSave } from './useAutoSave';
import { CollabConfig } from '../collab/types';
import { useCollaboration } from '../collab/useCollaboration';
import { useSync } from '../collab/sync/useSync';
import type { SyncAdapter, SyncActions, SyncConnection } from '../collab/sync/SyncAdapter';
import SharePanel from '../collab/SharePanel';
import CollabBadge from '../collab/CollabBadge';
import { resolveRelayUrl } from '../collab/url-params';
import type { EditorHandle, EditorStateCallbacks } from './EditorHandle';
import FloatingToolbar from './FloatingToolbar';
import type { ToolbarPosition } from './FloatingToolbar';
import SaveToast from './SaveToast';
import type { ToastPosition } from './SaveToast';

const OPPOSITE_HORIZONTAL: Record<ToolbarPosition, ToastPosition> = {
  'bottom-right': 'bottom-left',
  'bottom-left': 'bottom-right',
  'top-right': 'top-left',
  'top-left': 'top-right',
};

export interface EditorChromeProps {
  host: EditorHost;
  tool: 'excalidraw' | 'mermaid';
  showCancel?: boolean;
  collabConfig?: CollabConfig;
  /** Position of the floating toolbar in web mode. Default 'bottom-right'. */
  toolbarPosition?: ToolbarPosition;
  children: (props: {
    ref: React.Ref<EditorHandle>;
    stateCallbacks: EditorStateCallbacks;
    syncActions: SyncActions | null;
    autoSave: { enabled: boolean; setEnabled: (v: boolean) => void };
  }) => React.ReactNode;
}

const EditorChrome: React.FC<EditorChromeProps> = ({
  host,
  tool,
  showCancel = true,
  collabConfig,
  toolbarPosition = 'bottom-right',
  children,
}) => {
  const editorRef = useRef<EditorHandle>(null);

  // State lifted from editors
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncAdapter, setSyncAdapter] = useState<SyncAdapter | null>(null);

  // Auto-save
  const handleSave = useCallback(async () => {
    await editorRef.current?.save();
  }, []);

  const { autoSaveEnabled, setAutoSaveEnabled, autoSaveStatus } = useAutoSave({
    isDirty,
    isSaving,
    canAutoSave: !showCancel,
    onSave: handleSave,
  });

  // Collaboration
  const syncActionsRef = useRef<SyncActions | null>(null);
  const onCollabEvent = useCallback((event: any) => {
    syncActionsRef.current?.handleEvent(event);
  }, []);
  const [collabState, collabActions] = useCollaboration(tool, onCollabEvent);

  const syncConnection = useMemo<SyncConnection>(() => ({
    isConnected: collabState.isConnected,
    clientId: collabState.clientId,
    isOwner: collabState.isOwner,
    peers: collabState.peers,
    send: collabActions.send,
  }), [collabState.isConnected, collabState.clientId, collabState.isOwner, collabState.peers, collabActions.send]);

  const [, syncActions] = useSync(syncAdapter, syncConnection);
  syncActionsRef.current = syncActions;

  // Collab panel state
  const [showCollabPanel, setShowCollabPanel] = useState(!!collabConfig?.initialRelayUrl);

  // Auto-connect as follower when collabConfig.autoJoin is set
  useEffect(() => {
    if (collabConfig?.autoJoin && !collabState.isConnected && !collabState.isConnecting) {
      const relayUrl = collabConfig.autoJoinRelayUrl || '/relay';
      const sessionId = collabConfig.autoJoinSessionId || '';
      collabActions.connect(resolveRelayUrl(relayUrl), sessionId, '', false, collabConfig.drawingId);
    }
  }, [collabConfig?.autoJoin]);

  // Cancel with dirty guard
  const handleCancel = useCallback((): void => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    host.close();
  }, [isDirty, host]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        editorRef.current?.save();
        return;
      }

      // ESC to cancel (only when toolbar is shown)
      if (showCancel && e.key === 'Escape') {
        // Let the editor decide if ESC should be handled (e.g. Excalidraw modal open)
        if (editorRef.current?.canClose?.() === false) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleCancel, showCancel]);

  // State callbacks passed to editors
  const stateCallbacks = useMemo<EditorStateCallbacks>(() => ({
    onDirtyChange: setIsDirty,
    onSavingChange: setIsSaving,
    onSyncAdapterReady: setSyncAdapter,
  }), []);

  const toolLabel = tool === 'mermaid' ? 'Mermaid' : 'Excalidraw';
  const childContent = children({
    ref: editorRef,
    stateCallbacks,
    syncActions,
    autoSave: { enabled: autoSaveEnabled, setEnabled: setAutoSaveEnabled },
  });

  // Forge toolbar layout
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
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>{toolLabel}</h3>
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
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '6px 12px',
                backgroundColor: isSaving ? '#84bef7' : '#0052cc',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {showCollabPanel && (
          <SharePanel state={collabState} actions={collabActions} tool={tool}
            drawingId={collabConfig?.drawingId ?? ''} onClose={() => setShowCollabPanel(false)} />
        )}
        <div style={{ flex: 1, overflow: 'hidden', width: '100%', height: '100%' }}
          className={tool === 'excalidraw' ? 'excalidraw-wrapper' : undefined}>
          {childContent}
        </div>
      </div>
    );
  }

  // Web/playground floating layout
  const toastPosition = OPPOSITE_HORIZONTAL[toolbarPosition];

  return (
    <div className="h-full w-full relative bg-white dark:bg-gray-900">
      <div className={`w-full h-full ${tool === 'excalidraw' ? 'excalidraw-wrapper' : ''}`}>
        {childContent}
      </div>
      <FloatingToolbar
        position={toolbarPosition}
        onSave={handleSave}
        isSaving={isSaving}
        autoSaveEnabled={autoSaveEnabled}
        onAutoSaveChange={setAutoSaveEnabled}
        collabState={collabState}
        collabActions={collabActions}
        tool={tool}
        drawingId={collabConfig?.drawingId ?? ''}
      />
      <SaveToast
        status={autoSaveStatus}
        isDirty={isDirty}
        autoSaveEnabled={autoSaveEnabled}
        position={toastPosition}
      />
    </div>
  );
};

export default EditorChrome;
