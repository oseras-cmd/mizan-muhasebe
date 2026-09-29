/**
 * 2026 Gelir Vergisi Dilim hesaplama motoru.
 *
 * Kaynak: 31.12.2025 tarihli Resmî Gazete (Sayı: 33124 - 5. Mükerrer),
 * Gelir Vergisi Genel Tebliği (Seri No: 332) — GVK m.103 tarifesi.
 *
 * 2026'da ilk iki dilim herkes için aynıdır; 3. dilimden itibaren ücret
 * gelirleri ile ücret dışı gelirler farklılaşır:
 *  - Ücret:      190.000 → 400.000 → 1.500.000 → 5.300.000
 *  - Ücret dışı: 190.000 → 400.000 → 1.000.000 → 5.300.000
 */

export interface VergiDilimi {
  /** Dilimin alt sınırı (dahil) */
  alt: number;
  /** Dilimin üst sınırı (hariç); son dilimde null = sınırsız */
  ust: number | null;
  /** Vergi oranı (0.15, 0.20 …) */
  oran: number;
}

/** 2026 ücret gelirleri tarifesi (GVK m.103, 332 no.lu tebliğ) */
export const DILIMLER_2026_UCRET: VergiDilimi[] = [
  { alt: 0, ust: 190_000, oran: 0.15 },
  { alt: 190_000, ust: 400_000, oran: 0.2 },
  { alt: 400_000, ust: 1_500_000, oran: 0.27 },
  { alt: 1_500_000, ust: 5_300_000, oran: 0.35 },
  { alt: 5_300_000, ust: null, oran: 0.4 },
];

/** 2026 ücret dışı gelirler tarifesi (kira, serbest meslek vb.) */
export const DILIMLER_2026_UCRET_DISI: VergiDilimi[] = [
  { alt: 0, ust: 190_000, oran: 0.15 },
  { alt: 190_000, ust: 400_000, oran: 0.2 },
  { alt: 400_000, ust: 1_000_000, oran: 0.27 },
  { alt: 1_000_000, ust: 5_300_000, oran: 0.35 },
  { alt: 5_300_000, ust: null, oran: 0.4 },
];

export type GelirTuru = "ucret" | "ucretDisi";

export function dilimleriGetir(tur: GelirTuru): VergiDilimi[] {
  return tur === "ucret" ? DILIMLER_2026_UCRET : DILIMLER_2026_UCRET_DISI;
}

export interface DilimKalem {
  /** Dilim sırası (1 tabanlı) */
  sira: number;
  /** Bu dilimde vergilenen matrah parçası */
  matrah: number;
  oran: number;
  vergi: number;
}

export interface YillikSonuc {
  /** Toplam yıllık matrah */
  matrah: number;
  /** Dilim dilim vergi dağılımı */
  kalemler: DilimKalem[];
  /** Toplam gelir vergisi */
  toplamVergi: number;
  /** Efektif oran (toplamVergi / matrah, 0–1) */
  efektifOran: number;
  /** Matrahın içinde kaldığı dilimin sırası (1 tabanlı) */
  sonDilim: number;
}

/** Yıllık matrahı 2026 tarifesi üzerinden artan oranlı hesaplar. */
export function hesaplaYillik(matrah: number, tur: GelirTuru): YillikSonuc {
  const dilimler = dilimleriGetir(tur);
  const kalemler: DilimKalem[] = [];
  let kalan = Math.max(0, matrah);
  let toplamVergi = 0;
  let sonDilim = 1;

  for (let i = 0; i < dilimler.length && kalan > 0.005; i++) {
    const d = dilimler[i];
    const genislik = d.ust === null ? kalan : Math.min(kalan, d.ust - d.alt);
    const vergi = genislik * d.oran;
    kalemler.push({ sira: i + 1, matrah: genislik, oran: d.oran, vergi });
    toplamVergi += vergi;
    kalan -= genislik;
    sonDilim = i + 1;
  }

  const m = Math.max(0, matrah);
  return {
    matrah: m,
    kalemler,
    toplamVergi,
    efektifOran: m > 0 ? toplamVergi / m : 0,
    sonDilim,
  };
}

/* ─────────────────── Aylık kümülatif simülasyon (dilim atlama) ─────────────────── */

export interface AyDetay {
  /** 1 = Ocak … 12 = Aralık */
  ay: number;
  brüt: number;
  /** Bu ayın GV matrahı */
  matrah: number;
  /** Yıl başından bu aya kadar kümülatif matrah */
  kumMatrah: number;
  /** Bu ay kesilen gelir vergisi */
  gv: number;
  /** Bu ay kesilen damga vergisi (binde 7,59) */
  damga: number;
  /** Bu ayın matrahının içinde bulunduğu dilim */
  dilim: number;
  /** Bu ayda bir üst dilime geçildi mi */
  atladi: boolean;
  net: number;
  isverenMaliyet: number;
}

export interface AylikGirdi {
  /** Aylık brüt maaş (TL) */
  aylikBrut: number;
  /** Hangi aydan itibaren çalışma başlıyor (1–12) */
  baslangicAyi: number;
  /** Aylık engelli indirimi (TL, matraftan düşülür) */
  engelliIndirimi: number;
  /** Yüzde olarak zam oranı (ör. 30 = %30) */
  zamOrani: number;
  /** Zamun uygulandığı ay (1–12) */
  zamAyi: number;
  /** Yıllık toplam ikramiye/prim (brüt TL); verilen aylara eşit bölünür */
  ikramiye: number;
  /** İkramiyenin ödendiği aylar (1–12) */
  ikramiyeAylari: number[];
  /** Aylık şahıs sigorta primi (matraftan indirilir, GVK 63/3 sınırı gösterge amaçlıdır) */
  sigortaPrimi: number;
  /** Aylık sendika aidatı (matraftan indirilir) */
  sendikaAidati: number;
  /** Asgari ücret GV+damga istisnası uygula (2025+ gerçek bordro uygulaması) */
  asgariIstisna: boolean;
  gelirTuru: GelirTuru;
}

/** SGK işçi payı %14 + işsizlik %1 */
const SGK_ISCI_ORAN = 0.15;
/** Damga vergisi oranı (binde 7,59) */
const DAMGA_ORAN = 0.00759;
/** SGK prime esas kazanç tavanı — aylık (2026) */
export const SGK_TAVAN_AYLIK = 297_270;
/** 2026 aylık brüt asgari ücret */
export const ASGARI_UCRET_BRUT = 33_030;
/** Asgari ücret GV istisnası: asgari ücretin GV matrahı
 *  (brüt asgari − SGK işçi payı %14 − işsizlik %1). GVK Ek Madde uyarınca
 *  ücret gelirinin asgari ücrete isabet eden kısmı 2025'ten beri GV'den müstesnadır. */
export const ASGARI_UCRET_ISTISNA = ASGARI_UCRET_BRUT * (1 - SGK_ISCI_ORAN); // 28.075,50

/** Aylık kümülatif vergi simülasyonu çalıştırır. */
export function simuleEt(g: AylikGirdi): AyDetay[] {
  const dilimler = dilimleriGetir(g.gelirTuru);
  const detay: AyDetay[] = [];
  let kumMatrah = 0;
  let oncekiDilim = 1;
  // SGK tavanı aylık uygulanır (yıllık birikimli değildir; her ay ayrı)
  const ikramiyeAyBaglanti = new Set(g.ikramiyeAylari);
  const ikramiyeAylik =
    g.ikramiye > 0 && ikramiyeAyBaglanti.size > 0 ? g.ikramiye / ikramiyeAyBaglanti.size : 0;
  const istisna = g.asgariIstisna ? ASGARI_UCRET_ISTISNA : 0;

  for (let ay = 1; ay <= 12; ay++) {
    if (ay < g.baslangicAyi) {
      detay.push({
        ay,
        brüt: 0,
        matrah: 0,
        kumMatrah,
        gv: 0,
        damga: 0,
        dilim: oncekiDilim,
        atladi: false,
        net: 0,
        isverenMaliyet: 0,
      });
      continue;
    }

    const zamUygula = g.zamOrani > 0 && g.zamAyi > 0 && ay >= g.zamAyi;
    const carpan = zamUygula ? 1 + g.zamOrani / 100 : 1;
    const brüt = g.aylikBrut * carpan + ikramiyeAylik * (ikramiyeAyBaglanti.has(ay) ? 1 : 0);

    // SGK primi tavanlı
    const sgkMatrah = Math.min(brüt, SGK_TAVAN_AYLIK);
    const sgkIsci = sgkMatrah * SGK_ISCI_ORAN;

    // GV matrahı = brüt − SGK işçi − engelli ind. − sigorta − sendika
    const hamMatrah = Math.max(
      0,
      brüt - sgkIsci - g.engelliIndirimi - g.sigortaPrimi - g.sendikaAidati,
    );
    // Asgari ücret istisnası: asgari ücrete isabet eden kısım vergiden muaf
    const istisnaTutar = Math.min(istisna, hamMatrah);
    const matrah = hamMatrah - istisnaTutar;
    const oncekiKum = kumMatrah;
    kumMatrah += matrah;

    // Kümülatif matrah üzerinden bu ayın vergisi:
    // vergi(kum) − vergi(önceki kümülatif)
    const vergiHesapla = (m: number): { toplam: number; dilim: number } => {
      let kalan = Math.max(0, m);
      let toplam = 0;
      let dilim = 1;
      for (let i = 0; i < dilimler.length && kalan > 0.005; i++) {
        const d = dilimler[i];
        const genislik = d.ust === null ? kalan : Math.min(kalan, d.ust - d.alt);
        toplam += genislik * d.oran;
        kalan -= genislik;
        dilim = i + 1;
      }
      return { toplam, dilim };
    };

    const simdiki = vergiHesapla(kumMatrah);
    const onceki = vergiHesapla(oncekiKum);
    const gv = Math.max(0, simdiki.toplam - onceki.toplam);

    // Damga vergisi: asgari ücrete isabet eden kısım istisna
    const damgaMatrahi = g.asgariIstisna ? Math.max(0, brüt - ASGARI_UCRET_BRUT) : brüt;
    const damga = damgaMatrahi * DAMGA_ORAN;

    const net = brüt - sgkIsci - gv - damga;
    // İşveren maliyeti: brüt + SGK işveren %20,5 (SGK %19,5 + işsizlik %2 — tavanlı) + damga
    const sgkIsveren = sgkMatrah * 0.215;
    const isverenMaliyet = brüt + sgkIsveren + damga;

    detay.push({
      ay,
      brüt,
      matrah,
      kumMatrah,
      gv,
      damga,
      dilim: simdiki.dilim,
      atladi: simdiki.dilim > oncekiDilim,
      net,
      isverenMaliyet,
    });
    oncekiDilim = simdiki.dilim;
  }

  return detay;
}

export interface YilSonuOzet {
  yillikBrut: number;
  toplamMatrah: number;
  toplamIstisna: number;
  toplamGv: number;
  toplamDamga: number;
  efektifOran: number;
  toplamSgkIsci: number;
  yillikNet: number;
  isverenMaliyet: number;
}

export function yilOzeti(detay: AyDetay[]): YilSonuOzet {
  const toplam = (fn: (d: AyDetay) => number) => detay.reduce((s, d) => s + fn(d), 0);
  const yillikBrut = toplam((d) => d.brüt);
  const toplamMatrah = toplam((d) => d.matrah);
  const toplamGv = toplam((d) => d.gv);
  const toplamDamga = toplam((d) => d.damga);
  const toplamSgkIsci = toplam(
    (d) => Math.min(d.brüt, SGK_TAVAN_AYLIK) * SGK_ISCI_ORAN,
  );
  return {
    yillikBrut,
    toplamMatrah,
    toplamIstisna: yillikBrut - toplamMatrah - toplamSgkIsci,
    toplamGv,
    toplamDamga,
    efektifOran: toplamMatrah > 0 ? toplamGv / toplamMatrah : 0,
    toplamSgkIsci,
    yillikNet: toplam((d) => d.net),
    isverenMaliyet: toplam((d) => d.isverenMaliyet),
  };
}

/** Hedef net maaşa ulaşmak için gereken ilk ay brütünü iki nokta aramasıyla bulur. */
export function gerekliBrut(
  hedefNet: number,
  g: Omit<AylikGirdi, "aylikBrut">,
): number | null {
  if (hedefNet <= 0) return null;
  let lo = 0;
  let hi = Math.max(10_000, hedefNet * 4);
  // Brüt arttıkça net artar (artan oranlı vergi olsa da tekilde artış pozitif)
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const detay = simuleEt({ ...g, aylikBrut: mid });
    const ilkAy = detay.find((d) => d.ay >= g.baslangicAyi);
    const net = ilkAy?.net ?? 0;
    if (Math.abs(net - hedefNet) < 0.5) return mid;
    if (net < hedefNet) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
