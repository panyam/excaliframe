/**
 * Mock Atlassian Platform (AP) API for local development/testing
 * When running outside Confluence, this provides stub implementations
 */

// Local storage key for mock macro data
const MOCK_STORAGE_KEY = 'excalfluence_mock_macro_body';

// Check if we're running inside Confluence (AP with full functionality is available)
const isInConfluence = (): boolean => {
  if (typeof window === 'undefined') return false;

  const AP = (window as any).AP;

  // Check that AP exists AND has the confluence methods we need
  // The Atlassian Connect JS (all.js) creates a partial AP object even outside Confluence
  // but it won't have working confluence.getMacroBody until actually in Confluence iframe
  return (
    AP !== undefined &&
    AP.confluence !== undefined &&
    typeof AP.confluence.getMacroBody === 'function' &&
    typeof AP.confluence.saveMacro === 'function'
  );
};

// Mock AP implementation for local testing
const mockAP = {
  resize: (width: string, height: string): void => {
    console.log(`[MockAP] resize(${width}, ${height}) - no-op in standalone mode`);
  },

  confluence: {
    getMacroBody: (callback: (body: string) => void): void => {
      console.log('[MockAP] getMacroBody - loading from localStorage');
      const body = localStorage.getItem(MOCK_STORAGE_KEY) || '';
      // Simulate async behavior like the real API
      setTimeout(() => callback(body), 10);
    },

    saveMacro: (params: any, body: string): void => {
      console.log('[MockAP] saveMacro - saving to localStorage, length:', body.length);
      localStorage.setItem(MOCK_STORAGE_KEY, body);
      alert('Drawing saved locally! (In Confluence, this would save to the page)');
    },

    closeMacroEditor: (): void => {
      console.log('[MockAP] closeMacroEditor - no-op in standalone mode');
      alert('Editor closed! (In Confluence, this would close the dialog)');
    },
  },
};

// Export the AP object - either real or mock
export const getAP = (): typeof mockAP => {
  if (isInConfluence()) {
    return (window as any).AP;
  }
  return mockAP;
};

// Helper to check if running in Confluence
export const isRunningInConfluence = isInConfluence;
