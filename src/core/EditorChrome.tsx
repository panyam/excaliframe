import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VERSION } from '../version';
import { EditorHost } from './types';
import { useAutoSave } from './useAutoSave';
import { CollabConfig } from '../collab/types';
import { useCollabEngine } from '../collab/useCollabEngine';
import type { CollabEngine, CollabEngineState } from '../collab/useCollabEngine';
import type { SyncAdapter } from '../collab/sync/SyncAdapter';
import type { SyncActions } from '../collab/sync/SyncAdapter';
import SharePanel from '../collab/SharePanel';
import CollabBadge from '../collab/CollabBadge';
import { resolveRelayUrl } from '../collab/url-params';
import { deriveKey } from '../collab/crypto';
import { getBrowserId } from '../collab/browserId';
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
    /** Broadcast a title change to collab peers (owner only). */
    notifyTitleChanged: (title: string) => void;
  }) => React.ReactNode;
}

/** Adapt CollabEngineState to the shape SharePanel/CollabBadge/FloatingToolbar expect. */
function engineStateToCollabState(s: CollabEngineState) {
  return {
    isConnected: s.phase === 'connected',
    isConnecting: s.phase === 'connecting',
    clientId: s.clientId,
    sessionId: s.sessionId,
    peers: s.peers as Map<string, any>,
    error: s.error,
    isOwner: s.isOwner,
    ownerClientId: s.ownerClientId,
    roomEncrypted: s.roomEncrypted,
    maxPeers: s.maxPeers,
    roomTitle: s.roomTitle,
  };
}

/** Adapt engine methods to CollabActions shape that SharePanel/FloatingToolbar expect. */
function engineToCollabActions(engine: CollabEngine, tool: string, drawingId?: string) {
  return {
    connect: (relayUrl: string, sessionId: string, username: string, isOwner: boolean = false, _drawingId?: string, encrypted: boolean = false, title: string = '') => {
      // Persist to localStorage
      localStorage.setItem('excaliframe:lastRelayUrl', relayUrl);
      if (username) localStorage.setItem('excaliframe:lastUsername', username);

      const browserId = getBrowserId();
      const effectiveDrawingId = _drawingId ?? drawingId ?? '';
      const clientHint = effectiveDrawingId ? `${browserId}:${effectiveDrawingId}` : '';

      engine.connect({
        relayUrl,
        sessionId,
        username,
        metadata: { tool },
        isOwner,
        browserId,
        clientHint,
        encrypted,
        title,
      });
    },
    disconnect: () => engine.disconnect(),
    send: (_action: Record<string, unknown>) => {
      // No-op — engine handles send internally
    },
    notifyCredentialsChanged: (reason: string) => engine.notifyCredentialsChanged(reason),
    notifyTitleChanged: (title: string) => engine.notifyTitleChanged(title),
  };
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

  // Collaboration via CollabEngine
  const [engineState, engine] = useCollabEngine();
  const collabState = useMemo(() => engineStateToCollabState(engineState), [engineState]);
  const collabActions = useMemo(() => engineToCollabActions(engine, tool, collabConfig?.drawingId), [engine, tool, collabConfig?.drawingId]);

  // Wire adapter to engine when it becomes available
  useEffect(() => {
    engine.setAdapter(syncAdapter);
  }, [engine, syncAdapter]);

  // E2EE encryption key (derived from password, cached for session duration)
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);

  const handlePasswordChange = useCallback(async (password: string | null) => {
    if (!password) {
      setEncryptionKey(null);
      return;
    }
    // sessionId may not be available yet (owner hasn't connected), derive once we have it
    // For now store the password and derive after connect
    passwordRef.current = password;
  }, []);
  const passwordRef = useRef<string | null>(null);

  // Derive key once sessionId is available (after connect)
  useEffect(() => {
    if (engineState.sessionId && passwordRef.current) {
      deriveKey(passwordRef.current, engineState.sessionId).then(setEncryptionKey);
    }
    if (engineState.phase === 'disconnected') {
      setEncryptionKey(null);
      passwordRef.current = null;
    }
  }, [engineState.sessionId, engineState.phase]);

  // Push encryption key to engine
  useEffect(() => {
    engine.setEncryptionKey(encryptionKey);
  }, [engine, encryptionKey]);

  // When a follower receives roomTitle from the relay, update the local title
  useEffect(() => {
    if (engineState.roomTitle && engineState.phase === 'connected' && !engineState.isOwner) {
      host.setTitle?.(engineState.roomTitle);
    }
  }, [engineState.roomTitle, engineState.phase, engineState.isOwner, host]);

  // localStorage side effects for session tracking
  useEffect(() => {
    const drawingId = collabConfig?.drawingId;
    if (engineState.sessionId && drawingId) {
      localStorage.setItem(`excaliframe:sessionDrawing:${engineState.sessionId}`, drawingId);
      if (engineState.isOwner) {
        localStorage.setItem(`excaliframe:activeSession:${drawingId}`, engineState.sessionId);
      }
    }
  }, [engineState.sessionId, engineState.isOwner, collabConfig?.drawingId]);

  // Clean up localStorage on disconnect
  const prevSessionRef = useRef<string>('');
  useEffect(() => {
    if (engineState.phase === 'disconnected' && prevSessionRef.current) {
      const sid = prevSessionRef.current;
      localStorage.removeItem(`excaliframe:sessionDrawing:${sid}`);
      localStorage.removeItem(`excaliframe:sessionPassword:${sid}`);
      if (collabConfig?.drawingId && engineState.isOwner) {
        localStorage.removeItem(`excaliframe:activeSession:${collabConfig.drawingId}`);
      }
      prevSessionRef.current = '';
    }
    if (engineState.sessionId) {
      prevSessionRef.current = engineState.sessionId;
    }
  }, [engineState.phase, engineState.sessionId, engineState.isOwner, collabConfig?.drawingId]);

  // Collab panel state
  const [showCollabPanel, setShowCollabPanel] = useState(!!collabConfig?.initialRelayUrl);

  // Auto-connect as follower when collabConfig.autoJoin is set
  useEffect(() => {
    if (collabConfig?.autoJoin && engineState.phase === 'disconnected') {
      const relayUrl = collabConfig.autoJoinRelayUrl || '/relay';
      const sessionId = collabConfig.autoJoinSessionId || '';
      // Check for password in sessionStorage (set by JoinPage for encrypted rooms)
      // or localStorage (set by owner's other tabs)
      const storedPassword = sessionId
        ? (sessionStorage.getItem(`excaliframe:joinPassword:${sessionId}`)
           || localStorage.getItem(`excaliframe:sessionPassword:${sessionId}`))
        : null;
      if (storedPassword) {
        passwordRef.current = storedPassword;
        // Clean up sessionStorage (one-time use)
        if (sessionId) sessionStorage.removeItem(`excaliframe:joinPassword:${sessionId}`);
      }
      const encrypted = !!storedPassword;
      collabActions.connect(resolveRelayUrl(relayUrl), sessionId, '', false, collabConfig.drawingId, encrypted);
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

  // SyncActions for editors — thin wrapper around engine
  const syncActions = useMemo<SyncActions>(() => ({
    notifyLocalChange: () => engine.notifyLocalChange(),
    notifyCursorMove: () => engine.notifyCursorMove(),
    handleEvent: () => {}, // no-op — engine handles events internally
  }), [engine]);

  const toolLabel = tool === 'mermaid' ? 'Mermaid' : 'Excalidraw';
  const childContent = children({
    ref: editorRef,
    stateCallbacks,
    syncActions,
    autoSave: { enabled: autoSaveEnabled, setEnabled: setAutoSaveEnabled },
    notifyTitleChanged: collabActions.notifyTitleChanged,
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
            {!!collabConfig && <CollabBadge state={collabState} onClick={() => setShowCollabPanel(!showCollabPanel)} />}
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
        {!!collabConfig && showCollabPanel && (
          <SharePanel state={collabState} actions={collabActions} tool={tool}
            drawingId={collabConfig.drawingId} onClose={() => setShowCollabPanel(false)}
            onPasswordChange={handlePasswordChange} title={host.getTitle?.() ?? ''} />
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
        onPasswordChange={handlePasswordChange}
        title={host.getTitle?.() ?? ''}
        collabEnabled={!!collabConfig}
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
