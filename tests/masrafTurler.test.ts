import { describe, expect, test } from "bun:test";
import { MASRAF_CINSLERI } from "../src/data/masrafListesi";
import {
  MASRAF_TURLERI,
  VARSAYILAN_MASRAF_TURU,
  turEsle,
} from "../src/lib/finance/masrafTurler";

const norm = (s: string) => s.trim().toLocaleUpperCase("tr-TR");

describe("masrafTurler", () => {
  test("kanonik listede yinelenen tür yok", () => {
    const keys = MASRAF_TURLERI.map(norm);
    expect(new Set(keys).size).toBe(MASRAF_TURLERI.length);
    expect(MASRAF_TURLERI).toContain(VARSAYILAN_MASRAF_TURU);
  });

  test("Excel'deki (VERİ BANKASI) 19 masraf cinsinin hepsi kanonik ada eşlenir", () => {
    expect(MASRAF_CINSLERI.length).toBe(19);
    for (const xlsxTuru of MASRAF_CINSLERI) {
      const kanonik = turEsle(xlsxTuru);
      expect(MASRAF_TURLERI).toContain(kanonik);
      expect(kanonik).not.toBe(VARSAYILAN_MASRAF_TURU); // hiçbiri 'Diğer'e düşmemeli
    }
  });

  test("eski/yinelenen adlar aynı kanonik ada toplanır", () => {
    // Otopark: eski hatalı adlar + Excel adı → tek ada
    const vale = "Araç Otopark ve Vale Giderleri";
    expect(turEsle("Araç Otopark ve Viyadük")).toBe(vale); // eski hatalı yazımdı
    expect(turEsle("ARAÇ OTOPARK VE VİZYÖR")).toBe(vale); // daha eski hatalı ad
    expect(turEsle("ARAÇ OTOPARK VE VALE GİDERLERİ")).toBe(vale); // Excel
    expect(turEsle("araç otopark ve vale giderleri")).toBe(vale); // küçük harf

    expect(turEsle("Araç Tamir ve Bakım")).toBe("Araç Tamir ve Bakım Giderleri");
    expect(turEsle("ARAÇ TAMİR VE BAKIM GİDERLERİ")).toBe("Araç Tamir ve Bakım Giderleri");
    expect(turEsle("Mutfak Yiyecek ve İçecek")).toBe("Mutfak Yiyecek ve İçecek Giderleri");
    expect(turEsle("Yiyecek İçecek Gideri")).toBe("Yiyecek-İçecek Giderleri");
    expect(turEsle("Temsilcilik İkram ve Yemek")).toBe("Temsil, İkram ve Yemek Giderleri");
    expect(turEsle("PTT Kargo, Koli")).toBe("PTT, Kargo, Nakliye ve Hammaliye Giderleri");
    expect(turEsle("PT. KARGO, KOLİ")).toBe("PTT, Kargo, Nakliye ve Hammaliye Giderleri");
    expect(turEsle("Kırtasiye ve Matbaa")).toBe("Kırtasiye ve Matbaa Giderleri");
    expect(turEsle("Yurt İçi Seyahat ve Konaklama")).toBe(
      "Yurt İçi Seyahat ve Konaklama Giderleri",
    );
    expect(turEsle("Temizlik ve Sarf Malzeme")).toBe("Temizlik ve Sarf Malzeme Giderleri");
    expect(turEsle("Muhasebe ve Danışmanlık")).toBe("Muhasebe ve Danışmanlık Giderleri");
    expect(turEsle("Diğer Vergi ve Resimler")).toBe("Diğer Vergi, Resim ve Harç Giderleri");
    expect(turEsle("İlan, Reklam ve Tanıtım")).toBe("İlan, Reklam ve Tanıtım Giderleri");
  });

  test("KKEG düzeltmesi: (669) → (689)", () => {
    expect(turEsle("Kanunen Kabul Edilmeyen (669)")).toBe(
      "Kanunen Kabul Edilmeyen Giderler (689)",
    );
    expect(turEsle("669 KANUNEN KABUL EDİLMEYEN")).toBe(
      "Kanunen Kabul Edilmeyen Giderler (689)",
    );
    expect(turEsle("689 KANUNEN KABUL EDİLMEYEN GİD.")).toBe(
      "Kanunen Kabul Edilmeyen Giderler (689)",
    );
  });

  test("değişmez kanonik adlar aynen korunur", () => {
    expect(turEsle("Özel İletişim Giderleri")).toBe("Özel İletişim Giderleri");
    expect(turEsle("İş Teknik Bakım")).toBe("İş Teknik Bakım");
    expect(turEsle("Noter Giderleri")).toBe("Noter Giderleri");
    expect(turEsle("Sağlık Giderleri")).toBe("Sağlık Giderleri");
    expect(turEsle("Diğer")).toBe("Diğer");
  });

  test("tanımayan veya boş değer 'Diğer'e düşer", () => {
    expect(turEsle("Bilinmeyen Tür XYZ")).toBe(VARSAYILAN_MASRAF_TURU);
    expect(turEsle("")).toBe(VARSAYILAN_MASRAF_TURU);
    expect(turEsle(null)).toBe(VARSAYILAN_MASRAF_TURU);
    expect(turEsle(undefined)).toBe(VARSAYILAN_MASRAF_TURU);
  });
});
