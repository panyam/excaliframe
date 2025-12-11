// Type definitions for Atlassian Connect JS API
// The AP object is provided globally by Confluence at runtime

interface APContext {
  contentId?: string;
  version?: number;
  confluence?: {
    macro?: {
      id?: string;
      outputType?: string;
    };
    content?: {
      id?: string;
      version?: number;
    };
  };
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

interface APMacroData {
  [key: string]: string;
}

interface APConfluence {
  saveMacro: (macroData: APMacroData, macroBody?: string) => void;
  closeMacroEditor: () => void;
  getMacroData: (callback: (data: APMacroData) => void) => void;
  getMacroBody: (callback: (body: string) => void) => void;
}

interface APDialog {
  close: (data?: any) => void;
  getButton: (name: string) => APDialogButton;
}

interface APDialogButton {
  enable: () => void;
  disable: () => void;
}

interface APEvents {
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
  emit: (event: string, data?: any) => void;
}

interface APContextAPI {
  getContext: () => Promise<APContext>;
}

interface AP {
  context: APContextAPI;
  request: (url: string, options: APRequestOptions) => Promise<APRequestResponse>;
  resize: (width?: string, height?: string) => void;
  confluence: APConfluence;
  dialog: APDialog;
  events: APEvents;
}

// Declare AP as a global variable
declare const AP: AP;
