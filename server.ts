import express, { Request, Response } from 'express';
import path from 'path';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(express.json());

// Serve atlassian-connect.json from root
app.get('/atlassian-connect.json', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, 'atlassian-connect.json'));
});

// Serve images
app.use('/images', express.static(path.join(__dirname, 'images')));

// Lifecycle endpoints
app.post('/lifecycle/installed', (_req: Request, res: Response): void => {
  console.log('Plugin installed');
  res.status(204).send();
});

app.post('/lifecycle/uninstalled', (_req: Request, res: Response): void => {
  console.log('Plugin uninstalled');
  res.status(204).send();
});

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routes (shouldn't be needed for this app)
app.get('*', (req: Request, res: Response): void => {
  // Only serve files that exist in dist, otherwise 404
  res.status(404).send('Not found');
});

app.listen(PORT, (): void => {
  console.log(`Excalfluence server running on http://localhost:${PORT}`);
  console.log(`Make sure to update atlassian-connect.json baseUrl if using a different port or domain`);
});
