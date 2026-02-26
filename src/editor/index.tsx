import React from 'react';
import ReactDOM from 'react-dom/client';
import ExcalidrawEditor from '../core/ExcalidrawEditor';
import { ForgeEditorHost } from '../hosts/forge';
import '@excalidraw/excalidraw/index.css';
import './styles.css';

// EXCALIDRAW_ASSET_PATH is set in index.html before this script loads

const host = new ForgeEditorHost();
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<ExcalidrawEditor host={host} />);
