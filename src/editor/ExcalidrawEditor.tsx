import React, { useState, useEffect, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import { exportToCanvas } from '@excalidraw/excalidraw';

interface DrawingData {
  type: string;
  version: number;
  source: string;
  elements: readonly any[];
  appState: {
    viewBackgroundColor?: string;
    gridSize?: number | null;
  };
}

interface StorageData {
  value: string;
  pngSnapshot: string;
}

const ExcalidrawEditor: React.FC = () => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initialData, setInitialData] = useState<DrawingData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initialize Confluence Connect API
    AP.resize();

    // Load existing content if editing
    loadExistingContent();
  }, []);

  const loadExistingContent = async (): Promise<void> => {
    try {
      // Get content from Confluence custom content storage
      const context = await AP.context.getContext();
      
      if (context.contentId) {
        // Try to load existing drawing data
        const content = await AP.request('/rest/api/content/' + context.contentId, {
          type: 'GET',
        });
        
        if (content && content.body) {
          const parsedContent = JSON.parse(content.body) as { storage?: { value?: string } };
          const drawingData = parsedContent.storage?.value;
          
          if (drawingData) {
            try {
              const parsed = JSON.parse(drawingData) as DrawingData;
              setInitialData(parsed);
            } catch (e) {
              console.log('No existing drawing data found');
            }
          }
        }
      }
    } catch (error) {
      console.log('Loading content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDrawing = useCallback(async (): Promise<void> => {
    if (!excalidrawAPI) return;

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      
      const drawingData: DrawingData = {
        type: 'excalidraw',
        version: 2,
        source: 'excalfluence',
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
      };

      // Generate PNG snapshot
      const canvas = await exportToCanvas({
        elements,
        appState: {
          ...appState,
          exportBackground: true,
        },
        files: excalidrawAPI.getFiles(),
        getDimensions: (width: number, height: number) => ({ width, height, scale: 1 }),
      });
      const pngDataURL = canvas.toDataURL('image/png');

      // Save to Confluence custom content storage
      const context = await AP.context.getContext();
      
      const storageData: StorageData = {
        value: JSON.stringify(drawingData),
        pngSnapshot: pngDataURL,
      };

      // Use Confluence Connect API to save content
      await AP.request('/rest/api/content/' + context.contentId, {
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({
          version: {
            number: (context.version || 0) + 1,
          },
          storage: {
            value: JSON.stringify(storageData),
            representation: 'storage',
          },
        }),
      });

      // Notify Confluence that content has been saved
      AP.confluence.saveMacro({
        storage: {
          value: JSON.stringify(storageData),
        },
      });

      // Close editor
      AP.confluence.closeMacroEditor();
    } catch (error) {
      console.error('Error saving drawing:', error);
      alert('Failed to save drawing. Please try again.');
    }
  }, [excalidrawAPI]);

  const handleCancel = useCallback((): void => {
    AP.confluence.closeMacroEditor();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading editor...</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#f4f5f7', 
        borderBottom: '1px solid #dfe1e6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0 }}>Excalidraw Editor</h3>
        <div>
          <button 
            onClick={handleCancel}
            style={{ 
              marginRight: '10px', 
              padding: '8px 16px',
              backgroundColor: '#fff',
              border: '1px solid #dfe1e6',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={saveDrawing}
            style={{ 
              padding: '8px 16px',
              backgroundColor: '#0052cc',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <Excalidraw
          excalidrawAPI={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
          initialData={initialData ? {
            ...initialData,
            appState: initialData.appState ? {
              ...initialData.appState,
              gridSize: initialData.appState.gridSize ?? undefined,
            } : undefined,
          } as ExcalidrawInitialDataState : undefined}
          onChange={(elements, appState, files) => {
            // Auto-save could be implemented here if needed
          }}
        />
      </div>
    </div>
  );
};

export default ExcalidrawEditor;
