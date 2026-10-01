/**
 * Kasa/Cari Adat (Imputed Faiz) Motoru
 * =====================================
 * "GD_ADAT HESAPLAMA TABLOSU-2025" Excel şablonundaki formüllerin birebir TypeScript
 * karşılığı. Kullanıcı kendi .xlsx/.xlsm şablonunu yüklediğinde TCMB oran tablosu,
 * parametreler ve işlem satırları dosyadan okunur; hesaplama canlı yapılır.
 *
 * Excel karşılıkları (KASA sayfası):
 *   E (Kasa Bakiyesi)  = önceki bakiye + borç − alacak
 *   G (İşlem Görecek)  = bakiye < 0 → yok · bakiye ≤ azami → 0 · değilse bakiye − azami
 *   H (Faiz %)         = işlem tarihine göre dönemsel TCMB avans oranları
 *   I (Gün)            = sonraki işlem tarihi − bu tarih (son satırda vade tarihine kadar)
 *   J (Faiz)           = gün × tutar × oran / (yılGünü × 100)   [Excel: 36500 = 365×100]
 *   K (Kümülatif)      = önceki kümülatif + J
 *   Toplam faiz = ΣJ · KDV = faiz × KDV% · Fatura = faiz + KDV
 */

import * as XLSX from "xlsx";
import { parseTurkishNumber } from "@/lib/finance/format";

export interface AdatOranDonemi {
  /** Başlangıç — "YYYY-MM-DD" (bir sonraki dönemin başlangıcına kadar geçerli) */
  bas: string;
  /** Yıllık avans/adat faiz oranı (%) */
  oran: number;
}

export interface AdatIslem {
  id: string;
  /** "YYYY-MM-DD" */
  tarih: string;
  borc: number;
  alacak: number;
}

export interface AdatSatir {
  islem: AdatIslem;
  /** İşlem sonrası bakiye */
  bakiye: number;
  /** Faiz işleyecek tutar (bakiye − azami; bakiye ≤ azami → 0; bakiye < 0 → null) */
  islemGorecek: number | null;
  /** İşlem tarihine düşen yıllık oran (%) */
  oran: number;
  /** Sonraki işlem/vade tarihine kadar geçen gün */
  gun: number | null;
  /** İşleyen adat faizi (TL) */
  faiz: number;
  /** Kümülatif faiz */
  kumulatif: number;
}

export interface AdatSonuc {
  satirlar: AdatSatir[];
  toplamFaiz: number;
  kdv: number;
  genelToplam: number;
  /** Vade tarihine kalan gün */
  kalanGun: number | null;
}

export interface AdatParametreler {
  /** Açılış bakiyesi (cari hesapta önceki dönem bakiyesi; kasada genelde 0) */
  acilisBakiyesi: number;
  /** "YYYY-MM-DD" — faiz bu tarihe kadar işler */
  vadeTarihi: string;
  /** 360 veya 365 */
  yilGunu: number;
  /** Kasada/cari hesapta adat dışı sayılan azami tutar */
  azamiTutar: number;
  /** KDV oranı (%) */
  kdvOrani: number;
}

const MS_GUN = 86_400_000;
const isoToDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const gunFarki = (a: string, b: string) => Math.round((isoToDate(b).getTime() - isoToDate(a).getTime()) / MS_GUN);

/** Tarih hangi dönemin oranına denk geliyor? (bas ≤ tarih < sonraki bas) */
function oranBul(donemler: AdatOranDonemi[], tarih: string): number {
  let bulunan = 0;
  for (const d of donemler) {
    if (d.bas <= tarih) bulunan = d.oran;
    else break;
  }
  return bulunan;
}

/** Ana hesaplama — Excel KASA sayfası satır formüllerinin birebir karşılığı. */
export function hesaplaAdat(
  islemler: AdatIslem[],
  donemler: AdatOranDonemi[],
  p: AdatParametreler,
): AdatSonuc {
  const sirali = [...islemler].sort((a, b) => a.tarih.localeCompare(b.tarih));

  const satirlar: AdatSatir[] = [];
  let bakiye = p.acilisBakiyesi;
  let kumulatif = 0;

  for (let i = 0; i < sirali.length; i++) {
    const islem = sirali[i];
    bakiye = bakiye + islem.borc - islem.alacak;

    // Excel: son satır için gün = vade tarihi − işlem tarihi (I20 > B32 şartıyla)
    const sonrakiTarih = sirali[i + 1]?.tarih;
    const bitis = sonrakiTarih ?? p.vadeTarihi;
    const gun = p.vadeTarihi > islem.tarih ? Math.max(0, gunFarki(islem.tarih, bitis)) : null;

    const islemGorecek = bakiye < 0 ? null : bakiye <= p.azamiTutar ? 0 : bakiye - p.azamiTutar;
    const oran = oranBul(donemler, islem.tarih);
    const faiz = gun !== null && islemGorecek !== null ? (gun * islemGorecek * oran) / (p.yilGunu * 100) : 0;
    kumulatif += faiz;

    satirlar.push({ islem, islemGorecek, oran, gun, faiz, kumulatif, bakiye });
  }

  const toplamFaiz = satirlar.reduce((a, s) => a + s.faiz, 0);
  const kdv = toplamFaiz * (p.kdvOrani / 100);
  const sonTarih = sirali[sirali.length - 1]?.tarih;
  const kalanGun = sonTarih && sonTarih < p.vadeTarihi ? gunFarki(sonTarih, p.vadeTarihi) : null;

  return { satirlar, toplamFaiz, kdv, genelToplam: toplamFaiz + kdv, kalanGun };
}

/* ------------------------------------------------------------------ */
/* Varsayılan TCMB avans/adat oranları                                 */
/* Kaynak: Excel "TCMB" sayfası (1990-2025) + KASA sayfası dönem       */
/* tablosu (2023-2025, kullanıcının güncellediği değerler).            */
/* ------------------------------------------------------------------ */

const TCMB_AVANS: [string, number][] = [
  ["1990-09-20", 48.25], ["1990-11-10", 45], ["1990-11-23", 50.75], ["1991-02-15", 54.5],
  ["1994-01-11", 64], ["1994-01-27", 65], ["1994-04-21", 98], ["1994-07-12", 85],
  ["1994-07-27", 75], ["1995-06-10", 60], ["1995-08-01", 57], ["1997-08-02", 80],
  ["1999-12-30", 70], ["2002-05-17", 64], ["2003-06-14", 57], ["2003-10-08", 48],
  ["2004-06-15", 42], ["2005-01-13", 35], ["2005-05-25", 30], ["2005-12-20", 25],
  ["2006-12-20", 29], ["2007-12-28", 27], ["2009-04-09", 20], ["2009-06-12", 19],
  ["2009-12-22", 16], ["2010-12-30", 15], ["2011-12-29", 17.75], ["2012-06-19", 16.5],
  ["2012-12-20", 13.75], ["2013-06-21", 11], ["2013-12-27", 11.75], ["2014-12-14", 10.5],
  ["2016-12-31", 9.75], ["2018-06-29", 19.5], ["2019-10-11", 18.25], ["2019-12-21", 13.75],
  ["2020-06-13", 10], ["2020-12-19", 16.75], ["2021-12-31", 15.75], ["2022-12-31", 10.75],
  // 2023 ve sonrası — Excel KASA sayfasındaki dönem tablosuyla birebir aynı
  ["2023-01-01", 9.75], ["2023-06-24", 15.75], ["2023-09-01", 25.75], ["2023-09-28", 30.75],
  ["2023-11-01", 35.75], ["2023-12-01", 40.75], ["2023-12-23", 43.25], ["2024-04-01", 50.75],
  ["2024-12-28", 48.25], ["2025-03-08", 43.25], ["2025-09-17", 42.25], ["2025-12-20", 39.75],
];

export function varsayilanOranDonemleri(): AdatOranDonemi[] {
  const sirali = [...TCMB_AVANS].sort((a, b) => a[0].localeCompare(b[0]));
  return sirali.map(([bas, oran]) => ({ bas, oran }));
}

/* ------------------------------------------------------------------ */
/* Kullanıcı Excel şablonu okuyucu (GD_ADAT HESAPLAMA TABLOSU)         */
/* ------------------------------------------------------------------ */

export interface AdatExcelIcerik {
  islemler: { tarih: string; borc: number; alacak: number }[];
  donemler: AdatOranDonemi[];
  acilisBakiyesi: number | null;
  vadeTarihi: string | null;
  yilGunu: number | null;
  azamiTutar: number | null;
  kdvOrani: number | null;
  firma: string | null;
  kaynakSayfa: string;
}

/** Excel seri tarih (45658) → "YYYY-MM-DD"; metin tarihleri de kabul eder. */
function hucreTarih(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * MS_GUN).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // "45658" gibi metin seri tarih
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + n * MS_GUN).toISOString().slice(0, 10);
  }
  return null;
}

const norm = (s: unknown) =>
  String(s ?? "").toLocaleLowerCase("tr-TR").replace(/[^a-zçğıöşü0-9]/gi, "");

/**
 * GD_ADAT şablonunu (veya aynı düzeni taşıyan herhangi bir dosyayı) okur.
 * tercihSayfa verilirse (örn. "KASA" veya "CARİ") o sayfa öncelikli okunur;
 * bulunamazsa diğer sayfalara bakılır.
 */
export function okuAdatExcel(buf: ArrayBuffer, tercihSayfa?: string): AdatExcelIcerik {
  const wb = XLSX.read(buf, { type: "array", cellFormula: true });
  const sonuc: AdatExcelIcerik = {
    islemler: [], donemler: [], acilisBakiyesi: null, vadeTarihi: null,
    yilGunu: null, azamiTutar: null, kdvOrani: null, firma: null, kaynakSayfa: "",
  };

  const adlar = tercihSayfa && wb.SheetNames.includes(tercihSayfa)
    ? [tercihSayfa, ...wb.SheetNames.filter((s) => s !== tercihSayfa)]
    : wb.SheetNames;

  for (const ad of adlar) {
    const ws = wb.Sheets[ad];
    if (!ws) continue;
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    const hucre = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v;
    const satirHucreleri = (r: number): unknown[] => {
      const out: unknown[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) out.push(hucre(r, c));
      return out;
    };

    // --- Parametre etiketlerini tara (satır içinde etiket → sağındaki ilk değer) ---
    for (let r = range.s.r; r <= range.e.r; r++) {
      const hucreler = satirHucreleri(r);
      for (let c = 0; c < hucreler.length; c++) {
        const n = norm(hucreler[c]);
        const sagSayi = () => {
          for (let k = c + 1; k < hucreler.length; k++) {
            const v = hucreler[k];
            if (v == null || v === "") continue;
            const num = typeof v === "number" ? v : parseTurkishNumber(String(v));
            return Number.isFinite(num) ? num : null;
          }
          return null;
        };
        const sagTarih = () => {
          for (let k = c + 1; k < hucreler.length; k++) {
            const t = hucreTarih(hucreler[k]);
            if (t) return t;
          }
          return null;
        };
        const sagMetin = () => {
          for (let k = c + 1; k < hucreler.length; k++) {
            const v = hucreler[k];
            if (typeof v === "string" && v.trim()) return v.trim();
          }
          return null;
        };
        if (n.includes("firma") && sonuc.firma === null) sonuc.firma = sagMetin();
        else if (n.includes("vadetarih") && sonuc.vadeTarihi === null) sonuc.vadeTarihi = sagTarih();
        else if (n.includes("hesaplamatarih") && sonuc.vadeTarihi === null) sonuc.vadeTarihi = sagTarih();
        else if (n.includes("yilgun") && sonuc.yilGunu === null) sonuc.yilGunu = sagSayi();
        else if ((n.includes("adatharici") || n.includes("azami")) && sonuc.azamiTutar === null) sonuc.azamiTutar = sagSayi();
        else if (n.includes("kdvorani") && sonuc.kdvOrani === null) {
          // Etiket içinde de geçebilir: "KDV ORANI %20"
          const s = String(hucreler[c] ?? "").match(/(\d{1,2})\s*%?$/) ?? String(hucreler[c] ?? "").match(/%\s*(\d{1,2})/);
          sonuc.kdvOrani = (s ? Number(s[1]) : sagSayi()) ?? sonuc.kdvOrani;
        } else if (n.includes("carihesapbakiye") && sonuc.acilisBakiyesi === null) sonuc.acilisBakiyesi = sagSayi();
      }
    }

    // --- Oran dönemi tablosu: "Başlama / Bitiş / %" başlıklı blok ---
    if (sonuc.donemler.length === 0) {
      for (let r = range.s.r; r <= Math.min(range.e.r, 40); r++) {
        const hucreler = satirHucreleri(r);
        const basIdx = hucreler.findIndex((v) => norm(v).includes("baslama"));
        const pctIdx = hucreler.findIndex((v) => norm(v) === "%" || norm(v).includes("oran"));
        if (basIdx === -1 || pctIdx === -1 || pctIdx <= basIdx) continue;
        for (let rr = r + 1; rr <= Math.min(range.e.r, r + 20); rr++) {
          const bas = hucreTarih(hucre(rr, basIdx));
          const oranH = hucre(rr, pctIdx);
          const oran = typeof oranH === "number" ? oranH : parseTurkishNumber(String(oranH ?? ""));
          if (bas && Number.isFinite(oran) && oran > 0) sonuc.donemler.push({ bas, oran });
          else if (sonuc.donemler.length > 0) break;
        }
        if (sonuc.donemler.length > 0) { sonuc.kaynakSayfa = ad; break; }
      }
    }

    // --- İşlem satırları: "İŞLEM TARİHİ / BORÇ / ALACAK" başlıklı tablo ---
    if (sonuc.islemler.length === 0) {
      for (let r = range.s.r; r <= range.e.r; r++) {
        const hucreler = satirHucreleri(r);
        const tarIdx = hucreler.findIndex((v) => norm(v).includes("islemtarih"));
        const borcIdx = hucreler.findIndex((v) => norm(v).includes("borc"));
        const alcIdx = hucreler.findIndex((v) => norm(v).includes("alacak"));
        if (tarIdx === -1 || borcIdx === -1) continue;
        let bosSayac = 0;
        for (let rr = r + 1; rr <= range.e.r && bosSayac < 5; rr++) {
          const t = hucreTarih(hucre(rr, tarIdx));
          if (!t) { bosSayac++; continue; }
          bosSayac = 0;
          const numAt = (idx: number) => {
            if (idx < 0) return 0;
            const v = hucre(rr, idx);
            if (v == null || v === "") return 0;
            return typeof v === "number" ? v : parseTurkishNumber(String(v)) || 0;
          };
          const borc = numAt(borcIdx);
          const alacak = numAt(alcIdx);
          if (borc !== 0 || alacak !== 0) sonuc.islemler.push({ tarih: t, borc, alacak });
        }
        if (sonuc.islemler.length > 0) { sonuc.kaynakSayfa = ad; break; }
      }
    }

    // Tercih edilen sayfadan veri geldiyse diğer sayfaları tarama
    if (ad === tercihSayfa && (sonuc.islemler.length > 0 || sonuc.donemler.length > 0)) break;
  }

  return sonuc;
}
