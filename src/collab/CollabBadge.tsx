import React from 'react';
import { CollabState } from './useCollaboration';

export interface CollabBadgeProps {
  state: CollabState;
  onClick?: () => void;
}

const CollabBadge: React.FC<CollabBadgeProps> = ({ state, onClick }) => {
  return <div data-testid="collab-badge">stub</div>;
};

export default CollabBadge;
