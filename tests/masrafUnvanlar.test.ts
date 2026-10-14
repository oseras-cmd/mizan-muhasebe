import { describe, expect, test } from "bun:test";
import { SATICILAR, UNVANLAR } from "../src/data/masrafListesi";

describe("masrafListesi — ünvan/vergi no rehberi", () => {
  test("UNVANLAR: her vergi no tek kez, ünvanlar dolu", () => {
    // VERİ BANKASI 716 kod içerir; aylık sayfalardan gelen yeni çiftlerle daha fazla olmalı
    expect(UNVANLAR.length).toBeGreaterThan(730);
    const kods = UNVANLAR.map((u) => u.kod);
    expect(new Set(kods).size).toBe(kods.length); // vergi no tekrar etmemeli
    for (const u of UNVANLAR) {
      expect(u.kod.length).toBeGreaterThanOrEqual(5);
      expect(u.unvan.trim().length).toBeGreaterThan(0);
    }
  });

  test("VERİ BANKASI satıcılarının kodları ünvan rehberinde mevcut", () => {
    const kodSet = new Set(UNVANLAR.map((u) => u.kod));
    let sayildi = 0;
    for (const s of SATICILAR) {
      if (!s.kod) continue;
      expect(kodSet.has(s.kod)).toBe(true);
      sayildi++;
    }
    expect(sayildi).toBeGreaterThan(700);
  });

  test("aylık sayfalardan gelen örnek çift rehberde", () => {
    // "03.AY O.Y. 2026" sayfasındaki belge satırından hasat edilmişti
    const kayit = UNVANLAR.find((u) => u.kod === "6370192467");
    expect(kayit).toBeDefined();
    expect(kayit!.unvan).toContain("OKAY GİYİM");
  });
});
