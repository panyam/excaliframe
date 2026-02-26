import React from 'react';
import ReactDOM from 'react-dom/client';
import ExcalidrawRenderer from '../core/ExcalidrawRenderer';
import { ForgeRendererHost } from '../hosts/forge';
import './styles.css';

const host = new ForgeRendererHost();
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<ExcalidrawRenderer host={host} />);
