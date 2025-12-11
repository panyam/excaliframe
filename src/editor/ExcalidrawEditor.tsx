import React, { useState, useEffect, useCallback, useRef } from 'react';
import { exportToCanvas } from '@excalidraw/excalidraw';
import type {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFiles
} from '@excalidraw/excalidraw/types/types';
import { VERSION, BUILD_DATE } from '../version';
import { getAP, isRunningInConfluence } from '../utils/mockAP';

type ExcalidrawElement = any;

interface DrawingData {
  type: string;
  version: number;
  source: string;
  elements: any[];
  appState: {
    viewBackgroundColor?: string;
    gridSize?: number | null;
  };
  files?: Record<string, any>;
}

interface StorageData {
  drawing: string;
  preview: string;
}

const ExcalidrawEditor: React.FC = () => {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<any>(null);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [initialData, setInitialData] = useState<{
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Dynamically load Excalidraw
  useEffect(() => {
    console.log(`Excalfluence v${VERSION} (built ${BUILD_DATE})`);
    import('@excalidraw/excalidraw').then((module) => {
      setExcalidrawComponent(() => module.Excalidraw);
    });
  }, []);

  // Load macro body on mount
  useEffect(() => {
    const AP = getAP();
    try {
      AP.resize('100%', '100%');
    } catch (e) {
      console.log('Could not resize:', e);
    }
    loadMacroBody();
  }, []);

  const loadMacroBody = (): void => {
    const AP = getAP();
    try {
      AP.confluence.getMacroBody((body: string) => {
        console.log('Macro body:', body ? body.substring(0, 100) : 'empty');
        if (body && body.trim()) {
          try {
            const storageData: StorageData = JSON.parse(body);
            if (storageData.drawing) {
              const drawingData: DrawingData = JSON.parse(storageData.drawing);
              setInitialData({
                elements: drawingData.elements || [],
                appState: {
                  viewBackgroundColor: drawingData.appState?.viewBackgroundColor || '#ffffff',
                },
                files: drawingData.files || {},
              });
            }
          } catch (e) {
            console.log('Could not parse macro body:', e);
          }
        }
        setIsLoading(false);
      });
    } catch (error) {
      console.log('Error loading macro body:', error);
      setIsLoading(false);
    }
  };

  const saveDrawing = useCallback(async (): Promise<void> => {
    if (!excalidrawApiRef.current || isSaving) return;

    setIsSaving(true);
    try {
      const elements = excalidrawApiRef.current.getSceneElements();
      const appState = excalidrawApiRef.current.getAppState();
      const files = excalidrawApiRef.current.getFiles();

      const drawingData: DrawingData = {
        type: 'excalidraw',
        version: 2,
        source: 'excalfluence',
        elements: [...elements],
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files: files,
      };

      // Generate PNG preview
      let pngDataURL = '';
      if (elements.length > 0) {
        try {
          const canvas = await exportToCanvas({
            elements,
            appState: {
              ...appState,
              exportBackground: true,
            },
            files,
          });
          pngDataURL = canvas.toDataURL('image/png');
        } catch (e) {
          console.log('Could not generate preview:', e);
        }
      }

      const storageData: StorageData = {
        drawing: JSON.stringify(drawingData),
        preview: pngDataURL,
      };

      const macroBody = JSON.stringify(storageData);
      console.log('Saving macro body, length:', macroBody.length);

      const AP = getAP();
      AP.confluence.saveMacro({}, macroBody);
      AP.confluence.closeMacroEditor();
    } catch (error) {
      console.error('Error saving drawing:', error);
      alert('Failed to save drawing. Please try again.');
      setIsSaving(false);
    }
  }, [isSaving]);

  const handleCancel = useCallback((): void => {
    const AP = getAP();
    AP.confluence.closeMacroEditor();
  }, []);

  if (!ExcalidrawComponent || isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#fff'
      }}>
        <div>Loading editor...</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
      {/* Toolbar */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#f4f5f7',
        borderBottom: '1px solid #dfe1e6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>Excalidraw</h3>
          <span style={{ fontSize: '11px', color: '#6b778c' }}>v{VERSION}</span>
          {!isRunningInConfluence() && (
            <span style={{
              fontSize: '10px',
              color: '#fff',
              backgroundColor: '#ff7452',
              padding: '2px 6px',
              borderRadius: '3px',
            }}>
              DEV MODE
            </span>
          )}
        </div>
        <div>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            style={{
              marginRight: '8px',
              padding: '6px 12px',
              backgroundColor: '#fff',
              border: '1px solid #dfe1e6',
              borderRadius: '3px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={saveDrawing}
            disabled={isSaving}
            style={{
              padding: '6px 12px',
              backgroundColor: isSaving ? '#84bef7' : '#0052cc',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {isSaving ? 'Saving...' : 'Insert'}
          </button>
        </div>
      </div>

      {/* Excalidraw Canvas */}
      <div style={{ flex: 1, width: '100%', height: '100%' }} className="excalidraw-wrapper">
        <ExcalidrawComponent
          excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
            excalidrawApiRef.current = api;
          }}
          initialData={initialData || {
            elements: [],
            appState: {
              viewBackgroundColor: '#ffffff',
              currentItemStrokeColor: '#000000',
              currentItemBackgroundColor: 'transparent',
            },
          }}
          theme="light"
          UIOptions={{
            canvasActions: {
              loadScene: false,
            },
          }}
        />
      </div>
    </div>
  );
};

export default ExcalidrawEditor;
