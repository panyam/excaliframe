import React from 'react';
import ReactDOM from 'react-dom/client';
import ExcalidrawEditor from './ExcalidrawEditor';
import '@excalidraw/excalidraw/index.css';
import './styles.css';

// EXCALIDRAW_ASSET_PATH is set in index.html before this script loads

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<ExcalidrawEditor />);
