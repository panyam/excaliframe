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

  // Load macro body on mount and set up dialog button binding
  useEffect(() => {
    const AP = getAP();
    try {
      AP.resize('100%', '100%');
    } catch (e) {
      console.log('Could not resize:', e);
    }
    loadMacroBody();

    // Bind to Confluence's dialog submit button using the official pattern
    // This is the recommended way per Atlassian docs for macro custom editors
    if (AP.dialog && AP.dialog.getButton) {
      console.log('Editor - Binding to dialog submit button');
      AP.dialog.getButton('submit').bind(() => {
        console.log('Editor - Dialog submit button clicked');
        if (excalidrawApiRef.current) {
          saveDrawingFromEvent();
        }
        return true; // Allow dialog to proceed
      });
    }
  }, []);

  const loadMacroBody = (): void => {
    const AP = getAP();
    console.log('Editor - loadMacroBody called');

    // Also check getMacroData to see parameters
    if (AP.confluence.getMacroData) {
      AP.confluence.getMacroData((data: any) => {
        console.log('Editor - getMacroData result:', data);
      });
    }

    try {
      AP.confluence.getMacroBody((body: string) => {
        console.log('Editor - getMacroBody callback, body type:', typeof body, 'length:', body?.length || 0);
        console.log('Editor - getMacroBody body preview:', body ? body.substring(0, 200) : '(empty or null)');
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

  // Core save logic - used by both button click and dialog event
  // closeAfterSave: true for button click, false for dialog.submit (Confluence handles close)
  const performSave = async (closeAfterSave: boolean = true): Promise<void> => {
    if (!excalidrawApiRef.current) {
      console.log('Editor - No excalidraw API ref, cannot save');
      return;
    }

    console.log('Editor - performSave starting...');

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
          console.log('Editor - Could not generate preview:', e);
        }
      }

      const storageData: StorageData = {
        drawing: JSON.stringify(drawingData),
        preview: pngDataURL,
      };

      const macroBody = JSON.stringify(storageData);
      console.log('Editor - Saving macro body, length:', macroBody.length);
      console.log('Editor - Elements count:', elements.length);
      console.log('Editor - Preview generated:', pngDataURL ? 'yes' : 'no');

      const AP = getAP();
      console.log('Editor - Calling AP.confluence.saveMacro...');

      // Call saveMacro to save the macro data
      // First arg is macro parameters (key-value pairs), second is macro body
      console.log('Editor - About to call saveMacro with body length:', macroBody.length);

      try {
        AP.confluence.saveMacro({}, macroBody);
        console.log('Editor - saveMacro completed successfully');
      } catch (saveError) {
        console.error('Editor - saveMacro threw error:', saveError);
      }

      // Close the macro editor to signal Confluence to insert the macro
      // Only call this when triggered by our own button, not dialog.submit
      if (closeAfterSave) {
        console.log('Editor - Calling closeMacroEditor');
        AP.confluence.closeMacroEditor();
      } else {
        console.log('Editor - Not calling closeMacroEditor (dialog.submit handles it)');
      }
    } catch (error) {
      console.error('Editor - Error saving drawing:', error);
      throw error;
    }
  };

  // Called from dialog.submit event
  const saveDrawingFromEvent = (): void => {
    console.log('Editor - saveDrawingFromEvent called');
    // Call saveMacro, then closeMacroEditor after a delay
    performSave(false).then(() => {
      // Give saveMacro time to complete, then close
      setTimeout(() => {
        console.log('Editor - Delayed closeMacroEditor call');
        const AP = getAP();
        AP.confluence.closeMacroEditor();
      }, 100);
    }).catch((error) => {
      console.error('Editor - Save from event failed:', error);
      alert('Failed to save drawing. Please try again.');
    });
  };

  const saveDrawing = useCallback(async (): Promise<void> => {
    if (!excalidrawApiRef.current || isSaving) return;

    setIsSaving(true);
    try {
      await performSave();
      // performSave now calls closeMacroEditor
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
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#fff',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #f3f4f6',
          borderTop: '3px solid #0052cc',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ color: '#172b4d', fontSize: '16px', fontWeight: 500 }}>
          Loading Excalidraw...
        </div>
        <div style={{ color: '#6b778c', fontSize: '13px' }}>
          {!ExcalidrawComponent ? 'Loading editor components' : 'Loading your drawing'}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
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
        {/* Show Cancel only in dev mode, Insert button always visible */}
        <div>
          {!isRunningInConfluence() && (
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
          )}
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
            {isSaving ? 'Saving...' : 'Save'}
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
