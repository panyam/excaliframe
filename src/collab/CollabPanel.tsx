import React, { useState, useEffect } from 'react';
import { CollabState, CollabActions } from './useCollaboration';
import { DEFAULT_RELAY_SERVERS, RelayServerOption } from './types';
import { resolveRelayUrl, buildConnectUrl } from './url-params';

export interface CollabPanelProps {
  state: CollabState;
  actions: CollabActions;
  tool: 'excalidraw' | 'mermaid';
  drawingId: string;
  relayServers?: RelayServerOption[];
  onClose?: () => void;
}

const CollabPanel: React.FC<CollabPanelProps> = ({
  state, actions, tool, drawingId, relayServers, onClose,
}) => {
  const servers = relayServers ?? DEFAULT_RELAY_SERVERS;
  const [username, setUsername] = useState('');
  const [selectedServer, setSelectedServer] = useState(0);
  const [customUrl, setCustomUrl] = useState('');

  // Load saved username and custom relay URL from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('excaliframe:lastUsername');
    if (savedUser) setUsername(savedUser);

    const savedRelay = localStorage.getItem('excaliframe:lastRelayUrl');
    if (savedRelay) {
      // If it matches a predefined server, select that; otherwise select Custom
      const idx = servers.findIndex(s => s.url === savedRelay);
      if (idx >= 0) {
        setSelectedServer(idx);
      } else {
        setCustomUrl(savedRelay);
        setSelectedServer(servers.length);
      }
    }
  }, []);

  const getRelayUrl = (): string => {
    if (selectedServer < servers.length) return servers[selectedServer].url;
    return customUrl;
  };

  const handleConnect = () => {
    const relayUrl = getRelayUrl();
    // Persist custom relay URL for next time
    if (selectedServer === servers.length && customUrl.trim()) {
      localStorage.setItem('excaliframe:lastRelayUrl', customUrl);
    }
    const resolved = resolveRelayUrl(relayUrl);
    actions.connect(resolved, drawingId, username);
  };

  const handleCopyLink = () => {
    const relayUrl = getRelayUrl();
    const link = buildConnectUrl(window.location.href.split('?')[0], relayUrl);
    navigator.clipboard.writeText(link).catch(() => {});
  };

  const canConnect = username.trim() !== '' && (selectedServer < servers.length || customUrl.trim() !== '');

  // Connected state — show status view
  if (state.isConnected) {
    return (
      <div data-testid="collab-panel">
        <h3 style={{ margin: '0 0 12px' }}>Connected</h3>
        <div style={{ fontSize: '13px', marginBottom: '8px' }}>
          <div>Session: <code>{drawingId}</code></div>
        </div>
        <div data-testid="peer-list" style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>Peers:</div>
          {Array.from(state.peers.values()).map(peer => (
            <span key={peer.clientId} style={{ display: 'block' }}>
              {peer.username}
              {peer.clientId === state.clientId ? ' (you)' : ''}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleCopyLink}>Copy Link</button>
          <button onClick={() => actions.disconnect()}>Disconnect</button>
        </div>
      </div>
    );
  }

  // Disconnected state — connection form
  return (
    <div data-testid="collab-panel">
      <h3 style={{ margin: '0 0 12px' }}>Collaborate</h3>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px' }}>Name:</label>
        <input
          placeholder="Your name"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontWeight: 500, marginBottom: '4px' }}>Relay Server:</label>
        {servers.map((srv, i) => (
          <label key={srv.url} style={{ display: 'block', marginBottom: '2px' }}>
            <input
              type="radio"
              name="relay-server"
              checked={selectedServer === i}
              onChange={() => setSelectedServer(i)}
            />
            {' '}{srv.label} <span style={{ color: '#6b778c', fontSize: '12px' }}>({srv.url})</span>
          </label>
        ))}
        <label style={{ display: 'block', marginBottom: '2px' }}>
          <input
            type="radio"
            name="relay-server"
            checked={selectedServer === servers.length}
            onChange={() => setSelectedServer(servers.length)}
          />
          {' '}Custom:
        </label>
        {selectedServer === servers.length && (
          <input
            placeholder="ws://..."
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', marginTop: '4px' }}
          />
        )}
      </div>

      <div style={{ marginBottom: '12px', fontSize: '13px' }}>
        <span style={{ fontWeight: 500 }}>Session:</span>{' '}
        <code>{drawingId}</code>
        <button onClick={handleCopyLink} style={{ marginLeft: '8px', fontSize: '12px' }}>
          Copy Link
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        {onClose && <button onClick={onClose}>Cancel</button>}
        <button onClick={handleConnect} disabled={!canConnect}>Connect</button>
      </div>
    </div>
  );
};

export default CollabPanel;
