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

  it('renders username input', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
    expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument();
  });

  it('renders relay server radio buttons', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
    const radios = screen.getAllByRole('radio');
    // Default servers (2) + Custom option
    expect(radios.length).toBe(3);
  });

  it('renders Connect button when disconnected', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('renders Disconnect button when connected', () => {
    render(<CollabPanel state={makeState({ isConnected: true, clientId: 'c1' })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('displays drawingId as session ID', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="abc-123" />);
    expect(screen.getByText('abc-123')).toBeInTheDocument();
  });

  it('Connect button calls connect with resolved relay URL and drawingId as session', () => {
    const connect = vi.fn();
    render(<CollabPanel state={makeState()} actions={makeActions({ connect })} tool="excalidraw" drawingId="d1" />);

    fireEvent.change(screen.getByPlaceholderText(/name/i), { target: { value: 'Alice' } });
    // First radio (This server /relay) is selected by default
    fireEvent.click(screen.getByRole('button', { name: /^connect$/i }));

    expect(connect).toHaveBeenCalledTimes(1);
    // relayUrl is resolved, sessionId is drawingId, username is Alice
    expect(connect.mock.calls[0][1]).toBe('d1');
    expect(connect.mock.calls[0][2]).toBe('Alice');
  });

  it('disables Connect when username is empty', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeDisabled();
  });

  it('Disconnect button calls disconnect', () => {
    const disconnect = vi.fn();
    render(<CollabPanel state={makeState({ isConnected: true, clientId: 'c1' })} actions={makeActions({ disconnect })} tool="excalidraw" drawingId="d1" />);

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(disconnect).toHaveBeenCalled();
  });

  it('shows peer list when connected', () => {
    const peers = new Map<string, PeerInfo>();
    peers.set('c1', { clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);
    peers.set('c2', { clientId: 'c2', username: 'Bob', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);

    render(<CollabPanel state={makeState({ isConnected: true, clientId: 'c1', peers })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
  });

  it('shows "(you)" next to own username', () => {
    const peers = new Map<string, PeerInfo>();
    peers.set('c1', { clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true } as PeerInfo);

    render(<CollabPanel state={makeState({ isConnected: true, clientId: 'c1', peers })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  });

  it('loads last username from localStorage on mount', () => {
    localStorage.setItem('excaliframe:lastUsername', 'SavedUser');
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);

    const nameInput = screen.getByPlaceholderText(/name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('SavedUser');
  });

  it('shows custom URL input when Custom radio is selected', () => {
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);

    // Select the Custom radio (last one)
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[radios.length - 1]);

    expect(screen.getByPlaceholderText(/ws:\/\//)).toBeInTheDocument();
  });

  it('renders custom relay servers when provided', () => {
    const servers = [{ label: 'My Server', url: 'ws://my.server/relay' }];
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" relayServers={servers} />);

    expect(screen.getByText(/My Server/)).toBeInTheDocument();
    // 1 custom server + Custom option = 2 radios
    expect(screen.getAllByRole('radio').length).toBe(2);
  });

  it('loads saved custom relay URL from localStorage and selects Custom radio', () => {
    localStorage.setItem('excaliframe:lastRelayUrl', 'ws://custom.example.com/relay');
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);

    // Custom radio should be selected, showing the custom URL input
    const customInput = screen.getByPlaceholderText(/ws:\/\//);
    expect(customInput).toBeInTheDocument();
    expect((customInput as HTMLInputElement).value).toBe('ws://custom.example.com/relay');
  });

  it('selects predefined server radio when saved URL matches one', () => {
    localStorage.setItem('excaliframe:lastRelayUrl', '/relay');
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);

    // Should NOT show custom URL input (predefined "This server" is selected)
    expect(screen.queryByPlaceholderText(/ws:\/\//)).not.toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CollabPanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
