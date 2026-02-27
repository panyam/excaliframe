import React from 'react';
import ReactDOM from 'react-dom/client';
import { view } from '@forge/bridge';
import { EditorHost } from '../core/types';
import { ForgeEditorHost } from '../hosts/forge';
import './styles.css';

// EXCALIDRAW_ASSET_PATH is set in index.html before this script loads

type EditorComponent = React.FC<{ host: EditorHost; showCancel?: boolean }>;

/** Map Forge moduleKey to tool name. */
function toolFromModuleKey(moduleKey: string): string {
  if (moduleKey === 'mermaid-macro') return 'mermaid';
  return 'excalidraw';
}

/** Dynamically import the correct editor based on tool. */
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

(async () => {
  const context = await view.getContext();
  const moduleKey = (context as any).extension?.moduleKey || '';
  const tool = toolFromModuleKey(moduleKey);

  const host = new ForgeEditorHost(tool);
  const Editor = await loadEditor(tool);

  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(<Editor host={host} />);
})();
