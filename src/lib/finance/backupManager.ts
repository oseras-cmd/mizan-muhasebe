/**
 * Otomatik yedekleme yöneticisi
 * - Her saat otomatik yedekleme
 * - Son yedekleme tarihi takibi
 * - Yedek boyutu gösterimi
 * - IndexedDB'de saklama (localStorage'dan daha güvenilir)
 */

import { exportFinanceData, getFinanceData } from "./store";

const BACKUP_DB_NAME = "mizan-backups";
const BACKUP_STORE_NAME = "auto-backups";
const BACKUP_META_KEY = "mizan-backup-meta";
const AUTO_BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 saat

export interface BackupMeta {
  lastBackupAt: string | null;
  lastBackupSize: number; // byte
  autoBackupEnabled: boolean;
  backupCount: number;
}

const defaultMeta: BackupMeta = {
  lastBackupAt: null,
  lastBackupSize: 0,
  autoBackupEnabled: true,
  backupCount: 0,
};

/** Meta bilgisini localStorage'dan oku */
export function getBackupMeta(): BackupMeta {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BackupMeta>;
      return { ...defaultMeta, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...defaultMeta };
}

/** Meta bilgisini localStorage'a yaz */
function setBackupMeta(meta: BackupMeta) {
  try {
    localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

/** IndexedDB'yi aç */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        db.createObjectStore(BACKUP_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

interface BackupRecord {
  id: string;
  data: string;
  size: number;
  createdAt: string;
}

/** Tek bir yedek kaydı oluştur */
export async function createBackup(): Promise<{ size: number; date: string }> {
  const json = exportFinanceData();
  const size = new Blob([json]).size;
  const now = new Date().toISOString();

  // IndexedDB'ye yaz (en son 10 yedeği tut)
  try {
    const db = await openDB();
    const tx = db.transaction(BACKUP_STORE_NAME, "readwrite");
    const store = tx.objectStore(BACKUP_STORE_NAME);

    // Mevcut yedekleri say
    const countReq = store.count();
    const count = await new Promise<number>((resolve) => {
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => resolve(0);
    });

    // Yeni yedek ekle
    const record: BackupRecord = {
      id: `backup-${now}`,
      data: json,
      size,
      createdAt: now,
    };
    store.put(record);

    // Eski yedekleri sil (10'dan fazlaysa)
    if (count >= 10) {
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const all = getAllReq.result as BackupRecord[];
        all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const toDelete = all.slice(0, all.length - 9);
        const deleteTx = db.transaction(BACKUP_STORE_NAME, "readwrite");
        const deleteStore = deleteTx.objectStore(BACKUP_STORE_NAME);
        for (const item of toDelete) {
          deleteStore.delete(item.id);
        }
      };
    }

    db.close();
  } catch {
    // IndexedDB kullanılamıyorsa sessizce devam et
  }

  // Meta güncelle
  const meta = getBackupMeta();
  setBackupMeta({
    ...meta,
    lastBackupAt: now,
    lastBackupSize: size,
    backupCount: meta.backupCount + 1,
  });

  return { size, date: now };
}

/** Son yedeği indir */
export async function downloadLastBackup(): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(BACKUP_STORE_NAME, "readonly");
    const store = tx.objectStore(BACKUP_STORE_NAME);
    const allReq = store.getAll();
    const all = await new Promise<BackupRecord[]>((resolve) => {
      allReq.onsuccess = () => resolve(allReq.result);
      allReq.onerror = () => resolve([]);
    });
    db.close();

    if (all.length === 0) return false;

    // En son yedeği bul
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = all[0];

    // İndir
    const blob = new Blob([latest.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mizan-otomatik-yedek-${latest.createdAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Tüm otomatik yedekleri listele */
export async function listBackups(): Promise<{ id: string; date: string; size: number }[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(BACKUP_STORE_NAME, "readonly");
    const store = tx.objectStore(BACKUP_STORE_NAME);
    const allReq = store.getAll();
    const all = await new Promise<BackupRecord[]>((resolve) => {
      allReq.onsuccess = () => resolve(allReq.result);
      allReq.onerror = () => resolve([]);
    });
    db.close();

    return all
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({ id: r.id, date: r.createdAt, size: r.size }));
  } catch {
    return [];
  }
}

/** Byte değerini okunabilir formata çevir */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Tarih formatla */
export function formatBackupDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

// --- Otomatik yedekleme timer'ı ---

let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

/** Otomatik yedeklemeyi başlat */
export function startAutoBackup() {
  const meta = getBackupMeta();
  if (!meta.autoBackupEnabled) return;
  if (autoBackupTimer) return; // Zaten çalışıyor

  autoBackupTimer = setInterval(async () => {
    const currentMeta = getBackupMeta();
    if (!currentMeta.autoBackupEnabled) {
      stopAutoBackup();
      return;
    }
    try {
      await createBackup();
    } catch {
      // sessizce devam et
    }
  }, AUTO_BACKUP_INTERVAL_MS);
}

/** Otomatik yedeklemeyi durdur */
export function stopAutoBackup() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}

/** Otomatik yedekleme tercihini değiştir */
export function setAutoBackupEnabled(enabled: boolean) {
  const meta = getBackupMeta();
  setBackupMeta({ ...meta, autoBackupEnabled: enabled });
  if (enabled) {
    startAutoBackup();
  } else {
    stopAutoBackup();
  }
}

/** Mevcut veri boyutunu hesapla */
export function getCurrentDataSize(): number {
  const json = JSON.stringify(getFinanceData());
  return new Blob([json]).size;
}
