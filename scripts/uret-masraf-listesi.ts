/**
 * src/data/masrafListesi.ts üreticisi.
 *
 * KAYNAK: GÜNCEL MASRAF LİSTESİ 2026.xlsx (proje kökünde)
 *   - "VERİ BANKASI" sayfası → seçilebilir listeler + satıcı rehberi
 *   - Tüm aylık sayfalar → (vergi no → ünvan) çiftleri
 *
 * Kullanım: bun scripts/uret-masraf-listesi.ts
 *
 * Kalite kuralları:
 *   - Vergi no her zaman sayısal olmalı (5-12 hane); "ARAÇ YAKIT GİDERİ"
 *     gibi kaymış sütun değerleri bu sayede elenir.
 *   - Ünvan en az 3 karakter ve harf içermeli ("0" gibi sahte değerler elenir).
 */
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";

const norm = (v: unknown) =>
  String(v ?? "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
const KOD_DEMEK = /^\d{5,12}$/;
const UNVAN_DEMEK = /[a-zçğıöşü]/i; // en az bir harf

const wb = XLSX.readFile("GÜNCEL MASRAF LİSTESİ 2026.xlsx");

/* ── VERİ BANKASI listeleri ── */
const vbRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
  wb.Sheets["VERİ BANKASI"],
  { header: 1, defval: null },
);
const vbData = vbRows.slice(1);
const col = (i: number) =>
  vbData.map((r) => r[i]).filter((v): v is string | number => v !== null && v !== undefined && v !== "");
const uniq = (vals: (string | number)[]) =>
  [...new Set(vals.map((v) => String(v).trim()))].filter(Boolean);
const arr = (vals: (string | number)[]) =>
  vals.map((v) => `  ${JSON.stringify(String(v))},`).join("\n");

const masrafCinsleri = uniq(col(1));
const kdvOranlari = [...new Set(col(2).map(Number))].sort((a, b) => a - b);
const aylar = uniq(col(4));
const masrafMerkezleri = uniq(col(5));
const iller = uniq(col(6));
const odemeTurleri = uniq(col(8));
const plakalar = uniq(col(9));
const firmalar = uniq(col(10));
const gunAraliklari = uniq(col(11));

const saticilar: { kod: string; ad: string }[] = [];
const seenAd = new Set<string>();
for (const r of vbData) {
  const kod = r[12] !== null && r[12] !== undefined && r[12] !== "" ? String(r[12]).trim().replace(/\.0$/, "") : "";
  const ad = r[13] !== null && r[13] !== undefined && r[13] !== "" ? String(r[13]).trim() : "";
  if (ad && !seenAd.has(ad)) {
    seenAd.add(ad);
    saticilar.push({ kod, ad });
  }
}
saticilar.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));

/* ── Tüm sayfalardan (vergi no → ünvan) hasadı ── */
const kod2unvan = new Map<string, Map<string, number>>();
let belgeSatiri = 0;
let elenenSatir = 0;
const ekle = (kod: string, unvan: string) => {
  if (!KOD_DEMEK.test(kod)) {
    elenenSatir++;
    return;
  }
  const u = unvan.trim();
  if (u.length < 3 || !UNVAN_DEMEK.test(u)) {
    elenenSatir++;
    return;
  }
  belgeSatiri++;
  let m = kod2unvan.get(kod);
  if (!m) {
    m = new Map();
    kod2unvan.set(kod, m);
  }
  m.set(u, (m.get(u) ?? 0) + 1);
};

for (const name of wb.SheetNames) {
  if (norm(name).includes("VERİBANKASI")) continue;
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  let kVergi = -1;
  let kUnvan = -1;
  let h = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const hh = rows[i] ?? [];
    const iv = hh.findIndex((c) => norm(c).includes("V.N."));
    const iu = hh.findIndex((c) => norm(c).includes("BELGENİNALINDIĞI"));
    if (iv >= 0 && iu >= 0) {
      kVergi = iv;
      kUnvan = iu;
      h = i;
      break;
    }
  }
  if (h < 0) continue;
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const kod = String(row[kVergi] ?? "").trim().replace(/\.0$/, "");
    const unvan = String(row[kUnvan] ?? "").trim();
    if (!kod && !unvan) continue;
    ekle(kod, unvan);
  }
}
for (const s of saticilar) if (s.kod) ekle(s.kod, s.ad);

const unvanlar: { kod: string; unvan: string }[] = [];
for (const [kod, yazimlar] of kod2unvan) {
  let enIyi = "";
  let enSayi = -1;
  for (const [unvan, sayi] of yazimlar)
    if (sayi > enSayi) {
      enIyi = unvan;
      enSayi = sayi;
    }
  unvanlar.push({ kod, unvan: enIyi });
}
unvanlar.sort((a, b) => a.unvan.localeCompare(b.unvan, "tr"));

/* ── Dosyayı yaz ── */
const q = (s: string) => JSON.stringify(s);
const out = `/**
 * GÜNCEL MASRAF LİSTESİ 2026.xlsx dosyasından üretilmiştir
 * (scripts/uret-masraf-listesi.ts ile).
 *  - "VERİ BANKASI" sayfası: seçilebilir listeler
 *  - Tüm aylık sayfalar: (vergi no → ünvan) hasadı; vergi no sayısal,
 *    ünvan harf içeren satırlar alınır. Aynı no için en sık yazım seçilir.
 * Kaynak dosya güncellenirse: bun scripts/uret-masraf-listesi.ts
 */

/** Masraf cinsi seçenekleri (xlsx: "MASRAF CİNSİ SEÇİNİZ") */
export const MASRAF_CINSLERI = [
${arr(masrafCinsleri)}
];

/** KDV oranları (xlsx: "KDV ORANI SEÇİNİZ") — %8/%18/%26 2023 geçiş oranlarıdır */
export const MASRAF_KDV_ORANLARI = [${kdvOranlari.join(", ")}];

/** Aylar */
export const AYLAR = [
${arr(aylar)}
];

/** Masraf merkezleri (xlsx'e göre firma bazlı) */
export const MASRAF_MERKEZLERI_XLSX = [
${arr(masrafMerkezleri)}
];

/** İller */
export const ILLER = [
${arr(iller)}
];

/** Ödeme türleri (kart hesapları, nakit, çek, senet …) */
export const ODEME_TURLERI_XLSX = [
${arr(odemeTurleri)}
];

/** Araç plakaları */
export const ARAC_PLAKALARI = [
${arr(plakalar)}
];

/** Firmalar */
export const FIRMALAR_XLSX = [
${arr(firmalar)}
];

/** Gün aralıkları */
export const GUN_ARALIKLARI = [
${arr(gunAraliklari)}
];

/** Satıcı rehberi (VERİ BANKASI): { kod: vergi no, ad: satıcı unvanı } */
export const SATICILAR: { kod: string; ad: string }[] = [
${saticilar.map((s) => `  { kod: ${q(s.kod)}, ad: ${q(s.ad)} },`).join("\n")}
];

/** Tüm ünvan + vergi no çiftleri (belge satırlarından + VERİ BANKASI).
 *  Aynı vergi no için en sık kullanılan ünvan yazımı seçilmiştir. */
export const UNVANLAR: { kod: string; unvan: string }[] = [
${unvanlar.map((u) => `  { kod: ${q(u.kod)}, unvan: ${q(u.unvan)} },`).join("\n")}
];
`;

writeFileSync("src/data/masrafListesi.ts", out);
console.log(
  `UNVANLAR: ${unvanlar.length} çift · eşlenen satır: ${belgeSatiri} · elenen: ${elenenSatir} · dosya: ${out.length} byte`,
);
