/**
 * Belge dosya içeriklerini IndexedDB'de saklar (localStorage yerine).
 *
 * Neden IndexedDB: localStorage ~5 MB kota QuotaExceededError verir; IndexedDB
 * ise kullanılabilir disk alanını kullanır (yüzlerce MB+). "Depolama dolu"
 * hataları pratikte ortadan kalkar.
 *
 * Senkron API: store.ts senkron getDocumentDataUrl kullanıyor. IndexedDB
 * asenkondur; okunan her değer bellek önbelleğe konur ve senkron çağrılar
 * önbellekten döner. Uygulama init sırasında tüm belge verileri önbelleğe
 * yüklenir, böylece belge listesinin render'ı IndexedDB'yi beklemek zorunda kalmaz.
 *
 * Migrasyon: İlk açılışta localStorage'daki "mizan-doc-*" anahtarları ve eski
 * "mizan-doc-data-v1" haritası IndexedDB'ye taşınır. Taşıma başarılıysa
 * localStorage anahtarları silinir → kota boşalır. localStorage okunması
 * kota dolu olsa bile çalıştığı için migrasyon her koşulda tamamlanabilir.
 */

const DB_NAME = "mizan-docs";
const DB_VERSION = 1;
const STORE_NAME = "docs";
/** Eski sürüm: her belge kendi localStorage anahtarındaydı. */
const DOC_KEY_PREFIX = "mizan-doc-";
/** Daha eski sürüm: tüm belgeler tek JSON anahtarındaydı (yalnızca okunur). */
const DOC_DATA_KEY = "mizan-doc-data-v1";

interface DocRecord {
  id: string;
  data: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB açılamadı"));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("IndexedDB kullanılamıyor"));
      }
    });
  }
  return dbPromise;
}

function putDocData(id: string, data: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put({ id, data } satisfies DocRecord);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("IndexedDB yazılamadı"));
          tx.onabort = () => reject(tx.error ?? new Error("IndexedDB yazımı iptal edildi"));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("IndexedDB yazılamadı"));
        }
      }),
  );
}

function deleteDocData(id: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("IndexedDB silinemedi"));
          tx.onabort = () => reject(tx.error ?? new Error("IndexedDB silimi iptal edildi"));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("IndexedDB silinemedi"));
        }
      }),
  );
}

function getAllDocData(): Promise<Record<string, string>> {
  return openDb().then(
    (db) =>
      new Promise<Record<string, string>>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const request = tx.objectStore(STORE_NAME).getAll();
          request.onsuccess = () => {
            const out: Record<string, string> = {};
            for (const record of request.result as DocRecord[]) {
              if (record?.id && typeof record.data === "string") {
                out[record.id] = record.data;
              }
            }
            resolve(out);
          };
          request.onerror = () => reject(request.error ?? new Error("IndexedDB okunamadı"));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("IndexedDB okunamadı"));
        }
      }),
  );
}

/* ---------------------------------- Bellek önbelleği ---------------------------------- */

/** Senkron okuma çağrılarının (store.ts getDocumentDataUrl)IndexedDB'yi beklememesi
 *  için tüm belge verileri bellekte de tutulur. */
const cache = new Map<string, string>();

/** IndexedDB'deki tüm belgeleri önbelleğe yükler. */
async function hydrateCache(): Promise<void> {
  const all = await getAllDocData();
  cache.clear();
  for (const [id, value] of Object.entries(all)) {
    cache.set(id, value);
  }
}

/* ---------------------------------- localStorage migrasyonu ---------------------------------- */

function loadLegacyDocDataMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(DOC_DATA_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** localStorage'daki tüm belge anahtarlarını toplar (id → dataUrl). */
function collectLocalStorageDocData(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(DOC_KEY_PREFIX)) {
        const value = window.localStorage.getItem(key);
        if (value) out[key.slice(DOC_KEY_PREFIX.length)] = value;
      }
    }
  } catch {
    // ignore
  }
  // Eski tek-JSON anahtarından gelenleri ekle (öncelik: ayrı anahtar)
  for (const [id, value] of Object.entries(loadLegacyDocDataMap())) {
    if (!(id in out) && typeof value === "string" && value) out[id] = value;
  }
  return out;
}

/** localStorage'daki belge anahtarlarını IndexedDB'ye taşır; başarılıysa siler. */
async function migrateFromLocalStorage(): Promise<void> {
  const legacy = collectLocalStorageDocData();
  const ids = Object.keys(legacy);
  if (ids.length === 0) return;

  let allOk = true;
  for (const id of ids) {
    const value = legacy[id];
    if (typeof value !== "string" || !value) continue;
    try {
      await putDocData(id, value);
      cache.set(id, value);
    } catch {
      allOk = false; // Bu belge taşınamadı — localStorage'da kalmaya devam eder
    }
  }

  if (allOk) {
    try {
      for (const id of ids) {
        window.localStorage.removeItem(DOC_KEY_PREFIX + id);
      }
      window.localStorage.removeItem(DOC_DATA_KEY);
    } catch {
      // ignore
    }
  }
}

let initStarted = false;

/** Uygulama açılışında bir kez çağrılır: önbelleği doldurur ve migrasyon yapar. */
export function initDocumentStorage(): void {
  if (initStarted || typeof window === "undefined" || !("indexedDB" in window)) return;
  initStarted = true;
  void (async () => {
    try {
      await hydrateCache();
    } catch {
      // IndexedDB açılamadı — localStorage değeri hâlâ okunabilir
    }
    try {
      await migrateFromLocalStorage();
    } catch {
      // ignore
    }
  })();
}

/* ---------------------------------- Genel API (store.ts kullanır) ---------------------------------- */

/** Belge verisini senkron döner (önbellek → localStorage legacy sırasıyla). */
export function getDocumentDataUrlSync(id: string): string | null {
  const cached = cache.get(id);
  if (cached) return cached;
  try {
    const direct = window.localStorage.getItem(DOC_KEY_PREFIX + id);
    if (direct) return direct;
  } catch {
    // ignore
  }
  return loadLegacyDocDataMap()[id] ?? null;
}

/** Belge verisini IndexedDB'ye yazar ve önbelleğe alır. */
export async function putDocumentData(id: string, dataUrl: string): Promise<void> {
  // Önce önbelleğe yaz — senkron okumalar ve export hemen görsün
  cache.set(id, dataUrl);
  await putDocData(id, dataUrl);
}

/** Belge verisini IndexedDB'den ve önbellekten siler. */
export async function removeDocumentData(id: string): Promise<void> {
  cache.delete(id);
  try {
    await deleteDocData(id);
  } catch {
    // ignore
  }
  // localStorage legacy kalıntısını da temizle
  try {
    window.localStorage.removeItem(DOC_KEY_PREFIX + id);
    const legacy = loadLegacyDocDataMap();
    if (id in legacy) {
      delete legacy[id];
      window.localStorage.setItem(DOC_DATA_KEY, JSON.stringify(legacy));
    }
  } catch {
    // ignore
  }
}

/** Tüm belge verilerini toplar (export/yedekleme için). */
export async function collectDocData(): Promise<Record<string, string>> {
  // Önce IndexedDB'den taze veri almayı dene
  try {
    const all = await getAllDocData();
    for (const [id, value] of Object.entries(all)) {
      cache.set(id, value);
    }
  } catch {
    // IndexedDB yoksa önbellektekiler kullanılır
  }
  const out: Record<string, string> = {};
  for (const [id, value] of cache.entries()) {
    out[id] = value;
  }
  // localStorage'da hâlâ duran (taşınamamış) belgeleri de ekle
  for (const [id, value] of Object.entries(collectLocalStorageDocData())) {
    if (!(id in out)) out[id] = value;
  }
  return out;
}

/** localStorage'da hâlâ duran ve IndexedDB'ye taşınmamış belge sayısı. */
export function countPendingMigration(): number {
  try {
    let count = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(DOC_KEY_PREFIX)) count++;
    }
    const legacy = loadLegacyDocDataMap();
    const legacyIds = Object.keys(legacy).filter((id) => {
      const direct = window.localStorage.getItem(DOC_KEY_PREFIX + id);
      return !direct && typeof legacy[id] === "string" && legacy[id].length > 0;
    });
    return count + legacyIds.length;
  } catch {
    return 0;
  }
}

/** Migrasyonu tekrar dener (Ayarlar'daki "Taşı" butonu). */
export async function retryMigration(): Promise<number> {
  const before = countPendingMigration();
  await migrateFromLocalStorage();
  const after = countPendingMigration();
  return Math.max(0, before - after);
}

/** Depolama kullanım bilgisi (Ayarlar paneli için). */
export interface DocStorageInfo {
  /** Toplam bilinen belge verisi sayısı */
  docCount: number;
  /** IndexedDB'deki tahmini toplam boyut (bayt) */
  docBytes: number;
  /** localStorage'da hâlâ duran belge verisi (bayt) */
  localDocBytes: number;
  /** IndexedDB'ye taşınamamış belge sayısı */
  pendingMigration: number;
  /** Tarayıcı genel depolama kotası (varsa) */
  quotaBytes: number | null;
  /** Tarayıcı genel depolama kullanımı (varsa) */
  usageBytes: number | null;
}

/** Depolama kullanım bilgisi döner (Ayarlar paneli için). */
export async function getDocStorageInfo(): Promise<DocStorageInfo> {
  const docs = await collectDocData();
  let docBytes = 0;
  for (const value of Object.values(docs)) docBytes += value.length;
  let localDocBytes = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(DOC_KEY_PREFIX)) {
        const value = window.localStorage.getItem(key);
        if (value) localDocBytes += value.length;
      }
    }
    const legacy = loadLegacyDocDataMap();
    for (const value of Object.values(legacy)) {
      if (typeof value === "string") localDocBytes += value.length;
    }
  } catch {
    // ignore
  }
  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      quotaBytes = estimate.quota ?? null;
      usageBytes = estimate.usage ?? null;
    }
  } catch {
    // ignore
  }
  return {
    docCount: Object.keys(docs).length,
    docBytes,
    localDocBytes,
    pendingMigration: countPendingMigration(),
    quotaBytes,
    usageBytes,
  };
}

/**
 * Yetim belge verilerini temizler: metadata'sı olmayan (belgesi silinmiş)
 * IndexedDB kayıtları ve localStorage kalıntıları. Kullanıcı verisi korunur —
 * yalnızca listelerde görünmeyen veriler silinir. Silinen kayıt sayısını döner.
 */
export async function purgeOrphanDocData(knownIds: string[]): Promise<number> {
  const known = new Set(knownIds);
  let removed = 0;

  // IndexedDB kayıtları
  try {
    const all = await getAllDocData();
    for (const id of Object.keys(all)) {
      if (!known.has(id)) {
        try {
          await deleteDocData(id);
          cache.delete(id);
          removed++;
        } catch {
          // tek kayıt silinemediyse devam et
        }
      }
    }
  } catch {
    // IndexedDB yok — localStorage kalıntılarına bak
  }

  // localStorage ayrı anahtarlar
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(DOC_KEY_PREFIX)) {
        const id = key.slice(DOC_KEY_PREFIX.length);
        if (!known.has(id)) doomed.push(key);
      }
    }
    for (const key of doomed) {
      try {
        window.localStorage.removeItem(key);
        removed++;
      } catch {
        // ignore
      }
    }

    // Eski tek-JSON anahtarındaki yetimler
    const legacy = loadLegacyDocDataMap();
    const legacyIds = Object.keys(legacy).filter((id) => !known.has(id));
    if (legacyIds.length > 0) {
      const next: Record<string, string> = {};
      for (const [id, value] of Object.entries(legacy)) {
        if (known.has(id)) next[id] = value;
      }
      window.localStorage.setItem(DOC_DATA_KEY, JSON.stringify(next));
      removed += legacyIds.length;
    }
  } catch {
    // ignore
  }

  return removed;
}
