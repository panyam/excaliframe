import React from 'react';
import ReactDOM from 'react-dom/client';
import DrawingTitle from '@excaliframe/core/DrawingTitle';
import { EditorHost } from '@excaliframe/core/types';
import EditorChrome from '@excaliframe/core/EditorChrome';
import { WebEditorHost } from '@excaliframe/hosts/web';
import { PlaygroundStore } from '@excaliframe/hosts/playground-store';
import { parseConnectParam } from '@excaliframe/collab/url-params';
import { getBrowserId } from '@excaliframe/collab/browserId';
import { CollabConfig } from '@excaliframe/collab/types';
import type { EditorHandle, EditorStateCallbacks } from '@excaliframe/core/EditorHandle';
import type { SyncActions } from '@excaliframe/collab/sync/SyncAdapter';
import './styles.css';

declare global {
  interface Window {
    PLAYGROUND_DRAWING_ID?: string;
    EXCALIDRAW_ASSET_PATH?: string;
    ENABLE_SHARING?: boolean;
  }
}

type EditorComponent = React.ForwardRefExoticComponent<
  {
    host: EditorHost;
    syncActions: SyncActions | null;
    stateCallbacks: EditorStateCallbacks;
    autoSave?: { enabled: boolean; setEnabled: (v: boolean) => void };
  } & React.RefAttributes<EditorHandle>
>;

/** Dynamically import the correct editor based on drawing tool. */
async function loadEditor(tool: string): Promise<EditorComponent> {
  switch (tool) {
    case 'mermaid': {
      const mod = await import(/* webpackChunkName: "mermaid-editor" */ './mermaid-boot');
      return mod.default;
    }
    case 'excalidraw':
    default: {
      const mod = await import(/* webpackChunkName: "excalidraw-editor" */ './excalidraw-boot');
      return mod.default;
    }
  }
}

/** Check if there's an active sharing session for this drawing.
 *  Uses localStorage (shared across same-origin tabs) where the owner
 *  stores the relay-generated sessionId after starting a share. */
function findActiveSession(drawingId: string): string | null {
  return localStorage.getItem(`excaliframe:activeSession:${drawingId}`);
}

/** Validate that a room actually exists on the relay before auto-connecting.
 *  Clears stale localStorage entry if the room is gone (e.g. after server restart). */
async function validateRoom(drawingId: string, sessionId: string): Promise<boolean> {
  try {
    const resp = await fetch(`/relay/api/v1/rooms/${sessionId}`);
    if (!resp.ok) {
      localStorage.removeItem(`excaliframe:activeSession:${drawingId}`);
      return false;
    }
    const data = await resp.json();
    if (!data.peers || data.peers.length === 0) {
      localStorage.removeItem(`excaliframe:activeSession:${drawingId}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const drawingId = window.PLAYGROUND_DRAWING_ID;
if (!drawingId) {
  window.location.href = '/';
} else {
  const store = new PlaygroundStore();
  const host = new WebEditorHost(drawingId, store);

  // Parse ?connect=<relay-url> — auto-opens dialog (but doesn't auto-connect)
  const connectRelay = parseConnectParam(window.location.search);

  // Parse ?autoJoin=1&relay=<url> — from /join/<code> redirect
  const params = new URLSearchParams(window.location.search);
  const autoJoinParam = params.get('autoJoin') === '1';
  const relayParam = params.get('relay');

  // Load drawing first to get the tool type, then dynamically import the editor
  host.loadDrawing().then(async (envelope) => {
    const tool = (envelope?.tool || params.get('tool') || 'excalidraw') as 'excalidraw' | 'mermaid';
    const titleParam = params.get('title');
    if (titleParam) {
      await host.setTitle(titleParam);
    }
    const Editor = await loadEditor(tool);

    let collabConfig: CollabConfig | undefined;
    if (window.ENABLE_SHARING) {
      collabConfig = {
        drawingId,
        initialRelayUrl: connectRelay || undefined,
      };

      // Auto-join from /join/<code> redirect
      if (autoJoinParam) {
        collabConfig.autoJoin = true;
        collabConfig.autoJoinRelayUrl = relayParam || '/relay';
        collabConfig.autoJoinSessionId = params.get('session') || undefined;
      }
      // Same-origin auto-connect: validate room is still alive before joining
      else if (!connectRelay) {
        const activeSessionId = findActiveSession(drawingId);
        if (activeSessionId && await validateRoom(drawingId, activeSessionId)) {
          collabConfig.autoJoin = true;
          collabConfig.autoJoinRelayUrl = '/relay';
          collabConfig.autoJoinSessionId = activeSessionId;
        }
      }
    }

    // Capture notifyTitleChanged from EditorChrome for use in DrawingTitle
    let notifyTitleChanged: ((title: string) => void) | null = null;

    const root = ReactDOM.createRoot(document.getElementById('playground-root')!);
    root.render(
      <EditorChrome host={host} tool={tool} showCancel={false} collabConfig={collabConfig}>
        {(props) => {
          notifyTitleChanged = props.notifyTitleChanged;
          return <Editor ref={props.ref} host={host} syncActions={props.syncActions}
            stateCallbacks={props.stateCallbacks} autoSave={props.autoSave} />;
        }}
      </EditorChrome>
    );

    // Render editable title into the header slot (injected by PlaygroundEditPage.html)
    const titleSlot = document.getElementById('drawing-title-slot');
    if (titleSlot) {
      const titleRoot = ReactDOM.createRoot(titleSlot);
      titleRoot.render(
        <DrawingTitle
          initialTitle={host.getTitle()}
          onRename={(t) => {
            host.setTitle(t);
            notifyTitleChanged?.(t);
          }}
        />
      );
    }
  });
}
