/**
 * KDV Beyanname hesaplama motoru testleri.
 * Kaynak: müşavirlerkulubu.com.tr/araclar/kdv-beyanname hesaplama mantığı.
 */

import { describe, expect, it } from "bun:test";
import { hesaplaKdvBeyanname, EMPTY_KDV_INPUT } from "../kdvBeyanname";

describe("hesaplaKdvBeyanname", () => {
  it("sıfır girdilerde her şey sıfır ve devreden tipinde", () => {
    const r = hesaplaKdvBeyanname({ ...EMPTY_KDV_INPUT });
    expect(r.toplamHesaplanan).toBe(0);
    expect(r.toplamIndirilecek).toBe(0);
    expect(r.odenecek).toBe(0);
    expect(r.devreden).toBe(0);
    expect(r.tip).toBe("devreden");
  });

  it("aracın örnek senaryosu: %20 satış 100.000, %20 alış 40.000 → ödenecek 12.000", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: 100_000,
      alis20: 40_000,
    });
    expect(r.toplamHesaplanan).toBe(20_000);
    expect(r.toplamIndirilecekAlis).toBe(8_000);
    expect(r.toplamIndirilecek).toBe(8_000);
    expect(r.odenecek).toBe(12_000);
    expect(r.devreden).toBe(0);
    expect(r.tip).toBe("odenecek");
  });

  it("çoklu oran: %1 + %10 + %20 satışları doğru toplar", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis1: 10_000, // KDV 100
      satis10: 50_000, // KDV 5.000
      satis20: 100_000, // KDV 20.000
    });
    expect(r.toplamHesaplanan).toBe(25_100);
    expect(r.hesaplananSatirlar).toHaveLength(3);
  });

  it("önceki dönem devreden KDV indirime eklenir", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: 50_000, // KDV 10.000
      alis20: 40_000, // KDV 8.000
      devredenOnceki: 5_000,
    });
    expect(r.toplamIndirilecek).toBe(13_000);
    expect(r.odenecek).toBe(0);
    expect(r.devreden).toBe(3_000);
    expect(r.tip).toBe("devreden");
  });

  it("tevkifat kesintisi ödenecek KDV'yi azaltır", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: 100_000, // KDV 20.000
      alis20: 40_000, // KDV 8.000
      tevkifatSatis: 6_000,
    });
    // 20.000 − 8.000 − 6.000 = 6.000
    expect(r.odenecek).toBe(6_000);
    expect(r.tevkifat).toBe(6_000);
  });

  it("tüm indirimler hesaplananı geçerse kalan devreden olur", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: 10_000, // KDV 2.000
      alis20: 100_000, // KDV 20.000
      devredenOnceki: 3_000,
    });
    // 2.000 − 20.000 − 3.000 = −21.000
    expect(r.odenecek).toBe(0);
    expect(r.devreden).toBe(21_000);
    expect(r.tip).toBe("devreden");
  });

  it("istisna satışlar KDV hesabına girmez", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: 100_000,
      istisnaSatis: 500_000,
      alis20: 40_000,
    });
    expect(r.toplamHesaplanan).toBe(20_000);
    expect(r.odenecek).toBe(12_000);
  });

  it("tablo yapısı doğru bölümleri içerir", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: 100_000,
      alis20: 40_000,
      devredenOnceki: 1_000,
      tevkifatSatis: 500,
    });
    const kalemler = r.tablo.map((t) => t.kalem);
    expect(kalemler).toContain("Hesaplanan KDV (Satışlar)");
    expect(kalemler).toContain("Toplam Hesaplanan KDV");
    expect(kalemler).toContain("İndirilecek KDV (Alışlar)");
    expect(kalemler).toContain("Önceki dönemden devreden KDV");
    expect(kalemler).toContain("Toplam İndirilecek KDV");
    expect(kalemler).toContain("Tevkifat Kesintisi (Alıcı)");
  });

  it("muhasebe fişi 391/191/360 hesaplarını içerir ve borç=alacak dengelenir", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: 100_000,
      alis20: 40_000,
    });
    const hesaplar = r.muhasebeKaydi.map((m) => m.hesap);
    expect(hesaplar).toContain("391");
    expect(hesaplar).toContain("191");
    expect(hesaplar).toContain("360");

    const toplamBorc = r.muhasebeKaydi.reduce((s, m) => s + m.borc, 0);
    const toplamAlacak = r.muhasebeKaydi.reduce((s, m) => s + m.alacak, 0);
    expect(Math.round(toplamBorc * 100) / 100).toBe(
      Math.round(toplamAlacak * 100) / 100,
    );
  });

  it("devreden sonuçta 190 hesabı borç tarafta oluşur", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: 10_000,
      alis20: 100_000,
    });
    const s190 = r.muhasebeKaydi.find(
      (m) => m.hesap === "190" && m.hesapAdi.includes("sonraki"),
    );
    expect(s190).toBeDefined();
    expect(s190?.borc).toBe(18_000);
  });

  it("negatif veya geçersiz girdiler sıfır sayılır", () => {
    const r = hesaplaKdvBeyanname({
      ...EMPTY_KDV_INPUT,
      satis20: -500,
      alis10: NaN,
    });
    expect(r.toplamHesaplanan).toBe(0);
    expect(r.toplamIndirilecekAlis).toBe(0);
  });
});
