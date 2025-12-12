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
  const [FooterComponent, setFooterComponent] = useState<any>(null);
  const [MainMenuComponent, setMainMenuComponent] = useState<any>(null);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [initialData, setInitialData] = useState<{
    elements?: readonly ExcalidrawElement[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const initialElementsRef = useRef<string>('[]');

  // Dynamically load Excalidraw and its UI components
  useEffect(() => {
    console.log(`Excaliframe v${VERSION} (built ${BUILD_DATE})`);
    import('@excalidraw/excalidraw').then((module) => {
      setExcalidrawComponent(() => module.Excalidraw);
      setFooterComponent(() => module.Footer);
      setMainMenuComponent(() => module.MainMenu);
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
              const elements = drawingData.elements || [];
              initialElementsRef.current = JSON.stringify(elements);
              setInitialData({
                elements: elements,
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
        source: 'excaliframe',
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
        // Update initial reference and clear dirty state after successful save
        initialElementsRef.current = JSON.stringify([...elements].filter((el: any) => !el.isDeleted));
        setIsDirty(false);
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

  const confirmClose = useCallback((): boolean => {
    if (isDirty) {
      return window.confirm('You have unsaved changes. Are you sure you want to close without saving?');
    }
    return true;
  }, [isDirty]);

  const handleCancel = useCallback((): void => {
    if (confirmClose()) {
      const AP = getAP();
      AP.confluence.closeMacroEditor();
    }
  }, [confirmClose]);

  // Track changes to detect dirty state
  const handleChange = useCallback((elements: readonly ExcalidrawElement[]): void => {
    // Compare current elements with initial to detect changes
    // Filter out deleted elements for comparison
    const activeElements = elements.filter((el: any) => !el.isDeleted);
    const currentJson = JSON.stringify(activeElements);
    const hasChanges = currentJson !== initialElementsRef.current;
    setIsDirty(hasChanges);
  }, []);

  // Handle ESC key to show confirmation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // Check if Excalidraw is in a state where ESC should be handled by us
        // (not in text editing, menu open, etc.)
        const appState = excalidrawApiRef.current?.getAppState();
        if (appState?.openMenu || appState?.openPopup || appState?.isResizing ||
            appState?.isRotating || appState?.draggingElement || appState?.editingElement) {
          // Let Excalidraw handle ESC for its own UI
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleCancel]);

  const handleCopyJson = useCallback(async (): Promise<void> => {
    if (!excalidrawApiRef.current) return;

    const elements = excalidrawApiRef.current.getSceneElements();
    const appState = excalidrawApiRef.current.getAppState();
    const files = excalidrawApiRef.current.getFiles();

    const exportData = {
      type: 'excalidraw',
      version: 2,
      source: 'excaliframe',
      elements: [...elements],
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
      },
      files: files,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      alert('Diagram JSON copied to clipboard!');
    } catch (e) {
      console.error('Failed to copy:', e);
      alert('Failed to copy to clipboard');
    }
  }, []);

  const handlePasteJson = useCallback(async (): Promise<void> => {
    if (!excalidrawApiRef.current) return;

    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);

      // Validate it looks like Excalidraw data
      if (!data.elements || !Array.isArray(data.elements)) {
        alert('Invalid Excalidraw data - no elements array found');
        return;
      }

      excalidrawApiRef.current.updateScene({
        elements: data.elements,
        appState: data.appState || {},
      });

      // Load files if present
      if (data.files && Object.keys(data.files).length > 0) {
        excalidrawApiRef.current.addFiles(Object.values(data.files));
      }

      console.log('Pasted diagram with', data.elements.length, 'elements');
    } catch (e) {
      console.error('Failed to paste:', e);
      alert('Failed to paste - make sure clipboard contains valid Excalidraw JSON');
    }
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
          {isDirty && (
            <span style={{
              fontSize: '11px',
              color: '#de350b',
              fontWeight: 500,
            }}>
              • Unsaved changes
            </span>
          )}
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
        {/* Action buttons - fullscreen mode has no Confluence chrome */}
        <div style={{ display: 'flex', gap: '8px' }}>
        { false &&  <>
          <button
            onClick={handleCopyJson}
            title="Copy diagram JSON to clipboard"
            style={{
              padding: '6px 12px',
              backgroundColor: '#fff',
              border: '1px solid #dfe1e6',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📋 Copy
          </button>
          <button
            onClick={handlePasteJson}
            title="Paste diagram JSON from clipboard"
            style={{
              padding: '6px 12px',
              backgroundColor: '#fff',
              border: '1px solid #dfe1e6',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📥 Paste
          </button>
          </>
        }
          <div style={{ width: '1px', backgroundColor: '#dfe1e6', margin: '0 4px' }} />
          <button
            onClick={handleCancel}
            disabled={isSaving}
            style={{
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
          onChange={handleChange}
          theme="light"
          UIOptions={{
            canvasActions: {
              loadScene: false,
            },
          }}
        >
          {/* Custom Menu with Copy/Paste */}
          {MainMenuComponent && (
            <MainMenuComponent>
              <MainMenuComponent.DefaultItems.LoadScene />
              <MainMenuComponent.DefaultItems.SaveToActiveFile />
              <MainMenuComponent.DefaultItems.Export />
              <MainMenuComponent.DefaultItems.SaveAsImage />
              <MainMenuComponent.Separator />
              <MainMenuComponent.Item onSelect={handleCopyJson}>
                Copy diagram JSON
              </MainMenuComponent.Item>
              <MainMenuComponent.Item onSelect={handlePasteJson}>
                Paste diagram JSON
              </MainMenuComponent.Item>
              <MainMenuComponent.Separator />
              <MainMenuComponent.DefaultItems.ClearCanvas />
              <MainMenuComponent.DefaultItems.ToggleTheme />
              <MainMenuComponent.DefaultItems.ChangeCanvasBackground />
            </MainMenuComponent>
          )}
          {/* Footer with Copy/Paste buttons */}
          {false && FooterComponent && (
            <FooterComponent>
              <button
                onClick={handleCopyJson}
                title="Copy diagram JSON to clipboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface-low)',
                  border: '1px solid var(--color-border-outline-variant)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--color-on-surface)',
                }}
              >
                <span>📋</span> Copy JSON
              </button>
              <button
                onClick={handlePasteJson}
                title="Paste diagram JSON from clipboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface-low)',
                  border: '1px solid var(--color-border-outline-variant)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--color-on-surface)',
                }}
              >
                <span>📥</span> Paste JSON
              </button>
            </FooterComponent>
          )}
        </ExcalidrawComponent>
      </div>
    </div>
  );
};

export default ExcalidrawEditor;
