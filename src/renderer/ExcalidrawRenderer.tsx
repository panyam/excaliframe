import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAP } from '../utils/mockAP';

interface DrawingData {
  type?: string;
  version?: number;
  source?: string;
  elements?: any[];
  appState?: {
    viewBackgroundColor?: string;
    gridSize?: number | null;
  };
  files?: Record<string, any>;
}

interface StorageData {
  drawing: string;
  preview: string;
}

const ExcalidrawRenderer: React.FC = () => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasContent, setHasContent] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const resizeToFit = useCallback((height?: number) => {
    const AP = getAP();
    if (height) {
      // Add small padding for border
      AP.resize('100%', `${height + 10}px`);
    } else if (containerRef.current) {
      const contentHeight = containerRef.current.offsetHeight;
      AP.resize('100%', `${contentHeight + 10}px`);
    }
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Resize iframe to match actual image height
    resizeToFit(img.offsetHeight);
  }, [resizeToFit]);

  useEffect(() => {
    console.log('Renderer mounting...');
    loadMacroBody();
  }, []);

  const loadMacroBody = (): void => {
    const AP = getAP();
    console.log('Renderer - Loading macro body...');
    try {
      AP.confluence.getMacroBody((body: string) => {
        console.log('Renderer - Macro body received:', body ? `${body.length} chars` : 'empty');
        if (body) {
          console.log('Renderer - Body preview:', body.substring(0, 200));
        }

        if (body && body.trim()) {
          try {
            const storageData: StorageData = JSON.parse(body);
            console.log('Renderer - Parsed storage data, has preview:', !!storageData.preview, 'has drawing:', !!storageData.drawing);

            if (storageData.preview) {
              console.log('Renderer - Setting preview URL, length:', storageData.preview.length);
              setPreviewUrl(storageData.preview);
              setHasContent(true);
            } else if (storageData.drawing) {
              console.log('Renderer - Has drawing but no preview');
              // Has drawing but no preview - show placeholder
              setHasContent(true);
            } else {
              console.log('Renderer - No preview or drawing in storage data');
            }
          } catch (e) {
            console.error('Renderer - Could not parse macro body:', e);
            setError('Invalid drawing data');
          }
        } else {
          console.log('Renderer - Empty or whitespace-only body');
          // Empty macro - show placeholder
          setHasContent(false);
        }
        setIsLoading(false);
      });
    } catch (err) {
      console.error('Error loading macro body:', err);
      setError('Failed to load drawing');
      setIsLoading(false);
    }
  };

  // Resize for non-image states
  useEffect(() => {
    if (!isLoading && !previewUrl) {
      // Small delay to let DOM render
      setTimeout(() => resizeToFit(), 50);
    }
  }, [isLoading, previewUrl, hasContent, error, resizeToFit]);

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
      <div
        ref={containerRef}
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#ffebe6',
          border: '1px solid #ff8f73',
          borderRadius: '3px',
          color: '#de350b'
        }}
      >
        <p style={{ margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div
        ref={containerRef}
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          backgroundColor: '#fafbfc',
          border: '2px dashed #dfe1e6',
          borderRadius: '3px'
        }}
      >
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
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          backgroundColor: '#fff',
          border: '1px solid #dfe1e6',
          borderRadius: '3px',
          overflow: 'hidden'
        }}
      >
        <img
          src={previewUrl}
          alt="Excalidraw drawing"
          onLoad={handleImageLoad}
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            margin: '0 auto'
          }}
        />
      </div>
    );
  }

  // Has content but no preview
  return (
    <div
      ref={containerRef}
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        backgroundColor: '#fafbfc',
        border: '1px solid #dfe1e6',
        borderRadius: '3px'
      }}
    >
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
