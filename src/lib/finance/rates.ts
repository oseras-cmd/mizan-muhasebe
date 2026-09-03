import { useCallback, useEffect, useRef, useState } from "react";

export type RateCurrency = "USD" | "EUR" | "GBP" | "XAU" | "XAG";

export type ExchangeRates = Record<RateCurrency, number | null>;

export interface RateSnapshot {
  date: string;
  rates: ExchangeRates;
}

const API_BASE = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";
const CACHE_KEY = "mizan-rates-cache-v1";

interface RatesCache {
  fetchedAt: number;
  snapshot: RateSnapshot;
}

function readCache(): RatesCache | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RatesCache;
    if (
      parsed &&
      typeof parsed.snapshot?.date === "string" &&
      parsed.snapshot.rates
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(snapshot: RateSnapshot) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), snapshot }),
    );
  } catch {
    // Depolama dolu ya da erişilemezse sessizce devam et.
  }
}

/**
 * Günlük (date verilmezse "latest") veya tarihli kur anlık görüntüsünü çeker.
 * API, TRY başına döviz değerlerini döndürür; burada 1 birim = X TL olarak çevrilir.
 * XAU/XAG ons fiyatından gram fiyatına dönüştürülür.
 */
export async function fetchRateSnapshot(
  date?: string,
): Promise<RateSnapshot | null> {
  const tag = date ? date : "latest";
  try {
    const res = await fetch(`${API_BASE}@${tag}/v1/currencies/try.json`);
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      date?: string;
      try?: Record<string, number | undefined>;
    };
    const t = payload.try;
    if (!t) return null;
    const rates: ExchangeRates = {
      USD: t.usd ? 1 / t.usd : null,
      EUR: t.eur ? 1 / t.eur : null,
      GBP: t.gbp ? 1 / t.gbp : null,
      XAU: t.xau ? 1 / t.xau / 31.1035 : null,
      XAG: t.xag ? 1 / t.xag / 31.1035 : null,
    };
    return { date: payload.date ?? date ?? "", rates };
  } catch {
    return null;
  }
}

/** Oturum içinde aynı tarih için tekrar tekrar ağ isteği atmamak için önbellek. */
const sessionCache = new Map<string, Promise<RateSnapshot | null>>();

export function getRateSnapshotCached(
  date: string,
): Promise<RateSnapshot | null> {
  const existing = sessionCache.get(date);
  if (existing) return existing;
  const promise = fetchRateSnapshot(date);
  sessionCache.set(date, promise);
  return promise;
}

/** from/to "TRY" olabilir; kurlardan biri yoksa null döner. */
export function convertRate(
  rates: ExchangeRates,
  from: string,
  to: string,
  amount: number,
): number | null {
  const fromRate = from === "TRY" ? 1 : rates[from as RateCurrency];
  const toRate = to === "TRY" ? 1 : rates[to as RateCurrency];
  if (fromRate == null || toRate == null) return null;
  return amount * (fromRate / toRate);
}

export interface RatesState {
  snapshot: RateSnapshot | null;
  loading: boolean;
  failed: boolean;
  refresh: () => Promise<void>;
}

/** Canlı kur hook'u: önce kayıtlı önbelleği gösterir, ardından API'den tazeler. */
export function useRates(): RatesState {
  const [snapshot, setSnapshot] = useState<RateSnapshot | null>(
    () => readCache()?.snapshot ?? null,
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    setLoading(true);
    setFailed(false);
    const run = (async () => {
      const next = await fetchRateSnapshot();
      if (next) {
        writeCache(next);
        setSnapshot(next);
      } else {
        setFailed(true);
      }
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, loading, failed, refresh };
}
