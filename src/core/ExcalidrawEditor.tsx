import React, { useState, useEffect, useCallback, useRef } from 'react';
import { exportToCanvas } from '@excalidraw/excalidraw';
import { VERSION, BUILD_DATE } from '../version';
import { EditorHost, DrawingEnvelope, ExcalidrawDrawingData } from './types';

// Excalidraw types (defined locally to avoid module resolution issues)
type ExcalidrawElement = any;
type BinaryFiles = Record<string, any>;
interface AppState {
  viewBackgroundColor?: string;
  gridSize?: number | null;
  [key: string]: any;
}
interface ExcalidrawImperativeAPI {
  getSceneElements: () => readonly ExcalidrawElement[];
  getAppState: () => AppState;
  getFiles: () => BinaryFiles;
  updateScene: (scene: { elements?: readonly ExcalidrawElement[]; appState?: Partial<AppState> }) => void;
  addFiles: (files: any[]) => void;
}

interface Props {
  host: EditorHost;
}

const ExcalidrawEditor: React.FC<Props> = ({ host }) => {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<any>(null);
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

  // Dynamically load Excalidraw components
  useEffect(() => {
    console.log(`Excaliframe v${VERSION} (built ${BUILD_DATE})`);
    import('@excalidraw/excalidraw').then((module) => {
      setExcalidrawComponent(() => module.Excalidraw);
      setMainMenuComponent(() => module.MainMenu);
    });
  }, []);

  // Load existing drawing on mount
  useEffect(() => {
    loadDrawing();
  }, []);

  const loadDrawing = async (): Promise<void> => {
    console.log('Editor - Loading drawing...');
    try {
      const envelope = await host.loadDrawing();

      if (envelope?.data) {
        console.log('Editor - Found existing drawing data');
        const drawingData: ExcalidrawDrawingData = JSON.parse(envelope.data);
        const elements = drawingData.elements || [];
        initialElementsRef.current = JSON.stringify(elements);
        setInitialData({
          elements: elements,
          appState: {
            viewBackgroundColor: drawingData.appState?.viewBackgroundColor || '#ffffff',
          },
          files: drawingData.files || {},
        });
      } else {
        console.log('Editor - No existing drawing, starting fresh');
      }
    } catch (error) {
      console.error('Editor - Error loading drawing:', error);
    }
    setIsLoading(false);
  };

  const saveDrawing = useCallback(async (): Promise<void> => {
    if (!excalidrawApiRef.current || isSaving) return;

    setIsSaving(true);
    console.log('Editor - Saving drawing...');

    try {
      const elements = excalidrawApiRef.current.getSceneElements();
      const appState = excalidrawApiRef.current.getAppState();
      const files = excalidrawApiRef.current.getFiles();

      const drawingData: ExcalidrawDrawingData = {
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
      let preview = '';
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
          preview = canvas.toDataURL('image/png');
        } catch (e) {
          console.log('Editor - Could not generate preview:', e);
        }
      }

      const now = new Date().toISOString();
      const envelope: DrawingEnvelope = {
        tool: 'excalidraw',
        version: 1,
        data: JSON.stringify(drawingData),
        preview,
        updatedAt: now,
      };

      console.log('Editor - Saving envelope, elements:', elements.length);
      await host.saveDrawing(envelope);
      console.log('Editor - Save complete');
      setIsSaving(false);
      setIsDirty(false);
      initialElementsRef.current = JSON.stringify([...elements]);

    } catch (error) {
      console.error('Editor - Error saving:', error);
      alert('Failed to save drawing. Please try again.');
      setIsSaving(false);
    }
  }, [isSaving, host]);

  const handleCancel = useCallback((): void => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    host.close();
  }, [isDirty, host]);

  // Track changes to detect dirty state
  const handleChange = useCallback((elements: readonly ExcalidrawElement[]): void => {
    const activeElements = elements.filter((el: any) => !el.isDeleted);
    const currentJson = JSON.stringify(activeElements);
    const hasChanges = currentJson !== initialElementsRef.current;
    setIsDirty(hasChanges);
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        const appState = excalidrawApiRef.current?.getAppState();
        if (appState?.openMenu || appState?.openPopup || appState?.isResizing ||
            appState?.isRotating || appState?.draggingElement || appState?.editingElement) {
          return; // Let Excalidraw handle ESC
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

      if (!data.elements || !Array.isArray(data.elements)) {
        alert('Invalid Excalidraw data - no elements array found');
        return;
      }

      excalidrawApiRef.current.updateScene({
        elements: data.elements,
        appState: data.appState || {},
      });

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
            <span style={{ fontSize: '11px', color: '#de350b', fontWeight: 500 }}>
              • Unsaved changes
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
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
              <MainMenuComponent.DefaultItems.CommandPalette />
              <MainMenuComponent.DefaultItems.Help />
              <MainMenuComponent.Separator />
              <MainMenuComponent.DefaultItems.ClearCanvas />
              <MainMenuComponent.DefaultItems.ToggleTheme />
              <MainMenuComponent.DefaultItems.ChangeCanvasBackground />
            </MainMenuComponent>
          )}
        </ExcalidrawComponent>
      </div>
    </div>
  );
};

export default ExcalidrawEditor;
