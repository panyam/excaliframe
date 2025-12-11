import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// In-memory store for installed tenants (in production, use a database)
interface TenantInfo {
  clientKey: string;
  sharedSecret: string;
  baseUrl: string;
}
const tenants: Map<string, TenantInfo> = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Why do we need a server if Excalidraw is client-side?
 *
 * Confluence Connect architecture requires:
 * 1. A registered baseUrl that serves atlassian-connect.json
 * 2. Lifecycle endpoints (/lifecycle/installed, /lifecycle/uninstalled)
 * 3. HTML files (editor, renderer, macro) served from registered baseUrl
 *
 * The server is minimal - just static file serving + lifecycle endpoints.
 * All Excalidraw logic runs client-side in the browser.
 */

// Serve atlassian-connect.json from root (required by Confluence Connect)
app.get('/atlassian-connect.json', (_req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'application/json');

  const distPath = path.join(__dirname, 'atlassian-connect.json');
  const rootPath = path.join(process.cwd(), 'atlassian-connect.json');

  if (fs.existsSync(distPath)) {
    res.sendFile(distPath);
  } else if (fs.existsSync(rootPath)) {
    res.sendFile(rootPath);
  } else {
    res.status(404).json({ error: 'atlassian-connect.json not found' });
  }
});

// Serve images
const imagesPath = path.join(__dirname, 'images');
const imagesPathAlt = path.join(process.cwd(), 'images');
if (fs.existsSync(imagesPath)) {
  app.use('/images', express.static(imagesPath));
} else if (fs.existsSync(imagesPathAlt)) {
  app.use('/images', express.static(imagesPathAlt));
}

// Lifecycle endpoints (required by Confluence Connect with JWT)
app.post('/lifecycle/installed', (req: Request, res: Response): void => {
  const { clientKey, sharedSecret, baseUrl } = req.body;
  console.log('Plugin installed for tenant:', clientKey);
  console.log('Base URL:', baseUrl);

  // Store tenant info (in production, persist to database)
  if (clientKey && sharedSecret) {
    tenants.set(clientKey, { clientKey, sharedSecret, baseUrl });
    console.log('Stored tenant credentials');
  }

  res.status(200).json({ status: 'ok' });
});

app.post('/lifecycle/uninstalled', (req: Request, res: Response): void => {
  const { clientKey } = req.body;
  console.log('Plugin uninstalled for tenant:', clientKey);

  // Remove tenant info
  if (clientKey) {
    tenants.delete(clientKey);
  }

  res.status(200).json({ status: 'ok' });
});

// Macro render endpoint - serves the renderer HTML
app.get('/macro', (_req: Request, res: Response): void => {
  const rendererPath = path.join(__dirname, 'renderer.html');
  if (fs.existsSync(rendererPath)) {
    res.sendFile(rendererPath);
  } else {
    res.status(404).send('Renderer not found');
  }
});

// Editor endpoint - serves the editor HTML
app.get('/editor', (_req: Request, res: Response): void => {
  const editorPath = path.join(__dirname, 'editor.html');
  if (fs.existsSync(editorPath)) {
    res.sendFile(editorPath);
  } else {
    res.status(404).send('Editor not found');
  }
});

// Renderer endpoint - serves the renderer HTML
app.get('/renderer', (_req: Request, res: Response): void => {
  const rendererPath = path.join(__dirname, 'renderer.html');
  if (fs.existsSync(rendererPath)) {
    res.sendFile(rendererPath);
  } else {
    res.status(404).send('Renderer not found');
  }
});

// Serve static files from dist (JS bundles, CSS, etc.)
app.use(express.static(__dirname));

// Fallback for unmatched routes
app.get('*', (_req: Request, res: Response): void => {
  res.status(404).send('Not found');
});

app.listen(PORT, '0.0.0.0', (): void => {
  console.log(`Excalfluence server running on http://0.0.0.0:${PORT}`);
  console.log(`Plugin descriptor: http://0.0.0.0:${PORT}/atlassian-connect.json`);
  console.log(`Note: Server handles lifecycle + serves static files`);
  console.log(`      All Excalidraw logic runs client-side in the browser`);
});
