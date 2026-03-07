import React, { useState, useEffect, useRef } from 'react';
import type { AutoSaveStatus } from './useAutoSave';

export type ToastPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface SaveToastProps {
  status: AutoSaveStatus;
  isDirty: boolean;
  autoSaveEnabled: boolean;
  position?: ToastPosition;
}

const POSITION_CLASSES: Record<ToastPosition, string> = {
  'bottom-right': 'fixed bottom-4 right-4',
  'bottom-left': 'fixed bottom-4 left-4',
  'top-right': 'fixed top-4 right-4',
  'top-left': 'fixed top-4 left-4',
};

const SaveToast: React.FC<SaveToastProps> = ({
  status,
  isDirty,
  autoSaveEnabled,
  position = 'bottom-left',
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  let text: string | null = null;
  let colorClass = '';

  if (status === 'saved') {
    text = 'Saved';
    colorClass = 'bg-green-600/90';
  } else if (status === 'saving') {
    text = 'Saving\u2026';
    colorClass = 'bg-blue-600/90';
  } else if (isDirty && autoSaveEnabled) {
    text = 'Auto-saving\u2026';
    colorClass = 'bg-amber-500/90';
  } else if (isDirty) {
    text = 'Unsaved changes \u2014 \u2318S to save';
    colorClass = 'bg-red-500/90';
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (text) {
      setVisible(true);
      if (status === 'saved') {
        timerRef.current = setTimeout(() => setVisible(false), 2000);
      }
    } else {
      setVisible(false);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, status]);

  if (!visible || !text) return null;

  return (
    <div
      data-testid="save-toast"
      className={`${POSITION_CLASSES[position]} z-[1000] px-3.5 py-1.5 text-white rounded-full text-xs font-medium pointer-events-none shadow-md transition-opacity duration-300 ${colorClass}`}
    >
      {text}
    </div>
  );
};

export default SaveToast;
