import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import {
  masrafDosyasiAyristir,
  masrafSayfasiAyristir,
} from "../src/lib/finance/masrafImport";

/** Test workbook'u ArrayBuffer'a çevir (uygulamanın okuma biçimiyle aynı). */
function buildWorkbook(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** GÜNCEL MASRAF LİSTESİ dosyasındaki gerçek başlık satırı. */
const GERCEK_BASLIK = [
  "S.N.",
  "BEL. AL. FİRMA\r\nADI / UNVANI V.N.",
  "BELGENİN ALINDIĞI\r\nFİRMA ADI / UNVANI",
  "MASRAF TÜRÜ",
  "FATURA \r\nFİŞ NO",
  "BELGE\r\nTARİHİ",
  "KDV ORANI\r\n( % … )",
  "FİŞ GENEL\r\nTOPLAMI",
  "ÖDEME TÜRÜ",
  "MASRAF\r\nMERKEZİ",
  "ARAÇ\r\nPLAKA NO",
  "KKEG",
  "NET\r\nMATRAH",
];

const GERCEK_SATIR = [
  1,
  5270388270,
  "KASIMPAŞA SPOR KULÜBÜ DER.İKT.İŞL.",
  "ARAÇ OTOPARK VE VALE GİDERLERİ",
  35,
  46099, // Excel tarih serisi → 2026-03-18
  20,
  260,
  "NAKİT / PARA",
  "MESKUR KURUMSAL A.Ş.",
  null,
  78,
  182,
];

/** Boş şablon satırı: alanı yok, tutarı yok → aktarılmamalı. */
const BOS_SATIR = [3, null, null, null, null, null, null, 0, null, "MESKUR", null, 0, 0];

describe("masrafImport", () => {
  test("gerçek dosya düzenini satır satır eşler", () => {
    const buf = buildWorkbook({
      "03.AY O.Y. () 2026": [
        ["MASRAF LİSTESİ"],
        ["BELGE DÜZENLEME TARİHİ", null, null, 46127],
        GERCEK_BASLIK,
        GERCEK_SATIR,
        BOS_SATIR,
      ],
    });
    const sayfalar = masrafDosyasiAyristir(buf);
    expect(sayfalar.length).toBe(1);
    const [satir] = sayfalar[0].satirlar;
    expect(satir).toBeDefined();
    expect(satir!.masrafTuru).toBe("ARAÇ OTOPARK VE VALE GİDERLERİ");
    expect(satir!.fisFirma).toBe("KASIMPAŞA SPOR KULÜBÜ DER.İKT.İŞL.");
    expect(satir!.vergiNo).toBe("5270388270");
    expect(satir!.faturaFisNo).toBe("35");
    expect(satir!.belgeTarihi).toBe("2026-03-18");
    expect(satir!.kdvOrani).toBe(20);
    expect(satir!.fisToplam).toBe(260);
    expect(satir!.kkeg).toBe(78);
    expect(satir!.odemeTuru).toBe("NAKİT / PARA");
    // Masraf merkezine yazılan firma adı → Şirket alanına taşınır
    expect(satir!.sirket).toBe("Meskur");
    expect(satir!.masrafMerkez).toBe("");
    expect(satir!.belgeTipi).toBe("Fatura");
    // Boş şablon satırı atlandı
    expect(sayfalar[0].satirlar.length).toBe(1);
  });

  test("VERİ BANKASI sayfası (kaynak liste) içe aktarılmaz", () => {
    const rows = masrafSayfasiAyristir("VERİ BANKASI", [
      ["S.N.", "MASRAF CİNSİ SEÇİNİZ", "KDV ORANI SEÇİNİZ"],
      [1, "ARAÇ YAKIT GİDERİ", 20],
    ]);
    expect(rows.satirlar.length).toBe(0);
  });

  test("başlık satırında 'Masraf Türü' olmayan sayfa atlanır", () => {
    const rows = masrafSayfasiAyristir("Sayfa1", [
      ["Açıklama", "Tutar"],
      ["bir şeyler", 100],
    ]);
    expect(rows.satirlar.length).toBe(0);
  });

  test("metin tarih biçimlerini yyyy-mm-dd çevirir", () => {
    const rows = masrafSayfasiAyristir("Test", [
      GERCEK_BASLIK,
      [2, 111, "FİRMA A.Ş.", "KIRTASİYE VE MATBAA GİDERLERİ", "42", "14.03.2026", 10, 100, "ÇEK", "Genel", null, 0, 90],
      [3, 222, "FİRMA B", "SAĞLIK GİDERLERİ", "43", "2026-03-20", 0, 50, "Nakit", "Genel", null, 0, 50],
    ]);
    expect(rows.satirlar.length).toBe(2);
    expect(rows.satirlar[0].belgeTarihi).toBe("2026-03-14");
    expect(rows.satirlar[1].belgeTarihi).toBe("2026-03-20");
    expect(rows.satirlar[0].kdvOrani).toBe(10);
    expect(rows.satirlar[1].kdvOrani).toBe(0);
  });

  test("birden fazla sayfayı dosyadan ayırır", () => {
    const buf = buildWorkbook({
      "01.AY O.Y. (01-10 ARASI) 2026": [
        ["MASRAF LİSTESİ"],
        GERCEK_BASLIK,
        GERCEK_SATIR,
      ],
      "01.AY O.Y. (11-20 ARASI) 2026": [
        ["MASRAF LİSTESİ"],
        GERCEK_BASLIK,
        [2, 999, "BAŞKA FİRMA LTD.", "YİYECEK-İÇECEK GİDERLERİ", 7, 46100, 1, 126, "NAKİT / PARA", "FERLA DIŞ TİC. LTD.", null, 0, 126],
        BOS_SATIR,
      ],
      "VERİ BANKASI": [["S.N.", "MASRAF CİNSİ SEÇİNİZ"], [1, "ARAÇ YAKIT GİDERİ"]],
    });
    const sayfalar = masrafDosyasiAyristir(buf);
    expect(sayfalar.map((s) => s.ad)).toEqual([
      "01.AY O.Y. (01-10 ARASI) 2026",
      "01.AY O.Y. (11-20 ARASI) 2026",
      "VERİ BANKASI",
    ]);
    expect(sayfalar[0].satirlar.length).toBe(1);
    expect(sayfalar[1].satirlar.length).toBe(1);
    expect(sayfalar[1].satirlar[0].sirket).toBe("Ferla");
    expect(sayfalar[2].satirlar.length).toBe(0);
  });
});
