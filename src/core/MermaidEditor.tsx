import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EditorHost, DrawingEnvelope } from './types';
import { useAutoSave } from './useAutoSave';
import AutoSaveToggle from './AutoSaveToggle';
import { CollabConfig } from '../collab/types';
import { useCollaboration } from '../collab/useCollaboration';
import CollabPanel from '../collab/CollabPanel';
import CollabBadge from '../collab/CollabBadge';

interface Props {
  host: EditorHost;
  /** Show the Cancel button and top toolbar. Default true (Forge mode).
   *  When false, floating dirty badge (playground). */
  showCancel?: boolean;
  /** Optional collab config — opt-in collaboration via dialog. */
  collabConfig?: CollabConfig;
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


const MermaidEditor: React.FC<Props> = ({ host, showCancel = true, collabConfig }) => {
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
  const [leftWidth, setLeftWidth] = useState(50); // percentage

  const isDirty = code !== initialCode;

  // Load mermaid library
  useEffect(() => {
    import('mermaid').then((mod) => {
      const m = mod.default;
      m.initialize({
        startOnLoad: false,
        theme: 'default',
        // 'loose' is needed because 'strict' uses DOMPurify which strips
        // <foreignObject> elements required by C4 diagrams.
        // Safe here: users only render their own local content.
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
        // Keep last valid SVG visible
      }
    }, 300);
    return () => {
      if (renderTimer.current) clearTimeout(renderTimer.current);
    };
  }, [code, isLoading, mermaid]);

  const saveDrawing = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // Store SVG as data URI preview. PNG conversion via canvas doesn't work
      // for mermaid SVGs because they contain <foreignObject> elements that
      // browsers block when rendering SVG as an Image src.
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
    } catch (err) {
      console.error('MermaidEditor - Error saving:', err);
      alert('Failed to save drawing. Please try again.');
      setIsSaving(false);
    }
  }, [code, isSaving, host]);

  const { autoSaveEnabled, setAutoSaveEnabled, autoSaveStatus } = useAutoSave({
    isDirty,
    isSaving,
    canAutoSave: !showCancel,
    onSave: saveDrawing,
  });

  // Collaboration
  const [collabState, collabActions] = useCollaboration('mermaid');
  const [showCollabPanel, setShowCollabPanel] = useState(!!collabConfig?.initialRelayUrl);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    host.close();
  }, [isDirty, host]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveDrawing();
      }
      if (showCancel && e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleCancel, saveDrawing, showCancel]);

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
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  }, []);

  // Resizable divider drag handling
  useEffect(() => {
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
      setLeftWidth(Math.min(80, Math.max(20, pct)));
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
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
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', height: '100%', backgroundColor: '#fff', gap: '16px',
      }}>
        <div style={{
          width: '48px', height: '48px', border: '3px solid #f3f4f6',
          borderTop: '3px solid #0052cc', borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ color: '#172b4d', fontSize: '16px', fontWeight: 500 }}>
          Loading Mermaid...
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const editorPane = (
    <div className="mermaid-editor" ref={containerRef}>
      <div className="mermaid-editor__code" style={{ width: `${leftWidth}%` }}>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          spellCheck={false}
        />
      </div>
      <div className="mermaid-editor__divider" ref={dividerRef} />
      <div className="mermaid-editor__preview" style={{ width: `${100 - leftWidth}%` }}>
        <div ref={previewRef} className="mermaid-editor__preview-content" />
        {error && (
          <div className="mermaid-editor__error">{error}</div>
        )}
      </div>
    </div>
  );

  // Toolbar mode (Forge): top bar with Save + Cancel
  if (showCancel) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        <div style={{
          padding: '8px 16px', backgroundColor: '#f4f5f7', borderBottom: '1px solid #dfe1e6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>Mermaid</h3>
            {isDirty && (
              <span style={{ fontSize: '11px', color: '#de350b', fontWeight: 500 }}>
                • Unsaved changes
              </span>
            )}
            <CollabBadge state={collabState} onClick={() => setShowCollabPanel(!showCollabPanel)} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCancel} disabled={isSaving}
              style={{ padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #dfe1e6',
                borderRadius: '3px', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
              Cancel
            </button>
            <button onClick={saveDrawing} disabled={isSaving}
              style={{ padding: '6px 12px', backgroundColor: isSaving ? '#84bef7' : '#0052cc',
                color: 'white', border: 'none', borderRadius: '3px',
                cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {showCollabPanel && (
          <CollabPanel state={collabState} actions={collabActions} tool="mermaid"
            drawingId={collabConfig?.drawingId ?? ''} onClose={() => setShowCollabPanel(false)} />
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {editorPane}
        </div>
      </div>
    );
  }

  // No-toolbar mode (playground): floating dirty badge + auto-save toggle
  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', backgroundColor: '#fff' }}>
      {editorPane}
      <div style={{
        position: 'fixed', bottom: '16px', right: '16px', zIndex: 1000,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
      }}>
        {showCollabPanel && (
          <div className="bg-white/95 dark:bg-gray-800/95 rounded-lg p-3 shadow-lg min-w-[280px]">
            <CollabPanel state={collabState} actions={collabActions} tool="mermaid"
            drawingId={collabConfig?.drawingId ?? ''} onClose={() => setShowCollabPanel(false)} />
          </div>
        )}
        <CollabBadge state={collabState} onClick={() => setShowCollabPanel(!showCollabPanel)} />
      </div>
      {(() => {
        let badgeText: string | null = null;
        let badgeBg = 'rgba(222, 53, 11, 0.9)';

        if (autoSaveStatus === 'saved') {
          badgeText = 'Saved';
          badgeBg = 'rgba(0, 135, 90, 0.9)';
        } else if (autoSaveStatus === 'saving') {
          badgeText = 'Saving\u2026';
          badgeBg = 'rgba(0, 82, 204, 0.9)';
        } else if (isDirty && autoSaveEnabled) {
          badgeText = 'Auto-saving\u2026';
          badgeBg = 'rgba(255, 171, 0, 0.9)';
        } else if (isDirty) {
          badgeText = 'Unsaved changes \u2014 \u2318S to save';
        }

        return badgeText ? (
          <div style={{
            position: 'fixed', bottom: '16px', left: '16px', padding: '6px 14px',
            backgroundColor: badgeBg, color: 'white', borderRadius: '20px',
            fontSize: '12px', fontWeight: 500, zIndex: 1000, pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            {badgeText}
          </div>
        ) : null;
      })()}
      <div style={{
        position: 'fixed', bottom: '16px', right: '70px', zIndex: 1000,
        backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '8px',
        padding: '4px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <AutoSaveToggle enabled={autoSaveEnabled} onChange={setAutoSaveEnabled} />
      </div>
    </div>
  );
};

export default MermaidEditor;
