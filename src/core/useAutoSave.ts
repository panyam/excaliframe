import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'excaliframe:auto-save';
const DEFAULT_DEBOUNCE_MS = 2000;
const SAVED_DISPLAY_MS = 2000;

export type AutoSaveStatus = 'idle' | 'waiting' | 'saving' | 'saved';

interface UseAutoSaveOptions {
  isDirty: boolean;
  isSaving: boolean;
  canAutoSave: boolean;
  onSave: () => Promise<void>;
  debounceMs?: number;
}

interface UseAutoSaveResult {
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  autoSaveStatus: AutoSaveStatus;
}

function readPref(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

export function useAutoSave({
  isDirty,
  isSaving,
  canAutoSave,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseAutoSaveOptions): UseAutoSaveResult {
  const [enabled, setEnabled] = useState(() => canAutoSave && readPref());
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const setAutoSaveEnabled = useCallback((v: boolean) => {
    setEnabled(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
  }, []);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  // Track saving → saved transition
  useEffect(() => {
    if (isSaving) {
      // Clear any pending saved→idle timer so it can't fire during a new save
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
        savedTimer.current = null;
      }
      setStatus('saving');
    } else if (status === 'saving') {
      // Save just finished
      setStatus('saved');
      savedTimer.current = setTimeout(() => setStatus('idle'), SAVED_DISPLAY_MS);
    }
  }, [isSaving]);

  // Debounced auto-save trigger
  useEffect(() => {
    if (!canAutoSave || !enabled) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    if (!isDirty || isSaving) {
      if (!isSaving && status === 'waiting') setStatus('idle');
      return;
    }

    setStatus('waiting');
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      onSaveRef.current();
    }, debounceMs);
  }, [isDirty, isSaving, enabled, canAutoSave, debounceMs]);

  if (!canAutoSave) {
    return { autoSaveEnabled: false, setAutoSaveEnabled: () => {}, autoSaveStatus: 'idle' };
  }

  return { autoSaveEnabled: enabled, setAutoSaveEnabled, autoSaveStatus: status };
}
