import { formatNumberInput } from "@/lib/finance/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTRY, parseTurkishNumber } from "@/lib/finance/format";
import { cn } from "@/lib/utils";
import {
  Calculator,
  Plus,
  RotateCcw,
  Trash2,
  ReceiptText,
  Building2,
  FileSpreadsheet,
  Pencil,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CalcCard, Field, PrintButton, PrintHeader, ResultBox, ResultRow, ResultTotalRow, formatNumber } from "./shared";

/* ─── Sabitler ─── */
const MASRAF_TURLERI = [
  "Araç Yakıt Gideri",
  "Araç Otopark ve Viyadük",
  "Araç Tamir ve Bakım",
  "Mutfak Yiyecek ve İçecek",
  "Mutfak Sarf Malzeme",
  "Yiyecek İçecek Gideri",
  "Temsilcilik İkram ve Yemek",
  "Özel İletişim Giderleri",
  "İş Teknik Bakım",
  "PTT Kargo, Koli",
  "Kırtasiye ve Matbaa",
  "Yurt İçi Seyahat ve Konaklama",
  "Yurt Dışı Seyahat ve Konaklama",
  "Temizlik ve Sarf Malzeme",
  "Muhasebe ve Danışmanlık",
  "Diğer Vergi ve Resimler",
  "İlan, Reklam ve Tanıtım",
  "Sağlık Giderleri",
  "Kanunen Kabul Edilmeyen (669)",
  "Diğer",
] as const;

const BELGE_TURLERI = [
  "Fatura",
  "Fiş",
  "Makbuz",
  "İrsaliye",
  "Dekont",
  "Diğer",
] as const;

const KDV_ORANLARI = [0, 1, 10, 20] as const;

const ODEME_TURLERI = [
  "Nakit",
  "Kredi Kartı",
  "Havale / EFT",
  "Çek",
  "Diğer",
] as const;

const MASRAF_MERKEZLERI = [
  "Genel",
  "İdari",
  "Satış",
  "Üretim",
  "Diğer",
] as const;

/** Şirket seçimi opsiyoneldir — zorunlu değildir. */
const SIRKETLER = ["Ferla", "Meskur"] as const;

/* ─── Tip ─── */
interface MasrafItem {
  id: number;
  belgeTipi: string;
  masrafAdi: string;
  masrafTuru: string;
  faturaFisNo: string;
  belgeTarihi: string;
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

interface FirmaBilgileri {
  firmaAdi: string;
  sirket: string;
  isyeri: string;
  yil: number;
  ay: string;
  gunAraligi: string;
  belgeTarihi: string;
}

/* ─── Varsayılan ─── */
const DEFAULT_FIRMA: FirmaBilgileri = {
  firmaAdi: "",
  sirket: "",
  isyeri: "",
  yil: new Date().getFullYear(),
  ay: "",
  gunAraligi: "",
  belgeTarihi: new Date().toISOString().slice(0, 10),
};

const EMPTY_ITEM: Omit<MasrafItem, "id"> = {
  belgeTipi: "Fatura",
  masrafAdi: "",
  masrafTuru: MASRAF_TURLERI[0],
  faturaFisNo: "",
  belgeTarihi: new Date().toISOString().slice(0, 10),
  kdvOrani: 20,
  fisToplam: 0,
  odemeTuru: "Havale / EFT",
  masrafMerkez: "Genel",
  sirket: "",
  fisFirma: "",
  vergiNo: "",
  aracPlaka: "",
  kkeg: 0,
};

/* ─── Eski (büyük harfli) kayıtları yeni başlıklara çevir ─── */
function normTr(value: string): string {
  return value.trim().toLocaleUpperCase("tr-TR");
}

/** Eskiden yanlış yazılmış türlerin yeni karşılıkları */
const TUR_ESLEME: Record<string, string> = {
  "ARAÇ OTOPARK VE VİZYÖR": "Araç Otopark ve Viyadük",
  "PT. KARGO, KOLİ": "PTT Kargo, Koli",
  "İLAN REKLAM VE TANITIM": "İlan, Reklam ve Tanıtım",
  "669 KANUNEN KABUL EDİLMEYEN": "Kanunen Kabul Edilmeyen (669)",
};

const TUR_HARITA = new Map(MASRAF_TURLERI.map((t) => [normTr(t), t] as const));
const BELGE_HARITA = new Map(BELGE_TURLERI.map((t) => [normTr(t), t] as const));
const ODEME_HARITA = new Map(ODEME_TURLERI.map((t) => [normTr(t), t] as const));
const MERKEZ_HARITA = new Map(MASRAF_MERKEZLERI.map((t) => [normTr(t), t] as const));

function duzelt(value: string, harita: Map<string, string>, yedek: string): string {
  const n = normTr(value);
  if (n === "") return yedek;
  return harita.get(n) ?? yedek;
}

/** Eski kayıtları yeni alan/başlık yapısına taşır. */
function normalizeItem(raw: MasrafItem): MasrafItem {
  const turN = normTr(raw.masrafTuru ?? "");
  const merkezEski = normTr(raw.masrafMerkez ?? "");
  let sirket = (raw.sirket ?? "").trim();
  let merkez = duzelt(raw.masrafMerkez ?? "", MERKEZ_HARITA, "Genel");
  // Eski sürümde şirket bilgisi masraf merkezine yazılıyordu — Şirket alanına taşı.
  if (!sirket && (merkezEski === "MESKUR" || merkezEski === "FERLA")) {
    sirket = merkezEski === "MESKUR" ? "Meskur" : "Ferla";
    merkez = "Genel";
  }
  return {
    ...raw,
    belgeTipi: duzelt(raw.belgeTipi ?? "", BELGE_HARITA, "Fatura"),
    masrafTuru: TUR_ESLEME[turN] ?? TUR_HARITA.get(turN) ?? "Diğer",
    odemeTuru: duzelt(raw.odemeTuru ?? "", ODEME_HARITA, "Havale / EFT"),
    masrafMerkez: merkez,
    sirket,
    fisFirma: (raw.fisFirma ?? "").trim(),
    vergiNo: (raw.vergiNo ?? "").trim(),
  };
}

/* ─── Kalıcılık (localStorage) — çıkış/yenileme sonrası veriler korunur ─── */
const MASRAF_STORAGE_KEY = "mizan-masraf-data-v1";

interface MasrafStorage {
  firma: FirmaBilgileri;
  items: MasrafItem[];
  nextId: number;
}

function loadMasrafData(): MasrafStorage {
  try {
    const raw = window.localStorage.getItem(MASRAF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MasrafStorage>;
      if (Array.isArray(parsed.items) && parsed.firma) {
        const maxId = parsed.items.reduce((max, i) => Math.max(max, i.id ?? 0), 0);
        return {
          firma: { ...DEFAULT_FIRMA, ...parsed.firma },
          items: parsed.items.map(normalizeItem),
          nextId: typeof parsed.nextId === "number" && parsed.nextId > maxId ? parsed.nextId : maxId + 1,
        };
      }
    }
  } catch {
    // Bozuk veri — temiz başlangıca dön.
  }
  return { firma: { ...DEFAULT_FIRMA }, items: [], nextId: 1 };
}

/* ─── KDV Hesaplama ─── */
function kdvHesapla(toplam: number, oran: number) {
  if (oran === 0) return { matrah: toplam, kdv: 0 };
  const matrah = toplam / (1 + oran / 100);
  const kdv = toplam - matrah;
  return { matrah, kdv };
}

/* ─── Tutar formatı (100.000,00) ─── */
function fmt(value: number): string {
  return formatTRY(value).replace("₺", "").trim();
}

type DagilimVal = { matrah: number; kdv: number; kkeg: number; toplam: number; belgeAdet: number };

export function MasrafHesap() {
  const [initial] = useState(loadMasrafData);
  const [firma, setFirma] = useState<FirmaBilgileri>(initial.firma);
  const [items, setItems] = useState<MasrafItem[]>(initial.items);
  const [nextId, setNextId] = useState(initial.nextId);
  const [form, setForm] = useState<Omit<MasrafItem, "id">>({ ...EMPTY_ITEM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Her değişiklikte kalıcı depoya yaz */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        MASRAF_STORAGE_KEY,
        JSON.stringify({ firma, items, nextId } satisfies MasrafStorage),
      );
    } catch {
      // Depolama dolu veya erişilemez — sessizce devam et.
    }
  }, [firma, items, nextId]);

  /* ─── KDV Sütunları hesapla ─── */
  const hesaplamalar = useMemo(() => {
    let toplamMatrah = 0;
    let toplamKdv = 0;
    let toplamKkeg = 0;
    let toplamFis = 0;
    let belgeAdet = 0;

    const kdvSutunlari: Record<number, { matrah: number; kdv: number }> = {};
    for (const oran of KDV_ORANLARI) {
      kdvSutunlari[oran] = { matrah: 0, kdv: 0 };
    }

    // Masraf dağılımı
    type DagilimSatir = Record<string, DagilimVal> & Record<number, DagilimVal>;
    const dagilim: Record<string, DagilimSatir> = {} as any;
    for (const tur of MASRAF_TURLERI) {
      dagilim[tur] = {} as any;
      for (const oran of KDV_ORANLARI) {
        dagilim[tur][oran] = { matrah: 0, kdv: 0, kkeg: 0, toplam: 0, belgeAdet: 0 };
      }
      dagilim[tur]["kkeg"] = { matrah: 0, kdv: 0, kkeg: 0, toplam: 0, belgeAdet: 0 };
      dagilim[tur]["toplam"] = { matrah: 0, kdv: 0, kkeg: 0, toplam: 0, belgeAdet: 0 };
    }

    for (const item of items) {
      const { matrah, kdv } = kdvHesapla(item.fisToplam, item.kdvOrani);
      toplamMatrah += matrah;
      toplamKdv += kdv;
      toplamKkeg += item.kkeg;
      toplamFis += item.fisToplam;
      belgeAdet++;

      if (kdvSutunlari[item.kdvOrani]) {
        kdvSutunlari[item.kdvOrani].matrah += matrah;
        kdvSutunlari[item.kdvOrani].kdv += kdv;
      }

      // Dağılım
      const dRow = dagilim[item.masrafTuru];
      if (dRow) {
        dRow[item.kdvOrani].matrah += matrah;
        dRow[item.kdvOrani].kdv += kdv;
        dRow[item.kdvOrani].toplam += item.fisToplam;
        dRow[item.kdvOrani].belgeAdet++;
        dRow["kkeg"].kkeg += item.kkeg;
        dRow["toplam"].toplam += item.fisToplam;
        dRow["toplam"].matrah += matrah;
        dRow["toplam"].kdv += kdv;
        dRow["toplam"].belgeAdet++;
      }
    }

    return {
      toplamMatrah,
      toplamKdv,
      toplamKkeg,
      toplamFis,
      belgeAdet,
      kdvSutunlari,
      dagilim,
      genelToplam: toplamFis,
    };
  }, [items]);

  /* ─── Ekle / Güncelle ─── */
  const handleAdd = () => {
    if (!form.masrafAdi.trim()) {
      setError("Masraf adı girin.");
      return;
    }
    if (!Number.isFinite(form.fisToplam) || form.fisToplam <= 0) {
      setError("Geçerli bir tutar girin.");
      return;
    }
    if (editingId !== null) {
      setItems((prev) => prev.map((i) => (i.id === editingId ? { ...form, id: editingId } : i)));
      setEditingId(null);
      setForm({ ...EMPTY_ITEM, belgeTarihi: form.belgeTarihi });
      setError(null);
      return;
    }
    setItems((prev) => [...prev, { ...form, id: nextId }]);
    setNextId((n) => n + 1);
    setForm({ ...EMPTY_ITEM, belgeTarihi: form.belgeTarihi });
    setError(null);
  };

  /* ─── Düzenlemeye başla ─── */
  const handleEdit = (id: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const { id: _id, ...rest } = item;
    setForm({ ...EMPTY_ITEM, ...rest });
    setEditingId(id);
    setError(null);
  };

  /* ─── Düzenlemeyi iptal et ─── */
  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY_ITEM, belgeTarihi: form.belgeTarihi });
    setError(null);
  };

  /* ─── Sil ─── */
  const handleDelete = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  /* ─── Sıfırla ─── */
  const handleReset = () => {
    setItems([]);
    setNextId(1);
    setForm({ ...EMPTY_ITEM });
    setEditingId(null);
    setFirma({ ...DEFAULT_FIRMA });
    setError(null);
    try {
      window.localStorage.removeItem(MASRAF_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  /* ─── Yazdır ─── */

  /* ─── Dağılım tablosunda sadece kullanılan türleri göster ─── */
  const kullanilanTurler = useMemo(() => {
    const kullanilan = new Set(items.map((i) => i.masrafTuru));
    return MASRAF_TURLERI.filter((t) => kullanilan.has(t));
  }, [items]);

  return (
    <div className="print-area space-y-6">
      <PrintHeader
        title="Masraf Listesi Raporu"
        subtitle={
          [
            firma.firmaAdi || null,
            firma.sirket || null,
            `${firma.belgeTarihi ? new Date(firma.belgeTarihi).toLocaleDateString("tr-TR") : ""}`,
            `${items.length} belge · Toplam ${fmt(hesaplamalar.genelToplam)} ₺`,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
      {/* Firma Bilgileri + Ekleme Formu */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Firma Bilgileri */}
        <CalcCard title="Belge Bilgileri" subtitle="Şirket ve dönem bilgileri">
          <div className="grid gap-4">
            <Field label="Belge Düzenleme Tarihi">
              <Input
                type="date"
                value={firma.belgeTarihi}
                onChange={(e) => setFirma({ ...firma, belgeTarihi: e.target.value })}
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Firma Adı">
              <Input
                value={firma.firmaAdi}
                onChange={(e) => setFirma({ ...firma, firmaAdi: e.target.value })}
                placeholder="Örn. Ahmet Yıldırım"
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Şirket">
              <Input
                value={firma.sirket}
                onChange={(e) => setFirma({ ...firma, sirket: e.target.value })}
                placeholder="Örn. Ferla Kurumsal A.Ş."
                className="h-9 text-sm"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="İşyeri">
                <Input
                  value={firma.isyeri}
                  onChange={(e) => setFirma({ ...firma, isyeri: e.target.value })}
                  placeholder="İstanbul"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Yıl">
                <Input
                  type="number"
                  value={firma.yil}
                  onChange={(e) => setFirma({ ...firma, yil: Number(e.target.value) })}
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Gün Aralığı">
                <Input
                  value={firma.gunAraligi}
                  onChange={(e) => setFirma({ ...firma, gunAraligi: e.target.value })}
                  placeholder="1-10"
                  className="h-9 text-sm"
                />
              </Field>
            </div>
          </div>
        </CalcCard>

        {/* Masraf Ekleme Formu */}
        <CalcCard
          title={editingId !== null ? "Masrafı Düzenle" : "Masraf Ekle"}
          subtitle={editingId !== null ? "Değişiklikleri kaydedin veya iptal edin" : "Yeni masraf kalemi ekleyin"}
          className="print-hide"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleReset}>
                <RotateCcw className="size-3.5" />
                Sıfırla
              </Button>
              <PrintButton />
            </div>
          }
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Belge Tipi">
                <select
                  value={form.belgeTipi}
                  onChange={(e) => setForm({ ...form, belgeTipi: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
                >
                  {BELGE_TURLERI.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Belge Tarihi">
                <Input
                  type="date"
                  value={form.belgeTarihi}
                  onChange={(e) => setForm({ ...form, belgeTarihi: e.target.value })}
                  className="h-9 text-sm"
                />
              </Field>
            </div>

            <Field label="Masraf Adı / Ünvan">
              <Input
                value={form.masrafAdi}
                onChange={(e) => { setForm({ ...form, masrafAdi: e.target.value }); setError(null); }}
                placeholder="Örn. Yakıt alımı"
                className="h-9 text-sm"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Masraf Türü">
                <select
                  value={form.masrafTuru}
                  onChange={(e) => setForm({ ...form, masrafTuru: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
                >
                  {MASRAF_TURLERI.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="KDV Oranı (%)">
                <select
                  value={form.kdvOrani}
                  onChange={(e) => setForm({ ...form, kdvOrani: Number(e.target.value) })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
                >
                  {KDV_ORANLARI.map((o) => (
                    <option key={o} value={o}>%{o}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fiş / Fatura No">
                <Input
                  value={form.faturaFisNo}
                  onChange={(e) => setForm({ ...form, faturaFisNo: e.target.value })}
                  placeholder="No"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Fiş Genel Toplam (₺)">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatNumberInput(form.fisToplam)}
                  onChange={(e) => setForm({ ...form, fisToplam: parseTurkishNumber(e.target.value) })}
                  placeholder="0,00"
                  className="h-9 text-sm tabular-nums"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Ödeme Türü">
                <select
                  value={form.odemeTuru}
                  onChange={(e) => setForm({ ...form, odemeTuru: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
                >
                  {ODEME_TURLERI.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Masraf Merkezi">
                <select
                  value={form.masrafMerkez}
                  onChange={(e) => setForm({ ...form, masrafMerkez: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
                >
                  {MASRAF_MERKEZLERI.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Şirket (Opsiyonel)">
                <select
                  value={form.sirket}
                  onChange={(e) => setForm({ ...form, sirket: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
                >
                  <option value="">— Seçilmedi —</option>
                  {SIRKETLER.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fişin Alındığı Firma">
                <Input
                  value={form.fisFirma}
                  onChange={(e) => setForm({ ...form, fisFirma: e.target.value })}
                  placeholder="Örn. Opet Petrol"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Vergi Numarası">
                <Input
                  value={form.vergiNo}
                  onChange={(e) => setForm({ ...form, vergiNo: e.target.value })}
                  placeholder="Örn. 1234567890"
                  className="h-9 text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Araç Plaka No">
                <Input
                  value={form.aracPlaka}
                  onChange={(e) => setForm({ ...form, aracPlaka: e.target.value })}
                  placeholder="34 ABC 123"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="KKEG (₺)">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatNumberInput(form.kkeg)}
                  onChange={(e) => setForm({ ...form, kkeg: parseTurkishNumber(e.target.value) })}
                  placeholder="0,00"
                  className="h-9 text-sm tabular-nums"
                />
              </Field>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            {editingId !== null ? (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button type="button" onClick={handleAdd}>
                  Kaydet
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  <X className="size-4" />
                  İptal
                </Button>
              </div>
            ) : (
              <Button type="button" onClick={handleAdd} className="w-full">
                <Plus className="mr-2 size-4" />
                Masraf Ekle
              </Button>
            )}
          </div>
        </CalcCard>

        {/* Genel Toplam Özeti */}
        <CalcCard title="Genel Toplam" subtitle="Tüm masrafların özeti">
          <ResultBox>
            <ResultRow
              label="Toplam Belge"
              value={`${hesaplamalar.belgeAdet} adet`}
            />
            <ResultRow
              label="Fiş / Fatura Toplamı"
              value={fmt(hesaplamalar.toplamFis)}
            />
            <ResultRow
              label="Toplam KKEG"
              value={fmt(hesaplamalar.toplamKkeg)}
            />
            <ResultTotalRow
              label="Toplam Matrah"
              value={fmt(hesaplamalar.toplamMatrah)}
            />
            <ResultTotalRow
              label="Toplam KDV"
              value={fmt(hesaplamalar.toplamKdv)}
              valueClassName="text-orange-600"
            />
            <ResultTotalRow
              label="Genel Toplam"
              value={fmt(hesaplamalar.genelToplam)}
              valueClassName="text-emerald-700 dark:text-emerald-300 text-base"
            />
          </ResultBox>

          {/* KDV Dağılımı */}
          {items.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">KDV Oranına Göre Dağılım</p>
              <div className="grid grid-cols-2 gap-2">
                {KDV_ORANLARI.map((oran) => {
                  const s = hesaplamalar.kdvSutunlari[oran];
                  if (s.matrah === 0 && s.kdv === 0) return null;
                  return (
                    <div key={oran} className="rounded-md border border-border/50 bg-background p-2.5">
                      <p className="text-[10px] font-medium text-muted-foreground">%{oran} KDV</p>
                      <p className="mt-0.5 text-xs tabular-nums text-foreground">Matrah: {fmt(s.matrah)}</p>
                      <p className="text-xs tabular-nums text-orange-600">KDV: {fmt(s.kdv)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CalcCard>
      </div>

      {/* Masraf Listesi Tablosu */}
      {items.length > 0 && (
        <CalcCard
          title="Masraf Listesi"
          subtitle={`${items.length} kalem — toplam ${fmt(hesaplamalar.genelToplam)}`}
          actions={
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="size-3.5" />
              {firma.sirket || "Şirket belirtilmedi"}
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/70 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 text-center w-8">S.</th>
                  <th className="px-2 py-2">Belge</th>
                  <th className="px-2 py-2">Masraf Adı</th>
                  <th className="px-2 py-2">Tür</th>
                  <th className="px-2 py-2">No</th>
                  <th className="px-2 py-2">Tarih</th>
                  <th className="px-2 py-2 text-center">KDV</th>
                  <th className="px-2 py-2 text-right">Fiş Toplam</th>
                  <th className="px-2 py-2 text-right">Matrah</th>
                  <th className="px-2 py-2 text-right">KDV Tutar</th>
                  <th className="px-2 py-2 text-right">KKEG</th>
                  <th className="px-2 py-2">Ödeme</th>
                  <th className="px-2 py-2">Merkez</th>
                  <th className="px-2 py-2">Şirket</th>
                  <th className="px-2 py-2">Fiş Firması</th>
                  <th className="px-2 py-2">Vergi No</th>
                  <th className="px-2 py-2 text-center w-14">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const { matrah, kdv } = kdvHesapla(item.fisToplam, item.kdvOrani);
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-border/30 transition-colors hover:bg-muted/30",
                        idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                      )}
                    >
                      <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-2 text-muted-foreground">{item.belgeTipi}</td>
                      <td className="px-2 py-2 font-medium text-foreground max-w-[200px] truncate">{item.masrafAdi}</td>
                      <td className="px-2 py-2 text-muted-foreground max-w-[140px] truncate">{item.masrafTuru}</td>
                      <td className="px-2 py-2 text-muted-foreground">{item.faturaFisNo || "—"}</td>
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">
                        {item.belgeTarihi ? new Date(item.belgeTarihi).toLocaleDateString("tr-TR") : "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={cn(
                          "rounded px-1 py-0.5 text-[10px] font-semibold",
                          item.kdvOrani === 0 ? "bg-gray-100 text-gray-600" :
                          item.kdvOrani === 1 ? "bg-blue-50 text-blue-600" :
                          item.kdvOrani === 10 ? "bg-amber-50 text-amber-600" :
                          "bg-orange-50 text-orange-600",
                        )}>
                          %{item.kdvOrani}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-medium text-foreground">
                        {fmt(item.fisToplam)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {fmt(matrah)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-orange-600">
                        {item.kdvOrani > 0 ? fmt(kdv) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {item.kkeg > 0 ? fmt(item.kkeg) : "—"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{item.odemeTuru}</td>
                      <td className="px-2 py-2 text-muted-foreground">{item.masrafMerkez}</td>
                      <td className="px-2 py-2 text-muted-foreground">{item.sirket || "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground max-w-[140px] truncate">{item.fisFirma || "—"}</td>
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">{item.vergiNo || "—"}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-foreground"
                            title="Düzenle"
                            onClick={() => handleEdit(item.id)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            title="Sil"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold text-foreground">
                  <td colSpan={7} className="px-2 py-2.5 text-right text-xs">Toplam</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm">{fmt(hesaplamalar.toplamFis)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm">{fmt(hesaplamalar.toplamMatrah)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm text-orange-600">{fmt(hesaplamalar.toplamKdv)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm">{fmt(hesaplamalar.toplamKkeg)}</td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CalcCard>
      )}

      {/* Masraf Dağılımı Tablosu */}
      {kullanilanTurler.length > 0 && (
        <CalcCard
          title="Masraf Dağılımı"
          subtitle="Masraf türüne göre KDV ve matrah dağılımı"
          actions={
            <FileSpreadsheet className="size-4 text-muted-foreground print-hide" />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/70 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 text-center w-6">S.N.</th>
                  <th className="px-2 py-2">Masraf Dağılımı</th>
                  <th className="px-2 py-2 text-right">Matrah %0</th>
                  <th className="px-2 py-2 text-right">KDV %0</th>
                  <th className="px-2 py-2 text-right">Matrah %1</th>
                  <th className="px-2 py-2 text-right">KDV %1</th>
                  <th className="px-2 py-2 text-right">Matrah %10</th>
                  <th className="px-2 py-2 text-right">KDV %10</th>
                  <th className="px-2 py-2 text-right">Matrah %20</th>
                  <th className="px-2 py-2 text-right">KDV %20</th>
                  <th className="px-2 py-2 text-right">KKEG</th>
                  <th className="px-2 py-2 text-right">Toplam</th>
                  <th className="px-2 py-2 text-center">Belge</th>
                </tr>
              </thead>
              <tbody>
                {kullanilanTurler.map((tur, idx) => {
                  const d = hesaplamalar.dagilim[tur] as Record<string, DagilimVal>;
                  const toplamD = d["toplam"];
                  const kkegD = d["kkeg"];
                  return (
                    <tr
                      key={tur}
                      className={cn(
                        "border-b border-border/30 transition-colors hover:bg-muted/30",
                        idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                      )}
                    >
                      <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-2 font-medium text-foreground max-w-[200px] truncate">{tur}</td>
                      {KDV_ORANLARI.map((oran) => (
                        <td key={oran} className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {d[oran].matrah > 0 ? fmt(d[oran].matrah) : "0,00"}
                        </td>
                      ))}
                      {KDV_ORANLARI.map((oran) => (
                        <td key={`kdv-${oran}`} className="px-2 py-2 text-right tabular-nums text-orange-600">
                          {d[oran].kdv > 0 ? fmt(d[oran].kdv) : "0,00"}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {kkegD.kkeg > 0 ? fmt(kkegD.kkeg) : "0,00"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-medium text-foreground">
                        {fmt(toplamD.toplam)}
                      </td>
                      <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                        {toplamD.belgeAdet}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold text-foreground">
                  <td colSpan={2} className="px-2 py-2.5 text-right text-xs">Genel Toplam</td>
                  {KDV_ORANLARI.map((oran) => (
                    <td key={oran} className="px-2 py-2.5 text-right tabular-nums text-xs">
                      {fmt(hesaplamalar.kdvSutunlari[oran].matrah)}
                    </td>
                  ))}
                  {KDV_ORANLARI.map((oran) => (
                    <td key={`kdvf-${oran}`} className="px-2 py-2.5 text-right tabular-nums text-xs text-orange-600">
                      {fmt(hesaplamalar.kdvSutunlari[oran].kdv)}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right tabular-nums text-xs">{fmt(hesaplamalar.toplamKkeg)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm">{fmt(hesaplamalar.genelToplam)}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-xs">{hesaplamalar.belgeAdet}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CalcCard>
      )}

      {/* Boş durum */}
      {items.length === 0 && (
        <div className="print-hide rounded-lg border border-dashed bg-card px-6 py-16 text-center">
          <ReceiptText className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">Henüz masraf eklenmedi</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Soldaki formu kullanarak masraf kalemleri ekleyin
          </p>
        </div>
      )}
    </div>
  );
}
