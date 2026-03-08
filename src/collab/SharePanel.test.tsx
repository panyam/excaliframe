import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SharePanel from './SharePanel';
import type { CollabState, CollabActions } from './useCollaboration';
import type { PeerInfo } from './types';

// Mock crypto.generatePassword to return deterministic values
vi.mock('./crypto', () => ({
  generatePassword: vi.fn(() => 'mock-password-1234'),
}));

// Mock url-params
vi.mock('./url-params', () => ({
  resolveRelayUrl: (url: string) => url,
  encodeJoinCode: (_relay: string, sessionId: string) => `code-${sessionId}`,
}));

function makeState(overrides: Partial<CollabState> = {}): CollabState {
  return {
    isConnected: false,
    isConnecting: false,
    clientId: '',
    sessionId: '',
    peers: new Map(),
    error: null,
    isOwner: false,
    ownerClientId: '',
    roomEncrypted: false,
    maxPeers: 0,
    ...overrides,
  };
}

function makeActions(overrides: Partial<CollabActions> = {}): CollabActions {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    notifyCredentialsChanged: vi.fn(),
    ...overrides,
  };
}

function makePeers(...names: Array<{ id: string; name: string; isOwner?: boolean }>): Map<string, PeerInfo> {
  const peers = new Map<string, PeerInfo>();
  for (const p of names) {
    peers.set(p.id, {
      clientId: p.id,
      username: p.name,
      avatarUrl: '',
      clientType: 'browser',
      isActive: true,
      isOwner: p.isOwner ?? false,
    } as PeerInfo);
  }
  return peers;
}

describe('SharePanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ─── Disconnected state ───

  describe('disconnected (not sharing)', () => {
    it('renders Share heading and Start Sharing button', () => {
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText('Share')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start sharing/i })).toBeInTheDocument();
    });

    it('renders relay server selector', () => {
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText(/relay server/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows encrypt checkbox unchecked by default, password field hidden', () => {
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      const checkbox = screen.getByRole('checkbox', { name: /encrypt with password/i });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
      // Password input should not be visible
      expect(screen.queryByPlaceholderText(/enter a password/i)).not.toBeInTheDocument();
    });

    it('shows password field with auto-generated password when checkbox is checked', () => {
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      fireEvent.click(screen.getByRole('checkbox', { name: /encrypt with password/i }));

      const pwInput = screen.getByPlaceholderText(/enter a password/i) as HTMLInputElement;
      expect(pwInput).toBeInTheDocument();
      expect(pwInput.value).toBe('mock-password-1234');
    });

    it('shows password sharing reminder when encrypt is enabled', () => {
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      // Not visible before checking
      expect(screen.queryByText(/share the password separately/i)).not.toBeInTheDocument();
      // Visible after checking
      fireEvent.click(screen.getByRole('checkbox', { name: /encrypt with password/i }));
      expect(screen.getByText(/share the password separately/i)).toBeInTheDocument();
    });

    it('shows regenerate password button when encrypt is enabled', () => {
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      fireEvent.click(screen.getByRole('checkbox', { name: /encrypt with password/i }));
      const buttons = screen.getAllByRole('button');
      const regenButton = buttons.find(b => b.getAttribute('title') === 'Generate new password');
      expect(regenButton).toBeInTheDocument();
    });

    it('shows error message when state has error', () => {
      render(<SharePanel state={makeState({ error: 'Room is full (3/3)' })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText('Room is full (3/3)')).toBeInTheDocument();
    });

    it('calls connect with encrypted=false when checkbox is unchecked', () => {
      const connect = vi.fn();
      render(<SharePanel state={makeState()} actions={makeActions({ connect })} tool="excalidraw" drawingId="d1" />);
      // Don't check the encrypt checkbox — just share
      fireEvent.click(screen.getByRole('button', { name: /start sharing/i }));
      expect(connect).toHaveBeenCalledTimes(1);
      expect(connect.mock.calls[0][5]).toBe(false); // encrypted flag
    });

    it('calls connect with encrypted=true when checkbox is checked', () => {
      const connect = vi.fn();
      render(<SharePanel state={makeState()} actions={makeActions({ connect })} tool="excalidraw" drawingId="d1" />);
      fireEvent.click(screen.getByRole('checkbox', { name: /encrypt with password/i }));
      fireEvent.click(screen.getByRole('button', { name: /start sharing/i }));
      expect(connect).toHaveBeenCalledTimes(1);
      expect(connect.mock.calls[0][5]).toBe(true); // encrypted flag
    });

    it('calls onPasswordChange with password when starting encrypted share', () => {
      const onPasswordChange = vi.fn();
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" onPasswordChange={onPasswordChange} />);
      fireEvent.click(screen.getByRole('checkbox', { name: /encrypt with password/i }));
      fireEvent.click(screen.getByRole('button', { name: /start sharing/i }));
      expect(onPasswordChange).toHaveBeenCalledWith('mock-password-1234');
    });

    it('does not call onPasswordChange when checkbox is unchecked', () => {
      const onPasswordChange = vi.fn();
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" onPasswordChange={onPasswordChange} />);
      fireEvent.click(screen.getByRole('button', { name: /start sharing/i }));
      expect(onPasswordChange).not.toHaveBeenCalled();
    });

    it('shows Cancel button when onClose is provided', () => {
      const onClose = vi.fn();
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" onClose={onClose} />);
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      expect(cancelBtn).toBeInTheDocument();
      fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalled();
    });

    it('does not show Cancel button when onClose is not provided', () => {
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('reuses active session from localStorage when starting sharing', () => {
      localStorage.setItem('excaliframe:activeSession:d1', 'existing-sess-abc');
      const connect = vi.fn();
      render(<SharePanel state={makeState()} actions={makeActions({ connect })} tool="excalidraw" drawingId="d1" />);
      fireEvent.click(screen.getByRole('button', { name: /start sharing/i }));
      expect(connect).toHaveBeenCalledTimes(1);
      // Should pass the existing sessionId instead of empty string
      expect(connect.mock.calls[0][1]).toBe('existing-sess-abc');
    });

    it('uses empty sessionId when no active session exists', () => {
      const connect = vi.fn();
      render(<SharePanel state={makeState()} actions={makeActions({ connect })} tool="excalidraw" drawingId="d1" />);
      fireEvent.click(screen.getByRole('button', { name: /start sharing/i }));
      expect(connect).toHaveBeenCalledTimes(1);
      expect(connect.mock.calls[0][1]).toBe('');
    });

    it('loads saved relay URL from localStorage', () => {
      localStorage.setItem('excaliframe:lastRelayUrl', 'ws://saved.example.com/relay');
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      // Custom URL should appear in the custom input field
      const customInput = screen.getByPlaceholderText(/ws:\/\//);
      expect((customInput as HTMLInputElement).value).toBe('ws://saved.example.com/relay');
    });
  });

  // ─── Connected as owner ───

  describe('connected as owner', () => {
    const ownerState = (overrides: Partial<CollabState> = {}) => makeState({
      isConnected: true,
      isOwner: true,
      clientId: 'c1',
      sessionId: 'sess-123',
      peers: makePeers({ id: 'c1', name: 'Alice', isOwner: true }),
      ...overrides,
    });

    it('shows "Sharing Active" heading', () => {
      render(<SharePanel state={ownerState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText('Sharing Active')).toBeInTheDocument();
    });

    it('shows peer count', () => {
      render(<SharePanel state={ownerState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText(/1 peer:/)).toBeInTheDocument();
    });

    it('shows plural peer count', () => {
      const peers = makePeers(
        { id: 'c1', name: 'Alice', isOwner: true },
        { id: 'c2', name: 'Bob' },
      );
      render(<SharePanel state={ownerState({ peers })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText(/2 peers:/)).toBeInTheDocument();
    });

    it('shows "Copy Join Link" and "Stop Sharing" buttons', () => {
      render(<SharePanel state={ownerState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByRole('button', { name: /copy join link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /stop sharing/i })).toBeInTheDocument();
    });

    it('calls disconnect on Stop Sharing', () => {
      const disconnect = vi.fn();
      render(<SharePanel state={ownerState()} actions={makeActions({ disconnect })} tool="excalidraw" drawingId="d1" />);
      fireEvent.click(screen.getByRole('button', { name: /stop sharing/i }));
      expect(disconnect).toHaveBeenCalled();
    });

    it('shows encrypted badge when room is encrypted', () => {
      render(<SharePanel state={ownerState({ roomEncrypted: true })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText('encrypted')).toBeInTheDocument();
    });

    it('does not show encrypted badge when room is not encrypted', () => {
      render(<SharePanel state={ownerState({ roomEncrypted: false })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.queryByText('encrypted')).not.toBeInTheDocument();
    });

    it('shows "(you)" next to own peer', () => {
      render(<SharePanel state={ownerState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText(/(you)/)).toBeInTheDocument();
    });
  });

  // ─── Connected as follower ───

  describe('connected as follower', () => {
    const followerState = (overrides: Partial<CollabState> = {}) => makeState({
      isConnected: true,
      isOwner: false,
      clientId: 'c2',
      sessionId: 'sess-123',
      peers: makePeers(
        { id: 'c1', name: 'Alice', isOwner: true },
        { id: 'c2', name: 'Bob' },
      ),
      ...overrides,
    });

    it('shows "Connected" heading', () => {
      render(<SharePanel state={followerState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('shows peer list with owner indicator', () => {
      render(<SharePanel state={followerState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
      expect(screen.getByText(/(owner)/)).toBeInTheDocument();
    });

    it('shows Disconnect button (not "Stop Sharing")', () => {
      render(<SharePanel state={followerState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByRole('button', { name: /^disconnect$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /stop sharing/i })).not.toBeInTheDocument();
    });

    it('does not show "Copy Join Link" button', () => {
      render(<SharePanel state={followerState()} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.queryByRole('button', { name: /copy join link/i })).not.toBeInTheDocument();
    });

    it('calls disconnect on button click', () => {
      const disconnect = vi.fn();
      render(<SharePanel state={followerState()} actions={makeActions({ disconnect })} tool="excalidraw" drawingId="d1" />);
      fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
      expect(disconnect).toHaveBeenCalled();
    });
  });

  // ─── Error states ───

  describe('error handling', () => {
    it('shows ROOM_FULL error', () => {
      render(<SharePanel state={makeState({ error: 'ROOM_FULL: Room is full (10/10)' })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText(/room is full/i)).toBeInTheDocument();
    });

    it('shows credentials changed error', () => {
      render(<SharePanel state={makeState({ error: 'Password changed — please reconnect' })} actions={makeActions()} tool="excalidraw" drawingId="d1" />);
      expect(screen.getByText(/password changed/i)).toBeInTheDocument();
    });
  });

  // ─── Custom relay servers ───

  describe('custom relay servers', () => {
    it('shows custom servers in dropdown', () => {
      const servers = [
        { label: 'Server A', url: 'ws://a.example.com' },
        { label: 'Server B', url: 'ws://b.example.com' },
      ];
      render(<SharePanel state={makeState()} actions={makeActions()} tool="excalidraw" drawingId="d1" relayServers={servers} />);
      expect(screen.getByText('Server A')).toBeInTheDocument();
      expect(screen.getByText('Server B')).toBeInTheDocument();
    });
  });
});
