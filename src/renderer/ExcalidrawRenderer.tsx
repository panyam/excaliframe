import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    loadMacroBody();
    // Resize iframe to fit content
    setTimeout(() => {
      AP.resize('100%', '400px');
    }, 100);
  }, []);

  const loadMacroBody = (): void => {
    try {
      AP.confluence.getMacroBody((body: string) => {
        console.log('Renderer - Macro body:', body ? body.substring(0, 100) + '...' : 'empty');

        if (body && body.trim()) {
          try {
            const storageData: StorageData = JSON.parse(body);

            if (storageData.preview) {
              setPreviewUrl(storageData.preview);
              setHasContent(true);
            } else if (storageData.drawing) {
              // Has drawing but no preview - show placeholder
              setHasContent(true);
            }
          } catch (e) {
            console.log('Could not parse macro body:', e);
            setError('Invalid drawing data');
          }
        } else {
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

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
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
        padding: '60px 20px',
        textAlign: 'center',
        backgroundColor: '#fafbfc',
        border: '2px dashed #dfe1e6',
        borderRadius: '3px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
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
      <div style={{
        width: '100%',
        backgroundColor: '#fff',
        border: '1px solid #dfe1e6',
        borderRadius: '3px',
        overflow: 'hidden'
      }}>
        <img
          src={previewUrl}
          alt="Excalidraw drawing"
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
    <div style={{
      padding: '60px 20px',
      textAlign: 'center',
      backgroundColor: '#fafbfc',
      border: '1px solid #dfe1e6',
      borderRadius: '3px'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
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
