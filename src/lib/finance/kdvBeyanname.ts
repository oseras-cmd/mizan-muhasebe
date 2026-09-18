/**
 * KDV-1 Beyannamesi hesaplama motoru.
 *
 * müşavirlerkulubu.com.tr/araclar/kdv-beyanname aracındaki hesaplamanın
 * birebir klonudur:
 *   • Hesaplanan KDV   = %1 + %10 + %20 satış matrahlarının KDV'si
 *   • İndirilecek KDV  = %1 + %10 + %20 alış matrahlarının KDV'si
 *   • İndirim toplamı  = alış KDV'si + önceki dönem devreden KDV
 *   • Sonuç            = hesaplanan − indirilecek toplam − tevkifat kesintisi
 *   • Sonuç > 0  → Ödenecek KDV (ayın 28'ine kadar)
 *   • Sonuç < 0  → Sonraki aya devreden KDV
 */

const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

export interface KdvBeyannameInput {
  /** %1 KDV'li satış matrahı */
  satis1: number;
  /** %10 KDV'li satış matrahı */
  satis10: number;
  /** %20 KDV'li satış matrahı */
  satis20: number;
  /** KDV'den istisna satışlar (KDV hesaplanmaz, yalnızca bilgi) */
  istisnaSatis: number;
  /** Alış matrahları */
  alis1: number;
  alis10: number;
  alis20: number;
  /** Önceki dönemden devreden KDV */
  devredenOnceki: number;
  /** Tevkifata tabi satış KDV'si (alıcı kesintisi) */
  tevkifatSatis: number;
}

export interface KdvRateRow {
  oran: 1 | 10 | 20;
  matrah: number;
  kdv: number;
}

export interface KdvTableRow {
  kalem: string;
  matrah: number | null;
  kdv: number;
  /** Toplam satırı mı */
  isTotal?: boolean;
  /** Sıfırsa tabloda gösterme */
  hideIfZero?: boolean;
}

export interface MuhasebeSatiri {
  hesap: string;
  hesapAdi: string;
  borc: number;
  alacak: number;
}

export type KdvBeyannameSonucTipi = "odenecek" | "devreden";

export interface KdvBeyannameResult {
  /** Satışlardan hesaplanan KDV (orana göre kırılım) */
  hesaplananSatirlar: KdvRateRow[];
  toplamHesaplanan: number;
  /** Alışlardan indirilecek KDV (orana göre kırılım) */
  indirilecekSatirlar: KdvRateRow[];
  toplamIndirilecekAlis: number;
  /** Alış KDV'si + önceki dönem devreden */
  toplamIndirilecek: number;
  tevkifat: number;
  /** Sonuç pozitifse ödenecek KDV, negatifse 0 */
  odenecek: number;
  /** Sonuç negatifse devreden KDV, pozitifse 0 */
  devreden: number;
  tip: KdvBeyannameSonucTipi;
  /** KDV hesaplama tablosu (arayüzde gösterilen) */
  tablo: KdvTableRow[];
  /** Muhasebe fişi (391 / 191 / 190 / 360) */
  muhasebeKaydi: MuhasebeSatiri[];
}

export function hesaplaKdvBeyanname(input: KdvBeyannameInput): KdvBeyannameResult {
  const s1 = Math.max(0, input.satis1 || 0);
  const s10 = Math.max(0, input.satis10 || 0);
  const s20 = Math.max(0, input.satis20 || 0);
  const a1 = Math.max(0, input.alis1 || 0);
  const a10 = Math.max(0, input.alis10 || 0);
  const a20 = Math.max(0, input.alis20 || 0);
  const devredenOnceki = Math.max(0, input.devredenOnceki || 0);
  const tevkifat = Math.max(0, input.tevkifatSatis || 0);

  /* ── Hesaplanan KDV (satışlar) ── */
  const hesaplananSatirlar: KdvRateRow[] = (
    [
      { oran: 1, matrah: s1, kdv: round2(s1 * 0.01) },
      { oran: 10, matrah: s10, kdv: round2(s10 * 0.1) },
      { oran: 20, matrah: s20, kdv: round2(s20 * 0.2) },
    ] as KdvRateRow[]
  ).filter((r) => r.matrah > 0);
  const toplamHesaplanan = round2(hesaplananSatirlar.reduce((s, r) => s + r.kdv, 0));

  /* ── İndirilecek KDV (alışlar) ── */
  const indirilecekSatirlar: KdvRateRow[] = (
    [
      { oran: 1, matrah: a1, kdv: round2(a1 * 0.01) },
      { oran: 10, matrah: a10, kdv: round2(a10 * 0.1) },
      { oran: 20, matrah: a20, kdv: round2(a20 * 0.2) },
    ] as KdvRateRow[]
  ).filter((r) => r.matrah > 0);
  const toplamIndirilecekAlis = round2(indirilecekSatirlar.reduce((s, r) => s + r.kdv, 0));

  /* ── Toplam indirim: alış KDV'si + önceki dönem devreden ── */
  const toplamIndirilecek = round2(toplamIndirilecekAlis + devredenOnceki);

  /* ── Sonuç: hesaplanan − indirilecek − tevkifat ── */
  const net = round2(toplamHesaplanan - toplamIndirilecek - tevkifat);
  const odenecek = net > 0 ? net : 0;
  const devreden = net < 0 ? round2(-net) : 0;
  const tip: KdvBeyannameSonucTipi = net > 0 ? "odenecek" : "devreden";

  /* ── KDV hesaplama tablosu ── */
  const tablo: KdvTableRow[] = [];
  tablo.push({ kalem: "Hesaplanan KDV (Satışlar)", matrah: null, kdv: Number.NaN });
  for (const r of hesaplananSatirlar) {
    tablo.push({ kalem: `%${r.oran} KDV'li satış`, matrah: r.matrah, kdv: r.kdv });
  }
  tablo.push({ kalem: "Toplam Hesaplanan KDV", matrah: null, kdv: toplamHesaplanan, isTotal: true });

  tablo.push({ kalem: "İndirilecek KDV (Alışlar)", matrah: null, kdv: Number.NaN });
  for (const r of indirilecekSatirlar) {
    tablo.push({ kalem: `%${r.oran} KDV'li alış`, matrah: r.matrah, kdv: r.kdv });
  }
  if (devredenOnceki > 0) {
    tablo.push({ kalem: "Önceki dönemden devreden KDV", matrah: null, kdv: devredenOnceki });
  }
  tablo.push({ kalem: "Toplam İndirilecek KDV", matrah: null, kdv: toplamIndirilecek, isTotal: true });

  if (tevkifat > 0) {
    tablo.push({ kalem: "Tevkifat Kesintisi (Alıcı)", matrah: null, kdv: tevkifat });
  }

  /* ── Muhasebe fişi (Tek düzen hesap planı) ── */
  const muhasebeKaydi: MuhasebeSatiri[] = [];
  muhasebeKaydi.push({
    hesap: "391",
    hesapAdi: "Hesaplanan KDV",
    borc: toplamHesaplanan,
    alacak: 0,
  });
  if (toplamIndirilecekAlis > 0) {
    muhasebeKaydi.push({
      hesap: "191",
      hesapAdi: "İndirilecek KDV",
      borc: 0,
      alacak: toplamIndirilecekAlis,
    });
  }
  if (devredenOnceki > 0) {
    muhasebeKaydi.push({
      hesap: "190",
      hesapAdi: "Devreden KDV (önceki dönem)",
      borc: 0,
      alacak: devredenOnceki,
    });
  }
  if (tevkifat > 0) {
    muhasebeKaydi.push({
      hesap: "360",
      hesapAdi: "Tevkifat yoluyla ödenen KDV",
      borc: 0,
      alacak: tevkifat,
    });
  }
  if (tip === "odenecek") {
    muhasebeKaydi.push({
      hesap: "360",
      hesapAdi: "Ödenecek Vergi ve Fonlar",
      borc: 0,
      alacak: odenecek,
    });
  } else if (devreden > 0) {
    muhasebeKaydi.push({
      hesap: "190",
      hesapAdi: "Devreden KDV (sonraki döneme)",
      borc: devreden,
      alacak: 0,
    });
  }

  return {
    hesaplananSatirlar,
    toplamHesaplanan,
    indirilecekSatirlar,
    toplamIndirilecekAlis,
    toplamIndirilecek,
    tevkifat,
    odenecek,
    devreden,
    tip,
    tablo,
    muhasebeKaydi,
  };
}

export const EMPTY_KDV_INPUT: KdvBeyannameInput = {
  satis1: 0,
  satis10: 0,
  satis20: 0,
  istisnaSatis: 0,
  alis1: 0,
  alis10: 0,
  alis20: 0,
  devredenOnceki: 0,
  tevkifatSatis: 0,
};

/** Beyanname kontrol listesi — Göndermeden önce işaretlenir. */
export const KDV_KONTROL_LISTESI = [
  "Satış faturaları e-Defter ile mutabık",
  "Alış faturaları doğrulandı",
  "Ba-Bs formları ile tutarlar uyumlu",
  "Tevkifatlı faturalar KDV-2 ile çapraz kontrol edildi",
  "İstisna satışlar belgelendirildi",
  "Önceki dönem devreden KDV tutarı doğrulandı",
] as const;
