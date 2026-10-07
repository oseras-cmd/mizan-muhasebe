/**
 * Tarihsel kur modülü — işlem tarihine göre para birimi dönüşümü.
 *
 * Kaynak: fawazahmed0/currency-api (jsDelivr CDN) — 170+ fiat para birimi ve
 * popüler kripto paraları için günlük tarihli sürümler yayınlar:
 *   https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2024-05-01/v1/currencies/try.json
 *
 * Dosya biçimi: { date, try: { usd: 0.0208, ... } } → 1 TRY = X birim.
 * Eksik tarihlerde (geçmiş sürüm henüz yayımlanmamışsa) 7 gün geriye,
 * bulunamazsa @latest sürümüne düşülür ve gerçek tarih kullanıcıya bildirilir.
 *
 * TCMB kuru (canlı mod) yalnızca 7 popüler birim kapsar; bu modül
 * vergi/raporlamada tarihsel dönüşüm için kullanılır.
 */

export interface HistCurrency {
  /** ISO kod (USD, EUR, BTC…) — büyük harf */
  code: string;
  /** İngilizce ad (kaynak dosyadan) */
  name: string;
  crypto: boolean;
}

export interface HistRates {
  /** Kurların ait olduğu tarih (yyyy-mm-dd) — istenen tarihten farklıysa yedek güne düşüldü */
  date: string;
  /** 1 TRY = X birim */
  rates: Record<string, number>;
  /** true → istenen tarih bulunamadı, en güncel kurlar kullanıldı */
  stale: boolean;
}

const CDN = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";

/** Kripto para kodları (currency-api bunları da yayınlar) */
const CRYPTO_CODES = new Set([
  "BTC", "ETH", "LTC", "DOT", "XRP", "BNB", "ADA", "SOL", "DOGE",
  "MATIC", "TRX", "LINK", "ATOM", "XLM",
]);

/** Para birimi listesi ve tarihli kurlar için modül içi önbellek */
let currencyListCache: HistCurrency[] | null = null;
const ratesCache = new Map<string, Promise<HistRates>>();

function toUpper(code: string): string {
  return code.toUpperCase();
}

/** Tüm para birimlerini (fiat + kripto) getirir; bir kez çekilir.
 * Kaynak biçimi: { "usd": "US Dollar", "ada": "Cardano", … } — değerler string'dir. */
export async function fetchCurrencyList(): Promise<HistCurrency[]> {
  if (currencyListCache) return currencyListCache;
  const res = await fetch(`${CDN}@latest/v1/currencies.json`, { cache: "force-cache" });
  if (!res.ok) throw new Error("Para birimi listesi alınamadı.");
  const raw = (await res.json()) as Record<string, string | { name?: string }>;
  const list: HistCurrency[] = Object.entries(raw).map(([code, meta]) => {
    const upper = toUpper(code);
    const name = typeof meta === "string" ? meta : meta?.name;
    return {
      code: upper,
      name: name || upper,
      crypto: CRYPTO_CODES.has(upper),
    };
  });
  // Fiat'lar önce, alfabetik; kriptolar sonda
  list.sort((a, b) =>
    a.crypto === b.crypto ? a.code.localeCompare(b.code) : a.crypto ? 1 : -1,
  );
  currencyListCache = list;
  return list;
}

async function fetchTryRates(tag: string): Promise<HistRates | null> {
  try {
    const res = await fetch(`${CDN}@${tag}/v1/currencies/try.json`);
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      date?: string;
      try?: Record<string, number | undefined>;
    };
    const rates: Record<string, number> = {};
    for (const [code, v] of Object.entries(payload.try ?? {})) {
      if (typeof v === "number" && v > 0) rates[toUpper(code)] = v;
    }
    if (Object.keys(rates).length === 0) return null;
    return { date: payload.date ?? tag, rates, stale: false };
  } catch {
    return null;
  }
}

/**
 * İstenen tarihin kurlarını getirir.
 * Aynı istek için sonucu önbellekte tutar; bulunamayan tarihlerde
 * 7 gün geriye, sonra @latest sürümüne düşer.
 */
export function fetchHistoricalRates(isoDate: string): Promise<HistRates> {
  const cached = ratesCache.get(isoDate);
  if (cached) return cached;

  const promise = (async (): Promise<HistRates> => {
    // 1) İstenen gün ve 7 gün gerisi
    const base = new Date(`${isoDate}T00:00:00Z`);
    for (let i = 0; i < 8; i++) {
      const d = new Date(base.getTime() - i * 86400000);
      const tag = d.toISOString().slice(0, 10);
      const hit = await fetchTryRates(tag);
      if (hit) return { ...hit, stale: i > 0 };
    }
    // 2) Yedek: en güncel sürüm
    const latest = await fetchTryRates("latest");
    if (latest) return { ...latest, stale: true };
    throw new Error("Kur geçmişi alınamadı — internet bağlantınızı kontrol edin.");
  })();

  ratesCache.set(isoDate, promise);
  // Hata durumunda önbellekten düşür ki yeniden denensin
  promise.catch(() => ratesCache.delete(isoDate));
  return promise;
}

/**
 * Tarihsel kurlarla dönüşüm.
 * rates: 1 TRY = X birim. Sonuç verilen kura göre; para birimi yoksa null.
 */
export function convertHistorical(
  rates: Record<string, number>,
  from: string,
  to: string,
  amount: number,
): number | null {
  if (!Number.isFinite(amount)) return null;
  const f = toUpper(from);
  const t = toUpper(to);
  if (f === t) return amount;
  const rateF = f === "TRY" ? 1 : rates[f];
  const rateT = t === "TRY" ? 1 : rates[t];
  if (!rateF || !rateT) return null;
  // amount biriminden TRY'ye geç, oradan hedefe
  const inTry = amount / rateF;
  return inTry * rateT;
}
