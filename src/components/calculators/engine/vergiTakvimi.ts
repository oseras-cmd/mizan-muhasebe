/**
 * 2026 Vergi Takvimi — beyanname/bildirim son tarihleri.
 * Kaynak: musavirlerkulubu.com.tr/mevzuat/takvim 2026 listesi (birebir kural seti).
 * Kurallar: KDV aylık 28 · KDV-2 25 · MUHSGK/DV/Konaklama 26 · SGK ödemesi ayın son günü ·
 * Geçici vergi izleyen ikinci ayın 17'si · ÖTV/BSMV/ÖİV 15 · Şans oyunları 20 ·
 * e-Defter berat 10 (kurumlar 14) · 3 aylık Muhtasar ve Geç.67: izleyen ayın 26'sı ·
 * 3 aylık KDV: izleyen ayın 28'i · GEKAP 3 aylık: izleyen ayın ilk iş günü ·
 * Emlak/Çevre temizlik taksitleri: Mart ve Kasım · Damga vergisi maktu bildirimi Ocak 28.
 */

export interface TakvimKaydi {
  ay: number; // hangi ayda gerçekleşir (1-12)
  gun: number;
  ad: string;
  kategori: "KDV" | "Vergi" | "SGK" | "E-Belge";
  periyot: "Aylık" | "3 Aylık" | "6 Aylık" | "Yıllık";
  not?: string;
}

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
export { AY_ADLARI };

const aySonu = (ay: number) => new Date(2026, ay, 0).getDate();

const KDV2 = (ay: number): TakvimKaydi => ({ ay, gun: 25, ad: "KDV-2 (Sorumlu Sıfatıyla / Tevkifat) Beyannamesi", kategori: "KDV", periyot: "Aylık" });
const OTV_I_ILK = (ay: number): TakvimKaydi => ({ ay, gun: 25, ad: "ÖTV I Sayılı Liste Beyannamesi (İlk 15 Gün)", kategori: "Vergi", periyot: "Aylık" });
const OTV_I_IKINCI = (ay: number): TakvimKaydi => ({ ay, gun: 10, ad: "ÖTV I Sayılı Liste Beyannamesi (İkinci 15 Gün)", kategori: "Vergi", periyot: "Aylık", not: "Bir önceki ayın ikinci 15 günü" });
const OTV_II = (ay: number): TakvimKaydi => ({ ay, gun: 15, ad: "ÖTV II Sayılı Liste Beyannamesi", kategori: "Vergi", periyot: "Aylık", not: "Motorlu taşıtlar" });
const OTV_III = (ay: number): TakvimKaydi => ({ ay, gun: 15, ad: "ÖTV III Sayılı Liste Beyannamesi", kategori: "Vergi", periyot: "Aylık", not: "Alkol, tütün, kolalı içecek" });
const OTV_IV = (ay: number): TakvimKaydi => ({ ay, gun: 15, ad: "ÖTV IV Sayılı Liste Beyannamesi", kategori: "Vergi", periyot: "Aylık", not: "Dayanıklı tüketim malları" });
const BSMV = (ay: number): TakvimKaydi => ({ ay, gun: 15, ad: "BSMV Beyannamesi", kategori: "Vergi", periyot: "Aylık", not: "Banka ve sigorta muameleleri" });
const OIV = (ay: number): TakvimKaydi => ({ ay, gun: 15, ad: "Özel İletişim Vergisi (ÖİV) Beyannamesi", kategori: "Vergi", periyot: "Aylık" });
const SANS = (ay: number): TakvimKaydi => ({ ay, gun: 20, ad: "Şans Oyunları Vergisi Beyannamesi", kategori: "Vergi", periyot: "Aylık", not: "Aylık beyan ve ödeme" });
const MUHSGK = (ay: number): TakvimKaydi => ({ ay, gun: 26, ad: "Muhtasar ve Prim Hizmet Beyannamesi", kategori: "Vergi", periyot: "Aylık" });
const SGK_BILDIRIM = (ay: number): TakvimKaydi => ({ ay, gun: 26, ad: "SGK Aylık Prim ve Hizmet Belgesi", kategori: "SGK", periyot: "Aylık", not: "MUHSGK ile birlikte verilir." });
const DV_BEYAN = (ay: number): TakvimKaydi => ({ ay, gun: 26, ad: "Damga Vergisi Beyannamesi", kategori: "Vergi", periyot: "Aylık" });
const KONAKLAMA = (ay: number): TakvimKaydi => ({ ay, gun: 26, ad: "Konaklama Vergisi Beyannamesi", kategori: "Vergi", periyot: "Aylık", not: "Otel/pansiyon konaklama hizmeti" });
const KDV1 = (ay: number): TakvimKaydi => ({ ay, gun: 28, ad: "KDV Beyannamesi (Aylık)", kategori: "KDV", periyot: "Aylık" });
const SGK_ODEME = (ay: number): TakvimKaydi => ({ ay, gun: aySonu(ay), ad: "SGK Prim Ödemesi", kategori: "SGK", periyot: "Aylık" });
const DHV = (ay: number): TakvimKaydi => ({ ay, gun: aySonu(ay), ad: "Dijital Hizmet Vergisi Beyannamesi", kategori: "Vergi", periyot: "Aylık", not: "Aylık beyan ve ödeme" });
const TURIZM = (ay: number): TakvimKaydi => ({ ay, gun: aySonu(ay), ad: "Turizm Payı Beyannamesi", kategori: "Vergi", periyot: "Aylık", not: "Aylık beyan" });
const EDEFTER = (ay: number, donemAdi: string): TakvimKaydi[] => ([
  { ay, gun: 10, ad: `E-Defter Berat Yükleme (${donemAdi})`, kategori: "E-Belge", periyot: "Aylık", not: "Gelir vergisi mükellefleri için 10'u" },
  { ay, gun: 14, ad: `E-Defter Berat Yükleme — Kurumlar (${donemAdi})`, kategori: "E-Belge", periyot: "Aylık", not: "Kurum mükellefler için 14'ü" },
]);

/** Aylık yinelenen set: ay N'de, N-1 dönemine ilişkin beyanlar (ödenek kuralı). */
function aylikSet(ay: number): TakvimKaydi[] {
  if (ay <= 1) return []; // Ocak: bir önceki yıl dönemi ayrıca işlenmez
  return [
    KDV2(ay), OTV_I_ILK(ay), MUHSGK(ay), SGK_BILDIRIM(ay), DV_BEYAN(ay), KONAKLAMA(ay),
    KDV1(ay), SGK_ODEME(ay), DHV(ay), TURIZM(ay), OTV_I_IKINCI(ay), OTV_II(ay), OTV_III(ay),
    OTV_IV(ay), BSMV(ay), OIV(ay), SANS(ay),
  ];
}

/** 2026'nın tüm kayıtları. */
export const TAKVIM_2026: TakvimKaydi[] = [
  // Ocak
  { ay: 1, gun: 28, ad: "Damga Vergisi Maktu Beyannamesi", kategori: "Vergi", periyot: "Yıllık", not: "Önceki yıl maktu damga vergisi bildirimi" },
  ...aylikSet(2), ...EDEFTER(2, "Ekim 2025"),
  // Şubat
  ...aylikSet(3), ...EDEFTER(3, "Kasım 2025"),
  // Mart
  { ay: 3, gun: 31, ad: "Emlak Vergisi 1. Taksit", kategori: "Vergi", periyot: "Yıllık", not: "2026 birinci taksit" },
  { ay: 3, gun: 31, ad: "Çevre Temizlik Vergisi 1. Taksit", kategori: "Vergi", periyot: "Yıllık", not: "2026 birinci taksit" },
  ...aylikSet(4), ...EDEFTER(4, "Aralık 2025"),
  // Nisan
  { ay: 4, gun: 15, ad: "Yıllık Gelir Vergisi Beyannamesi", kategori: "Vergi", periyot: "Yıllık", not: "2025 yılı kazançları (işletme/SMM)" },
  { ay: 4, gun: 25, ad: "Yıllık Gelir Vergisi 1. Taksit", kategori: "Vergi", periyot: "Yıllık" },
  { ay: 4, gun: 26, ad: "3 Aylık Muhtasar Beyannamesi", kategori: "Vergi", periyot: "3 Aylık", not: "Ocak-Mart 2026 dönemi (10 ve daha az işçi)" },
  { ay: 4, gun: 26, ad: "GVK Geçici 67. Madde Stopaj Beyannamesi", kategori: "Vergi", periyot: "3 Aylık", not: "2026 1. dönem (Ocak-Mart)" },
  { ay: 4, gun: 28, ad: "3 Aylık KDV Beyannamesi", kategori: "KDV", periyot: "3 Aylık", not: "Ocak-Mart 2026 dönemi (3 aylık dönem belirlenenler)" },
  { ay: 4, gun: 30, ad: "Kurumlar Vergisi Beyannamesi", kategori: "Vergi", periyot: "Yıllık", not: "2025 hesap dönemi" },
  { ay: 4, gun: 30, ad: "Kurumlar Vergisi 1. Taksit", kategori: "Vergi", periyot: "Yıllık" },
  ...aylikSet(5), ...EDEFTER(5, "Ocak 2026"),
  // Mayıs
  { ay: 4, gun: 30, ad: "GEKAP Beyannamesi (Ocak-Şubat-Mart)", kategori: "Vergi", periyot: "3 Aylık", not: "1. dönem — 30 Nisan 2026 Perşembe." },
  ...aylikSet(6), ...EDEFTER(6, "Şubat 2026"),
  // Haziran
  { ay: 6, gun: 17, ad: "Geçici Vergi Beyannamesi", kategori: "Vergi", periyot: "3 Aylık", not: "1. dönem geçici vergi (Ocak-Nisan) — izleyen ikinci ayın 17'si" },
  { ay: 6, gun: 17, ad: "Yurt İçi Asgari Kurumlar Vergisi (1. Geçici)", kategori: "Vergi", periyot: "3 Aylık", not: "1. dönem geçici vergi içinde asgari KV" },
  ...aylikSet(7), ...EDEFTER(7, "Mart 2026"),
  // Temmuz
  ...aylikSet(8), ...EDEFTER(8, "Nisan 2026"),
  // Ağustos
  ...aylikSet(9), ...EDEFTER(9, "Mayıs 2026"),
  // Eylül
  { ay: 7, gun: 31, ad: "GEKAP Beyannamesi (Nisan-Mayıs-Haziran)", kategori: "Vergi", periyot: "3 Aylık", not: "2. dönem — 31 Temmuz 2026 Cuma." },
  { ay: 9, gun: 26, ad: "3 Aylık Muhtasar Beyannamesi", kategori: "Vergi", periyot: "3 Aylık", not: "Nisan-Haziran 2026 dönemi (10 ve daha az işçi)" },
  { ay: 9, gun: 26, ad: "GVK Geçici 67. Madde Stopaj Beyannamesi", kategori: "Vergi", periyot: "3 Aylık", not: "2026 2. dönem (Nisan-Haziran)" },
  { ay: 9, gun: 28, ad: "3 Aylık KDV Beyannamesi", kategori: "KDV", periyot: "3 Aylık", not: "Nisan-Haziran 2026 dönemi" },
  ...aylikSet(10), ...EDEFTER(10, "Haziran 2026"),
  // Ekim
  ...aylikSet(11), ...EDEFTER(11, "Temmuz 2026"),
  // Kasım
  { ay: 11, gun: 17, ad: "Geçici Vergi Beyannamesi", kategori: "Vergi", periyot: "3 Aylık", not: "2. dönem geçici vergi (Mayıs-Eylül) — izleyen ikinci ayın 17'si" },
  { ay: 11, gun: 17, ad: "Yurt İçi Asgari Kurumlar Vergisi (2. Geçici)", kategori: "Vergi", periyot: "3 Aylık", not: "2. dönem geçici vergi içinde asgari KV" },
  { ay: 11, gun: 26, ad: "3 Aylık Muhtasar Beyannamesi", kategori: "Vergi", periyot: "3 Aylık", not: "Temmuz-Eylül 2026 dönemi (10 ve daha az işçi)" },
  { ay: 11, gun: 26, ad: "GVK Geçici 67. Madde Stopaj Beyannamesi", kategori: "Vergi", periyot: "3 Aylık", not: "2026 3. dönem (Temmuz-Eylül)" },
  { ay: 11, gun: 28, ad: "3 Aylık KDV Beyannamesi", kategori: "KDV", periyot: "3 Aylık", not: "Temmuz-Eylül 2026 dönemi" },
  { ay: 11, gun: 30, ad: "Emlak Vergisi 2. Taksit", kategori: "Vergi", periyot: "Yıllık", not: "2026 ikinci taksit" },
  { ay: 11, gun: 30, ad: "Çevre Temizlik Vergisi 2. Taksit", kategori: "Vergi", periyot: "Yıllık", not: "2026 ikinci taksit" },
  { ay: 11, gun: 30, ad: "Veraset ve İntikal Vergisi 2. Taksit", kategori: "Vergi", periyot: "Yıllık", not: "2026 ikinci taksit" },
  ...aylikSet(12), ...EDEFTER(12, "Ağustos 2026"),
  // Aralık
  { ay: 12, gun: 2, ad: "GEKAP Beyannamesi (Temmuz-Ağustos-Eylül)", kategori: "Vergi", periyot: "3 Aylık", not: "3. dönem — 31 Ekim 2026 Cumartesi olduğundan ilk iş günü." },
  ...aylikSet(12),
];

/** Yalnızca benzersiz kayıtlar (ad+ay+gun bazında). */
export const TAKVIM_UNIQUE: TakvimKaydi[] = (() => {
  const seen = new Set<string>();
  const out: TakvimKaydi[] = [];
  for (const k of TAKVIM_2026) {
    const key = `${k.ay}-${k.gun}-${k.ad}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out.sort((a, b) => a.ay - b.ay || a.gun - b.gun);
})();

/** Son tarih Date nesnesi. */
export function takvimTarih(k: TakvimKaydi): Date {
  return new Date(2026, k.ay - 1, k.gun);
}

export interface TakvimFiltre {
  periyot: "tumu" | "Aylık" | "3 Aylık" | "6 Aylık" | "Yıllık";
}

/** Sırada bekleyenler (bugünden itibaren artan). */
export function takvimSiradaki(filtre: TakvimFiltre, bugun: Date = new Date()): { kayit: TakvimKaydi; tarih: Date; kalanGun: number }[] {
  const today0 = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate());
  return TAKVIM_UNIQUE.map((k) => {
    const tarih = takvimTarih(k);
    const kalanGun = Math.round((tarih.getTime() - today0.getTime()) / 86400000);
    return { kayit: k, tarih, kalanGun };
  })
    .filter((x) => x.kalanGun >= 0)
    .filter((x) => filtre.periyot === "tumu" || x.kayit.periyot === filtre.periyot)
    .sort((a, b) => a.tarih.getTime() - b.tarih.getTime());
}

/** Sıradaki son tarih. */
export function takvimSonraki(filtre: TakvimFiltre, bugun: Date = new Date()): { kayit: TakvimKaydi; tarih: Date; kalanGun: number } | null {
  const liste = takvimSiradaki(filtre, bugun);
  return liste[0] ?? null;
}

/** Son tarih tatile denk gelirse ilk iş gününe kaydır (basit: Pazar→Pazartesi, Cumartesi→Pazartesi). */
export function sonrakiIsGunu(d: Date): Date {
  const day = d.getDay();
  if (day === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  if (day === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2);
  return d;
}
