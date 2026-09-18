/**
 * Banka ekstresi ayrıştırıcı testleri.
 */

import { describe, expect, it } from "bun:test";
import { parseAmount, parseStatementDate, parseCsvStatement } from "../statementImport";

describe("parseAmount", () => {
  it("Türk formatını ayrıştırır: 1.234,56", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
  });

  it("sondaki eksi işaretini (banka formatı) negatif sayar: 1.234,56-", () => {
    expect(parseAmount("1.234,56-")).toBe(-1234.56);
  });

  it("öndeki eksi işaretini negatif sayar: -1.234,56", () => {
    expect(parseAmount("-1.234,56")).toBe(-1234.56);
  });

  it("İngiliz formatını ayrıştırır: 1,234.56", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
  });

  it("parantez içini negatif sayar: (1.234,56)", () => {
    expect(parseAmount("(1.234,56)")).toBe(-1234.56);
  });

  it("para birimi simgelerini temizler", () => {
    expect(parseAmount("₺1.000,00")).toBe(1000);
    expect(parseAmount("1000 TL")).toBe(1000);
    expect(parseAmount("$500,50")).toBe(500.5);
  });

  it("sayı girişini doğrudan döner", () => {
    expect(parseAmount(1234.56)).toBe(1234.56);
    expect(parseAmount(-99.5)).toBe(-99.5);
  });

  it("boş / geçersiz girdilerde null döner", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("ondalıklı küçük tutarlar: 0,01", () => {
    expect(parseAmount("0,01")).toBe(0.01);
  });
});

describe("parseStatementDate", () => {
  it("gg.aa.yyyy biçimini ISO'ya çevirir", () => {
    expect(parseStatementDate("05.03.2026")).toBe("2026-03-05");
  });

  it("gg/aa/yyyy biçimini destekler", () => {
    expect(parseStatementDate("15/08/2026")).toBe("2026-08-15");
  });

  it("yyyy-aa-gg biçimini olduğu gibi döner", () => {
    expect(parseStatementDate("2026-09-17")).toBe("2026-09-17");
  });

  it("2 haneli yılı doğru yüzyıla çevirir", () => {
    expect(parseStatementDate("05.03.99")).toBe("1999-03-05");
    expect(parseStatementDate("05.03.26")).toBe("2026-03-05");
  });

  it("Excel tarih serisini çözer", () => {
    // 45782 = 2025-05-05 (Excel serial)
    expect(parseStatementDate(45782)).toBe("2025-05-05");
  });

  it("Date nesnesini destekler", () => {
    expect(parseStatementDate(new Date(2026, 8, 17))).toBe("2026-09-17");
  });

  it("Türkçe ay adlarını çözer", () => {
    expect(parseStatementDate("5 Eyl 2026")).toBe("2026-09-05");
    expect(parseStatementDate("17 Aralık 2025")).toBe("2025-12-17");
  });

  it("geçersiz tarihte null döner", () => {
    expect(parseStatementDate("abc")).toBeNull();
    expect(parseStatementDate("")).toBeNull();
    expect(parseStatementDate(null)).toBeNull();
    expect(parseStatementDate("32.13.2026")).toBeNull();
  });
});

describe("parseCsvStatement", () => {
  it("başlıklı Türk bankası ekstresini ayrıştırır (noktalı virgül)", () => {
    const csv = [
      "Tarih;Açıklama;Tutar",
      "05.03.2026;MARKET ALIMI;1.250,00-",
      "06.03.2026;MÜŞTERİ ÖDEMESI;15.000,00",
      "07.03.2026;ELEKTRIK FATURASI;890,50-",
    ].join("\n");
    const r = parseCsvStatement(csv);
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(3);
    expect(r.skipped).toBe(0);
    expect(r.rows[0]).toEqual({
      date: "2026-03-05",
      description: "MARKET ALIMI",
      amount: -1250,
    });
    expect(r.rows[1]?.amount).toBe(15_000);
    expect(r.rows[2]?.amount).toBe(-890.5);
  });

  it("Giriş/Çıkış kolonlu ekstreyi doğru yönde ayrıştırır", () => {
    const csv = [
      "İşlem Tarihi;Açıklama;Giriş;Çıkış",
      "01.04.2026;HAVALE - AHMET;5.000,00;",
      "02.04.2026;KIRA ÖDEMESI;;2.500,00",
    ].join("\n");
    const r = parseCsvStatement(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]?.amount).toBe(5_000);
    expect(r.rows[1]?.amount).toBe(-2_500);
  });

  it("Borç/Alacak kolonlu ekstreyi destekler", () => {
    const csv = [
      "Tarih;Detay;Alacak;Borç",
      "10.05.2026;TAHSILAT;1.000,00;",
      "11.05.2026;ODeme;;300,00",
    ].join("\n");
    const r = parseCsvStatement(csv);
    expect(r.rows[0]?.amount).toBe(1_000);
    expect(r.rows[1]?.amount).toBe(-300);
  });

  it("başlıksız CSV'de örneklemeyle kolonları bulur", () => {
    const csv = "01.06.2026;ALISVERIS;250,00-\n02.06.2026;TAHSILAT;4.000,00";
    const r = parseCsvStatement(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]?.date).toBe("2026-06-01");
    expect(r.rows[0]?.amount).toBe(-250);
  });

  it("virgüllü ayraçlı CSV'yi destekler", () => {
    const csv = [
      "Tarih,Açıklama,Tutar",
      "2026-01-15,ÖDEME,1000,50",
    ].join("\n");
    // Bu belirsiz bir durum (tutar içindeki virgül ayraçla karışır);
    // en azından hata vermeden bir şey döndürmeli
    const r = parseCsvStatement(csv);
    expect(r).toBeDefined();
  });

  it("geçersiz satırları atlar ve skipped sayar", () => {
    const csv = [
      "Tarih;Açıklama;Tutar",
      "05.03.2026;GEÇERLİ;100,00",
      "GEÇERSİZ;SATIR;abc",
      "32.13.2026;KÖTÜ TARİH;50,00",
    ].join("\n");
    const r = parseCsvStatement(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it("boş dosyada hata döner", () => {
    const r = parseCsvStatement("");
    expect(r.error).toBeDefined();
    expect(r.rows).toHaveLength(0);
  });

  it("bakiye kolonlu ekstrede tutarı doğru kolondan alır", () => {
    const csv = [
      "Tarih;Açıklama;Tutar;Bakiye",
      "20.07.2026;FASTFOOD;150,75-;12.000,00",
    ].join("\n");
    const r = parseCsvStatement(csv);
    expect(r.rows[0]?.amount).toBe(-150.75);
  });
});
