import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorHost, DrawingEnvelope } from './types';
import { MermaidSyncAdapter } from '../collab/adapters/MermaidSyncAdapter';
import type { MermaidRemoteCursor } from '../collab/adapters/MermaidSyncAdapter';
import type { SyncActions } from '../collab/sync/SyncAdapter';
import type { EditorHandle, EditorStateCallbacks } from './EditorHandle';

export interface MermaidEditorProps {
  host: EditorHost;
  syncActions: SyncActions | null;
  stateCallbacks: EditorStateCallbacks;
}

const DEFAULT_TEMPLATE = `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E
`;

/** Insert mermaid-rendered SVG into a container.
 *  Uses innerHTML because C4 and other diagrams produce SVGs with
 *  <foreignObject> containing HTML that isn't valid XML, so DOMParser
 *  with 'image/svg+xml' silently fails for those diagram types.
 *  Safe here: svgString comes from mermaid's own renderer, not user HTML. */
function setSvgContent(container: HTMLElement, svgString: string): void {
  // eslint-disable-next-line no-unsanitized/property
  container.innerHTML = svgString;
}

const MermaidEditor = forwardRef<EditorHandle, MermaidEditorProps>(
  ({ host, syncActions, stateCallbacks }, ref) => {
  const [code, setCode] = useState('');
  const [initialCode, setInitialCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mermaid, setMermaid] = useState<any>(null);
  const lastValidSvg = useRef<string>('');
  const dividerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('excaliframe:mermaidSplitPct');
    return saved ? Number(saved) : 50;
  });

  const [cursorVersion, setCursorVersion] = useState(0);

  const isDirty = code !== initialCode;

  // Keep a ref so the sync adapter's getCode closure always reads latest
  const codeRef = useRef(code);
  codeRef.current = code;

  // Notify chrome of dirty changes
  const prevDirtyRef = useRef(false);
  useEffect(() => {
    if (isDirty !== prevDirtyRef.current) {
      prevDirtyRef.current = isDirty;
      stateCallbacks.onDirtyChange(isDirty);
    }
  }, [isDirty, stateCallbacks]);

  // Load mermaid library
  useEffect(() => {
    import('mermaid').then((mod) => {
      const m = mod.default;
      m.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      });
      setMermaid(m);
    });
  }, []);

  // Load drawing on mount
  useEffect(() => {
    (async () => {
      try {
        const envelope = await host.loadDrawing();
        const text = envelope?.data || DEFAULT_TEMPLATE;
        setCode(text);
        setInitialCode(text);
      } catch (err) {
        console.error('MermaidEditor - Error loading drawing:', err);
        setCode(DEFAULT_TEMPLATE);
        setInitialCode(DEFAULT_TEMPLATE);
      }
      setIsLoading(false);
    })();
  }, []);

  // Render preview with debounce
  useEffect(() => {
    if (isLoading || !mermaid) return;
    if (renderTimer.current) clearTimeout(renderTimer.current);
    renderTimer.current = setTimeout(async () => {
      try {
        const { svg } = await mermaid.render('mermaid-preview', code);
        lastValidSvg.current = svg;
        if (previewRef.current) {
          setSvgContent(previewRef.current, svg);
        }
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Invalid Mermaid syntax');
      }
    }, 300);
    return () => {
      if (renderTimer.current) clearTimeout(renderTimer.current);
    };
  }, [code, isLoading, mermaid]);

  const saveDrawing = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    stateCallbacks.onSavingChange(true);
    try {
      let preview = '';
      if (lastValidSvg.current) {
        preview = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(lastValidSvg.current)));
      }

      const now = new Date().toISOString();
      const envelope: DrawingEnvelope = {
        tool: 'mermaid',
        version: 1,
        data: code,
        preview,
        updatedAt: now,
      };
      await host.saveDrawing(envelope);
      setInitialCode(code);
      setIsSaving(false);
      stateCallbacks.onSavingChange(false);
      stateCallbacks.onDirtyChange(false);
    } catch (err) {
      console.error('MermaidEditor - Error saving:', err);
      alert('Failed to save drawing. Please try again.');
      setIsSaving(false);
      stateCallbacks.onSavingChange(false);
    }
  }, [code, isSaving, host, stateCallbacks]);

  // Imperative handle for EditorChrome
  useImperativeHandle(ref, () => ({
    save: saveDrawing,
  }), [saveDrawing]);

  // Sync adapter — created once after drawing is loaded
  const syncAdapterRef = useRef<MermaidSyncAdapter | null>(null);
  const syncActionsRef = useRef<SyncActions | null>(null);
  syncActionsRef.current = syncActions;

  useEffect(() => {
    if (!isLoading && !syncAdapterRef.current) {
      const adapter = new MermaidSyncAdapter(
        () => codeRef.current,
        setCode,
        () => setCursorVersion(v => v + 1),
      );
      syncAdapterRef.current = adapter;
      stateCallbacks.onSyncAdapterReady(adapter);
    }
  }, [isLoading, stateCallbacks]);

  // Broadcast local cursor position on selection change
  const handleCursorChange = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const adapter = syncAdapterRef.current;
    if (adapter) {
      adapter.setLocalSelection(ta.selectionStart, ta.selectionEnd);
      syncActionsRef.current?.notifyCursorMove();
    }
  }, []);

  // Compute remote cursors for rendering (driven by cursorVersion)
  const remoteCursors: MermaidRemoteCursor[] = [];
  if (cursorVersion >= 0 && syncAdapterRef.current) {
    syncAdapterRef.current.getRemoteCursors().forEach(c => remoteCursors.push(c));
  }

  // Handle Tab key in textarea (insert spaces instead of changing focus)
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const newVal = val.substring(0, start) + '    ' + val.substring(end);
      setCode(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  }, []);

  // Resizable divider drag handling
  // Runs after loading completes so refs are attached to the DOM
  useEffect(() => {
    if (isLoading) return;
    const divider = dividerRef.current;
    const container = containerRef.current;
    if (!divider || !container) return;

    let isDragging = false;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(80, Math.max(20, pct));
      setLeftWidth(clamped);
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const rect = container.getBoundingClientRect();
        const codePane = container.querySelector('.mermaid-editor__code') as HTMLElement;
        if (codePane) {
          const pct = (codePane.offsetWidth / rect.width) * 100;
          localStorage.setItem('excaliframe:mermaidSplitPct', String(Math.round(pct)));
        }
      }
    };

    divider.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      divider.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-full bg-white dark:bg-gray-900 gap-4">
        <div className="w-12 h-12 border-[3px] border-gray-100 dark:border-gray-700 border-t-blue-600 rounded-full animate-spin" />
        <div className="text-gray-800 dark:text-gray-200 text-base font-medium">
          Loading Mermaid...
        </div>
      </div>
    );
  }

  return (
    <div className="mermaid-editor" ref={containerRef}>
      <div className="mermaid-editor__code" style={{ width: `calc(${leftWidth}% - 3px)`, position: 'relative' }}>
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            const adapter = syncAdapterRef.current;
            if (adapter && !adapter.isApplyingRemote) {
              syncActionsRef.current?.notifyLocalChange();
            }
            handleCursorChange(e);
          }}
          onKeyDown={handleTextareaKeyDown}
          onSelect={handleCursorChange}
          onKeyUp={handleCursorChange}
          onClick={handleCursorChange}
          spellCheck={false}
        />
        {remoteCursors.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 4,
            left: 8,
            right: 8,
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            pointerEvents: 'none',
          }}>
            {remoteCursors.slice(0, 3).map(c => (
              <span
                key={c.clientId}
                style={{
                  background: c.color.background,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 10,
                  whiteSpace: 'nowrap',
                  lineHeight: '18px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                {c.username} · line {c.line}
              </span>
            ))}
            {remoteCursors.length > 3 && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                color: '#666',
              }}>
                +{remoteCursors.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mermaid-editor__divider" ref={dividerRef} />
      <div className="mermaid-editor__preview" style={{ width: `calc(${100 - leftWidth}% - 3px)` }}>
        <div ref={previewRef} className="mermaid-editor__preview-content" />
        {error && (
          <div className="mermaid-editor__error">{error}</div>
        )}
      </div>
    </div>
  );
});

MermaidEditor.displayName = 'MermaidEditor';
export default MermaidEditor;
