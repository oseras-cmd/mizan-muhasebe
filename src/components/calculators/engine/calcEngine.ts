/**
 * Ortak hesap motoru — saf fonksiyonlar (UI'dan bağımsız, doğrulanabilir).
 * Tüm oranlar PARAMS_2026'dan gelir; para birimi TL.
 */
import { PARAMS_2026 as P, kidemTavani } from "./params";
import { yiufeDeger } from "./yiufe";

/* ==================== 1. STOPAJ (GVK 94) ==================== */

export type StopajTuru =
  | "isyeriKira"
  | "konutKiraKurum"
  | "serbestMeslek"
  | "temettu"
  | "avukatlik"
  | "insaatTaahhut"
  | "menkul";

export interface StopajInput {
  tur: StopajTuru;
  brut: number;
}

export interface StopajResult {
  brut: number;
  oran: number;
  stopaj: number;
  net: number;
  turAdi: string;
}

const STOPAJ_ORANLARI: Record<StopajTuru, { oran: number; ad: string }> = {
  isyeriKira: { oran: 0.2, ad: "İşyeri Kira Stopajı" },
  konutKiraKurum: { oran: 0.2, ad: "Konut Kira Stopajı (Kurum / ESM Kiracısı)" },
  serbestMeslek: { oran: 0.2, ad: "Serbest Meslek Stopajı" },
  temettu: { oran: 0.15, ad: "Temettü (Kar Payı) Stopajı" },
  avukatlik: { oran: 0.2, ad: "Avukatlık Hizmeti Stopajı" },
  insaatTaahhut: { oran: 0.15, ad: "İnşaat ve Taahhüt İşleri Stopajı" },
  menkul: { oran: 0.175, ad: "Menkul Kıymet ve Diğer Kazanç Stopajı" },
};

export function hesaplaStopaj(input: StopajInput): StopajResult | null {
  if (!Number.isFinite(input.brut) || input.brut <= 0) return null;
  const t = STOPAJ_ORANLARI[input.tur];
  const stopaj = input.brut * t.oran;
  return { brut: input.brut, oran: t.oran, stopaj, net: input.brut - stopaj, turAdi: t.ad };
}

/* ==================== 2. DAMGA VERGİSİ ==================== */

export type DamgaBelgeTuru =
  | "sozlesme"
  | "ihale"
  | "bordro"
  | "makbuz"
  | "kefalet"
  | "teminatMektubu"
  | "bilanco"
  | "gelirTablosu";

export interface DamgaInput {
  belgeTuru: DamgaBelgeTuru;
  tutar: number;
  nusha: number;
}

export interface DamgaResult {
  oranBinde: number | null;
  maktu: number | null;
  birNusha: number;
  toplam: number;
}

const DAMGA_TURLERI: Record<DamgaBelgeTuru, { binde?: number; maktu?: number }> = {
  sozlesme: { binde: P.DV_SOZLESME },
  ihale: { binde: P.DV_IHALE },
  bordro: { binde: P.DV_BORDRO },
  makbuz: { binde: P.DV_BORDRO },
  kefalet: { binde: P.DV_KEFALET },
  teminatMektubu: { binde: P.DV_KEFALET },
  bilanco: { maktu: P.DV_MAKTU_BILANCO },
  gelirTablosu: { maktu: P.DV_MAKTU_GELIR_TABLOSU },
};

export function hesaplaDamga(input: DamgaInput): DamgaResult | null {
  const cfg = DAMGA_TURLERI[input.belgeTuru];
  if (!cfg) return null;
  const n = Math.max(1, Math.floor(input.nusha || 1));
  if (cfg.binde != null) {
    if (!Number.isFinite(input.tutar) || input.tutar <= 0) return null;
    const birNusha = (input.tutar * cfg.binde) / 1000;
    return { oranBinde: cfg.binde, maktu: null, birNusha, toplam: birNusha * n };
  }
  const m = cfg.maktu ?? 0;
  return { oranBinde: null, maktu: m, birNusha: m, toplam: m * n };
}

/* ==================== 3. GİDER PUSULASI (GVK 94/13) ==================== */

export type GiderPusulasiBent = "a" | "b" | "c" | "ges" | "d";

export interface GiderPusulasiInput {
  yon: "brutten" | "netten";
  oranBent: GiderPusulasiBent;
  tutar: number;
  teslimTarihi?: string;
  duzenlemeTarihi?: string;
}

export interface GiderPusulasiResult {
  brut: number;
  oran: number;
  bentAdi: string;
  stopaj: number;
  net: number;
  yediGun: { gun: number | null; sonTarih: string | null; durum: "icinde" | "asildi" | "bilinmiyor" };
}

export const GIDER_PUSULASI_BENTLER: { bent: GiderPusulasiBent; ad: string; oran: number; kisa: string }[] = [
  { bent: "a", ad: "Evlerde imal edilen ürünler / geleneksel-kültürel meslek kolları (GVK 9/1)", oran: 0.02, kisa: "%2 — 94/13-a" },
  { bent: "b", ad: "Hurda mal alımları", oran: 0.02, kisa: "%2 — 94/13-b" },
  { bent: "c", ad: "Diğer mal alımları", oran: 0.05, kisa: "%5 — 94/13-c" },
  { bent: "ges", ad: "İhtiyaç fazlası elektrik bedeli (çatı/cephe GES, GVK 9/1-9)", oran: 0.0, kisa: "%0 — 94/13-ç" },
  { bent: "d", ad: "Diğer hizmet alımları — mal/hizmet bedeli ayrılamıyorsa dâhil", oran: 0.1, kisa: "%10 — 94/13-d" },
];

export function hesaplaGiderPusulasi(input: GiderPusulasiInput): GiderPusulasiResult | null {
  if (!Number.isFinite(input.tutar) || input.tutar <= 0) return null;
  const b = GIDER_PUSULASI_BENTLER.find((x) => x.bent === input.oranBent) ?? GIDER_PUSULASI_BENTLER[2];
  const brut = input.yon === "netten" ? input.tutar / (1 - b.oran) : input.tutar;
  const stopaj = brut * b.oran;
  const net = brut - stopaj;

  let gun: number | null = null;
  let sonTarih: string | null = null;
  let durum: GiderPusulasiResult["yediGun"]["durum"] = "bilinmiyor";
  if (input.teslimTarihi) {
    const t = new Date(`${input.teslimTarihi}T00:00:00`);
    if (!Number.isNaN(t.getTime())) {
      const son = new Date(t);
      son.setDate(son.getDate() + 7);
      sonTarih = son.toISOString().slice(0, 10);
      const ref = input.duzenlemeTarihi
        ? new Date(`${input.duzenlemeTarihi}T00:00:00`)
        : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
      gun = Math.round((son.getTime() - ref.getTime()) / 86400000);
      durum = gun >= 0 ? "icinde" : "asildi";
    }
  }
  return { brut, oran: b.oran, bentAdi: b.ad, stopaj, net, yediGun: { gun, sonTarih, durum } };
}

/* ==================== 4. SERBEST MESLEK MAKBUZU ==================== */

export interface SmmInput {
  hesapTuru: "tahsilEdilenden" | "brutten" | "netten";
  kdvTevkifatVar: boolean;
  kdvTevkifatOran: number; // 0..1 (0.5, 0.7, 0.9)
  tutar: number;
}

export interface SmmResult {
  brut: number;
  gvOran: number;
  gv: number;
  net: number;
  kdvOran: number;
  kdv: number;
  kdvTevkifat: number;
  tahsilEdilen: number;
}

export function hesaplaSmm(input: SmmInput): SmmResult | null {
  if (!Number.isFinite(input.tutar) || input.tutar <= 0) return null;
  const gvOran = P.SMM_GV_ORANI;
  const kdvOran = P.SMM_KDV_ORANI;
  const tfOran = input.kdvTevkifatVar ? input.kdvTevkifatOran : 0;
  let brut: number;
  if (input.hesapTuru === "tahsilEdilenden") {
    // tahsil = brut(1-gv) + brut·kdv(1-tf)
    brut = input.tutar / (1 - gvOran + kdvOran * (1 - tfOran));
  } else if (input.hesapTuru === "netten") {
    brut = input.tutar / (1 - gvOran);
  } else {
    brut = input.tutar;
  }
  const gv = brut * gvOran;
  const net = brut - gv;
  const kdv = brut * kdvOran;
  const kdvTevkifat = kdv * tfOran;
  const tahsilEdilen = net + kdv - kdvTevkifat;
  return { brut, gvOran, gv, net, kdvOran, kdv, kdvTevkifat, tahsilEdilen };
}

/* ==================== 5. HARCIRAH (GVK 24) ==================== */

export type HarcirahStatu = "memur" | "isverenTemsilci" | "isveren";

export interface HarcirahPersonel {
  id: string;
  ad: string;
  tur: "yurtIci" | "yurtDisi";
  ulkeGrup: string;
  statu: HarcirahStatu;
  gundelikOdenen: number;
  konaklama: number;
  ulasim: number;
  geceSayisi: number;
}

export interface HarcirahResult {
  id: string;
  ad: string;
  gundelikToplam: number;
  istisnaGunluk: number;
  istisnaToplam: number;
  asanGunluk: number;
  asanToplam: number;
  konaklama: number;
  ulasim: number;
  toplam: number;
  vergiyeTabi: number;
  tamIstisna: boolean;
}

export const HARCIRAH_STATU_ADLARI: Record<HarcirahStatu, string> = {
  memur: "Ücretli / memur (×1)",
  isverenTemsilci: "İşveren vekili / yardımcısı (×8)",
  isveren: "İşveren (×6)",
};

/** Yurt dışı gündelik katsayıları (bütçe uygulaması — 2026). */
export const HARCIRAH_YURT_DISI_GRUPLARI: { grup: string; katsayi: number }[] = [
  { grup: "1. Grup — ABD, Kanada, Norveç, İsviçre", katsayi: 7.0 },
  { grup: "2. Grup — Almanya, Avusturya, Belçika, Danimarka, Finlandiya, Fransa, İngiltere, İsveç, Avustralya, Japonya, Lüksemburg, Hollanda, İspanya, İtalya", katsayi: 5.5 },
  { grup: "3. Grup — Portekiz, Yunanistan, İsrail, İrlanda, İzlanda, Yeni Zelanda", katsayi: 5.0 },
  { grup: "4. Grup — diğer tüm ülkeler", katsayi: 4.0 },
  { grup: "5. Grup — KKTC, Azerbaycan, Gürcistan, Kazakistan, Kırgızistan, Özbekistan, Türkmenistan, Tacikistan, Ukrayna, Moldova, Belarus, Rusya", katsayi: 3.0 },
];

/**
 * GVK m.24/2 istisna sınırı: ücretliler için devlet memuru en yüksek gündeliğin kendisi (×1),
 * işveren vekil ve yardımcıları için 8 katı, işverenler için 6 katı.
 */
export function harcirahIstisnaGunluk(p: Pick<HarcirahPersonel, "tur" | "ulkeGrup" | "statu">): number {
  const statuCarp: Record<HarcirahStatu, number> = { memur: 1, isverenTemsilci: 8, isveren: 6 };
  if (p.tur === "yurtIci") return P.DEVLET_GUNDELIK * statuCarp[p.statu];
  const g = HARCIRAH_YURT_DISI_GRUPLARI.find((x) => x.grup === p.ulkeGrup);
  return P.DEVLET_GUNDELIK * statuCarp[p.statu] * (g?.katsayi ?? 3.0);
}

export function hesaplaHarcirah(p: HarcirahPersonel): HarcirahResult | null {
  if (!Number.isFinite(p.gundelikOdenen) || p.gundelikOdenen < 0) return null;
  if (!Number.isFinite(p.geceSayisi) || p.geceSayisi <= 0) return null;
  const istisnaGunluk = harcirahIstisnaGunluk(p);
  const gundelikToplam = p.gundelikOdenen * p.geceSayisi;
  const istisnaToplam = Math.min(gundelikToplam, istisnaGunluk * p.geceSayisi);
  const asanGunluk = Math.max(0, p.gundelikOdenen - istisnaGunluk);
  const asanToplam = Math.max(0, gundelikToplam - istisnaToplam);
  return {
    id: p.id,
    ad: p.ad,
    gundelikToplam,
    istisnaGunluk,
    istisnaToplam,
    asanGunluk,
    asanToplam,
    konaklama: p.konaklama || 0,
    ulasim: p.ulasim || 0,
    toplam: gundelikToplam + (p.konaklama || 0) + (p.ulasim || 0),
    vergiyeTabi: asanToplam,
    tamIstisna: asanToplam <= 0.005,
  };
}

/* ==================== 6. AMORTİSMAN ==================== */

export interface Kiyimet {
  id: string;
  ad: string;
  bedel: number;
  faydaliOmr: number;
  yontem: "normal" | "azalan";
  kist: boolean;
  aktifAy: number; // 1-12
}

export interface AmortismanYil {
  yil: number;
  oran: number; // 0..1 (oran bazlı görünüm)
  amortisman: number;
  birikmis: number;
  netDefter: number;
}

export interface AmortismanResult {
  yillikOran: number;
  ilkYilAyKatsayi: number;
  satirlar: AmortismanYil[];
  toplamAmortisman: number;
}

export function hesaplaAmortisman(k: Kiyimet, vergiYili: number): AmortismanResult | null {
  if (!Number.isFinite(k.bedel) || k.bedel <= 0) return null;
  if (!Number.isFinite(k.faydaliOmr) || k.faydaliOmr <= 0) return null;
  const normalOran = 1 / k.faydaliOmr;
  const azalanOran = Math.min(2 * normalOran, 0.5);
  const oran = k.yontem === "azalan" ? azalanOran : normalOran;
  const ayKatsayi = k.kist ? (12 - k.aktifAy + 1) / 12 : 1;
  // Kıst: ilk yıl kalan aylar, kalan süre son yıla taşınır (toplam süre = omur+1 yıl)
  const toplamYil = k.kist ? k.faydaliOmr + 1 : k.faydaliOmr;

  const satirlar: AmortismanYil[] = [];
  let kalan = k.bedel;
  let birikmis = 0;
  for (let yil = 1; yil <= toplamYil && kalan > 0.005; yil++) {
    let tutar: number;
    if (k.yontem === "azalan") {
      tutar = kalan * oran;
      if (yil === toplamYil) tutar = kalan; // son yıl kalanı bitir
    } else {
      if (yil === 1 && k.kist) {
        tutar = k.bedel * oran * ayKatsayi;
      } else {
        // kalan yıllara eşit bölünür (kıst taşımalı)
        const kalanYil = toplamYil - yil + 1;
        tutar = kalan / kalanYil;
      }
      if (yil === toplamYil) tutar = kalan;
    }
    if (tutar > kalan) tutar = kalan;
    birikmis += tutar;
    kalan -= tutar;
    if (kalan < 0.005) kalan = 0;
    satirlar.push({
      yil: vergiYili + yil - 1,
      oran: k.yontem === "azalan" ? oran : (yil === 1 && k.kist ? oran * ayKatsayi : tutar / k.bedel),
      amortisman: tutar,
      birikmis,
      netDefter: kalan,
    });
  }
  return { yillikOran: oran, ilkYilAyKatsayi: ayKatsayi, satirlar, toplamAmortisman: birikmis };
}

/* ==================== 7. REESKONT (VUK 281/285) ==================== */

export type SenetTuru = "senet" | "cek";

export interface Senet {
  id: string;
  tur: SenetTuru;
  tutar: number;
  vade: string;
}

export interface SenetReeskont {
  id: string;
  tutar: number;
  vade: string;
  gun: number;
  vadesiGecen: boolean;
  reeskont: number;
  simdikiDeger: number;
}

export interface ReeskontResult {
  satirlar: SenetReeskont[];
  nominalToplam: number;
  reeskontToplam: number;
  simdikiToplam: number;
  ortalamaVade: number;
  agirlikliVade: number;
  gecenSayisi: number;
}

export function hesaplaReeskont(senetler: Senet[], oranYuzde: number, degerlemeTarihi: string): ReeskontResult {
  const d0 = new Date(`${degerlemeTarihi}T00:00:00`);
  const satirlar: SenetReeskont[] = [];
  let nominalToplam = 0;
  let reeskontToplam = 0;
  let simdikiToplam = 0;
  let agirlikliToplam = 0;
  let gecerliToplam = 0;
  let gecenSayisi = 0;
  for (const s of senetler) {
    if (!Number.isFinite(s.tutar) || s.tutar <= 0 || !s.vade) continue;
    const vade = new Date(`${s.vade}T00:00:00`);
    if (Number.isNaN(vade.getTime())) continue;
    const gun = Math.round((vade.getTime() - d0.getTime()) / 86400000);
    const vadesiGecen = gun <= 0;
    let reeskont = 0;
    if (!vadesiGecen) {
      // İç iskonto: Rd = N × i × d / (36500 + i × d) — i yüzde sayısı (örn. 39,75), 36500 = 365×100
      reeskont = (s.tutar * oranYuzde * gun) / (36500 + oranYuzde * gun);
    }
    const simdikiDeger = s.tutar - reeskont;
    satirlar.push({ id: s.id, tutar: s.tutar, vade: s.vade, gun, vadesiGecen, reeskont, simdikiDeger });
    nominalToplam += s.tutar;
    reeskontToplam += reeskont;
    simdikiToplam += simdikiDeger;
    if (!vadesiGecen) {
      agirlikliToplam += s.tutar * gun;
      gecerliToplam += s.tutar;
    } else {
      gecenSayisi++;
    }
  }
  const gecenOlmayan = satirlar.filter((x) => !x.vadesiGecen);
  const ortalamaVade = gecenOlmayan.length
    ? gecenOlmayan.reduce((a, x) => a + x.gun, 0) / gecenOlmayan.length
    : 0;
  const agirlikliVade = gecerliToplam > 0 ? agirlikliToplam / gecerliToplam : 0;
  return { satirlar, nominalToplam, reeskontToplam, simdikiToplam, ortalamaVade, agirlikliVade, gecenSayisi };
}

/* ==================== 8. ADAT (TÜRMOB) ==================== */

export interface AdatSatir {
  tutar: number;
  gun: number;
}

export interface AdatResult {
  toplamTutar: number;
  toplamTutarGun: number; // Σ (tutar × gün)
  ortalamaVade: number; // Σ(t×g)/Σt
  adatKatsayisi: number; // Σ(t×g)/1000
}

export function hesaplaAdat(senetler: AdatSatir[]): AdatResult | null {
  const gecerli = senetler.filter(
    (s) => Number.isFinite(s.tutar) && s.tutar > 0 && Number.isFinite(s.gun) && s.gun > 0,
  );
  if (gecerli.length === 0) return null;
  const toplamTutar = gecerli.reduce((a, s) => a + s.tutar, 0);
  const toplamTutarGun = gecerli.reduce((a, s) => a + s.tutar * s.gun, 0);
  return {
    toplamTutar,
    toplamTutarGun,
    ortalamaVade: toplamTutarGun / toplamTutar,
    adatKatsayisi: toplamTutarGun / 1000,
  };
}

/* ==================== 9. ENFLASYON DÜZELTMESİ (VUK 298) ==================== */

export interface EnflasyonKalem {
  id: string;
  hesap: string;
  ad: string;
  tur: "aktif" | "pasif";
  edinmeYil: number;
  edinmeAy: number;
  defterDegeri: number;
}

export interface EnflasyonSatir {
  id: string;
  hesap: string;
  ad: string;
  tur: "aktif" | "pasif";
  defterDegeri: number;
  edinmeEndeksi: number;
  katsayi: number;
  duzeltilmis: number;
  fark: number;
}

export interface EnflasyonResult {
  satirlar: EnflasyonSatir[];
  aktifToplam: { defter: number; duzeltilmis: number; fark: number };
  pasifToplam: { defter: number; duzeltilmis: number; fark: number };
  kzarar: number;
  donemSonuEndeksi: number;
}

export function hesaplaEnflasyon(
  kalemler: EnflasyonKalem[],
  donemSonuYil: number,
  donemSonuAy: number,
): EnflasyonResult | null {
  if (kalemler.length === 0) return null;
  const sonEndeks = yiufeDeger(donemSonuYil, donemSonuAy);
  if (sonEndeks == null || sonEndeks <= 0) return null;
  const satirlar: EnflasyonSatir[] = [];
  let aDefter = 0, aDuz = 0, aFark = 0;
  let pDefter = 0, pDuz = 0, pFark = 0;
  for (const k of kalemler) {
    const eEndeks = yiufeDeger(k.edinmeYil, k.edinmeAy);
    const gecerli = k.defterDegeri > 0 && eEndeks != null && eEndeks > 0;
    const katsayi = gecerli ? sonEndeks / (eEndeks as number) : 0;
    const duzeltilmis = gecerli ? k.defterDegeri * katsayi : 0;
    const fark = gecerli ? duzeltilmis - k.defterDegeri : 0;
    satirlar.push({
      id: k.id, hesap: k.hesap, ad: k.ad, tur: k.tur,
      defterDegeri: k.defterDegeri,
      edinmeEndeksi: eEndeks ?? 0,
      katsayi,
      duzeltilmis: gecerli ? duzeltilmis : k.defterDegeri,
      fark,
    });
    if (!gecerli) continue;
    if (k.tur === "aktif") { aDefter += k.defterDegeri; aDuz += duzeltilmis; aFark += fark; }
    else { pDefter += k.defterDegeri; pDuz += duzeltilmis; pFark += fark; }
  }
  return {
    satirlar,
    aktifToplam: { defter: aDefter, duzeltilmis: aDuz, fark: aFark },
    pasifToplam: { defter: pDefter, duzeltilmis: pDuz, fark: pFark },
    kzarar: aFark - pFark,
    donemSonuEndeksi: sonEndeks,
  };
}

/* ==================== 10. FİNANSMAN GİDER KISITLAMASI (KVK 11/1-i) ==================== */

export interface FinansmanInput {
  yabanciKaynak: number;
  ozkaynak: number;
  finansmanGideri: number;
  kisitlamaOrani: number; // 0.10
}

export interface FinansmanResult {
  uygulanmaz: boolean;
  asanKisim: number;
  asanOran: number;
  kisitlamayaTabi: number;
  kkeg: number;
  indirilecek: number;
}

export function hesaplaFinansman(input: FinansmanInput): FinansmanResult | null {
  if (!Number.isFinite(input.yabanciKaynak) || !Number.isFinite(input.ozkaynak) || !Number.isFinite(input.finansmanGideri)) return null;
  if (input.yabanciKaynak < 0 || input.ozkaynak < 0 || input.finansmanGideri < 0) return null;
  const asanKisim = Math.max(0, input.yabanciKaynak - input.ozkaynak);
  const asanOran = input.yabanciKaynak > 0 ? asanKisim / input.yabanciKaynak : 0;
  const uygulanmaz = asanKisim <= 0 || input.finansmanGideri <= 0;
  const kisitlamayaTabi = input.finansmanGideri * asanOran;
  const kkeg = kisitlamayaTabi * input.kisitlamaOrani;
  return { uygulanmaz, asanKisim, asanOran, kisitlamayaTabi, kkeg, indirilecek: input.finansmanGideri - kkeg };
}

/* ==================== 11. BİNEK OTO KISITLAMASI ==================== */

export interface BinekInput {
  alisBedeli: number; // KDV hariç
  kdv: number;
  otv: number;
  aylikKira: number;
  yillikYakit: number;
  yil: 2025 | 2026;
}

export interface BinekResult {
  toplamAlis: number;
  amortismanMatrahi: number;
  yillikAmortisman: number;
  amortismanKKEG: number;
  kiraYillik: number;
  kiraKKEG: number;
  yakitIndirilebilir: number;
  yakitKKEG: number;
  toplamKKEG: number;
  toplamIndirilebilir: number;
  kdvIndirilebilir: boolean;
  kdvKKEG: number;
}

export function hesaplaBinek(input: BinekInput): BinekResult | null {
  if (!Number.isFinite(input.alisBedeli) || input.alisBedeli <= 0) return null;
  const sinir = input.yil === 2025 ? P.BINEK_AMORTISMAN_SINIR_2025 : P.BINEK_AMORTISMAN_SINIR_2026;
  const kiraSinirAylik = input.yil === 2025 ? 9200 : 9900;
  const toplamAlis = input.alisBedeli + (input.kdv || 0) + (input.otv || 0);
  const amortismanMatrahi = Math.min(input.alisBedeli, sinir);
  const yillikAmortisman = amortismanMatrahi / 5;
  const amortismanKKEG = Math.max(0, input.alisBedeli - sinir) / 5;
  const kiraYillik = (input.aylikKira || 0) * 12;
  const kiraKKEG = Math.max(0, kiraYillik - kiraSinirAylik * 12);
  const yakitIndirilebilir = (input.yillikYakit || 0) * 0.5;
  const yakitKKEG = (input.yillikYakit || 0) - yakitIndirilebilir;
  const toplamKKEG = amortismanKKEG + kiraKKEG + yakitKKEG;
  const toplamIndirilebilir = yillikAmortisman + (kiraYillik - kiraKKEG) + yakitIndirilebilir;
  const kdvIndirilebilir = toplamAlis <= P.BINEK_KDV_SINIR;
  const kdvKKEG = kdvIndirilebilir ? 0 : (input.kdv || 0);
  return {
    toplamAlis, amortismanMatrahi, yillikAmortisman, amortismanKKEG,
    kiraYillik, kiraKKEG, yakitIndirilebilir, yakitKKEG,
    toplamKKEG, toplamIndirilebilir, kdvIndirilebilir, kdvKKEG,
  };
}

/* ==================== 12. KIDEM & İHBAR ==================== */

export type FesihNedeni = "isverenFeshi" | "istifa" | "erkekEvlenme" | "erkekAskerlik" | "emeklilik" | "oluyorlar";

export interface KidemIhbarInput {
  iseGiris: string;
  istenCikis: string;
  giydirilmisBrut: number;
  fesihNedeni: FesihNedeni;
}

export interface KidemResult {
  hak: boolean;
  calismaSuresi: { yil: number; ay: number; gun: number; toplamGun: number };
  giydirilmisBrut: number;
  tavan: number;
  tavanAsildi: boolean;
  kullanilanGunluk: number;
  brutKidem: number;
  damga: number;
  netKidem: number;
}

export interface IhbarResult {
  hak: boolean;
  sureHafta: number;
  brutIhbar: number;
  sgk: number;
  issizlik: number;
  gv: number;
  damga: number;
  netIhbar: number;
}

export const FESIH_ADLARI: Record<FesihNedeni, string> = {
  isverenFeshi: "İşveren tarafından fesih (haklı neden hariç)",
  istifa: "İşçi istifası",
  erkekEvlenme: "Erkek işçinin evlenmesi (işçi feshi)",
  erkekAskerlik: "Erkek işçinin askerlik görevi (işçi feshi)",
  emeklilik: "Emeklilik / EYT (işçi feshi)",
  oluyorlar: "",
};

/** İş Kanunu m.17 ihbar süreleri (hafta). */
export function ihbarSureHafta(toplamGun: number): number {
  if (toplamGun < 180) return 2; // 6 aydan az — süre 2 hafta (tazminat hakkı kıdem koşuluna bağlı)
  if (toplamGun < 540) return 2;
  if (toplamGun < 1095) return 4;
  if (toplamGun < 1825) return 6;
  return 8;
}

/** Kıdem hakkı: istifa hariç tüm nedenler; istifa → yalnızca evlilik/askerlik (erkek) zaten ayrı türlerde. */
export function kidemHakVar(nedeni: FesihNedeni): boolean {
  return nedeni !== "istifa";
}

export function hesaplaKidemIhbar(input: KidemIhbarInput): { kidem: KidemResult | null; ihbar: IhbarResult | null } {
  const giris = new Date(`${input.iseGiris}T00:00:00`);
  const cikis = new Date(`${input.istenCikis}T00:00:00`);
  if (Number.isNaN(giris.getTime()) || Number.isNaN(cikis.getTime()) || cikis <= giris) {
    return { kidem: null, ihbar: null };
  }
  if (!Number.isFinite(input.giydirilmisBrut) || input.giydirilmisBrut <= 0) {
    return { kidem: null, ihbar: null };
  }
  // Çalışma süresi: yıl/ay/gün
  let yil = cikis.getFullYear() - giris.getFullYear();
  let ay = cikis.getMonth() - giris.getMonth();
  let gun = cikis.getDate() - giris.getDate();
  if (gun < 0) {
    ay -= 1;
    gun += new Date(cikis.getFullYear(), cikis.getMonth(), 0).getDate();
  }
  if (ay < 0) { yil -= 1; ay += 12; }
  const toplamGun = Math.round((cikis.getTime() - giris.getTime()) / 86400000);

  const tav = kidemTavani(cikis);
  const gunlukBrut = input.giydirilmisBrut / 30;
  const tavanGunluk = tav / 30;
  const kullanilanGunluk = Math.min(gunlukBrut, tavanGunluk);

  // Kıdem: her tam yıl için 30 günlük ücret → toplam gün × günlük / 12
  // (1 yıl = 360 gün → 360/12 = 30 günlük ücret ✓; 6 ay = 180/12 = 15 günlük ✓)
  const toplam30Gunluk = yil * 360 + ay * 30 + gun;
  const hak = kidemHakVar(input.fesihNedeni);
  const brutKidem = hak ? (toplam30Gunluk / 12) * kullanilanGunluk : 0;
  const damga = brutKidem * P.DAMGA_KIDEM;
  const kidem: KidemResult = {
    hak,
    calismaSuresi: { yil, ay, gun, toplamGun },
    giydirilmisBrut: input.giydirilmisBrut,
    tavan: tav,
    tavanAsildi: gunlukBrut > tavanGunluk + 0.005,
    kullanilanGunluk,
    brutKidem,
    damga,
    netKidem: brutKidem - damga,
  };

  // İhbar: işçi istifasında ihbar tazminatı yok (işveren feshinde var)
  const hafta = ihbarSureHafta(toplamGun);
  const ihbarHak = input.fesihNedeni === "isverenFeshi" || input.fesihNedeni === "emeklilik";
  const brutIhbar = ihbarHak ? gunlukBrut * hafta * 7 : 0;
  const sgk = brutIhbar * P.SGK_ISCI;
  const issizlik = brutIhbar * P.ISSIZLIK_ISCI;
  const gv = (brutIhbar - sgk - issizlik) * P.GV_DILIM_1;
  const damgaI = brutIhbar * P.DAMGA_UCRET;
  const ihbar: IhbarResult = {
    hak: ihbarHak,
    sureHafta: hafta,
    brutIhbar,
    sgk,
    issizlik,
    gv,
    damga: damgaI,
    netIhbar: brutIhbar - sgk - issizlik - gv - damgaI,
  };

  return { kidem, ihbar };
}

/* ==================== 13. İŞE GİRİŞ/ÇIKIŞ MALİYET ==================== */

export interface GirisCikisInput {
  brutMaas: number;
  iseGiris: string;
  istenCikis: string;
  fesihNedeni: FesihNedeni;
  sgkTesvik: boolean;
  besIsverenOran: number; // 0..1
  besOtomatikIsci: boolean;
  kullanilmayanIzinGun: number;
  yanHaklarAylik: number;
}

export interface GirisCikisResult {
  aylıkIsveren: { brut: number; sgkIsveren: number; issizlikIsveren: number; bes: number; yanHaklar: number; toplam: number };
  yillik: { brut: number; sgkIsveren: number; issizlikIsveren: number; bes: number; yanHaklar: number; toplam: number };
  isciKesinti: { sgk: number; issizlik: number; bes: number; gv: number; damga: number; netMaas: number };
  kidem: KidemResult | null;
  ihbar: IhbarResult | null;
  izin: { gun: number; brut: number; kesinti: number; net: number } | null;
  calismaSuresi: { yil: number; ay: number; gun: number; toplamGun: number } | null;
  toplamCikisMaliyeti: number;
  calisanaOdenen: number;
  toplamIstihdamMaliyeti: number;
  dagilim: { brutOran: number; sgkOran: number; besYanOran: number; cikisOran: number };
}

export function hesaplaGirisCikis(input: GirisCikisInput): GirisCikisResult | null {
  if (!Number.isFinite(input.brutMaas) || input.brutMaas <= 0) return null;
  const tesvikOran = input.sgkTesvik ? P.SGK_ISVEREN_TESVIK : P.SGK_ISVEREN;
  const sgkIsveren = input.brutMaas * tesvikOran;
  const issizlikIsveren = input.brutMaas * P.ISSIZLIK_ISVEREN;
  const bes = input.brutMaas * (input.besIsverenOran || 0);
  const yanHaklar = input.yanHaklarAylik || 0;
  const aylıkToplam = input.brutMaas + sgkIsveren + issizlikIsveren + bes + yanHaklar;

  // İşçi kesintileri (GV %15 ilk dilim basitleştirmesi; damga binde 7,59)
  const sgkIsci = input.brutMaas * P.SGK_ISCI;
  const issizlikIsci = input.brutMaas * P.ISSIZLIK_ISCI;
  const besIsci = input.besOtomatikIsci ? input.brutMaas * 0.03 : 0;
  const gvMatrahi = Math.max(0, input.brutMaas - sgkIsci - issizlikIsci - besIsci);
  const gv = gvMatrahi * P.GV_DILIM_1;
  const damga = input.brutMaas * P.DAMGA_UCRET;
  const netMaas = gvMatrahi - gv - damga;

  const aylıkIsveren = { brut: input.brutMaas, sgkIsveren, issizlikIsveren, bes, yanHaklar, toplam: aylıkToplam };
  const yillik = {
    brut: input.brutMaas * 12,
    sgkIsveren: sgkIsveren * 12,
    issizlikIsveren: issizlikIsveren * 12,
    bes: bes * 12,
    yanHaklar: yanHaklar * 12,
    toplam: aylıkToplam * 12,
  };

  const { kidem, ihbar } = hesaplaKidemIhbar({
    iseGiris: input.iseGiris,
    istenCikis: input.istenCikis,
    giydirilmisBrut: input.brutMaas + yanHaklar,
    fesihNedeni: input.fesihNedeni,
  });

  // Kullanılmayan izin: giydirilmiş brüt üzerinden, kesintiyle
  let izin: GirisCikisResult["izin"] = null;
  if (input.kullanilmayanIzinGun > 0) {
    const giydirilmisGunluk = (input.brutMaas + yanHaklar) / 30;
    const izinBrut = giydirilmisGunluk * input.kullanilmayanIzinGun;
    const izinSgk = izinBrut * P.SGK_ISCI;
    const izinIssizlik = izinBrut * P.ISSIZLIK_ISCI;
    const izinGv = Math.max(0, izinBrut - izinSgk - izinIssizlik) * P.GV_DILIM_1;
    const izinDamga = izinBrut * P.DAMGA_UCRET;
    const kesinti = izinSgk + izinIssizlik + izinGv + izinDamga;
    izin = { gun: input.kullanilmayanIzinGun, brut: izinBrut, kesinti, net: izinBrut - kesinti };
  }

  const toplamCikis = (kidem?.netKidem ?? 0) + (ihbar?.netIhbar ?? 0) + (izin?.net ?? 0);
  const calisanaOdenen = (kidem?.netKidem ?? 0) + (ihbar?.netIhbar ?? 0) + (izin?.net ?? 0);

  const toplamGun = kidem?.calismaSuresi.toplamGun ?? 0;
  const calismaYilOrani = toplamGun > 0 ? toplamGun / 365 : 0;
  const toplamIstihdam = yillik.toplam * calismaYilOrani + toplamCikis;

  const dagilimToplam = toplamIstihdam > 0 ? toplamIstihdam : 1;
  const dagilim = {
    brutOran: (yillik.brut * calismaYilOrani) / dagilimToplam,
    sgkOran: ((yillik.sgkIsveren + yillik.issizlikIsveren) * calismaYilOrani) / dagilimToplam,
    besYanOran: ((yillik.bes + yillik.yanHaklar) * calismaYilOrani) / dagilimToplam,
    cikisOran: toplamCikis / dagilimToplam,
  };

  return {
    aylıkIsveren,
    yillik,
    isciKesinti: { sgk: sgkIsci, issizlik: issizlikIsci, bes: besIsci, gv, damga, netMaas },
    kidem, ihbar, izin,
    calismaSuresi: kidem?.calismaSuresi ?? null,
    toplamCikisMaliyeti: toplamCikis,
    calisanaOdenen,
    toplamIstihdamMaliyeti: toplamIstihdam,
    dagilim,
  };
}

/* ==================== 14. MİZAN ANALİZİ ==================== */

export interface MizanSatir {
  hesap: string;
  ad: string;
  borcToplam: number;
  alacakToplam: number;
  borcBakiye: number;
  alacakBakiye: number;
}

export interface MizanUyari {
  hesap: string;
  ad: string;
  detay: string;
  seviye: "yuksek" | "orta";
  bakiye: number;
}

export interface KdvKontrol {
  kontrol: string;
  durum: "ok" | "uyari" | "bilgi";
  aciklama: string;
}

export interface MizanAnalizResult {
  tersBakiye: MizanUyari[];
  olaganDisi: MizanUyari[];
  riskli: MizanUyari[];
  kdvKontroller: KdvKontrol[];
  toplamBorcToplam: number;
  toplamAlacakToplam: number;
  toplamBorcBakiye: number;
  toplamAlacakBakiye: number;
  dengeliMi: boolean;
}

const KASA_LIMITI = 500000;

export function analizMizan(rows: MizanSatir[]): MizanAnalizResult {
  const tersBakiye: MizanUyari[] = [];
  const olaganDisi: MizanUyari[] = [];
  const riskli: MizanUyari[] = [];
  let toplamBorcToplam = 0, toplamAlacakToplam = 0, toplamBorcBakiye = 0, toplamAlacakBakiye = 0;

  const bul = (kod: string) => rows.find((r) => r.hesap === kod);

  for (const r of rows) {
    toplamBorcToplam += r.borcToplam || 0;
    toplamAlacakToplam += r.alacakToplam || 0;
    toplamBorcBakiye += r.borcBakiye || 0;
    toplamAlacakBakiye += r.alacakBakiye || 0;
    const bakiye = (r.borcBakiye || 0) - (r.alacakBakiye || 0);
    const g1 = r.hesap.slice(0, 1);

    // Ters bakiye kontrolleri
    if ((g1 === "1" || g1 === "2") && bakiye < -0.005) {
      tersBakiye.push({ hesap: r.hesap, ad: r.ad, detay: "Aktif hesap alacak bakiye verdi", seviye: "orta", bakiye });
    } else if ((g1 === "3" || g1 === "4" || g1 === "5") && bakiye > 0.005) {
      tersBakiye.push({ hesap: r.hesap, ad: r.ad, detay: "Pasif hesap borç bakiye verdi", seviye: "orta", bakiye });
    } else if (g1 === "6" && bakiye < -0.005) {
      tersBakiye.push({ hesap: r.hesap, ad: r.ad, detay: "Gelir hesabı borç bakiye verdi (iade/düzeltme olabilir)", seviye: "orta", bakiye });
    } else if (g1 === "7" && bakiye > 0.005) {
      tersBakiye.push({ hesap: r.hesap, ad: r.ad, detay: "Gider hesabı alacak bakiye verdi (iade/düzeltme olabilir)", seviye: "orta", bakiye });
    }

    // Olağandışı hareketler
    if (r.hesap.startsWith("100") && bakiye > KASA_LIMITI) {
      olaganDisi.push({ hesap: r.hesap, ad: r.ad, detay: `Kasa bakiyesi ${KASA_LIMITI.toLocaleString("tr-TR")} TL üzerinde — adat hesabına konu olabilir`, seviye: "yuksek", bakiye });
    }
    if ((g1 === "6" || g1 === "7") && Math.abs(bakiye) > 0.005) {
      olaganDisi.push({ hesap: r.hesap, ad: r.ad, detay: "Gelir/gider hesabında dönem sonu bakiyesi kalmış — kapanmamış olabilir", seviye: "orta", bakiye });
    }
    if (g1 === "7" && r.hesap.startsWith("7") && !r.hesap.startsWith("760") && !r.hesap.startsWith("770") && Math.abs(bakiye) > 0.005) {
      // yansıtma hesapları 760-780 hariç bakiye
      olaganDisi.push({ hesap: r.hesap, ad: r.ad, detay: "Maliyet/yansıtma hesabında bakiye kalmış", seviye: "orta", bakiye });
    }

    // Riskli hesaplar
    if (r.hesap.startsWith("131") || r.hesap.startsWith("231")) {
      riskli.push({ hesap: r.hesap, ad: r.ad, detay: "Ortaklardan alacaklar — transfer fiyatlandırması ve örtülü kazanç riski", seviye: "yuksek", bakiye });
    }
    if (r.hesap.startsWith("331") || r.hesap.startsWith("332")) {
      riskli.push({ hesap: r.hesap, ad: r.ad, detay: "Ortaklara borçlar — örtülü sermaye riski", seviye: "yuksek", bakiye });
    }
    if (r.hesap.startsWith("180") || r.hesap.startsWith("280")) {
      riskli.push({ hesap: r.hesap, ad: r.ad, detay: "Gelecek dönemlere ait gider/gelir tahakkukları — kalemlerin belgelenmesi gerekir", seviye: "orta", bakiye });
    }
  }

  // KDV kontrolleri
  const kdvKontroller: KdvKontrol[] = [];
  const b191 = bul("191"), b391 = bul("391"), b190 = bul("190"), b360 = bul("360");
  const bakiyeOf = (x?: MizanSatir) => (x ? (x.borcBakiye || 0) - (x.alacakBakiye || 0) : null);
  const kb191 = bakiyeOf(b191), kb391 = bakiyeOf(b391), kb190 = bakiyeOf(b190), kb360 = bakiyeOf(b360);

  if (kb191 == null && kb391 == null && kb190 == null) {
    kdvKontroller.push({ kontrol: "KDV hesapları (190, 191, 391)", durum: "bilgi", aciklama: "KDV hesapları (190, 191, 391) mizanda bulunamadı." });
  } else {
    if (kb191 != null && Math.abs(kb191) > 0.005) {
      kdvKontroller.push({ kontrol: "191 İndirilecek KDV", durum: "uyari", aciklama: "Dönem sonunda bakiye kalmış — KDV beyannamesi ile mutabakat yapın (devreden KDV'ye aktarım yapılmadıysa)." });
    } else if (kb191 != null) {
      kdvKontroller.push({ kontrol: "191 İndirilecek KDV", durum: "ok", aciklama: "Sıfır bakiye — beyannameye doğru aktarılmış görünüyor." });
    }
    if (kb391 != null && Math.abs(kb391) > 0.005) {
      kdvKontroller.push({ kontrol: "391 Hesaplanan KDV", durum: "uyari", aciklama: "Dönem sonunda bakiye kalmış — 360 Ödenecek Vergi'ye aktarım kontrol edilmeli." });
    } else if (kb391 != null) {
      kdvKontroller.push({ kontrol: "391 Hesaplanan KDV", durum: "ok", aciklama: "Sıfır bakiye." });
    }
    if (kb190 != null && kb360 != null && Math.abs(kb190) > 0.005 && Math.abs(kb360) > 0.005) {
      kdvKontroller.push({ kontrol: "190 Devreden KDV ↔ 360 Ödenecek Vergi", durum: "uyari", aciklama: "190 Devreden KDV ve 360 Ödenecek Vergi aynı anda bakiye veriyor — tutarsızlık." });
    } else {
      kdvKontroller.push({ kontrol: "190 Devreden KDV ↔ 360 Ödenecek Vergi", durum: "ok", aciklama: "Çapraz bakiye yok — tutarlı." });
    }
  }

  return {
    tersBakiye, olaganDisi, riskli, kdvKontroller,
    toplamBorcToplam, toplamAlacakToplam, toplamBorcBakiye, toplamAlacakBakiye,
    dengeliMi: Math.abs(toplamBorcToplam - toplamAlacakToplam) < 0.005 && Math.abs(toplamBorcBakiye - toplamAlacakBakiye) < 0.005,
  };
}
