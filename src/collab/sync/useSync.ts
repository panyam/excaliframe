import { useState, useCallback, useRef, useEffect } from 'react';
import type { SyncAdapter, SyncState, SyncActions, SyncConnection } from './SyncAdapter';

interface UseSyncConfig {
  /** Debounce interval for outgoing updates (ms). Default 100. */
  outgoingDebounceMs?: number;
  /** Throttle interval for cursor broadcasts (ms). Default 50. */
  cursorThrottleMs?: number;
}

/**
 * Tool-agnostic sync orchestration hook.
 *
 * Sits between a SyncAdapter (tool-specific diff/merge) and the transport
 * layer. Takes a plain SyncConnection object — no dependency on
 * useCollaboration types. The editor wires the two together.
 *
 * Handles:
 * - Debounced outgoing updates (pull-based: only diffs when timer fires)
 * - Incoming event routing via `handleEvent` (returned in SyncActions)
 * - Initial scene sync (request/response on join)
 * - Throttled cursor broadcasts
 */
export function useSync(
  adapter: SyncAdapter | null,
  connection: SyncConnection,
  config?: UseSyncConfig,
): [SyncState, SyncActions] {
  const debounceMs = config?.outgoingDebounceMs ?? 100;
  const cursorThrottleMs = config?.cursorThrottleMs ?? 50;

  const [syncState, setSyncState] = useState<SyncState>({ isInitialized: false });
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorPending = useRef(false);
  const initRequestSent = useRef(false);

  // Reset state when disconnected
  useEffect(() => {
    if (!connection.isConnected) {
      setSyncState({ isInitialized: false });
      initRequestSent.current = false;
    }
  }, [connection.isConnected]);

  // Initial scene sync: when connected with peers, request scene from existing peer.
  // When first peer (no others), mark initialized immediately.
  useEffect(() => {
    if (!connection.isConnected || !adapter || syncState.isInitialized || initRequestSent.current) {
      return;
    }

    // peers includes self (added by CollabClient on RoomJoined).
    // If only 1 peer (self), we're first — no need to request.
    if (connection.peers.size <= 1) {
      setSyncState({ isInitialized: true });
    } else {
      connection.send({ sceneInitRequest: {} });
      initRequestSent.current = true;
    }
  }, [connection.isConnected, connection.peers.size, adapter, syncState.isInitialized, connection]);

  // Flush debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
    };
  }, []);

  const flushOutgoing = useCallback(() => {
    if (!adapter || !connection.isConnected) return;

    const update = adapter.computeOutgoing();
    if (!update) return;

    // Send using the proto JSON field name matching the update type
    connection.send({ [update.type]: update.payload });
  }, [adapter, connection]);

  const notifyLocalChange = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushOutgoing, debounceMs);
  }, [flushOutgoing, debounceMs]);

  const notifyCursorMove = useCallback(() => {
    if (!adapter || !connection.isConnected) return;
    if (cursorPending.current) return; // already scheduled

    cursorPending.current = true;
    cursorTimer.current = setTimeout(() => {
      cursorPending.current = false;
      const cursor = adapter.getCursorData();
      if (cursor) {
        connection.send({ cursorUpdate: cursor });
      }
    }, cursorThrottleMs);
  }, [adapter, connection, cursorThrottleMs]);

  const handleEvent = useCallback((event: any) => {
    if (!adapter) return;

    if (event.sceneUpdate) {
      adapter.applyRemote(event.fromClientId ?? '', event.sceneUpdate);
    } else if (event.textUpdate) {
      adapter.applyRemote(event.fromClientId ?? '', event.textUpdate);
    } else if (event.cursorUpdate && event.fromClientId) {
      adapter.applyRemoteCursor({
        clientId: event.fromClientId,
        username: '',
        x: event.cursorUpdate.x,
        y: event.cursorUpdate.y,
        tool: event.cursorUpdate.tool,
        button: event.cursorUpdate.button,
        selectedElementIds: event.cursorUpdate.selectedElementIds,
      });
    } else if (event.sceneInitResponse) {
      adapter.applySceneInit(event.sceneInitResponse.payload ?? '{}');
      setSyncState({ isInitialized: true });
    } else if (event.sceneInitRequest && event.fromClientId) {
      // Another peer is requesting the scene. Owner responds; if no owner,
      // fall back to lowest clientId among connected peers.
      if (connection.isOwner) {
        const snapshot = adapter.getSceneSnapshot();
        connection.send({ sceneInitResponse: { payload: snapshot } });
      } else if (!connection.isOwner) {
        // Fallback: lowest clientId responds (for rooms without an explicit owner)
        const myClientId = connection.clientId;
        if (!myClientId) return;
        const peerIds = Array.from(connection.peers.keys());
        const candidates = peerIds.filter(id => id !== event.fromClientId);
        if (candidates.length === 0) return;
        candidates.sort();
        if (candidates[0] === myClientId) {
          const snapshot = adapter.getSceneSnapshot();
          connection.send({ sceneInitResponse: { payload: snapshot } });
        }
      }
    } else if (event.peerLeft && event.peerLeft.clientId) {
      adapter.removePeerCursor(event.peerLeft.clientId);
    }
  }, [adapter, connection]);

  return [syncState, { notifyLocalChange, notifyCursorMove, handleEvent }];
}
