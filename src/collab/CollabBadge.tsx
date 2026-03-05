import React from 'react';
import { CollabState } from './useCollaboration';

export interface CollabBadgeProps {
  state: CollabState;
  onClick?: () => void;
}

const CollabBadge: React.FC<CollabBadgeProps> = ({ state, onClick }) => {
  const { isConnected, isConnecting, error, peers } = state;

  // Render nothing when disconnected with no error
  if (!isConnected && !isConnecting && !error) return null;

  let label = '';
  if (error) {
    label = error;
  } else if (isConnecting) {
    label = 'Connecting...';
  } else if (isConnected) {
    const count = peers.size;
    label = `${count} peer${count !== 1 ? 's' : ''}`;
  }

  return (
    <div data-testid="collab-badge" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {label}
    </div>
  );
};

export default CollabBadge;
