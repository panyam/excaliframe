import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MermaidRemoteCursor } from '../collab/adapters/MermaidSyncAdapter';

interface CursorPosition {
  top: number;
  left: number;
}

interface MermaidCursorOverlayProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  code: string;
  cursors: MermaidRemoteCursor[];
}

/** Copy text-related computed styles from textarea to a mirror div. */
const MIRROR_STYLE_PROPS = [
  'font-family', 'font-size', 'font-weight', 'font-style',
  'line-height', 'letter-spacing', 'word-spacing', 'text-indent',
  'white-space', 'word-wrap', 'overflow-wrap', 'tab-size',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'box-sizing',
];

/** Compute pixel position of char offsets within a textarea using a mirror div. */
function measureCursorPositions(
  textarea: HTMLTextAreaElement,
  code: string,
  offsets: number[],
): CursorPosition[] {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  for (const p of MIRROR_STYLE_PROPS) {
    mirror.style.setProperty(p, style.getPropertyValue(p));
  }
  mirror.style.width = textarea.clientWidth + 'px';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflow = 'hidden';
  mirror.style.position = 'absolute';
  mirror.style.top = '-9999px';
  mirror.style.left = '-9999px';
  mirror.style.visibility = 'hidden';
  document.body.appendChild(mirror);

  const results: CursorPosition[] = [];
  for (const offset of offsets) {
    const clamped = Math.max(0, Math.min(offset, code.length));
    const marker = document.createElement('span');
    marker.textContent = '\u200b'; // zero-width space

    mirror.textContent = '';
    mirror.appendChild(document.createTextNode(code.slice(0, clamped)));
    mirror.appendChild(marker);
    mirror.appendChild(document.createTextNode(code.slice(clamped)));

    results.push({ top: marker.offsetTop, left: marker.offsetLeft });
  }

  document.body.removeChild(mirror);
  return results;
}

const CARET_BLINK_CSS = `
@keyframes mermaid-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`;

export default function MermaidCursorOverlay({ textareaRef, code, cursors }: MermaidCursorOverlayProps) {
  const [positions, setPositions] = useState<CursorPosition[]>([]);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const styleInjected = useRef(false);

  // Inject blink keyframes once
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const s = document.createElement('style');
    s.textContent = CARET_BLINK_CSS;
    s.setAttribute('data-mermaid-cursor', '');
    document.head.appendChild(s);
    return () => { s.remove(); styleInjected.current = false; };
  }, []);

  // Track textarea scroll
  const onScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) setScroll({ top: ta.scrollTop, left: ta.scrollLeft });
  }, [textareaRef]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.addEventListener('scroll', onScroll);
    return () => ta.removeEventListener('scroll', onScroll);
  }, [textareaRef, onScroll]);

  // Measure positions whenever cursors or code change
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || cursors.length === 0) {
      setPositions([]);
      return;
    }
    const offsets = cursors.map(c => c.charOffset);
    setPositions(measureCursorPositions(ta, code, offsets));
  }, [textareaRef, code, cursors]);

  if (cursors.length === 0 || positions.length !== cursors.length) return null;

  const ta = textareaRef.current;
  if (!ta) return null;
  const computedStyle = window.getComputedStyle(ta);
  const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.6;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {cursors.map((cursor, i) => {
        const pos = positions[i];
        if (!pos) return null;
        const top = pos.top - scroll.top;
        const left = pos.left - scroll.left;

        // Skip carets that are scrolled out of view
        if (top + lineHeight < 0 || top > ta.clientHeight) return null;
        if (left < 0 || left > ta.clientWidth) return null;

        return (
          <div key={cursor.clientId} style={{
            position: 'absolute',
            top,
            left,
          }}>
            {/* Caret line */}
            <div style={{
              width: 2,
              height: lineHeight,
              background: cursor.color.background,
              animation: 'mermaid-cursor-blink 1s step-end infinite',
              borderRadius: 1,
            }} />
            {/* Name flag */}
            <div style={{
              position: 'absolute',
              top: -16,
              left: 0,
              background: cursor.color.background,
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: '3px 3px 3px 0',
              whiteSpace: 'nowrap',
              lineHeight: '14px',
              textShadow: '0 1px 1px rgba(0,0,0,0.2)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              {cursor.username}
            </div>
          </div>
        );
      })}
    </div>
  );
}
