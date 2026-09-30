const APP_STORE = "pnp-trickster-data";
const openAppStore = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(APP_STORE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore("state");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const appStore = {
  async get(key) { const db = await openAppStore(); const transaction = db.transaction("state", "readonly"), request = transaction.objectStore("state").get(key); const value = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return value; },
  async set(key, value) { const db = await openAppStore(); const transaction = db.transaction("state", "readwrite"); transaction.objectStore("state").put(value, key); await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); }); db.close(); }
};

let locale = "en", translations = {}, sharedTranslations = {};
export const configureTranslations = (nextLocale, nextTranslations, nextSharedTranslations) => { locale = nextLocale; translations = nextTranslations; sharedTranslations = nextSharedTranslations; };
export const tr = (key) => translations?.[locale]?.[key] || sharedTranslations?.[locale]?.[key] || key;
