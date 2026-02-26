import React from 'react';
import ReactDOM from 'react-dom/client';
import ExcalidrawEditor from '../../src/core/ExcalidrawEditor';
import { WebEditorHost } from '../../src/hosts/web';
import '@excalidraw/excalidraw/index.css';
import './styles.css';

const host = new WebEditorHost();
const root = ReactDOM.createRoot(document.getElementById('playground-root')!);
root.render(<ExcalidrawEditor host={host} />);
