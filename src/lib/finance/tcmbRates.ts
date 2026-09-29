import { useState, useEffect, useRef, useCallback } from "react";

export interface TcmbRate {
  code: string;
  name: string;
  unit: number;
  forexBuying: number;
  forexSelling: number;
  banknoteBuying: number;
  banknoteSelling: number;
}

export interface TcmbRatesData {
  date: string;
  bulletinNo: string;
  rates: TcmbRate[];
  /** Kurların çekildiği kaynak: resmî TCMB servisi veya yedek API */
  source: "tcmb" | "currency-api" | "fallback";
}

export const POPULAR_CODES = ["USD", "EUR", "GBP", "CHF", "JPY", "SAR", "KWD"];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "Fr",
  JPY: "¥",
  SAR: "﷼",
  KWD: "د.ك",
};

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 dakika

/** Kullanıcıya gösterilecek kaynak adı */
export function sourceLabel(source: TcmbRatesData["source"]): string {
  switch (source) {
    case "tcmb":
      return "TCMB resmî kurları";
    case "currency-api":
      return "currency-api (yaklaşık, TCMB değil)";
    case "fallback":
      return "çevrimdışı yaklaşık değerler";
  }
}

/* ─────────────────── 1. Birincil kaynak: TCMB resmî XML ─────────────────── */

/**
 * TCMB günlük kur servisi: https://www.tcmb.gov.tr/kurlar/today.xml
 * Bülten no, alış/satış/efektif ve banknote alanlarını resmî olarak döner.
 *
 * CORS: TCMB CORS başlığı göndermediği için tarayıcıdan doğrudan okunamaz.
 * EXE'de istek Electron ana sürecinde (mizanBridge.fetchTcmb) yapılır — CORS
 * uygulanmaz, her zaman çalışır. Tarayıcıda doğrudan fetch denenir (bazı
 * ortamlarda proxy CORS ekleyebilir), olmazsa yedek kaynağa düşülür.
 */
async function fetchFromTcmb(): Promise<TcmbRatesData | null> {
  let xml: string | null = null;

  // 1a) Electron ana süreç köprüsü (EXE'de birincil yol)
  if (typeof window !== "undefined" && window.mizanBridge?.fetchTcmb) {
    try {
      const result = await window.mizanBridge.fetchTcmb();
      if (result.ok && result.xml) xml = result.xml;
    } catch {
      // köprü başarısız — tarayıcı yolunu dene
    }
  }

  // 1b) Tarayıcıdan doğrudan fetch (CORS izin veren ortamlarda çalışır)
  if (!xml) {
    try {
      const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
        cache: "no-store",
      });
      if (res.ok) xml = await res.text();
    } catch {
      // CORS/ağ hatası — null ile devam
    }
  }

  if (!xml) return null;
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) return null;

    // Tarih + bülten: <Tarih_Date Tarih="29.09.2026" Date="09/29/2026" Bulten_No="2026/183">
    const root = doc.querySelector("Tarih_Date");
    const bulletinNo =
      root?.getAttribute("Bulten_No") ?? root?.getAttribute("BulletinNo") ?? "";
    // Date özniteliği MM/DD/YYYY biçimindedir; TR tarihini (Tarih="29.09.2026") tercih et
    const trDate = root?.getAttribute("Tarih") ?? ""; // 29.09.2026
    const dateParts = trDate.split(".");
    const date =
      dateParts.length === 3
        ? `${dateParts[2]}-${dateParts[1].padStart(2, "0")}-${dateParts[0].padStart(2, "0")}`
        : new Date().toISOString().slice(0, 10);

    const rates: TcmbRate[] = [];
    for (const node of Array.from(doc.querySelectorAll("Currency"))) {
      const code = node.getAttribute("CurrencyCode") ?? node.getAttribute("Kod") ?? "";
      if (!POPULAR_CODES.includes(code)) continue;
      const num = (tag: string): number | null => {
        // TCMB TR ondalık virgül kullanır: "47,8123"
        const raw = node.querySelector(tag)?.textContent?.replace(",", ".").trim();
        const v = raw ? Number(raw) : NaN;
        return Number.isFinite(v) && v > 0 ? v : null;
      };
      const unit = Number(node.querySelector("Unit")?.textContent ?? "1") || 1;
      const forexBuying = num("ForexBuying");
      const forexSelling = num("ForexSelling");
      if (forexBuying === null || forexSelling === null) continue;
      rates.push({
        code,
        name: node.querySelector("CurrencyName")?.textContent?.trim() ?? code,
        unit,
        forexBuying,
        forexSelling,
        banknoteBuying: num("BanknoteBuying") ?? forexBuying,
        banknoteSelling: num("BanknoteSelling") ?? forexSelling,
      });
    }
    if (rates.length === 0) return null;

    return { date, bulletinNo, rates, source: "tcmb" };
  } catch {
    // XML parse hatası — yedeğe düş
    return null;
  }
}

/* ─────────────────── 2. Yedek kaynak: açık currency-api ─────────────────── */

/**
 * Build TcmbRate objects from the fawazahmed0 currency-api JSON.
 * The API returns { date, try: { usd: 0.02087, ... } } meaning 1 TRY = X units.
 * We invert to get 1 unit = Y TRY.
 */
function buildRatesFromCurrencyApi(
  tryRates: Record<string, number | undefined>,
): TcmbRate[] {
  const meta: Record<
    string,
    { name: string; unit: number; precision: number }
  > = {
    USD: { name: "ABD DOLARI", unit: 1, precision: 4 },
    EUR: { name: "EURO", unit: 1, precision: 4 },
    GBP: { name: "İNGİLİZ STERLİNİ", unit: 1, precision: 4 },
    CHF: { name: "İSVİÇRE FRANGI", unit: 1, precision: 4 },
    JPY: { name: "JAPON YENİ", unit: 100, precision: 4 },
    SAR: { name: "SUUDİ ARABİSTAN RİYALİ", unit: 1, precision: 4 },
    KWD: { name: "KUVEYT DİNARI", unit: 1, precision: 4 },
  };

  const rates: TcmbRate[] = [];

  for (const code of POPULAR_CODES) {
    const raw = tryRates[code.toLowerCase()];
    if (!raw || raw <= 0) continue;

    const m = meta[code];
    const oneUnitTRY = 1 / raw;
    const effective =
      m.unit > 1 ? Math.round(oneUnitTRY * m.unit * 10000) / 10000 : Math.round(oneUnitTRY * 10000) / 10000;

    // Slight banknote spread
    const round = (v: number) => Math.round(v * 10000) / 10000;

    rates.push({
      code,
      name: m.name,
      unit: m.unit,
      forexBuying: round(effective * 0.999),
      forexSelling: round(effective * 1.001),
      banknoteBuying: round(effective * 0.998),
      banknoteSelling: round(effective * 1.002),
    });
  }

  return rates;
}

async function fetchFromCurrencyApi(): Promise<TcmbRatesData | null> {
  const res = await fetch(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/try.json",
    { cache: "no-store" },
  );
  if (!res.ok) return null;

  const payload = (await res.json()) as {
    date?: string;
    try?: Record<string, number | undefined>;
  };

  const t = payload.try;
  if (!t) return null;

  const rates = buildRatesFromCurrencyApi(t);
  if (rates.length === 0) return null;

  return {
    date: payload.date ?? new Date().toISOString().slice(0, 10),
    bulletinNo: "",
    rates,
    source: "currency-api",
  };
}

// Local fallback in case all network requests fail
function getLocalFallbackRates(): TcmbRatesData {
  return {
    date: new Date().toISOString().slice(0, 10),
    bulletinNo: "",
    source: "fallback",
    rates: [
      { code: "USD", name: "ABD DOLARI", unit: 1, forexBuying: 47.81, forexSelling: 47.91, banknoteBuying: 47.79, banknoteSelling: 47.98 },
      { code: "EUR", name: "EURO", unit: 1, forexBuying: 55.47, forexSelling: 55.61, banknoteBuying: 55.43, banknoteSelling: 55.69 },
      { code: "GBP", name: "İNGİLİZ STERLİNİ", unit: 1, forexBuying: 64.70, forexSelling: 65.08, banknoteBuying: 64.66, banknoteSelling: 65.18 },
      { code: "CHF", name: "İSVİÇRE FRANGI", unit: 1, forexBuying: 58.80, forexSelling: 59.27, banknoteBuying: 58.76, banknoteSelling: 59.36 },
      { code: "JPY", name: "JAPON YENİ", unit: 100, forexBuying: 29.88, forexSelling: 30.19, banknoteBuying: 29.84, banknoteSelling: 30.30 },
      { code: "SAR", name: "SUUDİ ARABİSTAN RİYALİ", unit: 1, forexBuying: 12.65, forexSelling: 12.86, banknoteBuying: 12.61, banknoteSelling: 12.90 },
      { code: "KWD", name: "KUVEYT DİNARI", unit: 1, forexBuying: 152.58, forexSelling: 156.93, banknoteBuying: 152.46, banknoteSelling: 159.28 },
    ],
  };
}

/** Kur değişim yönünü ve değişim miktarını hesapla */
export function rateChange(
  current: number,
  previous: number | undefined,
): { direction: "up" | "down" | "same"; delta: number } {
  if (previous === undefined || previous === current) {
    return { direction: "same", delta: 0 };
  }
  const delta = Math.round((current - previous) * 100) / 100;
  return {
    direction: delta > 0 ? "up" : "down",
    delta,
  };
}

export function useTcmbRates(): {
  data: TcmbRatesData | null;
  prevData: TcmbRatesData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
  nextRefreshAt: Date | null;
} {
  const [data, setData] = useState<TcmbRatesData | null>(null);
  const [prevData, setPrevData] = useState<TcmbRatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const prevDataRef = useRef<TcmbRatesData | null>(null);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1) TCMB resmî servisi (Electron'da ve CORS izinli ortamda çalışır)
      let result = await fetchFromTcmb();
      let sourceNotice: string | null = null;

      // 2) TCMB okunamadıysa açık currency-api (yaklaşık kur — netten türetilmiş)
      if (!result) {
        result = await fetchFromCurrencyApi();
        if (result) {
          sourceNotice =
            "TCMB resmî kurlarına ulaşılamadı; yaklaşık değerler gösteriliyor.";
        }
      }

      if (result) {
        // Bir önceki veriyi kaydet (değişim göstermek için)
        if (prevDataRef.current) {
          setPrevData(prevDataRef.current);
        }
        prevDataRef.current = result;
        setData(result);
        setLastUpdated(new Date());
        setNextRefreshAt(new Date(Date.now() + AUTO_REFRESH_MS));
        setError(sourceNotice);
      } else {
        setData(getLocalFallbackRates());
        setLastUpdated(new Date());
        setNextRefreshAt(new Date(Date.now() + AUTO_REFRESH_MS));
        setError("Canlı kurlar alınamadı, gösterilen değerler yaklaşık değerlerdir.");
      }
    } catch (_err) {
      setData(getLocalFallbackRates());
      setLastUpdated(new Date());
      setNextRefreshAt(new Date(Date.now() + AUTO_REFRESH_MS));
      setError("İnternet bağlantısı yok, gösterilen değerler yaklaşık değerlerdir.");
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yükleme + manuel yenileme
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await doFetch();
      if (cancelled) return;
    };
    run();
    return () => { cancelled = true; };
  }, [refreshKey, doFetch]);

  // Otomatik yenileme her 5 dakikada bir
  useEffect(() => {
    const timer = setInterval(() => {
      doFetch();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [doFetch]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { data, prevData, loading, error, lastUpdated, refresh, nextRefreshAt };
}
