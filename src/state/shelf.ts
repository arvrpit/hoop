// "Your pieces": saved pieces kept in this browser (IndexedDB, because design images and stitches
// can be large). The store holds light summaries for the shelf; full records load on open.
import { create } from 'zustand';
import { summarise, type PieceSummary, type SavedPiece } from '../model/savedPiece';

const DB_NAME = 'hoop';
const STORE = 'pieces';

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB failed to open'));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = f(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

interface ShelfState {
  items: PieceSummary[]; // newest first
  status: 'loading' | 'ready' | 'unavailable';
  refresh: () => Promise<void>;
  put: (piece: SavedPiece) => Promise<void>;
  get: (id: string) => Promise<SavedPiece | null>;
  remove: (id: string) => Promise<void>;
}

const byNewest = (a: PieceSummary, b: PieceSummary) => b.updatedAt.localeCompare(a.updatedAt);

export const useShelf = create<ShelfState>((set, get) => ({
  items: [],
  status: 'loading',
  refresh: async () => {
    try {
      const all = await run<SavedPiece[]>('readonly', (s) => s.getAll() as IDBRequest<SavedPiece[]>);
      set({ items: all.map(summarise).sort(byNewest), status: 'ready' });
    } catch {
      set({ items: [], status: 'unavailable' });
    }
  },
  put: async (piece) => {
    await run('readwrite', (s) => s.put(piece));
    const rest = get().items.filter((i) => i.id !== piece.id);
    set({ items: [summarise(piece), ...rest].sort(byNewest), status: 'ready' });
  },
  get: async (id) => (await run<SavedPiece | undefined>('readonly', (s) => s.get(id))) ?? null,
  remove: async (id) => {
    await run('readwrite', (s) => s.delete(id));
    set({ items: get().items.filter((i) => i.id !== id) });
  },
}));

void useShelf.getState().refresh();
