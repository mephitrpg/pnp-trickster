const APP_STORE = "pnp-trickster-data";
const openAppStore = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(APP_STORE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore("state");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const appStore = {
  async get<T = unknown>(key: string): Promise<T | undefined> { const db = await openAppStore(); const transaction = db.transaction("state", "readonly"), request = transaction.objectStore("state").get(key); const value = await new Promise<T | undefined>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return value; },
  async set(key, value) { const db = await openAppStore(); const transaction = db.transaction("state", "readwrite"); transaction.objectStore("state").put(value, key); await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); }); db.close(); }
};
