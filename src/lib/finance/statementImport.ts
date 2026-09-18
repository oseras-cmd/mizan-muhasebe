/**
 * Banka ekstresi içe aktarma.
 *
 * Türk bankalarının (Ziraat, İş Bankası, Garanti, Akbank, Yapı Kredi vb.)
 * CSV/XLSX ekstre çıktılarını ayrıştırır:
 *   • Ayraç: ";" veya "," (otomatik algılanır)
 *   • Tarih: gg.aa.yyyy, gg/aa/yyyy, yyyy-aa-gg, Excel tarih serisi
 *   • Tutar: "1.234,56", "1.234,56-", "-1.234,56", "1,234.56", "(1.234,56)"
 *   • Yön: tutar işaretinden veya ayrı Giriş/Çıkış / Borç/Alacak kolonlarından
 */

import * as XLSX from "xlsx";

export interface StatementRow {
  /** ISO tarih (yyyy-aa-gg) */
  date: string;
  description: string;
  /** Pozitif: hesaba giriş · Negatif: hesaptan çıkış */
  amount: number;
}

export interface ParseResult {
  rows: StatementRow[];
  /** Kaynak biçimi */
  format: "csv" | "xlsx";
  /** Kaç satırın atlandığı (tarih/tutar okunamayan) */
  skipped: number;
  error?: string;
}

/* ─── Tutar ayrıştırma ─── */

export function parseAmount(raw: string | number | Date | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  let s = String(raw).trim();
  if (!s) return null;

  let negative = false;

  // (1.234,56) negatif gösterimi
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // sondaki "-" (Türk bankaları: "1.234,56-")
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  // baştaki "-"
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }

  // Para birimi ve boşlukları temizle
  s = s.replace(/[₺$€£\sTLTRY]/gi, "");

  // Ondalık ayıracı belirle: son geçen , veya .
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    // Türk formatı: 1.234,56
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // İngiliz formatı: 1,234.56
    normalized = s.replace(/,/g, "");
  } else {
    normalized = s;
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return negative ? -num : num;
}

/* ─── Tarih ayrıştırma ─── */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoOf(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 1900 || y > 2200) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseStatementDate(raw: string | number | Date | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (raw instanceof Date) {
    return isoOf(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  if (typeof raw === "number") {
    // Excel tarih serisi (1900 tabanlı)
    const ms = Math.round((raw - 25569) * 86_400_000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  const s = String(raw).trim();

  // yyyy-aa-gg veya yyyy/aa/gg
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return isoOf(Number(m[1]), Number(m[2]), Number(m[3]));

  // gg.aa.yyyy veya gg/aa/yyyy (2 haneli yıl: 50-99 → 1950+, 00-49 → 2000+)
  m = s.match(/^((\d{1,2})[-/.](\d{1,2})[-/.])(\d{4}|\d{2})/);
  if (m) {
    let year = Number(m[4]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    return isoOf(year, Number(m[3]), Number(m[2]));
  }

  // dd MMM yyyy / d MMMM yyyy (Türkçe ay adları)
  const trMonths: Record<string, number> = {
    "oca": 1, "şub": 2, "sub": 2, "mar": 3, "nis": 4, "may": 5, "haz": 6,
    "tem": 7, "ağu": 8, "agu": 8, "eyl": 9, "eki": 10, "kas": 11, "ara": 12,
    "ocak": 1, "şubat": 2, "subat": 2, "mart": 3, "nisan": 4, "mayıs": 5,
    "mayis": 5, "haziran": 6, "temmuz": 7, "ağustos": 8, "agustos": 8,
    "eylül": 9, "eylul": 9, "ekim": 10, "kasım": 11, "kasim": 11, "aralık": 12,
    "aralik": 12,
  };
  m = s.match(/^(\d{1,2})\s+([a-zA-ZğüşöçıİĞÜŞÖÇ]+)\s+(\d{4})/);
  if (m) {
    const month = trMonths[m[2].toLocaleLowerCase("tr")];
    if (month) return isoOf(Number(m[3]), month, Number(m[1]));
  }

  return null;
}

/* ─── CSV ayrıştırma ─── */

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > semis && tabs > commas) return "\t";
  return semis >= commas ? ";" : ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/** Bir CSV metnini satır nesnelerine çevirir. */
function csvToRows(text: string): { headers: string[] | null; records: string[][] } {
  const delim = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: null, records: [] };

  const first = splitCsvLine(lines[0], delim);
  // İlk satır başlık mı? — tarih/tutar/işlem gibi anahtar kelimeler içeriyor mu
  const headerHint = /tarih|tutar|açıklama|aciklama|işlem|islem|bakiye|borç|borc|alacak|giriş|giris|çıkış|cikis|amount|date|description/i;
  const hasHeader = first.some((cell) => headerHint.test(cell));

  if (hasHeader) {
    return {
      headers: first,
      records: lines.slice(1).map((l) => splitCsvLine(l, delim)),
    };
  }
  return { headers: null, records: lines.map((l) => splitCsvLine(l, delim)) };
}

/* ─── Kolon eşleme ─── */

interface ColumnMap {
  dateIdx: number;
  descIdx: number;
  amountIdx: number;
  /** ayrı giriş/çıkış kolonları (opsiyonel) */
  creditIdx: number;
  debitIdx: number;
}

const DATE_HINTS = /tarih|date|değer|işlem tarihi|valör/i;
const DESC_HINTS = /açıklama|aciklama|açiklama|description|detay|işlem|islem|specifikasyon|konu/i;
const AMOUNT_HINTS = /tutar|tımır|amount|miktar|tım/i;
const CREDIT_HINTS = /giriş|giris|alacak|credit|yatan|gelen/i;
const DEBIT_HINTS = /çıkış|cikis|borç|borc|debit|çekilen|giden/i;

function findColumn(headers: string[] | null, hints: RegExp, fallbackIdx: number): number {
  if (headers) {
    for (let i = 0; i < headers.length; i++) {
      if (hints.test(headers[i])) return i;
    }
  }
  return fallbackIdx;
}

function buildColumnMap(
  headers: string[] | null,
  records: string[][],
): ColumnMap {
  if (headers) {
    const dateIdx = findColumn(headers, DATE_HINTS, 0);
    const descIdx = findColumn(headers, DESC_HINTS, 1);
    const creditIdx = findColumn(headers, CREDIT_HINTS, -1);
    const debitIdx = findColumn(headers, DEBIT_HINTS, -1);
    let amountIdx = -1;
    if (creditIdx === -1 && debitIdx === -1) {
      amountIdx = findColumn(headers, AMOUNT_HINTS, -1);
      if (amountIdx === -1) {
        // İlk tutar-benzeri kolonu bul
        for (let i = 0; i < headers.length; i++) {
          const sample = records.find((r) => r[i])?.[i];
          if (sample !== undefined && parseAmount(sample) !== null && i !== dateIdx) {
            amountIdx = i;
            break;
          }
        }
      }
    }
    return { dateIdx, descIdx, amountIdx, creditIdx, debitIdx };
  }

  // Başlıksız: örneklemlerle kolonları bul
  const sample = records.slice(0, 8);
  const colCount = Math.max(...sample.map((r) => r.length), 0);

  // 1) Tarih kolonu: örneklerin çoğunluğunda tarih çözülen ilk kolon
  let dateIdx = -1;
  for (let i = 0; i < colCount; i++) {
    const vals = sample.map((r) => r[i]).filter((v) => v !== undefined && v !== "");
    const hits = vals.filter((v) => parseStatementDate(v) !== null).length;
    if (vals.length > 0 && hits / vals.length >= 0.5) {
      dateIdx = i;
      break;
    }
  }
  if (dateIdx === -1) dateIdx = 0;

  // 2) Tutar kolonu: tarih olmayan, sayıya çevrilen SON kolon (bakiye genelde en sonda)
  let amountIdx = -1;
  for (let i = colCount - 1; i >= 0; i--) {
    if (i === dateIdx) continue;
    const vals = sample.map((r) => r[i]).filter((v) => v !== undefined && v !== "");
    const hits = vals.filter((v) => parseAmount(v) !== null).length;
    if (vals.length > 0 && hits / vals.length >= 0.5) {
      amountIdx = i;
      break;
    }
  }
  if (amountIdx === -1) amountIdx = 1;

  // 3) Açıklama: tarih ve tutar olmayan ilk kolon
  let descIdx = -1;
  for (let i = 0; i < colCount; i++) {
    if (i === dateIdx || i === amountIdx) continue;
    descIdx = i;
    break;
  }
  if (descIdx === -1) descIdx = dateIdx === 0 ? 1 : 0;

  return { dateIdx, descIdx, amountIdx, creditIdx: -1, debitIdx: -1 };
}

/* ─── Ana ayrıştırıcılar ─── */

function recordsToStatement(
  headers: string[] | null,
  records: (string | number | Date)[][],
): ParseResult {
  if (records.length === 0) {
    return { rows: [], format: "csv", skipped: 0, error: "Ekstrede satır bulunamadı." };
  }

  const map = buildColumnMap(
    headers,
    records.map((r) => r.map((c) => (c == null ? "" : String(c)))),
  );

  const rows: StatementRow[] = [];
  let skipped = 0;

  for (const record of records) {
    const date = parseStatementDate(record[map.dateIdx]);
    let amount: number | null = null;

    if (map.creditIdx !== -1 || map.debitIdx !== -1) {
      const credit = map.creditIdx !== -1 ? parseAmount(record[map.creditIdx]) : null;
      const debit = map.debitIdx !== -1 ? parseAmount(record[map.debitIdx]) : null;
      if (credit != null && credit !== 0) amount = Math.abs(credit);
      else if (debit != null && debit !== 0) amount = -Math.abs(debit);
    }
    if (amount === null && map.amountIdx !== -1) {
      amount = parseAmount(record[map.amountIdx]);
    }

    if (date === null || amount === null || amount === 0) {
      skipped++;
      continue;
    }

    const description =
      map.descIdx !== -1 && map.descIdx < record.length
        ? String(record[map.descIdx] ?? "").trim()
        : "";

    rows.push({ date, description, amount });
  }

  if (rows.length === 0) {
    return {
      rows,
      format: "csv",
      skipped,
      error:
        "Uygun satır bulunamadı — dosyada Tarih ve Tutar kolonları (gg.aa.yyyy / 1.234,56) olmalı.",
    };
  }

  return { rows, format: "csv", skipped };
}

/** CSV / TXT ekstre metnini ayrıştırır. */
export function parseCsvStatement(text: string): ParseResult {
  try {
    const { headers, records } = csvToRows(text);
    return recordsToStatement(headers, records);
  } catch {
    return { rows: [], format: "csv", skipped: 0, error: "CSV okunamadı." };
  }
}

/** XLSX / XLS ekstre dosyasını ayrıştırır. */
export async function parseXlsxStatement(file: File | ArrayBuffer): Promise<ParseResult> {
  try {
    const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { rows: [], format: "xlsx", skipped: 0, error: "Dosyada sayfa yok." };
    }
    const ws = wb.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
    });
    if (records.length === 0) {
      return { rows: [], format: "xlsx", skipped: 0, error: "Sayfa boş." };
    }

    // İlk satır başlık mı?
    const first = records[0].map((c) => String(c ?? ""));
    const headerHint = /tarih|tutar|açıklama|aciklama|işlem|islem|bakiye|borç|borc|alacak|giriş|giris|çıkış|cikis|amount|date/i;
    const hasHeader = first.some((cell) => headerHint.test(cell));

    const headers = hasHeader ? first : null;
    const body = (hasHeader ? records.slice(1) : records) as (string | number | Date)[][];
    const result = recordsToStatement(headers, body);
    return { ...result, format: "xlsx" };
  } catch {
    return { rows: [], format: "xlsx", skipped: 0, error: "Excel dosyası okunamadı." };
  }
}

/** Dosya türüne göre otomatik ayrıştırır. */
export async function parseStatementFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseXlsxStatement(file);
  }
  const text = await file.text();
  return parseCsvStatement(text);
}
