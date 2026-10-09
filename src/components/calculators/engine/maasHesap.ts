/**
 * 2026 Maaş Hesaplama Motoru — Brütten Nete
 *
 * Verginet mantığına paralel, aylık kümülatif bordro simülasyonu.
 * Her ay için: SSK İşçi, İşsizlik İşçi, Gelir Vergisi, Damga Vergisi,
 * Kümülatif Vergi Matrahı, Net, Asgari Geçim İndirimi,
 * Asgari Ücret GV/Damga İstisnaları, Net Ödenecek, İşveren SSK/İşsizlik, Toplam Maliyet.
 *
 * Parametreler 2026 yılı içindir.
 */

export interface MaasAySonuc {
  ayAdi: string;
  brut: number;
  sgkIsci: number;
  issizlikIsci: number;
  gelirVergisi: number;
  damgaVergisi: number;
  kumVergiMatrah: number;
  net: number;
  asgariGecimIndirimi: number;
  asgariUcretGvIstisna: number;
  asgariUcretDamgaIstisna: number;
  netOdenecek: number;
  sgkIsveren: number;
  issizlikIsveren: number;
  toplamMaliyet: number;
}

export interface MaasSonuc {
  aylar: MaasAySonuc[];
  toplam: Omit<MaasAySonuc, "ayAdi">;
}

export interface MaasGirdi {
  /** Aylık brüt ücret (TL) */
  aylikBrut: number;
  /** İşe başlangıç ayı (1–12, varsayılan 1 = Ocak) */
  baslangicAyi: number;
  /** Yıllık brüt ikramiye/prim (seçili aylara eşit dağıtılır) */
  ikramiye: number;
  /** İkramiyenin ödendiği aylar (1–12) */
  ikramiyeAylari: number[];
  /** Zam oranı (%) — belirtilen aydan itibaren uygulanır */
  zamOrani: number;
  /** Zam uygulanan ay (1–12) */
  zamAyi: number;
  /** Aylık engelli indirimi (TL, matraftan düşülür) */
  engelliIndirimi: number;
  /** Aylık şahıs sigorta primi (TL, matraftan düşülür) */
  sigortaPrimi: number;
  /** Aylık sendika aidatı (TL, matraftan düşülür) */
  sendikaAidati: number;
  /** Asgari ücret GV+damga istisnası uygula */
  asgariIstisna: boolean;
  /** Çocuk sayısı (0–6, asgari geçim indirimi için) */
  cocukSayisi: number;
  /** Medeni durum: bekar veya evli */
  medeniDurum: "bekar" | "evli";
  /** Eş çalışmıyor mu? (evliyse AGİ için) */
  esCalismiyor: boolean;
}

/* ── 2026 Parametreleri ── */

const SGK_ISCI_ORAN = 0.14;
const SGK_ISVEREN_ORAN = 0.205;
const SGK_ISVEREN_INDIRIMLI_ORAN = 0.155; // 5 puan indirim
const ISSIZLIK_ISCI_ORAN = 0.01;
const ISSIZLIK_ISVEREN_ORAN = 0.02;
const DAMGA_ORAN = 0.00759; // binde 7,59

const ASGARI_UCRET_BRUT = 33_030;
const SGK_TAVAN_AYLIK = ASGARI_UCRET_BRUT * 7.5; // 247.725

/** 2026 ücret gelirleri GV tarifesi (GVK m.103) */
const GV_DILIMLERI = [
  { alt: 0, ust: 190_000, oran: 0.15 },
  { alt: 190_000, ust: 400_000, oran: 0.2 },
  { alt: 400_000, ust: 1_500_000, oran: 0.27 },
  { alt: 1_500_000, ust: 5_300_000, oran: 0.35 },
  { alt: 5_300_000, ust: Infinity, oran: 0.4 },
] as const;

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Asgari ücret GV istisnası matrahı = brüt asgari − SGK işçi %14 − işsizlik %1 */
const ASGARI_UCRET_GV_ISTISNA_MATRAH = ASGARI_UCRET_BRUT * (1 - SGK_ISCI_ORAN - ISSIZLIK_ISCI_ORAN); // 28.075,50

/** Asgari ücret damga vergisi istisnası = brüt asgari ücret üzerinden damga */
const ASGARI_UCRET_DAMGA_ISTISNA = ASGARI_UCRET_BRUT * DAMGA_ORAN;

/**
 * 2026 Asgari Geçim İndirimi (AGİ) aylık tutarları.
 * AGİ, gelir vergisinden mahsup edilir; ücret gelirinin asgari ücrete
 * isabet eden kısmının vergi muafiyeti (2025+) nedeniyle pratikte
 * sadece asgari ücretin üzerindeki maaşlarda anlamlıdır.
 *
 * GVK m.32 — 2026 tarifesine göre hesaplanmıştır.
 */
export function hesaplaAGI(
  medeniDurum: "bekar" | "evli",
  cocukSayisi: number,
  esCalismiyor: boolean,
): number {
  // 2026 yılı için AGI katsayıları (yıllık asgari ücretin yıllık GV'sine göre)
  // Bekar: %50, Evli eş çalışmıyor: %50 + eş için %10 ek
  // Çocuk: 1. çocuk %7,5, 2. çocuk %7,5, 3. çocuk %10, 4.+ %5
  // Ancak 2025'ten beri asgari ücret GV muaf olduğu için AGI pratikte uygulanmaz.
  // Burada verginet mantığına uygun olarak hesaplanır ama istisna ile mahsup edilir.
  const yillikAsgari = ASGARI_UCRET_BRUT * 12;
  const yillikGV = hesaplaKumulatifGV(yillikAsgari, true);
  const aylikGV = yillikGV / 12;

  let oran = 0.5; // bekar
  if (medeniDurum === "evli" && esCalismiyor) {
    oran = 0.5 + 0.1; // eş için ek %10
  } else if (medeniDurum === "evli") {
    oran = 0.5;
  }

  const cocuklar = Math.max(0, Math.floor(cocukSayisi));
  let cocukOran = 0;
  for (let i = 0; i < cocuklar; i++) {
    if (i < 2) cocukOran += 0.075;
    else if (i === 2) cocukOran += 0.1;
    else cocukOran += 0.05;
  }

  return aylikGV * (oran + cocukOran);
}

/** Kümülatif matraha göre artan oranlı gelir vergisi hesaplar. */
function hesaplaKumulatifGV(kumMatrah: number, ucret: boolean): number {
  let kalan = Math.max(0, kumMatrah);
  let toplam = 0;
  for (let i = 0; i < GV_DILIMLERI.length && kalan > 0.005; i++) {
    const d = GV_DILIMLERI[i];
    const genislik = d.ust === Infinity ? kalan : Math.min(kalan, d.ust - d.alt);
    toplam += genislik * d.oran;
    kalan -= genislik;
  }
  return toplam;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Brütten nete aylık bordro simülasyonu — 12 ay + toplam. */
export function hesaplaMaas(g: MaasGirdi): MaasSonuc {
  const baslangicAyi = Math.min(12, Math.max(1, Math.round(g.baslangicAyi) || 1));
  const ikramiyeAyleriSet = new Set(g.ikramiyeAylari.filter((a) => a >= 1 && a <= 12));
  const ikramiyeAylik = g.ikramiye > 0 && ikramiyeAyleriSet.size > 0
    ? g.ikramiye / ikramiyeAyleriSet.size
    : 0;

  const agi = hesaplaAGI(g.medeniDurum, g.cocukSayisi, g.esCalismiyor);
  const istisnaGV = g.asgariIstisna ? ASGARI_UCRET_GV_ISTISNA_MATRAH : 0;
  const istisnaDamga = g.asgariIstisna ? ASGARI_UCRET_DAMGA_ISTISNA : 0;

  let kumMatrah = 0;
  const aylar: MaasAySonuc[] = [];

  for (let ay = 1; ay <= 12; ay++) {
    const ayAdi = AY_ADLARI[ay - 1];

    if (ay < baslangicAyi) {
      aylar.push({
        ayAdi,
        brut: 0, sgkIsci: 0, issizlikIsci: 0, gelirVergisi: 0,
        damgaVergisi: 0, kumVergiMatrah: round2(kumMatrah),
        net: 0, asgariGecimIndirimi: 0, asgariUcretGvIstisna: 0,
        asgariUcretDamgaIstisna: 0, netOdenecek: 0,
        sgkIsveren: 0, issizlikIsveren: 0, toplamMaliyet: 0,
      });
      continue;
    }

    // Zam uygulaması
    const zamVar = g.zamOrani > 0 && g.zamAyi > 0 && ay >= g.zamAyi;
    const carpan = zamVar ? 1 + g.zamOrani / 100 : 1;
    const ikramiyeEkle = ikramiyeAyleriSet.has(ay) ? ikramiyeAylik : 0;
    const brut = round2(g.aylikBrut * carpan + ikramiyeEkle);

    // SGK işçi (%14, tavanlı)
    const sgkMatrah = Math.min(brut, SGK_TAVAN_AYLIK);
    const sgkIsci = round2(sgkMatrah * SGK_ISCI_ORAN);
    const issizlikIsci = round2(sgkMatrah * ISSIZLIK_ISCI_ORAN);

    // GV matrahı = brüt − SGK işçi − işsizlik − engelli − sigorta − sendika
    const hamMatrah = Math.max(
      0,
      brut - sgkIsci - issizlikIsci - g.engelliIndirimi - g.sigortaPrimi - g.sendikaAidati,
    );

    // Asgari ücret GV istisnası
    const gvIstisnaTutar = Math.min(istisnaGV, hamMatrah);
    const gvMatrah = Math.max(0, hamMatrah - gvIstisnaTutar);

    const oncekiKum = kumMatrah;
    kumMatrah += gvMatrah;

    // Bu ayın GV'si = vergi(kümülatif) − vergi(önceki kümülatif)
    const gvOnceki = hesaplaKumulatifGV(oncekiKum, true);
    const gvSimdi = hesaplaKumulatifGV(kumMatrah, true);
    let gv = round2(Math.max(0, gvSimdi - gvOnceki));

    // AGİ mahsubu
    const agiMahsup = Math.min(agi, gv);
    gv = round2(gv - agiMahsup);

    // Damga vergisi (asgari ücret istisnası dahil)
    const damgaMatrahi = g.asgariIstisna ? Math.max(0, brut - ASGARI_UCRET_BRUT) : brut;
    const damgaVergisi = round2(damgaMatrahi * DAMGA_ORAN);

    // Net = brüt − SGK işçi − işsizlik − GV − damga
    const net = round2(brut - sgkIsci - issizlikIsci - gv - damgaVergisi);

    // Net ödenecek (AGİ dahilse ekle — pratikte AGİ GV'den düşüldü, net'e yansır)
    const netOdenecek = round2(net + agiMahsup);

    // İşveren maliyeti
    const sgkIsveren = round2(sgkMatrah * SGK_ISVEREN_INDIRIMLI_ORAN); // 5 puan indirimli
    const issizlikIsveren = round2(sgkMatrah * ISSIZLIK_ISVEREN_ORAN);
    const toplamMaliyet = round2(brut + sgkIsveren + issizlikIsveren + damgaVergisi);

    aylar.push({
      ayAdi,
      brut,
      sgkIsci,
      issizlikIsci,
      gelirVergisi: gv,
      damgaVergisi,
      kumVergiMatrah: round2(kumMatrah),
      net,
      asgariGecimIndirimi: round2(agiMahsup),
      asgariUcretGvIstisna: round2(gvIstisnaTutar),
      asgariUcretDamgaIstisna: g.asgariIstisna ? round2(istisnaDamga) : 0,
      netOdenecek,
      sgkIsveren,
      issizlikIsveren,
      toplamMaliyet,
    });
  }

  // Toplam satırı
  const toplamFields: (keyof Omit<MaasAySonuc, "ayAdi">)[] = [
    "brut", "sgkIsci", "issizlikIsci", "gelirVergisi", "damgaVergisi",
    "kumVergiMatrah", "net", "asgariGecimIndirimi", "asgariUcretGvIstisna",
    "asgariUcretDamgaIstisna", "netOdenecek", "sgkIsveren", "issizlikIsveren",
    "toplamMaliyet",
  ];

  const toplam = {} as Omit<MaasAySonuc, "ayAdi">;
  for (const key of toplamFields) {
    if (key === "kumVergiMatrah") {
      toplam[key] = aylar.length > 0 ? aylar[aylar.length - 1].kumVergiMatrah : 0;
    } else {
      toplam[key] = round2(aylar.reduce((s, a) => s + a[key], 0));
    }
  }

  return { aylar, toplam };
}
