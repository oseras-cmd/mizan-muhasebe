import { describe, expect, test } from "bun:test";
import { SATICILAR, UNVANLAR } from "../src/data/masrafListesi";
import { araFiltre, araNorm } from "../src/lib/finance/araNorm";

describe("masrafListesi — ünvan/vergi no rehberi", () => {
  test("UNVANLAR: vergi no'lar sayısal, ünvanlar harf içeriyor", () => {
    expect(UNVANLAR.length).toBeGreaterThan(600);
    const kods = UNVANLAR.map((u) => u.kod);
    expect(new Set(kods).size).toBe(kods.length); // vergi no tekrar etmemeli
    for (const u of UNVANLAR) {
      // Kaymış sütunlardan gelen gider adları ("ARAÇ YAKIT GİDERİ") vb. elenmeli
      expect(u.kod).toMatch(/^\d{5,12}$/);
      expect(u.unvan.trim().length).toBeGreaterThanOrEqual(3);
      expect(u.unvan).toMatch(/[a-zçğıöşü]/i); // sahte "0" değerleri elenmeli
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

  test("aylık sayfalardan gelen çiftler rehberde", () => {
    // "03.AY O.Y. 2026" sayfası: OKAY GİYİM
    const okay = UNVANLAR.find((u) => u.kod === "6370192467");
    expect(okay).toBeDefined();
    expect(okay!.unvan).toContain("OKAY GİYİM");
    // "12.AY T.K. MESKUR 2025" sayfası: MİGROS
    const migros = UNVANLAR.find((u) => u.kod === "6220529513");
    expect(migros).toBeDefined();
    expect(migros!.unvan).toContain("MİGROS");
  });
});

describe("Türkçe duyarlı arama (araNorm)", () => {
  test("ı/İ/I/i hepsi 'i'ye iner", () => {
    expect(araNorm("MİGROS")).toBe("migros");
    expect(araNorm("migros")).toBe("migros");
    expect(araNorm("ISPARTA")).toBe("isparta");
    expect(araNorm("ısparta")).toBe("isparta");
  });

  test("ş/ğ/ü/ö/ç ASCII karşılıklarına iner", () => {
    expect(araNorm("ŞÖLEN GIDA")).toBe("solen gida");
    expect(araNorm("solen gida")).toBe("solen gida");
    expect(araNorm("ÇİĞDEM")).toBe("cigdem");
    expect(araNorm("GÜNGÖR")).toBe("gungor");
  });

  test("'migros' yazınca MİGROS ünvanı eşleşir", () => {
    const kayit = UNVANLAR.find((u) => u.kod === "6220529513")!;
    const listedeGoren = `${kayit.unvan} ${kayit.kod}`; // bileşenin filtrelediği değer
    expect(araFiltre(kayit.unvan, "migros")).toBe(1);
    expect(araFiltre(kayit.unvan, "MİGROS")).toBe(1);
    expect(araFiltre(kayit.unvan, "ticaret")).toBe(1);
    // çoklu kelime: tüm kelimeler geçmeli
    expect(araFiltre(listedeGoren, "migros ticaret 6220529513")).toBe(1);
    expect(araFiltre(kayit.unvan, "migros ticaret")).toBe(1);
    expect(araFiltre(kayit.unvan, "migros banka")).toBe(0);
  });
});
