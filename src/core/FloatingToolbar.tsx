import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CollabState } from '../collab/useCollaboration';
import type { CollabActions } from '../collab/useCollaboration';
import CollabBadge from '../collab/CollabBadge';
import SharePanel from '../collab/SharePanel';
import AutoSaveToggle from './AutoSaveToggle';

export type ToolbarPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface FloatingToolbarProps {
  position?: ToolbarPosition;
  onSave: () => void;
  isSaving: boolean;
  autoSaveEnabled: boolean;
  onAutoSaveChange: (enabled: boolean) => void;
  collabState: CollabState;
  collabActions: CollabActions;
  tool: 'excalidraw' | 'mermaid';
  drawingId: string;
  onPasswordChange?: (password: string | null) => void;
  /** Drawing title to send when starting a sharing session. */
  title?: string;
  /** Whether collab/share UI is enabled. Default true. */
  collabEnabled?: boolean;
}

const POSITION_CLASSES: Record<ToolbarPosition, string> = {
  'bottom-right': 'fixed bottom-36 right-4',
  'bottom-left': 'fixed bottom-4 left-4',
  'top-right': 'fixed top-4 right-4',
  'top-left': 'fixed top-4 left-4',
};

const GearIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z" />
  </svg>
);

type PanelView = 'menu' | 'share';

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  position = 'bottom-right',
  onSave,
  isSaving,
  autoSaveEnabled,
  onAutoSaveChange,
  collabState,
  collabActions,
  tool,
  drawingId,
  onPasswordChange,
  title,
  collabEnabled = true,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('menu');
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside dismiss
  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setPanelView('menu');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => {
      if (prev) setPanelView('menu');
      return !prev;
    });
  }, []);

  const isTop = position.startsWith('top');
  const hasCollabIndicator = collabState.isConnected;

  const menuPanel = (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-[200px] flex flex-col gap-1">
      {/* Save button */}
      <button
        onClick={() => { onSave(); }}
        disabled={isSaving}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4zm-5 16a3 3 0 110-6 3 3 0 010 6zm3-10H5V5h10v4z" />
        </svg>
        {isSaving ? 'Saving\u2026' : 'Save'}
      </button>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700 my-0.5" />

      {collabEnabled && <>
        {/* Share / Collab */}
        <button
          onClick={() => setPanelView('share')}
          className="flex items-center w-full rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <CollabBadge state={collabState} />
        </button>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-0.5" />
      </>}

      {/* Auto-save toggle */}
      <div className="px-3 py-1.5">
        <AutoSaveToggle enabled={autoSaveEnabled} onChange={onAutoSaveChange} />
      </div>
    </div>
  );

  const shareView = (
    <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[280px]">
      <button
        onClick={() => setPanelView('menu')}
        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        Back
      </button>
      <SharePanel
        state={collabState}
        actions={collabActions}
        tool={tool}
        drawingId={drawingId}
        onClose={() => setPanelView('menu')}
        onPasswordChange={onPasswordChange}
        title={title}
      />
    </div>
  );

  return (
    <div ref={containerRef} className={`${POSITION_CLASSES[position]} z-[1000] flex flex-col items-end gap-2`}>
      {/* Panel above button (bottom positions) or below (top positions) */}
      {expanded && !isTop && (panelView === 'menu' ? menuPanel : shareView)}

      {/* Gear button */}
      <button
        onClick={toggleExpanded}
        title="Menu"
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 shadow-md transition-colors"
      >
        <GearIcon />
        {hasCollabIndicator && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white dark:border-gray-800" />
        )}
      </button>

      {/* Panel below button (top positions) */}
      {expanded && isTop && (panelView === 'menu' ? menuPanel : shareView)}
    </div>
  );
};

export default FloatingToolbar;
