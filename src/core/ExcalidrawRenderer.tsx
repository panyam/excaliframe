import React, { useState, useEffect } from 'react';
import { RendererHost } from './types';

interface Props {
  host: RendererHost;
}

const ExcalidrawRenderer: React.FC<Props> = ({ host }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingFullPreview, setIsLoadingFullPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasContent, setHasContent] = useState<boolean>(false);

  useEffect(() => {
    console.log('Renderer mounting...');
    loadConfig();
  }, []);

  const loadConfig = async (): Promise<void> => {
    console.log('Renderer - Loading config...');
    try {
      const envelope = await host.loadConfig();

      console.log('Renderer - Config received:', envelope ? 'yes' : 'no');

      // Show thumbnail or inline preview immediately
      if (envelope?.thumbnail) {
        console.log('Renderer - Setting thumbnail, length:', envelope.thumbnail.length);
        setPreviewUrl(envelope.thumbnail);
        setHasContent(true);
      }
      if (envelope?.preview && envelope.preview !== envelope.thumbnail) {
        console.log('Renderer - Setting inline preview, length:', envelope.preview.length);
        setPreviewUrl(envelope.preview);
        setHasContent(true);
      } else if (envelope?.preview) {
        setHasContent(true);
      }

      // Fetch full preview from host asynchronously (V3 — host handles the fetch)
      if (host.loadFullPreview) {
        console.log('Renderer - Requesting full preview from host...');
        setIsLoadingFullPreview(true);
        try {
          const fullPreview = await host.loadFullPreview();
          if (fullPreview) {
            console.log(`Renderer - Full preview loaded, ${(fullPreview.length / 1024).toFixed(1)}KB`);
            setPreviewUrl(fullPreview);
          }
        } catch (err) {
          console.warn('Renderer - Failed to load full preview, keeping thumbnail:', err);
        }
        setIsLoadingFullPreview(false);
      }

      if (!envelope?.preview && !envelope?.thumbnail && envelope?.data) {
        console.log('Renderer - Has drawing but no preview');
        setHasContent(true);
      } else if (!envelope?.preview && !envelope?.thumbnail) {
        console.log('Renderer - No config data');
        setHasContent(false);
      }
    } catch (err) {
      console.error('Renderer - Error loading config:', err);
      setError('Failed to load drawing');
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100px',
        padding: '20px',
        backgroundColor: '#fafbfc',
        border: '1px solid #dfe1e6',
        borderRadius: '3px'
      }}>
        <div style={{ color: '#6b778c' }}>Loading drawing...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        backgroundColor: '#ffebe6',
        border: '1px solid #ff8f73',
        borderRadius: '3px',
        color: '#de350b'
      }}>
        <p style={{ margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        backgroundColor: '#fafbfc',
        border: '2px dashed #dfe1e6',
        borderRadius: '3px'
      }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎨</div>
        <p style={{ margin: 0, color: '#6b778c', fontSize: '14px' }}>
          Empty Excalidraw drawing
        </p>
        <p style={{ margin: '8px 0 0 0', color: '#97a0af', fontSize: '12px' }}>
          Edit this macro to add content
        </p>
      </div>
    );
  }

  if (previewUrl) {
    // SVG data URIs (Mermaid C4 diagrams) contain <foreignObject> that browsers
    // strip in <img> tags. Render inline instead.
    // SECURITY: SVG is from mermaid's own renderer, stored in Confluence macro
    // config — not user-supplied HTML. DOMPurify hardening is tracked in backlog.
    const isSvgDataUri = previewUrl.startsWith('data:image/svg+xml;base64,');
    const svgMarkup = isSvgDataUri
      ? decodeURIComponent(escape(atob(previewUrl.slice('data:image/svg+xml;base64,'.length))))
      : '';

    return (
      <div style={{
        width: '100%',
        backgroundColor: '#fff',
        border: '1px solid #dfe1e6',
        borderRadius: '3px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {isSvgDataUri
          // eslint-disable-next-line react/no-danger
          ? <div dangerouslySetInnerHTML={{ __html: svgMarkup }} style={{ width: '100%' }} />
          : <img
              src={previewUrl}
              alt="Drawing"
              style={{
                display: 'block',
                maxWidth: '100%',
                height: 'auto',
                margin: '0 auto',
                transition: 'filter 0.3s ease',
                filter: isLoadingFullPreview ? 'blur(2px)' : 'none',
              }}
            />
        }
      </div>
    );
  }

  // Has content but no preview
  return (
    <div style={{
      padding: '40px 20px',
      textAlign: 'center',
      backgroundColor: '#fafbfc',
      border: '1px solid #dfe1e6',
      borderRadius: '3px'
    }}>
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎨</div>
      <p style={{ margin: 0, color: '#172b4d', fontSize: '14px' }}>
        Excalidraw Drawing
      </p>
      <p style={{ margin: '8px 0 0 0', color: '#97a0af', fontSize: '12px' }}>
        Edit to view content
      </p>
    </div>
  );
};

export default ExcalidrawRenderer;
