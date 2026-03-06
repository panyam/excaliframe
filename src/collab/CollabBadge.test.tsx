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
  it('renders people icon button when disconnected', () => {
    render(<CollabBadge state={makeState()} />);
    const badge = screen.getByTestId('collab-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('title')).toBe('Collaborate');
  });

  it('renders connecting indicator', () => {
    render(<CollabBadge state={makeState({ isConnecting: true })} />);
    const badge = screen.getByTestId('collab-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('title')).toBe('Connecting...');
  });

  it('renders peer count when connected', () => {
    const peers = new Map<string, PeerInfo>();
    peers.set('c1', { clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);
    peers.set('c2', { clientId: 'c2', username: 'Bob', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);

    render(<CollabBadge state={makeState({ isConnected: true, clientId: 'c1', peers })} />);
    const badge = screen.getByTestId('collab-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('title')).toBe('2 peers');
    expect(badge.textContent).toContain('2');
  });

  it('shows singular "1 peer" title for single peer', () => {
    const peers = new Map<string, PeerInfo>();
    peers.set('c1', { clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);

    render(<CollabBadge state={makeState({ isConnected: true, clientId: 'c1', peers })} />);
    expect(screen.getByTestId('collab-badge').getAttribute('title')).toBe('1 peer');
  });

  it('shows error state with title', () => {
    render(<CollabBadge state={makeState({ error: 'Connection failed' })} />);
    const badge = screen.getByTestId('collab-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('title')).toBe('Connection failed');
  });

  it('calls onClick when badge is clicked', () => {
    const onClick = vi.fn();
    render(<CollabBadge state={makeState()} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('collab-badge'));
    expect(onClick).toHaveBeenCalled();
  });
});
