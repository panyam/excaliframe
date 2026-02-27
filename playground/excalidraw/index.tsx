import React from 'react';
import ReactDOM from 'react-dom/client';
import ExcalidrawEditor from '../../src/core/ExcalidrawEditor';
import { WebEditorHost } from '../../src/hosts/web';
import { PlaygroundStore } from '../../src/hosts/playground-store';
import '@excalidraw/excalidraw/index.css';
import './styles.css';

declare global {
  interface Window {
    PLAYGROUND_DRAWING_ID?: string;
  }
}

const drawingId = window.PLAYGROUND_DRAWING_ID;
if (!drawingId) {
  window.location.href = '/playground/';
} else {
  const store = new PlaygroundStore();
  const host = new WebEditorHost(drawingId, store);
  const root = ReactDOM.createRoot(document.getElementById('playground-root')!);
  root.render(<ExcalidrawEditor host={host} />);
}
