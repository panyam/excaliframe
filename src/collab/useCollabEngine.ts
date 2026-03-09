import { useState, useRef, useEffect } from 'react';
import { CollabEngine } from '@panyam/massrelay/engine';
import type { CollabEngineState } from '@panyam/massrelay/engine';
import { CollabClient } from './CollabClient';

const INITIAL_STATE: CollabEngineState = {
  phase: 'disconnected',
  isInitialized: false,
  clientId: '',
  sessionId: '',
  isOwner: false,
  ownerClientId: '',
  peers: new Map(),
  error: null,
  roomEncrypted: false,
  maxPeers: 0,
  roomTitle: '',
};

export function useCollabEngine(): [CollabEngineState, CollabEngine] {
  const engineRef = useRef<CollabEngine | null>(null);
  const [state, setState] = useState<CollabEngineState>(INITIAL_STATE);

  if (!engineRef.current) {
    const client = new CollabClient();
    engineRef.current = new CollabEngine({ client });
    engineRef.current.on('stateChange', setState);
  }

  useEffect(() => () => engineRef.current?.dispose(), []);
  return [state, engineRef.current];
}

export type { CollabEngineState, CollabEngine };
