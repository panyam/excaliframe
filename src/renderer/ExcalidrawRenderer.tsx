import React, { useState, useEffect } from 'react';
import { view } from '@forge/bridge';

// Macro config stored in Forge
interface MacroConfig {
  drawing: string;   // JSON stringified DrawingData
  preview: string;   // Base64 PNG preview
}

const ExcalidrawRenderer: React.FC = () => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasContent, setHasContent] = useState<boolean>(false);

  useEffect(() => {
    console.log('Renderer mounting...');
    loadMacroConfig();
  }, []);

  const loadMacroConfig = async (): Promise<void> => {
    console.log('Renderer - Loading macro config...');
    try {
      const context = await view.getContext();
      const config = (context as any).extension?.config as MacroConfig | undefined;

      console.log('Renderer - Config received:', config ? 'yes' : 'no');

      if (config?.preview) {
        console.log('Renderer - Setting preview URL, length:', config.preview.length);
        setPreviewUrl(config.preview);
        setHasContent(true);
      } else if (config?.drawing) {
        console.log('Renderer - Has drawing but no preview');
        setHasContent(true);
      } else {
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
