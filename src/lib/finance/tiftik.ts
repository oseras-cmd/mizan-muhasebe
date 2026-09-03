export interface EkMaliyet {
  ad: string;
  tutar: number;
}

export interface TiftikParams {
  /** Ham tiftik miktarı (kg). */
  miktar: number;
  /** Alım fiyatı (USD/kg). */
  alimUsd: number;
  /** Döviz kuru (₺/USD). */
  kur: number;
  /** Yıkama firesi (%). */
  yikamaFirePct: number;
  /** İşleme firesi (%). */
  islemeFirePct: number;
  /** Boz mal miktarı (sabit kg). NaN girilirse "bilinmiyor" sayılır. */
  bozMalKg: number;
  /** Yıkama ücreti (₺/kg, ham kg üzerinden). */
  yikamaUcreti: number;
  /** Genel giderler (₺). */
  genelGiderler: number;
  /** Satış fiyatı (USD/kg). */
  satisUsd: number;
  /** Elle girilen ek maliyet kalemleri (₺). */
  ekMaliyetler: EkMaliyet[];
}

export interface TiftikResult {
  /** Alım fiyatı (₺/kg) = alimUsd × kur. */
  alimTL: number;
  /** Alım fiyatı (USD/kg). */
  alimUSD: number;
  /** Satış fiyatı (₺/kg) = satisUsd × kur. */
  satisTL: number;
  /** Satış fiyatı (USD/kg). */
  satisUSD: number;
  /** Yıkama sonrası kg = miktar × (1 − yikamaFirePct/100). */
  yikamaSonrasi: number;
  /** Boz mal sonrası kg = yikamaSonrasi − bozMalKg. */
  bozMalSonrasi: number;
  /** Net satılabilir kg = bozMalSonrasi × (1 − islemeFirePct/100). */
  netKg: number;
  /** Yıkama fire miktarı (kg). */
  yikamaFireKg: number;
  /** Yıkama fire oranı (ham'a göre %). */
  yikamaFireOran: number;
  /** Boz mal fire miktarı (kg). */
  bozMalFireKg: number;
  /** Boz mal fire oranı (ham'a göre %). */
  bozMalFireOran: number;
  /** İşleme fire miktarı (kg). */
  islemeFireKg: number;
  /** İşleme fire oranı (ham'a göre %). */
  islemeFireOran: number;
  /** Toplam fire miktarı (kg). */
  toplamFireKg: number;
  /** Toplam fire oranı (ham'a göre %). */
  toplamFireOran: number;
  /** Ham alım maliyeti (₺). */
  hamAlim: number;
  /** Yıkama ücreti toplamı (₺). */
  yikamaUcretiToplam: number;
  /** Ek maliyetler toplamı (₺). */
  ekMaliyetlerToplam: number;
  /** Toplam maliyet (₺). */
  toplamMaliyet: number;
  /** Toplam maliyet (USD). */
  toplamMaliyetUSD: number;
  /** Kilo başı maliyet (₺/kg); net kg bilinmiyorsa veya sıfırsa null. */
  birimMaliyet: number | null;
  /** Kilo başı maliyet (USD/kg). */
  birimMaliyetUSD: number | null;
  /** Toplam gelir (₺); hesaplanamıyorsa null. */
  toplamGelir: number | null;
  /** Toplam gelir (USD). */
  toplamGelirUSD: number | null;
  /** Brüt kâr (₺); hesaplanamıyorsa null. */
  brutKar: number | null;
  /** Brüt kâr (USD). */
  brutKarUSD: number | null;
  /** Kilo başı kâr (₺/kg); hesaplanamıyorsa null. */
  kiloBasiKar: number | null;
  /** Kilo başı kâr (USD/kg). */
  kiloBasiKarUSD: number | null;
  /** Kâr marjı (%); hesaplanamıyorsa null. */
  karMarjiPct: number | null;
  /** Başabaş satış (USD/kg); hesaplanamıyorsa null. */
  basabasUsd: number | null;
}

/**
 * Tiftik maliyet hesabı — fire akışı, maliyet kalemleri, kilo başı maliyet,
 * satış/kâr ve başabaş satış fiyatı. `bozMalKg` NaN ise net kg ve ona bağlı
 * sonuçlar hesaplanamaz (null) sayılır.
 */
export function computeTiftikMaliyet(params: TiftikParams): TiftikResult {
  const kur = params.kur > 0 ? params.kur : 1;
  const alimTL = params.alimUsd * kur;
  const satisTL = params.satisUsd * kur;

  const yikamaSonrasi = params.miktar * (1 - params.yikamaFirePct / 100);
  const bozMalSonrasi = yikamaSonrasi - params.bozMalKg;
  const netKg = bozMalSonrasi * (1 - params.islemeFirePct / 100);

  // Fire miktarları ve oranları
  const yikamaFireKg = params.miktar - yikamaSonrasi;
  const yikamaFireOran = params.miktar > 0 ? (yikamaFireKg / params.miktar) * 100 : 0;
  const bozMalFireKg = Number.isFinite(params.bozMalKg) ? Math.max(0, params.bozMalKg) : 0;
  const bozMalFireOran = params.miktar > 0 ? (bozMalFireKg / params.miktar) * 100 : 0;
  const islemeFireKg = Number.isFinite(netKg) ? Math.max(0, bozMalSonrasi - netKg) : 0;
  const islemeFireOran = params.miktar > 0 ? (islemeFireKg / params.miktar) * 100 : 0;
  const toplamFireKg = yikamaFireKg + bozMalFireKg + islemeFireKg;
  const toplamFireOran = params.miktar > 0 ? (toplamFireKg / params.miktar) * 100 : 0;

  const hamAlim = params.miktar * alimTL;
  const yikamaUcretiToplam = params.miktar * params.yikamaUcreti;
  const ekMaliyetlerToplam = params.ekMaliyetler.reduce(
    (sum, item) => sum + (Number.isFinite(item.tutar) ? item.tutar : 0),
    0,
  );
  const toplamMaliyet =
    hamAlim + yikamaUcretiToplam + params.genelGiderler + ekMaliyetlerToplam;
  const toplamMaliyetUSD = toplamMaliyet / kur;

  // Kayan nokta gürültüsü eşiği
  const NET_KG_EPSILON = 1e-9;
  const computable = Number.isFinite(netKg) && netKg > NET_KG_EPSILON;

  if (!computable) {
    return {
      alimTL,
      alimUSD: params.alimUsd,
      satisTL,
      satisUSD: params.satisUsd,
      yikamaSonrasi,
      bozMalSonrasi,
      netKg: Number.isFinite(netKg) && netKg <= NET_KG_EPSILON ? 0 : netKg,
      yikamaFireKg,
      yikamaFireOran,
      bozMalFireKg,
      bozMalFireOran,
      islemeFireKg,
      islemeFireOran,
      toplamFireKg,
      toplamFireOran,
      hamAlim,
      yikamaUcretiToplam,
      ekMaliyetlerToplam,
      toplamMaliyet,
      toplamMaliyetUSD,
      birimMaliyet: null,
      birimMaliyetUSD: null,
      toplamGelir: null,
      toplamGelirUSD: null,
      brutKar: null,
      brutKarUSD: null,
      kiloBasiKar: null,
      kiloBasiKarUSD: null,
      karMarjiPct: null,
      basabasUsd: null,
    };
  }

  const birimMaliyet = toplamMaliyet / netKg;
  const birimMaliyetUSD = birimMaliyet / kur;
  const toplamGelir = netKg * satisTL;
  const toplamGelirUSD = toplamGelir / kur;
  const brutKar = toplamGelir - toplamMaliyet;
  const brutKarUSD = brutKar / kur;
  const kiloBasiKar = satisTL - birimMaliyet;
  const kiloBasiKarUSD = kiloBasiKar / kur;
  const karMarjiPct = (brutKar / toplamGelir) * 100;
  const basabasUsd = birimMaliyet / kur;

  return {
    alimTL,
    alimUSD: params.alimUsd,
    satisTL,
    satisUSD: params.satisUsd,
    yikamaSonrasi,
    bozMalSonrasi,
    netKg,
    yikamaFireKg,
    yikamaFireOran,
    bozMalFireKg,
    bozMalFireOran,
    islemeFireKg,
    islemeFireOran,
    toplamFireKg,
    toplamFireOran,
    hamAlim,
    yikamaUcretiToplam,
    ekMaliyetlerToplam,
    toplamMaliyet,
    toplamMaliyetUSD,
    birimMaliyet,
    birimMaliyetUSD,
    toplamGelir,
    toplamGelirUSD,
    brutKar,
    brutKarUSD,
    kiloBasiKar,
    kiloBasiKarUSD,
    karMarjiPct,
    basabasUsd,
  };
}
