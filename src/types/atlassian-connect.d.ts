// Type definitions for Atlassian Connect JS API
// The AP object is provided globally by Confluence at runtime

interface APContext {
  contentId?: string;
  version?: number;
  [key: string]: any;
}

interface APRequestOptions {
  type: 'GET' | 'POST' | 'PUT' | 'DELETE';
  contentType?: string;
  data?: string;
  [key: string]: any;
}

interface APRequestResponse {
  body: string;
  [key: string]: any;
}

interface APConfluenceMacroStorage {
  value: string;
}

interface APConfluence {
  saveMacro: (options: { storage: APConfluenceMacroStorage }) => void;
  closeMacroEditor: () => void;
  editMacro: (options: { macroId: string }) => void;
}

interface APContextAPI {
  getContext: () => Promise<APContext>;
}

interface APRequestAPI {
  request: (url: string, options: APRequestOptions) => Promise<APRequestResponse>;
}

interface APResizeAPI {
  resize: () => void;
}

interface AP {
  context: APContextAPI;
  request: (url: string, options: APRequestOptions) => Promise<APRequestResponse>;
  resize: () => void;
  confluence: APConfluence;
}

// Declare AP as a global variable
declare const AP: AP;
