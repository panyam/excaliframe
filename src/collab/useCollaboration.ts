import { useState, useCallback, useEffect, useRef } from 'react';
import { CollabClient } from './CollabClient';
import { CollabEvent, CollabAction, PeerInfo } from './types';

export interface CollabState {
  isConnected: boolean;
  isConnecting: boolean;
  clientId: string;
  peers: Map<string, PeerInfo>;
  error: string | null;
}

export interface CollabActions {
  connect: (relayUrl: string, sessionId: string, username: string) => void;
  disconnect: () => void;
  send: (action: Partial<CollabAction>) => void;
}

export function useCollaboration(
  tool: 'excalidraw' | 'mermaid',
  onEvent?: (event: CollabEvent) => void,
): [CollabState, CollabActions] {
  // stub — return defaults
  const state: CollabState = {
    isConnected: false,
    isConnecting: false,
    clientId: '',
    peers: new Map(),
    error: null,
  };
  const actions: CollabActions = {
    connect: () => {},
    disconnect: () => {},
    send: () => {},
  };
  return [state, actions];
}
