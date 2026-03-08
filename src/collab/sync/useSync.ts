import { useState, useCallback, useRef, useEffect } from 'react';
import type { SyncAdapter, SyncState, SyncActions, SyncConnection } from './SyncAdapter';
import { encryptPayload, decryptPayload } from '../crypto';

interface UseSyncConfig {
  /** Debounce interval for outgoing updates (ms). Default 100. */
  outgoingDebounceMs?: number;
  /** Throttle interval for cursor broadcasts (ms). Default 50. */
  cursorThrottleMs?: number;
  /** AES-256-GCM key for E2EE. When set, content payloads are encrypted/decrypted. */
  encryptionKey?: CryptoKey | null;
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
  const encryptionKey = config?.encryptionKey ?? null;

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

  const flushOutgoing = useCallback(async () => {
    if (!adapter || !connection.isConnected) {
      console.log('[SYNC] flushOutgoing skipped: adapter=%s connected=%s', !!adapter, connection.isConnected);
      return;
    }

    const update = adapter.computeOutgoing();
    if (!update) {
      console.log('[SYNC] flushOutgoing: no changes to send');
      return;
    }

    console.log('[SYNC] flushOutgoing: sending %s', update.type, update.payload);

    // Encrypt content fields if E2EE is enabled
    if (encryptionKey) {
      try {
        const payload = update.payload as any;
        if (update.type === 'sceneUpdate' && payload.elements) {
          for (const el of payload.elements) {
            if (el.data) {
              el.data = await encryptPayload(encryptionKey, el.data);
            }
          }
        } else if (update.type === 'textUpdate' && typeof payload.text === 'string') {
          payload.text = await encryptPayload(encryptionKey, payload.text);
        }
      } catch (err) {
        console.warn('[SYNC] Encryption failed, skipping send:', err);
        return;
      }
    }

    // Send using the proto JSON field name matching the update type
    connection.send({ [update.type]: update.payload });
  }, [adapter, connection, encryptionKey]);

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

  const handleEvent = useCallback(async (event: any) => {
    if (!adapter) {
      console.log('[SYNC] handleEvent: no adapter, ignoring', event);
      return;
    }

    if (event.sceneUpdate) {
      console.log('[SYNC] handleEvent: sceneUpdate from %s, elements=%d', event.fromClientId, event.sceneUpdate?.elements?.length ?? 0);
      // Decrypt element data fields if E2EE is enabled
      if (encryptionKey && event.sceneUpdate.elements) {
        try {
          for (const el of event.sceneUpdate.elements) {
            if (el.data) {
              el.data = await decryptPayload(encryptionKey, el.data);
            }
          }
        } catch (err) {
          console.warn('[SYNC] Decryption failed (wrong key?), skipping update:', err);
          return;
        }
      }
      adapter.applyRemote(event.fromClientId ?? '', event.sceneUpdate);
    } else if (event.textUpdate) {
      console.log('[SYNC] handleEvent: textUpdate from %s', event.fromClientId);
      // Decrypt text field if E2EE is enabled
      if (encryptionKey && typeof event.textUpdate.text === 'string') {
        try {
          event.textUpdate.text = await decryptPayload(encryptionKey, event.textUpdate.text);
        } catch (err) {
          console.warn('[SYNC] Decryption failed (wrong key?), skipping update:', err);
          return;
        }
      }
      adapter.applyRemote(event.fromClientId ?? '', event.textUpdate);
    } else if (event.cursorUpdate && event.fromClientId) {
      // Cursors are NOT encrypted — low sensitivity, high frequency
      const peer = connection.peers.get(event.fromClientId) as { username?: string } | undefined;
      adapter.applyRemoteCursor({
        clientId: event.fromClientId,
        username: peer?.username || event.fromClientId.slice(0, 6),
        x: event.cursorUpdate.x,
        y: event.cursorUpdate.y,
        tool: event.cursorUpdate.tool,
        button: event.cursorUpdate.button,
        selectedElementIds: event.cursorUpdate.selectedElementIds,
      });
    } else if (event.sceneInitResponse) {
      let payload = event.sceneInitResponse.payload ?? '{}';
      // Decrypt scene init payload if E2EE is enabled
      if (encryptionKey && payload !== '{}') {
        try {
          payload = await decryptPayload(encryptionKey, payload);
        } catch (err) {
          console.warn('[SYNC] Scene init decryption failed (wrong key?):', err);
          return;
        }
      }
      adapter.applySceneInit(payload);
      setSyncState({ isInitialized: true });
    } else if (event.sceneInitRequest && event.fromClientId) {
      // Another peer is requesting the scene. Owner responds; if no owner,
      // fall back to lowest clientId among connected peers.
      const shouldRespond = connection.isOwner || (() => {
        const myClientId = connection.clientId;
        if (!myClientId) return false;
        const peerIds = Array.from(connection.peers.keys());
        const candidates = peerIds.filter(id => id !== event.fromClientId);
        if (candidates.length === 0) return false;
        candidates.sort();
        return candidates[0] === myClientId;
      })();

      if (shouldRespond) {
        let snapshot = adapter.getSceneSnapshot();
        // Encrypt scene init payload if E2EE is enabled
        if (encryptionKey) {
          try {
            snapshot = await encryptPayload(encryptionKey, snapshot);
          } catch (err) {
            console.warn('[SYNC] Scene init encryption failed:', err);
            return;
          }
        }
        connection.send({ sceneInitResponse: { payload: snapshot } });
      }
    } else if (event.peerLeft && event.peerLeft.clientId) {
      adapter.removePeerCursor(event.peerLeft.clientId);
    }
  }, [adapter, connection, encryptionKey]);

  return [syncState, { notifyLocalChange, notifyCursorMove, handleEvent }];
}
