import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CollabPanel from './CollabPanel';
import type { CollabState, CollabActions } from './useCollaboration';
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

function makeActions(overrides: Partial<CollabActions> = {}): CollabActions {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    ...overrides,
  };
}

describe('CollabPanel', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders relay URL input', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);
    expect(screen.getByPlaceholderText(/relay/i)).toBeInTheDocument();
  });

  it('renders session ID input', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);
    expect(screen.getByPlaceholderText(/session/i)).toBeInTheDocument();
  });

  it('renders username input', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);
    expect(screen.getByPlaceholderText(/name|user/i)).toBeInTheDocument();
  });

  it('renders Connect button when disconnected', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('renders Disconnect button when connected', () => {
    render(<CollabPanel state={makeState({ isConnected: true, clientId: 'c1' })} actions={makeActions()} tool="excalidraw" />);
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('renders Generate button for session ID', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  it('Connect button calls connect with form values', () => {
    const connect = vi.fn();
    render(<CollabPanel state={makeState()} actions={makeActions({ connect })} tool="excalidraw" />);

    fireEvent.change(screen.getByPlaceholderText(/relay/i), { target: { value: 'ws://localhost:8787' } });
    fireEvent.change(screen.getByPlaceholderText(/session/i), { target: { value: 'sess1' } });
    fireEvent.change(screen.getByPlaceholderText(/name|user/i), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    expect(connect).toHaveBeenCalledWith('ws://localhost:8787', 'sess1', 'Alice');
  });

  it('Disconnect button calls disconnect', () => {
    const disconnect = vi.fn();
    render(<CollabPanel state={makeState({ isConnected: true, clientId: 'c1' })} actions={makeActions({ disconnect })} tool="excalidraw" />);

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(disconnect).toHaveBeenCalled();
  });

  it('disables Connect when relay URL is empty', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);

    fireEvent.change(screen.getByPlaceholderText(/session/i), { target: { value: 'sess1' } });
    fireEvent.change(screen.getByPlaceholderText(/name|user/i), { target: { value: 'Alice' } });

    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled();
  });

  it('disables Connect when session ID is empty', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);

    fireEvent.change(screen.getByPlaceholderText(/relay/i), { target: { value: 'ws://localhost:8787' } });
    fireEvent.change(screen.getByPlaceholderText(/name|user/i), { target: { value: 'Alice' } });

    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled();
  });

  it('shows peer list when connected', () => {
    const peers = new Map<string, PeerInfo>();
    peers.set('c1', { clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);
    peers.set('c2', { clientId: 'c2', username: 'Bob', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);

    render(<CollabPanel state={makeState({ isConnected: true, clientId: 'c1', peers })} actions={makeActions()} tool="excalidraw" />);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it('shows "(you)" next to own username', () => {
    const peers = new Map<string, PeerInfo>();
    peers.set('c1', { clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);

    render(<CollabPanel state={makeState({ isConnected: true, clientId: 'c1', peers })} actions={makeActions()} tool="excalidraw" />);
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  });

  it('loads last relay URL from localStorage on mount', () => {
    localStorage.setItem('excaliframe:lastRelayUrl', 'ws://saved-relay.com');
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);

    const relayInput = screen.getByPlaceholderText(/relay/i) as HTMLInputElement;
    expect(relayInput.value).toBe('ws://saved-relay.com');
  });

  it('loads last username from localStorage on mount', () => {
    localStorage.setItem('excaliframe:lastUsername', 'SavedUser');
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" />);

    const nameInput = screen.getByPlaceholderText(/name|user/i) as HTMLInputElement;
    expect(nameInput.value).toBe('SavedUser');
  });
});
