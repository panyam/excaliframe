import React from 'react';
import ReactDOM from 'react-dom/client';
import DrawingTitle from '@excaliframe/core/DrawingTitle';
import { EditorHost } from '@excaliframe/core/types';
import { WebEditorHost } from '@excaliframe/hosts/web';
import { PlaygroundStore } from '@excaliframe/hosts/playground-store';
import './styles.css';

declare global {
  interface Window {
    PLAYGROUND_DRAWING_ID?: string;
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

type EditorComponent = React.FC<{ host: EditorHost; showCancel?: boolean }>;

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

const drawingId = window.PLAYGROUND_DRAWING_ID;
if (!drawingId) {
  window.location.href = '/playground/';
} else {
  const store = new PlaygroundStore();
  const host = new WebEditorHost(drawingId, store);

  // Load drawing first to get the tool type, then dynamically import the editor
  host.loadDrawing().then(async (envelope) => {
    const tool = envelope?.tool || 'excalidraw';
    const Editor = await loadEditor(tool);

    const root = ReactDOM.createRoot(document.getElementById('playground-root')!);
    root.render(<Editor host={host} showCancel={false} />);

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
