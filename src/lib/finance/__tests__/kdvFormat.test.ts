/**
 * KDV dönüşüm matematiği ve Türkçe sayı format katmanı testleri.
 *
 * Kullanıcı hatası raporunun ardından eklendi: formatInputValue(String(x))
 * tuzağı kuruşlu tutarları 10/100 kat şişiriyordu (1234.5 → "12345").
 * formatNumberInput bu tuzağın yerini aldı.
 */

import { describe, expect, it } from "bun:test";
import {
  formatInputValue,
  formatNumberInput,
  formatTRY,
  parseTurkishNumber,
} from "../format";

/** KdvHesap.tsx'teki dönüşüm matematiğinin aynısı. */
const r2 = (x: number): number => Math.round(x * 100) / 100;

function kdvHesap(tip: "haric" | "dahil" | "kdvden", tutarStr: string, oranStr: string) {
  const value = parseTurkishNumber(tutarStr);
  const rate = Number(oranStr) / 100;
  if (!Number.isFinite(value) || value <= 0) return null;
  if (tip === "haric") {
    const kdv = r2(value * rate);
    return { matrah: value, kdv, toplam: value + kdv };
  }
  if (tip === "kdvden") {
    if (rate <= 0) return null;
    const matrah = r2(value / rate);
    return { matrah, kdv: value, toplam: matrah + value };
  }
  const matrah = r2(value / (1 + rate));
  return { matrah, kdv: value - matrah, toplam: value };
}

describe("KDV Hariç → Dahil", () => {
  it("10.000 @ %20 → KDV 2.000, toplam 12.000", () => {
    const r = kdvHesap("haric", "10000", "20");
    expect(r?.matrah).toBe(10000);
    expect(r?.kdv).toBe(2000);
    expect(r?.toplam).toBe(12000);
  });

  it("850 @ %10 → KDV 85, toplam 935", () => {
    const r = kdvHesap("haric", "850", "10");
    expect(r?.kdv).toBe(85);
    expect(r?.toplam).toBe(935);
  });

  it("500 @ %1 → KDV 5, toplam 505", () => {
    const r = kdvHesap("haric", "500", "1");
    expect(r?.kdv).toBe(5);
    expect(r?.toplam).toBe(505);
  });

  it("kuruşlu: 333,33 @ %20 → KDV 66,67, toplam 400,00", () => {
    const r = kdvHesap("haric", "333,33", "20");
    expect(r?.kdv).toBe(66.67);
    expect(r?.toplam).toBe(400);
  });
});

describe("KDV Dahil → Hariç", () => {
  it("12.000 @ %20 → matrah 10.000, KDV 2.000", () => {
    const r = kdvHesap("dahil", "12000", "20");
    expect(r?.matrah).toBe(10000);
    expect(r?.kdv).toBe(2000);
    expect(r?.toplam).toBe(12000);
  });

  it("935 @ %10 → matrah 850, KDV 85", () => {
    const r = kdvHesap("dahil", "935", "10");
    expect(r?.matrah).toBe(850);
    expect(r?.kdv).toBe(85);
  });

  it("kuruşlu: 100,05 @ %20 → matrah 83,38, KDV 16,67, satırlar toplamla tutarlı", () => {
    const r = kdvHesap("dahil", "100,05", "20");
    expect(r?.matrah).toBe(83.38);
    expect(r?.kdv).toBe(16.67);
    expect(r).not.toBeNull();
    if (r) expect(r2(r.matrah + r.kdv)).toBe(r.toplam);
  });
});

describe("KDV Tutarından Matrah", () => {
  it("KDV 2.000 @ %20 → matrah 10.000, toplam 12.000", () => {
    const r = kdvHesap("kdvden", "2000", "20");
    expect(r?.matrah).toBe(10000);
    expect(r?.toplam).toBe(12000);
  });

  it("KDV 85 @ %10 → matrah 850", () => {
    expect(kdvHesap("kdvden", "85", "10")?.matrah).toBe(850);
  });

  it("KDV 5 @ %1 → matrah 500", () => {
    expect(kdvHesap("kdvden", "5", "1")?.matrah).toBe(500);
  });
});

describe("Türkçe sayı girişi turu", () => {
  it("parseTurkishNumber binlik ve ondalık ayraçlarını doğru okur", () => {
    expect(parseTurkishNumber("10.000")).toBe(10000);
    expect(parseTurkishNumber("1.234,56")).toBe(1234.56);
    expect(parseTurkishNumber("10000")).toBe(10000);
  });

  it("formatInputValue → parseTurkishNumber girdiği korur", () => {
    expect(formatInputValue("10000")).toBe("10.000");
    expect(parseTurkishNumber(formatInputValue("10000"))).toBe(10000);
    expect(parseTurkishNumber(formatInputValue("1234,56"))).toBe(1234.56);
  });

  it("formatTRY tr-TR para birimi basar", () => {
    expect(formatTRY(12000)).toBe("₺12.000,00");
  });
});

describe("formatNumberInput — String(x) şişme tuzağının regresyon testi", () => {
  it("eski tuzak: formatInputValue(String(1234.5)) ondalığı siler (×10 şişme)", () => {
    // Bu davranış belgelenmiştir — bu yüzden formatNumberInput zorunlu oldu.
    expect(parseTurkishNumber(formatInputValue(String(1234.5)))).toBe(12345);
    expect(parseTurkishNumber(formatInputValue(String(1234.56)))).toBe(123456);
  });

  it("yeni yol: formatNumberInput sayıyı doğru Türkçe girişe çevirir", () => {
    expect(formatNumberInput(1234.5)).toBe("1.234,5");
    expect(formatNumberInput(1234.56)).toBe("1.234,56");
    expect(formatNumberInput(10000)).toBe("10.000");
    expect(formatNumberInput(0.5)).toBe("0,5");
    expect(formatNumberInput(0)).toBe("");
  });

  it("yeni yol girdiği kaybetmez", () => {
    expect(parseTurkishNumber(formatNumberInput(1234.5))).toBe(1234.5);
    expect(parseTurkishNumber(formatNumberInput(1234.56))).toBe(1234.56);
    expect(parseTurkishNumber(formatNumberInput(10000))).toBe(10000);
  });
});
