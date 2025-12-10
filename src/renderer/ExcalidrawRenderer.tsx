import React, { useState, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawInitialDataState } from '@excalidraw/excalidraw/dist/types/excalidraw/types';

interface DrawingData {
  type?: string;
  version?: number;
  source?: string;
  elements?: readonly any[];
  appState?: {
    viewBackgroundColor?: string;
    gridSize?: number | null;
  };
}

interface StorageData {
  value?: string;
  pngSnapshot?: string;
}

interface ConfluenceContent {
  body?: {
    storage?: {
      value?: string;
    };
  };
}

const ExcalidrawRenderer: React.FC = () => {
  const [drawingData, setDrawingData] = useState<DrawingData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDrawingData();
  }, []);

  const loadDrawingData = async (): Promise<void> => {
    try {
      // Get content from Confluence custom content storage
      const context = await AP.context.getContext();
      
      if (!context.contentId) {
        throw new Error('No content ID found');
      }

      // Load content from Confluence
      const response = await AP.request('/rest/api/content/' + context.contentId + '?expand=body.storage', {
        type: 'GET',
      });

      if (response && response.body) {
        const content = JSON.parse(response.body) as ConfluenceContent;
        const storageValue = content.body?.storage?.value;
        
        if (storageValue) {
          try {
            const parsed = JSON.parse(storageValue) as StorageData | DrawingData;
            // Check if it's wrapped in StorageData format
            if ('value' in parsed && typeof parsed.value === 'string') {
              const drawingJson = JSON.parse(parsed.value) as DrawingData;
              setDrawingData(drawingJson);
            } else {
              // Direct DrawingData format
              setDrawingData(parsed as DrawingData);
            }
          } catch (e) {
            // Try direct parsing if nested structure doesn't exist
            const drawingJson = JSON.parse(storageValue) as DrawingData;
            setDrawingData(drawingJson);
          }
        } else {
          setError('No drawing data found');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error loading drawing:', err);
      setError('Failed to load drawing: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (): Promise<void> => {
    try {
      const context = await AP.context.getContext();
      AP.confluence.editMacro({
        macroId: context.contentId || '',
      });
    } catch (err) {
      console.error('Error opening editor:', err);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        padding: '20px'
      }}>
        <div>Loading drawing...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: '#de350b'
      }}>
        <p>{error}</p>
      </div>
    );
  }

  if (!drawingData) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: '#6b778c'
      }}>
        <p>No drawing data available</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
      }}>
        <button
          onClick={handleEdit}
          style={{
            padding: '6px 12px',
            backgroundColor: '#0052cc',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          Edit
        </button>
      </div>
      <div style={{ width: '100%', height: '600px' }}>
        <Excalidraw
          initialData={drawingData ? {
            ...drawingData,
            appState: drawingData.appState ? {
              ...drawingData.appState,
              gridSize: drawingData.appState.gridSize ?? undefined,
            } : undefined,
          } as ExcalidrawInitialDataState : undefined}
          viewModeEnabled={true}
          zenModeEnabled={false}
          gridModeEnabled={false}
        />
      </div>
    </div>
  );
};

export default ExcalidrawRenderer;
