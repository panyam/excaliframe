import React, { useState, useEffect } from 'react';
import { CollabState, CollabActions } from './useCollaboration';
import { DEFAULT_RELAY_SERVERS, RelayServerOption } from './types';
import { resolveRelayUrl, encodeJoinCode } from './url-params';
import { getPeerColor } from './peerColors';

export interface SharePanelProps {
  state: CollabState;
  actions: CollabActions;
  tool: 'excalidraw' | 'mermaid';
  drawingId: string;
  relayServers?: RelayServerOption[];
  onClose?: () => void;
}

const SharePanel: React.FC<SharePanelProps> = ({
  state, actions, tool, drawingId, relayServers, onClose,
}) => {
  const servers = relayServers ?? DEFAULT_RELAY_SERVERS;
  const [selectedServer, setSelectedServer] = useState(0);
  const [customUrl, setCustomUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
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

  const handleStartSharing = () => {
    const relayUrl = getRelayUrl();
    const resolved = resolveRelayUrl(relayUrl);
    // Empty sessionId → relay generates one; pass drawingId for hint-based reuse
    actions.connect(resolved, '', '', true, drawingId);
  };

  const handleCopyJoinCode = () => {
    // Use the relay-returned sessionId (available after connect)
    const sessionId = state.sessionId;
    if (!sessionId) return;
    const relayUrl = getRelayUrl();
    const resolved = resolveRelayUrl(relayUrl);
    const code = encodeJoinCode(resolved, sessionId);
    const joinUrl = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const canShare = selectedServer < servers.length || customUrl.trim() !== '';

  // ─── Connected as follower ───
  if (state.isConnected && !state.isOwner) {
    return (
      <div data-testid="share-panel" className="text-gray-900 dark:text-gray-100">
        <h3 className="text-sm font-semibold mb-3">Connected</h3>
        <div data-testid="peer-list" className="mb-3">
          <div className="text-xs font-medium mb-1">Peers:</div>
          {Array.from(state.peers.values()).map((peer, i) => {
            const color = getPeerColor(i);
            return (
              <span key={peer.clientId} className="flex items-center gap-1.5 text-sm">
                <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color.background }} />
                {peer.username}
                {peer.clientId === state.clientId
                  ? <span className="text-gray-400 dark:text-gray-500"> (you)</span>
                  : ''}
                {peer.isOwner
                  ? <span className="text-indigo-400 dark:text-indigo-300"> (owner)</span>
                  : ''}
              </span>
            );
          })}
        </div>
        <button onClick={() => actions.disconnect()}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50">
          Disconnect
        </button>
      </div>
    );
  }

  // ─── Sharing as owner ───
  if (state.isConnected && state.isOwner) {
    return (
      <div data-testid="share-panel" className="text-gray-900 dark:text-gray-100">
        <h3 className="text-sm font-semibold mb-3">Sharing Active</h3>
        <div data-testid="peer-list" className="mb-3">
          <div className="text-xs font-medium mb-1">
            {state.peers.size} peer{state.peers.size !== 1 ? 's' : ''}:
          </div>
          {Array.from(state.peers.values()).map((peer, i) => {
            const color = getPeerColor(i);
            return (
              <span key={peer.clientId} className="flex items-center gap-1.5 text-sm">
                <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color.background }} />
                {peer.username}
                {peer.clientId === state.clientId
                  ? <span className="text-gray-400 dark:text-gray-500"> (you)</span>
                  : ''}
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopyJoinCode}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
            {copied ? 'Copied!' : 'Copy Join Link'}
          </button>
          <button onClick={() => actions.disconnect()}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50">
            Stop Sharing
          </button>
        </div>
      </div>
    );
  }

  // ─── Not sharing (disconnected) ───
  return (
    <div data-testid="share-panel" className="text-gray-900 dark:text-gray-100">
      <h3 className="text-sm font-semibold mb-3">Share</h3>

      {state.error && (
        <div className="mb-3 px-2.5 py-1.5 text-xs rounded-md bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
          {state.error}
        </div>
      )}

      <div className="mb-3">
        <label className="block text-xs font-medium mb-1">Relay Server:</label>
        <select
          value={selectedServer}
          onChange={e => setSelectedServer(Number(e.target.value))}
          className="w-full px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {servers.map((srv, i) => (
            <option key={srv.url} value={i}>{srv.label}</option>
          ))}
          <option value={servers.length}>Custom...</option>
        </select>
        {selectedServer === servers.length && (
          <input
            placeholder="ws://..."
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            className="w-full mt-1 px-2.5 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        )}
      </div>

      <div className="flex gap-2 justify-end">
        {onClose && (
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
            Cancel
          </button>
        )}
        <button onClick={handleStartSharing} disabled={!canShare}
          className="px-4 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
          Start Sharing
        </button>
      </div>
    </div>
  );
};

export default SharePanel;
