import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CollabBadge from './CollabBadge';
import type { CollabState } from './useCollaboration';
import type { PeerInfo } from './types';

function makeState(overrides: Partial<CollabState> = {}): CollabState {
  return {
    isConnected: false,
    isConnecting: false,
    clientId: '',
    peers: new Map(),
    error: null,
    ...overrides,
  };
}

describe('CollabBadge', () => {
  it('renders nothing for disconnected state by default', () => {
    const { container } = render(<CollabBadge state={makeState()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders indicator for connecting state', () => {
    render(<CollabBadge state={makeState({ isConnecting: true })} />);
    const badge = screen.getByTestId('collab-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/connecting/i);
  });

  it('renders badge with peer count for connected state', () => {
    const peers = new Map<string, PeerInfo>();
    peers.set('c1', { clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);
    peers.set('c2', { clientId: 'c2', username: 'Bob', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);

    render(<CollabBadge state={makeState({ isConnected: true, clientId: 'c1', peers })} />);
    const badge = screen.getByTestId('collab-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/2 peers/i);
  });

  it('shows singular "1 peer" for single peer', () => {
    const peers = new Map<string, PeerInfo>();
    peers.set('c1', { clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);

    render(<CollabBadge state={makeState({ isConnected: true, clientId: 'c1', peers })} />);
    expect(screen.getByTestId('collab-badge').textContent).toMatch(/1 peer\b/i);
  });

  it('renders badge with error message for error state', () => {
    render(<CollabBadge state={makeState({ error: 'Connection failed' })} />);
    const badge = screen.getByTestId('collab-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/connection failed/i);
  });

  it('calls onClick when badge is clicked', () => {
    const onClick = vi.fn();
    render(<CollabBadge state={makeState({ isConnecting: true })} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('collab-badge'));
    expect(onClick).toHaveBeenCalled();
  });
});
