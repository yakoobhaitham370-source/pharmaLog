// IndexedDB persistent storage for invoice photos

const DB_NAME = 'pharmalog_photos_db';
const STORE_NAME = 'invoice_photos';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export async function storeInvoicePhoto(id: string, base64DataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, dataUrl: base64DataUrl, timestamp: Date.now() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to store photo in IndexedDB, fallback to memory', err);
  }
}

export async function getStoredInvoicePhoto(id: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result && request.result.dataUrl) {
          resolve(request.result.dataUrl);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// Convert Google Drive view URL to direct image URL if needed
export function getDirectImageUrl(urlOrBase64: string): string {
  if (!urlOrBase64) return '';
  if (urlOrBase64.startsWith('data:')) return urlOrBase64;
  if (urlOrBase64.startsWith('blob:')) return urlOrBase64;

  // Extract Google Drive ID if it's a Drive link
  const driveMatch = urlOrBase64.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || urlOrBase64.match(/id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}=w1600`;
  }

  return urlOrBase64;
}
