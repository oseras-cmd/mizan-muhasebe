/**
 * Hesaplama kaydı — her hesaplayıcının o anki girdi ve sonuçlarını
 * tarayıcı deposuna (localStorage) kaydeder. Kayıtlar hesaplayıcı
 * başlığındaki "Kayıtlar" dialogundan listelenir, Excel'e aktarılır
 * ve silinebilir. Veri biçimi doğrudan ExcelSection[] olduğu için
 * kayıt, orijinal dışa aktarımla birebir aynı içeriği taşır.
 */
import type { ExcelSection } from "./calcExport";

export interface SavedCalculation {
  /** Benzersiz kayıt kimliği */
  id: string;
  /** Hesaplayıcı anahtarı (ör. "maas", "kdv") */
  calcId: string;
  /** Kayıt başlığı — hesaplayıcının adı */
  title: string;
  /** Kaydedilme anı (ISO-8601) */
  savedAt: string;
  /** Excel sayfa adı */
  sheet: string;
  /** Kaydedilen veri (girdiler + sonuçlar) */
  sections: ExcelSection[];
}

export interface SaveCalculationInput {
  calcId: string;
  title: string;
  sheet: string;
  sections: ExcelSection[];
}

const STORAGE_KEY = "mizan.hesapKayitlari.v1";
/** Aynı hesaplayıcı için saklanan azami kayıt sayısı */
const MAX_PER_CALC = 25;
/** Tüm hesaplayıcılar için toplam azami kayıt sayısı */
const MAX_TOTAL = 500;

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Bazı ortamlarda localStorage erişimi reddedilir (gizli sekme vb.)
    return null;
  }
}

function isValidCell(value: unknown): value is string | number | null {
  return value === null || typeof value === "string" || typeof value === "number";
}

function isValidSection(value: unknown): value is ExcelSection {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<ExcelSection>;
  if (!Array.isArray(s.rows)) return false;
  if (s.title !== undefined && typeof s.title !== "string") return false;
  if (s.headers !== undefined && (!Array.isArray(s.headers) || s.headers.some((h) => typeof h !== "string"))) return false;
  if (s.footers !== undefined && (!Array.isArray(s.footers) || s.footers.some((f) => typeof f !== "string"))) return false;
  if (s.notes !== undefined && (!Array.isArray(s.notes) || s.notes.some((n) => typeof n !== "string"))) return false;
  return s.rows.every(
    (row) => Array.isArray(row) && row.every(isValidCell),
  );
}

function isValidRecord(value: unknown): value is SavedCalculation {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<SavedCalculation>;
  return (
    typeof r.id === "string" &&
    typeof r.calcId === "string" &&
    typeof r.title === "string" &&
    typeof r.savedAt === "string" &&
    typeof r.sheet === "string" &&
    Array.isArray(r.sections) &&
    r.sections.every(isValidSection)
  );
}

function readAll(): SavedCalculation[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
  } catch {
    return [];
  }
}

function writeAll(records: SavedCalculation[]): boolean {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

/** Tüm kayıtları (yeni → eski) döndürür. */
export function listAllSavedCalculations(): SavedCalculation[] {
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Bir hesaplayıcının kayıtlarını (yeni → eski) döndürür. */
export function listSavedCalculations(calcId: string): SavedCalculation[] {
  return listAllSavedCalculations().filter((r) => r.calcId === calcId);
}

/** Bir hesaplayıcının kayıt sayısı. */
export function countSavedCalculations(calcId: string): number {
  return readAll().reduce((n, r) => (r.calcId === calcId ? n + 1 : n), 0);
}

/**
 * Yeni hesaplama kaydı oluşturur. Depoya yazılamazsa null döner
 * (kota dolu / localStorage kapalı).
 */
export function saveCalculation(input: SaveCalculationInput): SavedCalculation | null {
  const sections = input.sections.filter((s) => s.rows.length > 0);
  if (sections.length === 0) return null;

  const record: SavedCalculation = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    calcId: input.calcId,
    title: input.title,
    savedAt: new Date().toISOString(),
    sheet: input.sheet,
    sections,
  };

  let records = readAll();
  records = records.filter((r) => r.calcId !== record.calcId || r.id !== record.id);
  records.unshift(record);

  // Sınırları uygula: önce aynı hesaplayıcının eskilerini, sonra genel eskileri kırp
  const mine = records.filter((r) => r.calcId === record.calcId);
  if (mine.length > MAX_PER_CALC) {
    const drop = new Set(mine.slice(MAX_PER_CALC).map((r) => r.id));
    records = records.filter((r) => !drop.has(r.id));
  }
  if (records.length > MAX_TOTAL) {
    records = records.slice(0, MAX_TOTAL);
  }

  if (writeAll(records)) return record;

  // Kota dolmuş olabilir — yarısını silip bir kez daha dene
  records = records.slice(0, Math.max(1, Math.floor(records.length / 2)));
  return writeAll(records) ? record : null;
}

/** Kaydı siler; kayıt bulunamazsa sessizce geçer. */
export function deleteCalculation(id: string): void {
  const records = readAll().filter((r) => r.id !== id);
  writeAll(records);
}

/** Bir hesaplayıcının tüm kayıtlarını siler. */
export function clearCalculations(calcId: string): void {
  writeAll(readAll().filter((r) => r.calcId !== calcId));
}
