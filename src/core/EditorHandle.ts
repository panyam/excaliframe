import type { SyncAdapter } from '../collab/sync/SyncAdapter';

/** Imperative handle: host → editor commands */
export interface EditorHandle {
  save(): Promise<void>;
  /** Whether closing is safe (e.g. no Excalidraw modal open). Default: true. */
  canClose?(): boolean;
}

/** Callback props: editor → host state flow */
export interface EditorStateCallbacks {
  onDirtyChange: (isDirty: boolean) => void;
  onSavingChange: (isSaving: boolean) => void;
  onSyncAdapterReady: (adapter: SyncAdapter) => void;
}
