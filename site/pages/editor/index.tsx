import React from 'react';
import ReactDOM from 'react-dom/client';
import DrawingTitle from '@excaliframe/core/DrawingTitle';
import { EditorHost } from '@excaliframe/core/types';
import { WebEditorHost } from '@excaliframe/hosts/web';
import { PlaygroundStore } from '@excaliframe/hosts/playground-store';
import { parseConnectParam } from '@excaliframe/collab/url-params';
import { getBrowserId } from '@excaliframe/collab/browserId';
import { CollabConfig } from '@excaliframe/collab/types';
import './styles.css';

declare global {
  interface Window {
    PLAYGROUND_DRAWING_ID?: string;
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

type EditorComponent = React.FC<{ host: EditorHost; showCancel?: boolean; collabConfig?: CollabConfig }>;

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

  // Check same-origin auto-connect: owner stores sessionId in localStorage
  const activeSessionId = (!autoJoinParam && !connectRelay)
    ? findActiveSession(drawingId)
    : null;

  // Load drawing first to get the tool type, then dynamically import the editor
  host.loadDrawing().then(async (envelope) => {
    const tool = envelope?.tool || params.get('tool') || 'excalidraw';
    const Editor = await loadEditor(tool);

    const collabConfig: CollabConfig = {
      drawingId,
      initialRelayUrl: connectRelay || undefined,
    };

    // Auto-join from /join/<code> redirect
    if (autoJoinParam) {
      collabConfig.autoJoin = true;
      collabConfig.autoJoinRelayUrl = relayParam || '/relay';
      collabConfig.autoJoinSessionId = params.get('session') || undefined;
    }
    // Same-origin auto-connect: owner wrote sessionId to localStorage
    else if (activeSessionId) {
      collabConfig.autoJoin = true;
      collabConfig.autoJoinRelayUrl = '/relay';
      collabConfig.autoJoinSessionId = activeSessionId;
    }

    const root = ReactDOM.createRoot(document.getElementById('playground-root')!);
    root.render(<Editor host={host} showCancel={false} collabConfig={collabConfig} />);

    // Render editable title into the header slot (injected by PlaygroundEditPage.html)
    const titleSlot = document.getElementById('drawing-title-slot');
    if (titleSlot) {
      const titleRoot = ReactDOM.createRoot(titleSlot);
      titleRoot.render(
        <DrawingTitle
          initialTitle={host.getTitle()}
          onRename={(t) => host.setTitle(t)}
        />
      );
    }
  });
}
