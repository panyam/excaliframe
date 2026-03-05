import React from 'react';
import { CollabState, CollabActions } from './useCollaboration';

export interface CollabPanelProps {
  state: CollabState;
  actions: CollabActions;
  tool: 'excalidraw' | 'mermaid';
  currentUrl?: string;
}

const CollabPanel: React.FC<CollabPanelProps> = ({ state, actions, tool, currentUrl }) => {
  return <div data-testid="collab-panel">stub</div>;
};

export default CollabPanel;
