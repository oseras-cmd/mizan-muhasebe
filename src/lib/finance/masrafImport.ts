import * as XLSX from "xlsx";

/**
 * Masraf Listesi Excel dosyasını (GÜNCEL MASRAF LİSTESİ.xlsx) içe aktarma.
 *
 * Dosya formatı: her sayfada "MASRAF LİSTESİ" başlığı, altında başlık satırı
 * (S.N., BEL. AL. FİRMA … V.N., BELGENİN ALINDIĞI FİRMA …, MASRAF TÜRÜ, …)
 * ve veri satırları. "VERİ BANKASI" sayfası kaynak listedir, içe aktarılmaz.
 */

/** İçe aktarılan tek bir masraf satırı (kimlik hariç — kimlik uygulama verir). */
export interface MasrafSatiri {
  belgeTipi: string;
  masrafAdi: string;
  masrafTuru: string;
  faturaFisNo: string;
  belgeTarihi: string; // yyyy-mm-dd
  kdvOrani: number;
  fisToplam: number;
  odemeTuru: string;
  masrafMerkez: string;
  sirket: string;
  fisFirma: string;
  vergiNo: string;
  aracPlaka: string;
  kkeg: number;
}

export interface MasrafSayfasi {
  ad: string;
  satirlar: MasrafSatiri[];
}

/** Başlık hücrelerini karşılaştırmak için:normalleştir (büyük harf, boşluksuz). */
function norm(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, "");
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Excel tarih serisi (ör. 46099) → yyyy-mm-dd */
function serialToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Tarih hücresini yyyy-mm-dd biçimine çevir; okunamazsa boş bırak. */
function toISODate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 1000 && value < 200000) {
    return serialToISO(value);
  }
  if (typeof value === "string") {
    const s = value.trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
    if (m) {
      const pad = (x: string) => x.padStart(2, "0");
      return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    }
  }
  return "";
}

type Kolonlar = Partial<{
  sn: number;
  vergiNo: number;
  fisFirma: number;
  masrafTuru: number;
  faturaFisNo: number;
  belgeTarihi: number;
  kdvOrani: number;
  fisToplam: number;
  odemeTuru: number;
  masrafMerkez: number;
  aracPlaka: number;
  kkeg: number;
}>;

/** Başlık satırındaki hücreleri sütun eşlemesine çevir. */
function basligiEslestir(header: unknown[]): Kolonlar | null {
  const k: Kolonlar = {};
  let turVar = false;
  header.forEach((cell, i) => {
    const n = norm(cell);
    if (!n) return;
    // Sıralama önemli: daha özel başlıklar önce kontrol edilir.
    if (n.includes("MASRAFTÜRÜ")) {
      k.masrafTuru = i;
      turVar = true;
    } else if (n.includes("V.N.")) {
      k.vergiNo = i;
    } else if (n.includes("BELGENİNALINDIĞI")) {
      k.fisFirma = i;
    } else if (n.includes("FATURA") || n.includes("FİŞNO")) {
      k.faturaFisNo = i;
    } else if (n.includes("BELGETARİHİ")) {
      k.belgeTarihi = i;
    } else if (n.includes("KDVORANI")) {
      k.kdvOrani = i;
    } else if (n.includes("FİŞGENELTOPLAMI")) {
      k.fisToplam = i;
    } else if (n.includes("ÖDEMETÜRÜ")) {
      k.odemeTuru = i;
    } else if (n.includes("MASRAFMERKEZİ")) {
      k.masrafMerkez = i;
    } else if (n.includes("PLAKA")) {
      k.aracPlaka = i;
    } else if (n.includes("KKEG")) {
      k.kkeg = i;
    } else if (n === "S.N.") {
      k.sn = i;
    }
  });
  return turVar ? k : null;
}

/** Firma adı: satıcı adı; yoksa masraf adı olarak kullanılır. */
function satiriCevir(row: unknown[], k: Kolonlar): MasrafSatiri | null {
  const get = (idx?: number) => {
    if (idx === undefined) return null;
    const v = row[idx];
    return v === null || v === undefined || v === "" ? null : v;
  };

  const turRaw = get(k.masrafTuru);
  const fisToplam = toNumber(get(k.fisToplam));
  const tur = turRaw ? String(turRaw).trim() : "";
  // Boş şablon satırlarını atla: ne türü ne tutarı olan satır işe yaramaz.
  if (!tur && fisToplam <= 0) return null;

  const fisFirma = get(k.fisFirma) ? String(get(k.fisFirma)).trim() : "";
  const merkezRaw = get(k.masrafMerkez) ? String(get(k.masrafMerkez)).trim() : "";

  // Excel'de "masraf merkezi" sütunu firma adıyla doldurulmuş (MESKUR/FERLA).
  const merkezN = merkezRaw.toLocaleUpperCase("tr-TR");
  let sirket = "";
  let masrafMerkez = merkezRaw;
  if (merkezN.includes("MESKUR")) {
    sirket = "Meskur";
    masrafMerkez = "";
  } else if (merkezN.includes("FERLA")) {
    sirket = "Ferla";
    masrafMerkez = "";
  }

  const kdv = toNumber(get(k.kdvOrani));
  const kkeg = Math.max(0, toNumber(get(k.kkeg)));

  return {
    belgeTipi: "Fatura",
    masrafAdi: fisFirma || tur || "İçe aktarılan belge",
    masrafTuru: tur || "Diğer",
    faturaFisNo: get(k.faturaFisNo) !== null ? String(get(k.faturaFisNo)).trim() : "",
    belgeTarihi: toISODate(get(k.belgeTarihi)),
    kdvOrani: Number.isFinite(kdv) && kdv >= 0 && kdv <= 100 ? Math.round(kdv) : 0,
    fisToplam,
    odemeTuru: get(k.odemeTuru) ? String(get(k.odemeTuru)).trim() : "",
    masrafMerkez,
    sirket,
    fisFirma,
    vergiNo: get(k.vergiNo) !== null ? String(get(k.vergiNo)).trim() : "",
    aracPlaka: get(k.aracPlaka) ? String(get(k.aracPlaka)).trim() : "",
    kkeg,
  };
}

/** Tek bir sayfayı ayrıştır; başlık satırı bulunamazsa boş döner. */
export function masrafSayfasiAyristir(name: string, rows: unknown[][]): MasrafSayfasi {
  if (name.toLocaleUpperCase("tr-TR").includes("VERİ BANKASI")) {
    return { ad: name, satirlar: [] };
  }
  for (let h = 0; h < Math.min(rows.length, 15); h++) {
    const k = basligiEslestir(rows[h] ?? []);
    if (!k) continue;
    const satirlar: MasrafSatiri[] = [];
    for (let r = h + 1; r < rows.length; r++) {
      const satir = satiriCevir(rows[r] ?? [], k);
      if (satir) satirlar.push(satir);
    }
    return { ad: name, satirlar };
  }
  return { ad: name, satirlar: [] };
}

/** Masraf Excel dosyasını okuyup sayfalarıyla birlikte ayrıştırır. */
export function masrafDosyasiAyristir(data: ArrayBuffer): MasrafSayfasi[] {
  const wb = XLSX.read(data, { cellDates: true });
  const sonuc: MasrafSayfasi[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
      raw: true,
    });
    sonuc.push(masrafSayfasiAyristir(name, rows));
  }
  return sonuc;
}
