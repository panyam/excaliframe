import React, { useState, useEffect } from 'react';
import { CollabState, CollabActions } from './useCollaboration';

export interface CollabPanelProps {
  state: CollabState;
  actions: CollabActions;
  tool: 'excalidraw' | 'mermaid';
  currentUrl?: string;
}

const CollabPanel: React.FC<CollabPanelProps> = ({ state, actions, tool }) => {
  const [relayUrl, setRelayUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [username, setUsername] = useState('');

  // Load saved values from localStorage on mount
  useEffect(() => {
    const savedRelay = localStorage.getItem('excaliframe:lastRelayUrl');
    const savedUser = localStorage.getItem('excaliframe:lastUsername');
    if (savedRelay) setRelayUrl(savedRelay);
    if (savedUser) setUsername(savedUser);
  }, []);

  const handleConnect = () => {
    actions.connect(relayUrl, sessionId, username);
  };

  const handleDisconnect = () => {
    actions.disconnect();
  };

  const handleGenerate = () => {
    setSessionId(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14));
  };

  const canConnect = relayUrl.trim() !== '' && sessionId.trim() !== '';

  return (
    <div data-testid="collab-panel">
      {!state.isConnected ? (
        <>
          <input
            placeholder="Relay URL (ws://...)"
            value={relayUrl}
            onChange={e => setRelayUrl(e.target.value)}
          />
          <input
            placeholder="Session ID"
            value={sessionId}
            onChange={e => setSessionId(e.target.value)}
          />
          <button onClick={handleGenerate}>Generate</button>
          <input
            placeholder="Your name"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <button onClick={handleConnect} disabled={!canConnect}>Connect</button>
        </>
      ) : (
        <>
          <button onClick={handleDisconnect}>Disconnect</button>
          <div data-testid="peer-list">
            {Array.from(state.peers.values()).map(peer => (
              <span key={peer.clientId}>
                {peer.username}
                {peer.clientId === state.clientId ? ' (you)' : ''}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CollabPanel;
