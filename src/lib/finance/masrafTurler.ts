/**
 * Masraf türleri — tek ve nihai liste.
 *
 * Eski uygulama listesi ile GÜNCEL MASRAF LİSTESİ.xlsx (VERİ BANKASI) listesi
 * birleştirildi; aynı anlamı taşıyan yinelenen adlar tek kanonik ad altında
 * toplandı, hatalı yazımlar düzeltildi (ör. "Viyadük" → "Vale", "(669)" → "(689)").
 *
 * Eski/kullanıcı Excel'indeki tüm varyasyonlar `TUR_ESLEME` ile kanonik ada
 * çevrilir; böylece geçmiş kayıtlar ve içe aktarılan satırlar kategori bilgisini
 * kaybetmez.
 */

/** Kanonik masraf türü listesi (seçim menüsünde görünen). */
export const MASRAF_TURLERI: string[] = [
  "Araç Yakıt Gideri",
  "Araç Otopark ve Vale Giderleri",
  "Araç Tamir ve Bakım Giderleri",
  "Mutfak Yiyecek ve İçecek Giderleri",
  "Mutfak Sarf Malzeme Giderleri",
  "Yiyecek-İçecek Giderleri",
  "Temsil, İkram ve Yemek Giderleri",
  "Özel İletişim Giderleri",
  "Ofis Makine Tam. Bak. ve Sarf Malz. Giderleri",
  "Ofis Tamir, Bakım ve Onarım Gideri",
  "İş Teknik Bakım",
  "PTT, Kargo, Nakliye ve Hammaliye Giderleri",
  "Kırtasiye ve Matbaa Giderleri",
  "Yurt İçi Seyahat ve Konaklama Giderleri",
  "Yurt Dışı Seyahat ve Konaklama Giderleri",
  "Temizlik ve Sarf Malzeme Giderleri",
  "Muhasebe ve Danışmanlık Giderleri",
  "Muhtelif ve Dışarıdan Sağlanan Hizmet Giderleri",
  "Diğer Vergi, Resim ve Harç Giderleri",
  "İlan, Reklam ve Tanıtım Giderleri",
  "Noter Giderleri",
  "Sağlık Giderleri",
  "Kanunen Kabul Edilmeyen Giderler (689)",
  "Diğer",
];

/** Eski uygulama adları ve Excel'deki yazımlar → kanonik ad. Anahtarlar
 * büyük harf/boşluk duyarsızdır (normTr). */
const TUR_ESLEME: Record<string, string> = {
  // Araç
  "ARAÇ OTOPARK VE VİYADÜK": "Araç Otopark ve Vale Giderleri", // eski hatalı ad
  "ARAÇ OTOPARK VE VİZYÖR": "Araç Otopark ve Vale Giderleri", // daha eski hatalı ad
  "ARAÇ OTOPARK VE VALE": "Araç Otopark ve Vale Giderleri",
  "ARAÇ OTOPARK VE VALE GİDERLERİ": "Araç Otopark ve Vale Giderleri",
  "ARAÇ TAMİR VE BAKIM": "Araç Tamir ve Bakım Giderleri",
  "ARAÇ TAMİR VE BAKIM GİDERLERİ": "Araç Tamir ve Bakım Giderleri",
  // Mutfak / yiyecek
  "MUTFAK YİYECEK VE İÇECEK": "Mutfak Yiyecek ve İçecek Giderleri",
  "MUTFAK YİYECEK VE İÇECEK GİDERLERİ": "Mutfak Yiyecek ve İçecek Giderleri",
  "MUTFAK SARF MALZEME": "Mutfak Sarf Malzeme Giderleri",
  "MUTFAK SARF MALZEME GİDERLERİ": "Mutfak Sarf Malzeme Giderleri",
  "YİYECEK İÇECEK GİDERİ": "Yiyecek-İçecek Giderleri",
  "YİYECEK-İÇECEK GİDERLERİ": "Yiyecek-İçecek Giderleri",
  // Temsil
  "TEMSİLCİLİK İKRAM VE YEMEK": "Temsil, İkram ve Yemek Giderleri",
  "TEMSİL İKRAM VE YEMEK GİDERLERİ": "Temsil, İkram ve Yemek Giderleri",
  // Ofis
  "OFİS MAKİNA TAM.BAK.VE SARF MALZ. GİD.": "Ofis Makine Tam. Bak. ve Sarf Malz. Giderleri",
  "OFİS MAKİNA TAMİR BAKIM VE SARF MALZEME": "Ofis Makine Tam. Bak. ve Sarf Malz. Giderleri",
  // Kargo / nakliye
  "PTT KARGO, KOLİ": "PTT, Kargo, Nakliye ve Hammaliye Giderleri",
  "PT. KARGO, KOLİ": "PTT, Kargo, Nakliye ve Hammaliye Giderleri", // eski hatalı ad
  "PTT, KARGO, NAKLİYE VE HAMMALİYE GİD.": "PTT, Kargo, Nakliye ve Hammaliye Giderleri",
  // Kırtasiye
  "KIRTASİYE VE MATBAA": "Kırtasiye ve Matbaa Giderleri",
  "KIRTASİYE VE MATBAA GİDERLERİ": "Kırtasiye ve Matbaa Giderleri",
  // Seyahat
  "YURT İÇİ SEYAHAT VE KONAKLAMA": "Yurt İçi Seyahat ve Konaklama Giderleri",
  "YURTİÇİ SEYAHAT VE KONAKLAMA GİD.": "Yurt İçi Seyahat ve Konaklama Giderleri",
  "YURT DIŞI SEYAHAT VE KONAKLAMA": "Yurt Dışı Seyahat ve Konaklama Giderleri",
  "YURTDIŞI SEYAHAT VE KONAKLAMA GİD.": "Yurt Dışı Seyahat ve Konaklama Giderleri",
  // Temizlik
  "TEMİZLİK VE SARF MALZEME": "Temizlik ve Sarf Malzeme Giderleri",
  "TEMİZLİK VE SARF MALZEME GİDERLERİ": "Temizlik ve Sarf Malzeme Giderleri",
  // Hizmet / danışmanlık
  "MUHASEBE VE DANIŞMANLIK": "Muhasebe ve Danışmanlık Giderleri",
  "MUHTELİF VE DIŞARDAN SAĞ.HİZ.GİD.": "Muhtelif ve Dışarıdan Sağlanan Hizmet Giderleri",
  "MUHTELİF VE DIŞARDAN SAĞLANAN HİZMET GİDERLERİ":
    "Muhtelif ve Dışarıdan Sağlanan Hizmet Giderleri",
  // Vergi / harç
  "DİĞER VERGİ VE RESİMLER": "Diğer Vergi, Resim ve Harç Giderleri",
  "DİĞER VERGİ RESİM VE HARÇ GİDERLERİ": "Diğer Vergi, Resim ve Harç Giderleri",
  // Reklam
  "İLAN REKLAM VE TANITIM": "İlan, Reklam ve Tanıtım Giderleri",
  "İLAN, REKLAM VE TANITIM": "İlan, Reklam ve Tanıtım Giderleri",
  // KKEG — 689 = Diğer Olağandışı Gider ve Zararlar hesabı (eski "669" hatalıydı)
  "KANUNEN KABUL EDİLMEYEN": "Kanunen Kabul Edilmeyen Giderler (689)",
  "KANUNEN KABUL EDİLMEYEN (669)": "Kanunen Kabul Edilmeyen Giderler (689)",
  "669 KANUNEN KABUL EDİLMEYEN": "Kanunen Kabul Edilmeyen Giderler (689)",
  "669 KANUNEN KABUL EDİLMEYEN GİD.": "Kanunen Kabul Edilmeyen Giderler (689)",
  "689 KANUNEN KABUL EDİLMEYEN GİD.": "Kanunen Kabul Edilmeyen Giderler (689)",
  "689 KANUNEN KABUL EDİLMEYEN": "Kanunen Kabul Edilmeyen Giderler (689)",
};

function normTr(value: string): string {
  return value.trim().toLocaleUpperCase("tr-TR");
}

const TUR_HARITA = new Map(MASRAF_TURLERI.map((t) => [normTr(t), t] as const));

/** Tanımayan değerler bu türe düşer. */
export const VARSAYILAN_MASRAF_TURU = "Diğer";

/** Ham masraf türünü (eski kayıt veya Excel'den gelen) kanonik ada çevirir. */
export function turEsle(ham: string | null | undefined): string {
  const n = normTr(ham ?? "");
  if (!n) return VARSAYILAN_MASRAF_TURU;
  return TUR_ESLEME[n] ?? TUR_HARITA.get(n) ?? VARSAYILAN_MASRAF_TURU;
}
