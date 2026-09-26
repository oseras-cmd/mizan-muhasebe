/**
 * 2026 YILI GÜNCEL PARAMETRELER
 * Kaynaklar: ÇSGB, GİB tebliğleri, TCMB
 * - Kıdem tavanı: 01.01.2026–30.06.2026: 64.948,77 TL · 01.07.2026–31.12.2026: 73.729,87 TL
 * - Brüt asgari ücret 2026: 33.030,00 TL (günlük 1.101,00 TL), net 28.075,50 TL
 * - TCMB kısa vadeli avans faiz oranı (20.12.2025'ten itibaren): %39,75
 * - Damga vergisi 2026 maktu: bilanço 616,30 TL, gelir tablosu 294,20 TL (71 seri no'lu DV GT)
 */

export const PARAMS_2026 = {
  // Kıdem tazminatı
  KIDEM_TAVAN_1: 64948.77, // 01.01.2026 – 30.06.2026
  KIDEM_TAVAN_2: 73729.87, // 01.07.2026 – 31.12.2026

  // Asgari ücret
  ASGARI_UCRET_BRUT: 33030,
  ASGARI_UCRET_NET: 28075.5,
  ASGARI_UCRET_GUNLUK_BRUT: 1101,

  // SGK oranları
  SGK_ISCI: 0.14,
  SGK_ISVEREN: 0.205,
  SGK_ISVEREN_TESVIK: 0.155, // 5 puanlık indirim
  ISSIZLIK_ISCI: 0.01,
  ISSIZLIK_ISVEREN: 0.02,
  GV_DILIM_1: 0.15, // 1. dilim %15 (dilim simülasyonu basit tutuldu)
  DAMGA_UCRET: 0.00759, // binde 7,59
  DAMGA_KIDEM: 0.00759,

  // SGK tavanı = 7,5 × brüt asgari ücret
  SGK_TAVAN: 33030 * 7.5,

  // Binek oto amortisman sınırı 2026 tahmini (2025: 611.000)
  BINEK_AMORTISMAN_SINIR_2025: 611000,
  BINEK_AMORTISMAN_SINIR_2026: 677000,
  BINEK_KDV_SINIR: 840000,

  // Devlet memuru en yüksek gündelik (harcırah istisnası) — 2026
  DEVLET_GUNDELIK: 900,

  // TCMB
  TCMB_AVANS_ORANI: 39.75, // % (yıllık), 20.12.2025'ten itibaren

  // Damga vergisi oranları (binde)
  DV_SOZLESME: 9.48,
  DV_IHALE: 5.69,
  DV_BORDRO: 7.59,
  DV_KEFALET: 9.48,
  DV_MAKTU_BILANCO: 616.3,
  DV_MAKTU_GELIR_TABLOSU: 294.2,

  // Serbest meslek makbuzu
  SMM_GV_ORANI: 0.2,
  SMM_KDV_ORANI: 0.2,
} as const;

/** Kıdem tazminatı tavanı — fesih/bordro tarihine göre doğru yarıyılı seçer. */
/** Kıdem tazminatı tavanı — fesih/bordro tarihine göre doğru yarıyılı seçer. */
export function kidemTavani(fesihTarihi: string | Date): number {
  const d = typeof fesihTarihi === "string" ? new Date(`${fesihTarihi}T00:00:00`) : fesihTarihi;
  if (Number.isNaN(d.getTime())) return PARAMS_2026.KIDEM_TAVAN_2;
  const yil = d.getFullYear();
  if (yil > 2026) return PARAMS_2026.KIDEM_TAVAN_2;
  if (yil < 2026) return PARAMS_2026.KIDEM_TAVAN_1;
  return d.getMonth() < 6 ? PARAMS_2026.KIDEM_TAVAN_1 : PARAMS_2026.KIDEM_TAVAN_2;
}
