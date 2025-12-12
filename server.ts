import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV === 'development';

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

// Setup webpack dev middleware for development (hot reload)
async function setupDevMiddleware(): Promise<void> {
  if (!isDev) return;

  console.log('Setting up webpack dev middleware for hot reload...');

  // Dynamic imports for dev dependencies
  const webpack = (await import('webpack')).default;
  const webpackDevMiddleware = (await import('webpack-dev-middleware')).default;
  const webpackHotMiddleware = (await import('webpack-hot-middleware')).default;
  // @ts-ignore - webpack config is JS, only used in dev mode
  const webpackConfig = (await import('./webpack.config.js')).default;

  // Get config for development mode - set mode explicitly
  const config = typeof webpackConfig === 'function'
    ? webpackConfig({}, { mode: 'development' })
    : webpackConfig;

  // Ensure mode is set for development
  config.mode = 'development';

  const compiler = webpack(config);

  // Dev middleware - serves files from memory AND writes to disk
  app.use(
    webpackDevMiddleware(compiler, {
      publicPath: config.output?.publicPath || '/',
      stats: 'minimal',
      writeToDisk: true, // Write files to dist/ so routes can serve them
    })
  );

  // Hot middleware - enables HMR
  app.use(webpackHotMiddleware(compiler));

  console.log('Webpack dev middleware ready - changes will hot reload');
}

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

// Helper to find HTML files (dev writes to dist/, prod runs from dist/)
function findHtmlFile(filename: string): string | null {
  const distPath = path.join(process.cwd(), 'dist', filename);
  const dirnamePath = path.join(__dirname, filename);

  if (fs.existsSync(distPath)) return distPath;
  if (fs.existsSync(dirnamePath)) return dirnamePath;
  return null;
}

// Macro render endpoint - serves the renderer HTML
app.get('/macro', (_req: Request, res: Response): void => {
  const rendererPath = findHtmlFile('renderer.html');
  if (rendererPath) {
    res.sendFile(rendererPath);
  } else {
    res.status(404).send('Renderer not found');
  }
});

// Editor endpoint - serves the editor HTML
app.get('/editor', (_req: Request, res: Response): void => {
  const editorPath = findHtmlFile('editor.html');
  if (editorPath) {
    res.sendFile(editorPath);
  } else {
    res.status(404).send('Editor not found');
  }
});

// Renderer endpoint - serves the renderer HTML
app.get('/renderer', (_req: Request, res: Response): void => {
  const rendererPath = findHtmlFile('renderer.html');
  if (rendererPath) {
    res.sendFile(rendererPath);
  } else {
    res.status(404).send('Renderer not found');
  }
});

// Serve static files from dist/ (both dev and prod)
const distStaticPath = isDev ? path.join(process.cwd(), 'dist') : __dirname;
app.use(express.static(distStaticPath));

// Fallback for unmatched routes
app.get('*', (_req: Request, res: Response): void => {
  res.status(404).send('Not found');
});

// Start server
async function start(): Promise<void> {
  await setupDevMiddleware();

  app.listen(PORT, '0.0.0.0', (): void => {
    console.log(`Excaliframe server running on http://0.0.0.0:${PORT}`);
    console.log(`Mode: ${isDev ? 'DEVELOPMENT (hot reload enabled)' : 'PRODUCTION'}`);
    console.log(`Plugin descriptor: http://0.0.0.0:${PORT}/atlassian-connect.json`);
  });
}

start().catch(console.error);
