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

  useEffect(() => {
    const savedUser = localStorage.getItem('excaliframe:lastUsername');
    if (savedUser) setUsername(savedUser);

    const savedRelay = localStorage.getItem('excaliframe:lastRelayUrl');
    if (savedRelay) {
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

  // Connected state
  if (state.isConnected) {
    return (
      <div data-testid="collab-panel" className="text-gray-900 dark:text-gray-100">
        <h3 className="text-sm font-semibold mb-3">Connected</h3>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Session: <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{drawingId}</code>
        </div>
        <div data-testid="peer-list" className="mb-3">
          <div className="text-xs font-medium mb-1">Peers:</div>
          {Array.from(state.peers.values()).map(peer => (
            <span key={peer.clientId} className="block text-sm">
              {peer.username}
              {peer.clientId === state.clientId
                ? <span className="text-gray-400 dark:text-gray-500"> (you)</span>
                : ''}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopyLink}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
            Copy Link
          </button>
          <button onClick={() => actions.disconnect()}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50">
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // Disconnected state — connection form
  return (
    <div data-testid="collab-panel" className="text-gray-900 dark:text-gray-100">
      <h3 className="text-sm font-semibold mb-3">Collaborate</h3>

      <div className="mb-3">
        <label className="block text-xs font-medium mb-1">Name:</label>
        <input
          placeholder="Your name"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium mb-1">Relay Server:</label>
        {servers.map((srv, i) => (
          <label key={srv.url} className="flex items-center gap-1.5 mb-1 text-sm cursor-pointer">
            <input type="radio" name="relay-server" checked={selectedServer === i}
              onChange={() => setSelectedServer(i)} className="accent-indigo-500" />
            {srv.label} <span className="text-xs text-gray-400 dark:text-gray-500">({srv.url})</span>
          </label>
        ))}
        <label className="flex items-center gap-1.5 mb-1 text-sm cursor-pointer">
          <input type="radio" name="relay-server" checked={selectedServer === servers.length}
            onChange={() => setSelectedServer(servers.length)} className="accent-indigo-500" />
          Custom:
        </label>
        {selectedServer === servers.length && (
          <input
            placeholder="ws://..."
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="text-gray-500 dark:text-gray-400">Session:</span>
        <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">{drawingId}</code>
        <button onClick={handleCopyLink}
          className="px-2 py-0.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">
          Copy Link
        </button>
      </div>

      <div className="flex gap-2 justify-end">
        {onClose && (
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
            Cancel
          </button>
        )}
        <button onClick={handleConnect} disabled={!canConnect}
          className="px-4 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
          Connect
        </button>
      </div>
    </div>
  );
};

export default CollabPanel;
