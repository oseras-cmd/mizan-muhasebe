/**
 * 2026 Maaş (brüt ↔ net) bordro motoru — verginet tarzı 12 aylık döküm.
 *
 * Vergi matrahı, kümülatif dilim atlama ve asgari ücret istisnası için
 * `gelirVergisiDilim` motorundaki `simuleEt`/`gerekliBrut` kullanılır;
 * bu modül yalnızca SGK kırılımını (işçi/işsizlik × işveren) ve verginet
 * tablosunun kolonlarını üretir.
 *
 * Kaynaklar (2026):
 *  - SGK İşveren Prim Oranları (sgk.gov.tr, 13.01.2026): işveren toplam
 *    %23,75 = SGK %21,75 (MYÖ %12 + GSS %7,5 + kısa vadeli %2,25) +
 *    işsizlik %2; işçi toplam %15 = SGK %14 + işsizlik %1.
 *  - 5 puanlık indirim (imalat vb. teşvik): işveren SGK %16,75.
 *  - Damga vergisi binde 7,59; asgari ücretin GV + damga istisnası (GVK ek md.).
 */

import {
  SGK_TAVAN_AYLIK,
  gerekliBrut,
  simuleEt,
  type AylikGirdi,
} from "./gelirVergisiDilim";

/** İşçi SGK payı (malullük-yaşlılık + genel sağlık), %14 */
export const ISCI_SGK_ORAN = 0.14;
/** İşçi işsizlik payı, %1 */
export const ISCI_ISSIZLIK_ORAN = 0.01;
/** İşveren SGK payı normal, %21,75 */
export const ISVEREN_SGK_ORAN = 0.2175;
/** İşveren SGK payı 5 puan indirimli, %16,75 */
export const ISVEREN_SGK_INDIRIMLI_ORAN = 0.1675;
/** İşveren işsizlik payı, %2 */
export const ISVEREN_ISSIZLIK_ORAN = 0.02;

export interface MaasSecenek {
  /** Asgari ücret GV + damga istisnası uygulansın mı */
  asgariIstisna: boolean;
  /** 5 puanlık SGK prim indirimi (imalat vb.) uygulansın mı */
  indirimliPrim: boolean;
}

export interface MaasAySatir {
  /** 1 = Ocak … 12 = Aralık */
  ay: number;
  brut: number;
  /** İşçi SGK %14 (tavanlı) */
  sskIsci: number;
  /** İşçi işsizlik %1 (tavanlı) */
  issizlikIsci: number;
  /** Bu ay kesilen gelir vergisi */
  gv: number;
  /** Bu ay kesilen damga vergisi (binde 7,59) */
  damga: number;
  /** Yıl başından bu aya kadar kümülatif GV matrahı */
  kumMatrah: number;
  /** Bu ayın net maaşı */
  net: number;
  /** İşveren SGK %21,75 — %16,75 (indirimli), tavanlı */
  sskIsveren: number;
  /** İşveren işsizlik %2, tavanlı */
  issizlikIsveren: number;
  /** Brüt + işveren SGK + işveren işsizlik */
  toplamMaliyet: number;
}

export interface MaasToplam {
  brut: number;
  sskIsci: number;
  issizlikIsci: number;
  gv: number;
  damga: number;
  net: number;
  sskIsveren: number;
  issizlikIsveren: number;
  toplamMaliyet: number;
}

export interface MaasSonuc {
  satirlar: MaasAySatir[];
  toplam: MaasToplam;
}

function girdiOlustur(s: MaasSecenek): Omit<AylikGirdi, "aylikBrut"> {
  return {
    baslangicAyi: 1,
    engelliIndirimi: 0,
    zamOrani: 0,
    zamAyi: 1,
    ikramiye: 0,
    ikramiyeAylari: [],
    sigortaPrimi: 0,
    sendikaAidati: 0,
    asgariIstisna: s.asgariIstisna,
    gelirTuru: "ucret",
  };
}

/** Aylık brüttün 12 aylık bordro dökümünü üretir (kümülatif vergi dilimiyle). */
export function hesaplaMaas(aylikBrut: number, s: MaasSecenek): MaasSonuc {
  const detay = simuleEt({ ...girdiOlustur(s), aylikBrut: Math.max(0, aylikBrut) });
  const isverenSgkOran = s.indirimliPrim ? ISVEREN_SGK_INDIRIMLI_ORAN : ISVEREN_SGK_ORAN;

  const satirlar: MaasAySatir[] = detay.map((d) => {
    const sgkMatrah = Math.min(d.brüt, SGK_TAVAN_AYLIK);
    const sskIsci = sgkMatrah * ISCI_SGK_ORAN;
    const issizlikIsci = sgkMatrah * ISCI_ISSIZLIK_ORAN;
    const sskIsveren = sgkMatrah * isverenSgkOran;
    const issizlikIsveren = sgkMatrah * ISVEREN_ISSIZLIK_ORAN;
    return {
      ay: d.ay,
      brut: d.brüt,
      sskIsci,
      issizlikIsci,
      gv: d.gv,
      damga: d.damga,
      kumMatrah: d.kumMatrah,
      net: d.net,
      sskIsveren,
      issizlikIsveren,
      toplamMaliyet: d.brüt + sskIsveren + issizlikIsveren,
    };
  });

  const toplam: MaasToplam = satirlar.reduce(
    (acc, r) => ({
      brut: acc.brut + r.brut,
      sskIsci: acc.sskIsci + r.sskIsci,
      issizlikIsci: acc.issizlikIsci + r.issizlikIsci,
      gv: acc.gv + r.gv,
      damga: acc.damga + r.damga,
      net: acc.net + r.net,
      sskIsveren: acc.sskIsveren + r.sskIsveren,
      issizlikIsveren: acc.issizlikIsveren + r.issizlikIsveren,
      toplamMaliyet: acc.toplamMaliyet + r.toplamMaliyet,
    }),
    {
      brut: 0,
      sskIsci: 0,
      issizlikIsci: 0,
      gv: 0,
      damga: 0,
      net: 0,
      sskIsveren: 0,
      issizlikIsveren: 0,
      toplamMaliyet: 0,
    },
  );

  return { satirlar, toplam };
}

/** Netten brüte: hedef aylık nete ulaşmak için gereken brütü bulur. */
export function gerekliMaasBrut(hedefNet: number, s: MaasSecenek): number | null {
  if (hedefNet <= 0) return null;
  return gerekliBrut(hedefNet, girdiOlustur(s));
}
