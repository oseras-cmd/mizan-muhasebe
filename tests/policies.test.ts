import { describe, expect, test } from "bun:test";
import { computePolicySchedule } from "../src/lib/finance/policies";

/**
 * Referans: Burhan Eray / TÜRMOB "Poliçe Hesaplama" aracı
 * (burhaneray.com/Hesaplamalar/policeHesaplama — sunucu tarafında hesaplar).
 * Bu testteki değerler, gerçek araca gönderilen iki sorgunun çıktılarından
 * birebir kopyalanmıştır.
 */
describe("computePolicySchedule — Burhan Eray referansı", () => {
  /** 15.07.2025 başlangıç, 24.000 ₺, Araç Ticari (K.K.E.G. yok). */
  test("Ticari / 15.07.2025 / 24.000 ₺", () => {
    const s = computePolicySchedule({
      type: "Ticari Araç",
      account: "740",
      startDate: "2025-07-15",
      amount: 24000,
    });

    // Referans: 13 satır, gün sayıları birebir
    expect(s.rows.map((r) => r.days)).toEqual([
      17, 31, 30, 31, 30, 31, 31, 28, 31, 30, 31, 30, 14,
    ]);

    // Aylık bedeller (referans: 1.117,81 / 2.038,36 / 1.972,60 / ... 920,55)
    expect(s.rows.map((r) => Number(r.amount.toFixed(2)))).toEqual([
      1117.81, 2038.36, 1972.6, 2038.36, 1972.6, 2038.36, 2038.36, 1841.1,
      2038.36, 1972.6, 2038.36, 1972.6, 920.55,
    ]);

    // Hesap kodları: ilk ay gider hesabı; aynı yılın ayları 180;
    // GELECEK YILIN TÜM ayları 280 (referans: Ocak–Temmuz 2026 tamamı 280)
    expect(s.rows[0].accountCode).toBe("740");
    expect(s.rows.slice(1, 6).map((r) => r.accountCode)).toEqual(
      Array(5).fill("180"),
    );
    expect(s.rows.slice(6).map((r) => r.accountCode)).toEqual(
      Array(7).fill("280"),
    );

    // Dönem etiketleri takvim çeyreğine göre
    expect(s.rows[0].periodLabel).toBe("2025 / 3. Dönem");
    expect(s.rows[6].periodLabel).toBe("2026 / 1. Dönem");
    expect(s.rows[11].periodLabel).toBe("2026 / 2. Dönem");
    expect(s.rows[12].periodLabel).toBe("2026 / 3. Dönem");

    // Bdiretilen toplam brüt tutara eşit; K.K.E.G. yok
    expect(s.kkegAmount).toBe(0);
    expect(s.rows.reduce((a, r) => a + r.amount, 0)).toBeCloseTo(24000, 0);
    expect(s.totals["740"]).toBeCloseTo(1117.81, 2);
  });

  /** 20.10.2025 başlangıç, 50.000 ₺, Araç Binek (%30 K.K.E.G.). */
  test("Binek / 20.10.2025 / 50.000 ₺ (K.K.E.G. %30)", () => {
    const s = computePolicySchedule({
      type: "Binek Araç",
      account: "740",
      startDate: "2025-10-20",
      amount: 50000,
    });

    // K.K.E.G. %30 → 15.000 ₺; dağıtım tabanı 35.000 ₺
    expect(s.kkegAmount).toBeCloseTo(15000, 2);

    // Referans 13 satır: ... Eylül 30 gün, son satır Ekim 2026'da 19 gün
    expect(s.rows.map((r) => r.days)).toEqual([
      12, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31, 30, 19,
    ]);

    // Aylık bedeller (referans: 1.150,68 ... 1.821,92)
    expect(s.rows.map((r) => Number(r.amount.toFixed(2)))).toEqual([
      1150.68, 2876.71, 2972.6, 2972.6, 2684.93, 2972.6, 2876.71, 2972.6,
      2876.71, 2972.6, 2972.6, 2876.71, 1821.92,
    ]);

    // Hesap kodları: ilk ay 740; Ekim–Aralık 2025 → 180;
    // Ocak 2025 dahil gelecek yılın tamamı → 280 (referansla birebir)
    expect(s.rows[0].accountCode).toBe("740");
    expect(s.rows[1].accountCode).toBe("180");
    expect(s.rows[2].accountCode).toBe("180");
    expect(s.rows.slice(3).map((r) => r.accountCode)).toEqual(
      Array(10).fill("280"),
    );

    // Hesap özeti (referans: 740'a 7.000,00; 689 = 15.000)
    expect(s.totals["740"]).toBeCloseTo(1150.68, 2);
    expect(s.totals["180"]).toBeCloseTo(5849.32, 2);
    expect(s.totals["280"]).toBeCloseTo(28000, 0);

    // Dağıtılan taban + KKEG = brüt tutar (önceki sürümde 1.821,92 kayıp vardı)
    expect(
      s.rows.reduce((a, r) => a + r.amount, 0) + s.kkegAmount,
    ).toBeCloseTo(50000, 0);
  });

  /** Yıl dönümü olmayan poliçe: 01.01 başlangıç → 12 satır, tamamı aynı yıl. */
  test("01.01.2025 başlangıç / 24.000 ₺ Ticari", () => {
    const s = computePolicySchedule({
      type: "Ticari Araç",
      account: "770",
      startDate: "2025-01-01",
      amount: 24000,
    });

    expect(s.rows).toHaveLength(12);
    // Gün toplamı 365: takvim günleri (2025 üçlü ay dağılımı)
    expect(s.rows.reduce((a, r) => a + r.days, 0)).toBe(365);
    expect(s.rows[0].accountCode).toBe("770");
    expect(s.rows.slice(1).map((r) => r.accountCode)).toEqual(
      Array(11).fill("180"),
    );
    expect(s.totals["180"]).toBeCloseTo(24000 - 24000 / 365 * 31, 2);
    expect(s.rows.reduce((a, r) => a + r.amount, 0)).toBeCloseTo(24000, 0);
  });
});
