import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EditorHost, DrawingEnvelope } from './types';

interface Props {
  host: EditorHost;
  /** Show the Cancel button and top toolbar. Default true (Forge mode).
   *  When false, floating dirty badge (playground). */
  showCancel?: boolean;
}

const DEFAULT_TEMPLATE = `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E
`;

/** Safely insert mermaid-rendered SVG into a container using DOM parsing. */
function setSvgContent(container: HTMLElement, svgString: string): void {
  container.textContent = '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;
  if (svgEl && svgEl.nodeName === 'svg') {
    container.appendChild(document.importNode(svgEl, true));
  }
}


const MermaidEditor: React.FC<Props> = ({ host, showCancel = true }) => {
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
        // 'strict' uses DOMPurify internally to sanitize rendered SVG
        securityLevel: 'strict',
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
        alignItems: 'center', height: '100vh', backgroundColor: '#fff', gap: '16px',
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
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
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
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {editorPane}
        </div>
      </div>
    );
  }

  // No-toolbar mode (playground): floating dirty badge
  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative', backgroundColor: '#fff' }}>
      {editorPane}
      {isDirty && (
        <div style={{
          position: 'fixed', bottom: '16px', left: '16px', padding: '6px 14px',
          backgroundColor: 'rgba(222, 53, 11, 0.9)', color: 'white', borderRadius: '20px',
          fontSize: '12px', fontWeight: 500, zIndex: 1000, pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          Unsaved changes — ⌘S to save
        </div>
      )}
    </div>
  );
};

export default MermaidEditor;
