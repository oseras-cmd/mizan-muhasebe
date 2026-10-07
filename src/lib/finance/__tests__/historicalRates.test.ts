/**
 * Tarihsel kur modülü testleri (TaxHacker tarzı tarihsel dönüşüm).
 * convertHistorical saf matematiği; ağ testleri canlı CDN'i doğrular.
 */

import { describe, expect, it } from "bun:test";
import {
  convertHistorical,
  fetchCurrencyList,
  fetchHistoricalRates,
} from "../historicalRates";

describe("convertHistorical", () => {
  // Kaynak biçimi: 1 TRY = 0.02 USD, 1 TRY = 0.019 EUR
  const rates = { USD: 0.02, EUR: 0.019 };

  it("TRY → yabancı birim", () => {
    expect(convertHistorical(rates, "TRY", "USD", 100)).toBeCloseTo(2, 9);
  });

  it("yabancı birim → TRY", () => {
    expect(convertHistorical(rates, "USD", "TRY", 2)).toBeCloseTo(100, 9);
  });

  it("yabancı → yabancı (parite)", () => {
    // 2 USD = 100 TRY = 1.9 EUR
    expect(convertHistorical(rates, "USD", "EUR", 2)).toBeCloseTo(1.9, 9);
  });

  it("aynı birim değişmez", () => {
    expect(convertHistorical(rates, "USD", "USD", 5)).toBe(5);
    expect(convertHistorical(rates, "TRY", "TRY", 7)).toBe(7);
  });

  it("kurlarda olmayan birim null döner", () => {
    expect(convertHistorical(rates, "GBP", "USD", 5)).toBeNull();
    expect(convertHistorical(rates, "USD", "GBP", 5)).toBeNull();
  });

  it("USD → TRY → USD turu kayıpsız", () => {
    const toTry = convertHistorical(rates, "USD", "TRY", 123.45);
    expect(toTry).not.toBeNull();
    const back = convertHistorical(rates, "TRY", "USD", toTry!);
    expect(back).toBeCloseTo(123.45, 6);
  });

  it("geçersiz tutar null döner", () => {
    expect(convertHistorical(rates, "USD", "EUR", NaN)).toBeNull();
  });
});

describe("canlı kaynak (ağ)", () => {
  it("para birimi listesi 170+ birim ve isimler doğru çözülür", async () => {
    const list = await fetchCurrencyList();
    expect(list.length).toBeGreaterThan(170);
    const usd = list.find((c) => c.code === "USD");
    expect(usd?.name.toLowerCase()).toContain("dollar");
    // currencies.json string değerlidir — "ada" → "Cardano" (kod değil)
    const ada = list.find((c) => c.code === "ADA");
    expect(ada?.name).toBe("Cardano");
    // kodlar büyük harf
    expect(list.every((c) => c.code === c.code.toUpperCase())).toBe(true);
  }, 20000);

  it("geçmiş tarih kuru çekilir ve 100 TRY dönüşümü makul", async () => {
    const h = await fetchHistoricalRates("2026-10-04");
    expect(h.rates.USD).toBeGreaterThan(0);
    expect(h.rates.EUR).toBeGreaterThan(0);
    const result = convertHistorical(h.rates, "TRY", "USD", 100);
    expect(result).not.toBeNull();
    // 100 TRY en azından 1 USD etmeli (tarihsel oran ne olursa olsun)
    expect(result!).toBeGreaterThan(1);
  }, 20000);

  it("aynı gün ikinci çağrıda önbellekten aynı sözleşmeyi döner", async () => {
    const a = fetchHistoricalRates("2026-10-04");
    const b = fetchHistoricalRates("2026-10-04");
    expect(a).toBe(b);
    await a;
  }, 20000);
});
