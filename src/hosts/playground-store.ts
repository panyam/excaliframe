import { DrawingEnvelope } from '../core/types';

const DB_NAME = 'excaliframe-playground';
const DB_VERSION = 1;
const STORE_NAME = 'drawings';
const LEGACY_STORAGE_KEY = 'excaliframe:drawing';

export interface StoredDrawing {
  id: string;
  title: string;
  envelope: DrawingEnvelope;
}

export class PlaygroundStore {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.open();
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        this.migrateLegacy(db).then(() => resolve(db));
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async migrateLegacy(db: IDBDatabase): Promise<void> {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;

    try {
      const envelope = JSON.parse(raw) as DrawingEnvelope;
      const drawing: StoredDrawing = {
        id: generateId(),
        title: 'Untitled Drawing',
        envelope,
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(drawing);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Ignore corrupt legacy data
    }
  }

  async listAll(): Promise<StoredDrawing[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<StoredDrawing | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async save(drawing: StoredDrawing): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(drawing);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}
