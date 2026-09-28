/**
 * Muhasebe Kontrol Asistanı — saf kural motoru.
 *
 * Mizan yorumlamanın (analizMizan) üzerine, kayıtlı fiş/fatura/belge
 * verisini de tarayarak dengesiz fişleri, mükerrer belgeleri,
 * olağandışı tutarları ve eksik kayıtları tespit eder.
 *
 * ÖNEMLİ: Motor yalnızca BULGU ve ÖNERİ üretir; hiçbir finansal kaydı
 * değiştirmez, silmez veya oluşturmaz.
 */
import type {
  Account,
  Contact,
  Invoice,
  StoredDocument,
  Transaction,
  Transfer,
} from "@/lib/finance/types";
import { analizMizan, type MizanSatir } from "./calcEngine";

export type BulguKategori =
  | "dengesiz"
  | "mukerrer"
  | "olaganDisi"
  | "eksik";

export type BulguSeviye = "kritik" | "uyari" | "bilgi";

export interface KontrolBulgu {
  kategori: BulguKategori;
  seviye: BulguSeviye;
  baslik: string;
  detay: string;
  oneri: string;
  /** Bulgu birden fazla kaydı kapsıyorsa kayıt sayısı */
  adet?: number;
}

export interface KontrolGirdi {
  transactions: Transaction[];
  invoices: Invoice[];
  documents: StoredDocument[];
  transfers: Transfer[];
  accounts: Account[];
  contacts: Contact[];
  /** Yüklü mizan satırları (opsiyonel — yoksa mizan kontrolleri atlanır) */
  mizan?: MizanSatir[];
}

export const KATEGORI_ETIKET: Record<BulguKategori, string> = {
  dengesiz: "Dengesiz Fiş",
  mukerrer: "Mükerrer Belge",
  olaganDisi: "Olağandışı Tutar",
  eksik: "Eksik Kayıt",
};

export const SEVIYE_ETIKET: Record<BulguSeviye, string> = {
  kritik: "Kritik",
  uyari: "Uyarı",
  bilgi: "Bilgi",
};

const SEVIYE_SIRA: Record<BulguSeviye, number> = { kritik: 0, uyari: 1, bilgi: 2 };
const KATEGORI_SIRA: Record<BulguKategori, number> = {
  dengesiz: 0,
  mukerrer: 1,
  olaganDisi: 2,
  eksik: 3,
};

/** Her kuraldan üretilecek en fazla bulgu sayısı (listeyi boğmamak için). */
const KURAL_LIMITI = 8;

function fmt(v: number): string {
  return v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Metni karşılaştırma için normalize eder (mükerrer tespiti). */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

function gecerliTarih(t: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(t);
}

/** Sayısal diziyi çeyreklerine ayırır (IQR için). */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next !== undefined
    ? sorted[base] + rest * (next - sorted[base])
    : sorted[base];
}

export function kontrolAsistani(g: KontrolGirdi): KontrolBulgu[] {
  const bulgular: KontrolBulgu[] = [];
  const ekle = (b: KontrolBulgu) => bulgular.push(b);

  /* ---------------- Mizan yorumlama (yüklendiyse) ---------------- */
  const mizanSatirlari = (g.mizan ?? []).filter((r) => r.hesap.trim() !== "");
  if (mizanSatirlari.length > 0) {
    const m = analizMizan(mizanSatirlari);

    if (!m.dengeliMi) {
      const fark = Math.abs(m.toplamBorcToplam - m.toplamAlacakToplam);
      ekle({
        kategori: "dengesiz",
        seviye: "kritik",
        baslik: "Mizan borç/alacak dengesiz",
        detay: `Borç toplamı ${fmt(m.toplamBorcToplam)} TL, alacak toplamı ${fmt(
          m.toplamAlacakToplam,
        )} TL — fark ${fmt(fark)} TL.`,
        oneri:
          "Borç ve alacak toplamları eşitlenene kadar mizanı gözden geçirin; kayıp veya çift girilmiş fiş olabilir.",
      });
    }

    if (m.tersBakiye.length > 0) {
      const ilk = m.tersBakiye.slice(0, KURAL_LIMITI);
      ekle({
        kategori: "dengesiz",
        seviye: "uyari",
        baslik: "Ters bakiye veren hesaplar",
        detay: ilk
          .map((u) => `${u.hesap} ${u.ad ? `(${u.ad})` : ""}: ${u.detay}`)
          .join(" · "),
        oneri:
          "Hesap niteliğine aykırı bakiyeler genelde yanlış hesap kodundan veya eksik mahsup kaydından doğar; ilgili fişleri kontrol edin.",
        adet: m.tersBakiye.length,
      });
    }

    if (m.olaganDisi.length > 0) {
      const ilk = m.olaganDisi.slice(0, KURAL_LIMITI);
      ekle({
        kategori: "olaganDisi",
        seviye: m.olaganDisi.some((u) => u.seviye === "yuksek") ? "uyari" : "bilgi",
        baslik: "Mizanda olağandışı hesap hareketleri",
        detay: ilk
          .map((u) => `${u.hesap} ${u.ad ? `(${u.ad})` : ""}: ${u.detay}`)
          .join(" · "),
        oneri:
          "Olağandışı bakiyeleri destekleyici belgelerle (fatura, makbuz) karşılaştırın; dönem sonu kapanışlarını doğrulayın.",
        adet: m.olaganDisi.length,
      });
    }

    if (m.riskli.length > 0) {
      const ilk = m.riskli.slice(0, KURAL_LIMITI);
      ekle({
        kategori: "olaganDisi",
        seviye: "uyari",
        baslik: "Vergi incelemesi riski taşıyan hesaplar",
        detay: ilk
          .map((u) => `${u.hesap} ${u.ad ? `(${u.ad})` : ""}: ${u.detay}`)
          .join(" · "),
        oneri:
          "131/231 ortaklar, 331 ortaklara borçlar ve 180/280 tahakkuk hesapları incelemede öncelikle incelenir; bakiyeleri belgeleyin.",
        adet: m.riskli.length,
      });
    }

    for (const k of m.kdvKontroller) {
      if (k.durum !== "uyari") continue;
      ekle({
        kategori: "dengesiz",
        seviye: "uyari",
        baslik: `KDV uyumsuzluğu — ${k.kontrol}`,
        detay: k.aciklama,
        oneri:
          "Mizandaki KDV hesaplarını dönem beyannamesiyle mutabıklaştırın; aktarımlar eksik kaldıysa düzeltin.",
      });
    }
  } else {
    ekle({
      kategori: "dengesiz",
      seviye: "bilgi",
      baslik: "Mizan yüklenmedi",
      detay:
        "Mizan Excel'i yüklenmediği için mizan bazlı dengesizlik ve KDV kontrolleri çalıştırılmadı.",
      oneri: "Hesaplama sayfasındaki Veri Girişi sekmesinden mizan dosyanızı yükleyin.",
    });
  }

  /* ---------------- Dengesiz / tutarsız fişler ---------------- */
  const hesapIds = new Set(g.accounts.map((a) => a.id));
  const faturaById = new Map(g.invoices.map((f) => [f.id, f]));
  const faturaNoGroups = new Map<string, Invoice[]>();
  for (const f of g.invoices) {
    const key = normalize(f.invoiceNo);
    if (!key) continue;
    faturaNoGroups.set(key, [...(faturaNoGroups.get(key) ?? []), f]);
  }

  const gecersizTutar = g.transactions.filter(
    (t) => !Number.isFinite(t.amount) || t.amount <= 0,
  );
  if (gecersizTutar.length > 0) {
    ekle({
      kategori: "dengesiz",
      seviye: "kritik",
      baslik: "Geçersiz tutarlı fişler",
      detay: gecersizTutar
        .slice(0, KURAL_LIMITI)
        .map((t) => `${t.date} · ${t.description} · ${fmt(t.amount)}`)
        .join(" · "),
      oneri:
        "Sıfır veya negatif tutarlı kayıtlar mizanda bozukluk yaratır; kaydı düzeltin ya da iade kaydı olarak yeniden girin.",
      adet: gecersizTutar.length,
    });
  }

  const tarihHatali = g.transactions.filter((t) => !gecerliTarih(t.date));
  if (tarihHatali.length > 0) {
    ekle({
      kategori: "dengesiz",
      seviye: "uyari",
      baslik: "Geçersiz tarihli fişler",
      detay: tarihHatali
        .slice(0, KURAL_LIMITI)
        .map((t) => t.description)
        .join(" · "),
      oneri: "Fiş tarihleri YYYY-AA-GG biçiminde olmalı; kayıtları düzenleyin.",
      adet: tarihHatali.length,
    });
  }

  const hesapsiz = g.transactions.filter((t) => !hesapIds.has(t.accountId));
  if (hesapsiz.length > 0) {
    ekle({
      kategori: "dengesiz",
      seviye: "kritik",
      baslik: "Hesabı bulunamayan fişler",
      detay: hesapsiz
        .slice(0, KURAL_LIMITI)
        .map((t) => `${t.date} · ${t.description}`)
        .join(" · "),
      oneri:
        "Fişin bağlı olduğu kasa/banka hesabı silinmiş görünüyor; hesabı geri ekleyin veya fişi yeni hesaba taşıyın.",
      adet: hesapsiz.length,
    });
  }

  const ayniHesapVirman = g.transfers.filter((t) => t.fromAccountId === t.toAccountId);
  if (ayniHesapVirman.length > 0) {
    ekle({
      kategori: "dengesiz",
      seviye: "kritik",
      baslik: "Kendine yapılan virmanlar",
      detay: ayniHesapVirman
        .slice(0, KURAL_LIMITI)
        .map((t) => `${t.date} · ${fmt(t.amount)} TL`)
        .join(" · "),
      oneri: "Aynı hesap arasındaki virmanlar bakiyeyi bozar; kayıtları silin.",
      adet: ayniHesapVirman.length,
    });
  }

  const virmanHesapsiz = g.transfers.filter(
    (t) => !hesapIds.has(t.fromAccountId) || !hesapIds.has(t.toAccountId),
  );
  if (virmanHesapsiz.length > 0) {
    ekle({
      kategori: "dengesiz",
      seviye: "kritik",
      baslik: "Hesabı bulunamayan virmanlar",
      detay: virmanHesapsiz
        .slice(0, KURAL_LIMITI)
        .map((t) => `${t.date} · ${fmt(t.amount)} TL`)
        .join(" · "),
      oneri: "Virmanın tarafları silinmiş hesaplara işaret ediyor; kaydı düzeltin.",
      adet: virmanHesapsiz.length,
    });
  }

  for (const t of g.transactions) {
    if (t.invoiceId && !faturaById.has(t.invoiceId)) {
      ekle({
        kategori: "dengesiz",
        seviye: "uyari",
        baslik: "Faturası silinmiş fiş",
        detay: `${t.date} · ${t.description} — bağlı fatura kayıtta yok.`,
        oneri:
          "Fatura silinmiş ama tahsilat/ödeme fişi kalmış; bağlantıyı temizleyin ya da faturayı geri yükleyin.",
      });
      break;
    }
  }

  for (const f of g.invoices) {
    const bagliVar = g.transactions.some((t) => t.invoiceId === f.id);
    if (f.paid && !bagliVar) {
      ekle({
        kategori: "eksik",
        seviye: "uyari",
        baslik: "Ödendi görünen faturada hareket yok",
        detay: `${f.invoiceNo} · ${fmt(f.total)} TL ödenmiş işaretli ama kasa/banka hareketi bulunamadı.`,
        oneri:
          "Fatura 'ödendi' işaretini geri alıp hesabı seçerek yeniden tahsil edin, ya da eksik hareketi girin.",
      });
    } else if (!f.paid && bagliVar) {
      ekle({
        kategori: "dengesiz",
        seviye: "uyari",
        baslik: "Ödenmemiş faturada bağlı hareket var",
        detay: `${f.invoiceNo} · ${fmt(f.total)} TL — fatura açık, ancak bağlı tahsilat/ödeme fişi mevcut.`,
        oneri: "Faturayı ödendi olarak işaretleyin veya hareketle fatura bağlantısını kaldırın.",
      });
    }
  }

  for (const [key, grup] of faturaNoGroups) {
    if (grup.length < 2) continue;
    ekle({
      kategori: "mukerrer",
      seviye: "kritik",
      baslik: "Mükerrer fatura numarası",
      detay: `${grup[0].invoiceNo} numarası ${grup.length} kez girilmiş (toplam ${fmt(
        grup.reduce((s, f) => s + f.total, 0),
      )} TL).`,
      oneri:
        "Aynı numaralı iki fatura varsa biri muhtemelen çift girilmiştir; silinmesi gerekeni belgeleyip kaldırın.",
      adet: grup.length,
    });
    if (bulgular.filter((b) => b.kategori === "mukerrer").length >= KURAL_LIMITI) break;
    void key;
  }

  /* ---------------- Mükerrer belgeler / fişler ---------------- */
  const fisGrup = new Map<string, Transaction[]>();
  for (const t of g.transactions) {
    const key = `${t.type}|${t.amount.toFixed(2)}|${t.date}|${normalize(t.description)}`;
    fisGrup.set(key, [...(fisGrup.get(key) ?? []), t]);
  }
  let fisSayac = 0;
  for (const grup of fisGrup.values()) {
    if (grup.length < 2 || fisSayac >= KURAL_LIMITI) continue;
    fisSayac++;
    ekle({
      kategori: "mukerrer",
      seviye: "uyari",
      baslik: "Mükerrer fiş benzerliği",
      detay: `"${grup[0].description}" — ${grup[0].date} tarihinde ${fmt(
        grup[0].amount,
      )} TL tutarında ${grup.length} adet aynı kayıt.`,
      oneri:
        "Aynı gün aynı tutarda iki kayıt varsa biri çift girilmiş olabilir; belge numaralarını karşılaştırıp fazlalık olanı silin.",
      adet: grup.length,
    });
  }

  const belgeGrup = new Map<string, StoredDocument[]>();
  for (const d of g.documents) {
    const key = `${normalize(d.fileName)}|${d.size}`;
    belgeGrup.set(key, [...(belgeGrup.get(key) ?? []), d]);
  }
  let belgeSayac = 0;
  for (const grup of belgeGrup.values()) {
    if (grup.length < 2 || belgeSayac >= KURAL_LIMITI) continue;
    belgeSayac++;
    ekle({
      kategori: "mukerrer",
      seviye: "uyari",
      baslik: "Aynı dosya iki kez yüklenmiş",
      detay: `${grup[0].fileName} (${fmt(grup[0].size / 1024)} KB) ${grup.length} kez mevcut.`,
      oneri: "Tekrarlanan belgeyi silin ki arşiv ve kontroller şişmesin.",
      adet: grup.length,
    });
  }

  const belgeNoGrup = new Map<string, StoredDocument[]>();
  const ciftTasarlik: StoredDocument[] = [];
  for (const d of g.documents) {
    if (!d.okuma) continue;
    const no = normalize(d.okuma.belgeNo);
    if (no) {
      belgeNoGrup.set(no, [...(belgeNoGrup.get(no) ?? []), d]);
    }
  }
  for (const grup of belgeNoGrup.values()) {
    if (grup.length < 2) continue;
    ekle({
      kategori: "mukerrer",
      seviye: "kritik",
      baslik: "Aynı belge numarası iki belgede",
      detay: `${grup[0].okuma?.belgeNo} numaralı belge ${grup.length} farklı dosyada mevcut.`,
      oneri:
        "Aynı fatura numarası iki kez yüklenmişse biri mükerrer olabilir; onay vermeden önce iki belgeyi karşılaştırın.",
      adet: grup.length,
    });
  }

  // Onay bekleyen taslaklar mevcut kayıtlarla eşleşiyor mu?
  for (const d of g.documents) {
    if (d.okumaDurum !== "taslak" || !d.okuma) continue;
    const eslesen = g.transactions.find(
      (t) =>
        t.type === (d.okuma?.yon === "gelir" ? "gelir" : "gider") &&
        d.okuma &&
        Math.abs(t.amount - d.okuma.toplamTutar) < 0.01 &&
        (!d.okuma.tarih || t.date === d.okuma.tarih),
    );
    if (eslesen && ciftTasarlik.length < KURAL_LIMITI) {
      ciftTasarlik.push(d);
      ekle({
        kategori: "mukerrer",
        seviye: "uyari",
        baslik: "Onay bekleyen belge mevcut kayıtla eşleşiyor",
        detay: `${d.name} — ${fmt(d.okuma.toplamTutar)} TL / ${d.okuma.tarih || "tarih yok"} tutarındaki belge, "${eslesen.description}" kaydıyla aynı görünüyor.`,
        oneri:
          "Onaylamadan önce mevcut kaydı kontrol edin; kayıt zaten varsa onaylamayın (çift kayıt oluşur).",
      });
    }
  }

  /* ---------------- Olağandışı tutarlar (kayıtlı fişler) ---------------- */
  const kategoriGrup = new Map<string, Transaction[]>();
  for (const t of g.transactions) {
    if (!Number.isFinite(t.amount) || t.amount <= 0) continue;
    const key = `${t.type}|${t.category}`;
    kategoriGrup.set(key, [...(kategoriGrup.get(key) ?? []), t]);
  }
  let olaganSayac = 0;
  for (const grup of kategoriGrup.values()) {
    if (grup.length < 6 || olaganSayac >= KURAL_LIMITI) continue;
    const tutarlar = grup.map((t) => t.amount).sort((a, b) => a - b);
    const q1 = quantile(tutarlar, 0.25);
    const q3 = quantile(tutarlar, 0.75);
    const iqr = q3 - q1;
    const medyan = quantile(tutarlar, 0.5);
    if (iqr <= 0) continue;
    const esik = q3 + 3 * iqr;
    const asimlar = grup.filter((t) => t.amount > esik && t.amount > medyan * 3);
    if (asimlar.length === 0) continue;
    olaganSayac++;
    const enBuyuk = [...asimlar].sort((a, b) => b.amount - a.amount)[0];
    ekle({
      kategori: "olaganDisi",
      seviye: "uyari",
      baslik: `Olağandışı tutar — ${enBuyuk.category} / ${enBuyuk.type === "gelir" ? "gelir" : "gider"}`,
      detay: `${asimlar.length} kayıt, kategori ortalamasının çok üzerinde (örnek: ${enBuyuk.date} · ${enBuyuk.description} · ${fmt(
        enBuyuk.amount,
      )} TL; eşik ${fmt(esik)} TL).`,
      oneri:
        "Bu tutarları ilgili belgelerle doğrulayın; veri giriş hatalı veya olağanüstü bir işlem olabilir.",
      adet: asimlar.length,
    });
  }

  /* ---------------- Eksik kayıtlar ---------------- */
  const bekleyen = g.documents.filter((d) => d.okumaDurum === "taslak");
  if (bekleyen.length > 0) {
    ekle({
      kategori: "eksik",
      seviye: "uyari",
      baslik: "Onay bekleyen belge okumaları",
      detay: `${bekleyen.length} belge okundu ama muhasebeci onayı verilmedi: ${bekleyen
        .slice(0, KURAL_LIMITI)
        .map((d) => d.name)
        .join(" · ")}`,
      oneri:
        "Bu belgeler henüz finansal kayda dönüşmedi. Belgeler sayfasından inceleyip onaylayın veya reddedin.",
      adet: bekleyen.length,
    });
  }

  const eskiAcik = g.invoices.filter((f) => {
    if (f.paid) return false;
    const gun = (Date.now() - new Date(f.date).getTime()) / 86_400_000;
    return Number.isFinite(gun) && gun > 45;
  });
  if (eskiAcik.length > 0) {
    ekle({
      kategori: "eksik",
      seviye: "uyari",
      baslik: "Tahsil/ödeme kaydı olmayan eski faturalar",
      detay: eskiAcik
        .slice(0, KURAL_LIMITI)
        .map((f) => `${f.invoiceNo} · ${fmt(f.total)} TL · ${f.date}`)
        .join(" · "),
      oneri:
        "45 günden eski açık faturalarda tahsilat/ödeme kaydı eksik olabilir; faturayı ödendi işaretleyip hesap bağlayın.",
      adet: eskiAcik.length,
    });
  }

  const hareketsizCari = g.contacts.filter(
    (c) =>
      !g.transactions.some((t) => normalize(t.description).includes(normalize(c.name))) &&
      !g.invoices.some((f) => f.contactId === c.id),
  );
  if (hareketsizCari.length > 0) {
    ekle({
      kategori: "eksik",
      seviye: "bilgi",
      baslik: "Hareketi olmayan cariler",
      detay: `${hareketsizCari.length} cari hesapta hiçbir fiş veya fatura yok: ${hareketsizCari
        .slice(0, KURAL_LIMITI)
        .map((c) => c.name)
        .join(" · ")}`,
      oneri:
        "Cari açıldıysa ama işlem girilmediyse kayıtlar eksik olabilir; kontrol edin.",
      adet: hareketsizCari.length,
    });
  }

  const baglanmamisBelge = g.documents.filter((d) => !d.contactId);
  if (baglanmamisBelge.length > 0) {
    ekle({
      kategori: "eksik",
      seviye: "bilgi",
      baslik: "Cariye bağlanmamış belgeler",
      detay: `${baglanmamisBelge.length} belge cari hesapla bağlantısız duruyor.`,
      oneri:
        "Belgeleri ilgili cariye bağlayın; cari bakiye ve raporlar eksiksiz hesaplanır.",
      adet: baglanmamisBelge.length,
    });
  }

  /* ---------------- Sıralama ---------------- */
  return bulgular.sort(
    (a, b) =>
      SEVIYE_SIRA[a.seviye] - SEVIYE_SIRA[b.seviye] ||
      KATEGORI_SIRA[a.kategori] - KATEGORI_SIRA[b.kategori],
  );
}
