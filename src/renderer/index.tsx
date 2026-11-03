import React from 'react';
import ReactDOM from 'react-dom/client';
import { view } from '@forge/bridge';
import ExcalidrawRenderer from '../core/ExcalidrawRenderer';
import { ForgeRendererHost } from '../hosts/forge';
import './styles.css';

function toolFromModuleKey(moduleKey: string): 'excalidraw' | 'mermaid' {
  if (moduleKey === 'mermaid-macro') return 'mermaid';
  return 'excalidraw';
}

(async () => {
  const context = await view.getContext();
  const moduleKey = (context as any).moduleKey || '';
  const tool = toolFromModuleKey(moduleKey);

  const host = new ForgeRendererHost(tool);
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(<ExcalidrawRenderer host={host} tool={tool} />);
})();
