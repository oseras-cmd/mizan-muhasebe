import { formatInputValue } from "@/lib/finance/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTRY, parseTurkishNumber } from "@/lib/finance/format";
import { cn } from "@/lib/utils";
import {
  Calculator,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  ReceiptText,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CalcCard, Field, ResultBox, ResultRow, ResultTotalRow, formatNumber } from "./shared";

/* ─── Sabitler ─── */
const MASRAF_TURLERI = [
  "ARAÇ YAKIT GİDERİ",
  "ARAÇ OTOPARK VE VİZYÖR",
  "ARAÇ TAMİR VE BAKIM",
  "MUTFAK YİYECEK VE İÇECEK",
  "MUTFAK SARF MALZEME",
  "YİYECEK İÇECEK GİDERİ",
  "TEMSİLCİLİK İKRAM VE YEMEK",
  "ÖZEL İLETİŞİM GİDERLERİ",
  "İŞ TEKNİK BAKIM",
  "PT. KARGO, KOLİ",
  "KIRTASİYE VE MATBAA",
  "YURT İÇİ SEYAHAT VE KONAKLAMA",
  "YURT DIŞI SEYAHAT VE KONAKLAMA",
  "TEMİZLİK VE SARF MALZEME",
  "MUHASEBE VE DANIŞMANLIK",
  "DİĞER VERGİ VE RESİMLER",
  "İLAN REKLAM VE TANITIM",
  "SAĞLIK GİDERLERİ",
  "669 KANUNEN KABUL EDİLMEYEN",
  "DİĞER",
] as const;

const BELGE_TURLERI = [
  "FATURA",
  "FİŞ",
  "MAKBUZ",
  "İRSALİYE",
  "DEKONT",
  "DİĞER",
] as const;

const KDV_ORANLARI = [0, 1, 10, 20] as const;

const ODEME_TURLERI = [
  "NAKİT",
  "KREDİ KARTI",
  "HAVALE / EFT",
  "ÇEK",
  "DİĞER",
] as const;

const MASRAF_MERKEZLERI = [
  "MESKUR",
  "GENEL",
  "İDARİ",
  "SATIŞ",
  " ÜRETİM",
  "DİĞER",
] as const;

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
  belgeTipi: "FATURA",
  masrafAdi: "",
  masrafTuru: MASRAF_TURLERI[0],
  faturaFisNo: "",
  belgeTarihi: new Date().toISOString().slice(0, 10),
  kdvOrani: 20,
  fisToplam: 0,
  odemeTuru: "HAVALE / EFT",
  masrafMerkez: "MESKUR",
  aracPlaka: "",
  kkeg: 0,
};

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
  const [firma, setFirma] = useState<FirmaBilgileri>(DEFAULT_FIRMA);
  const [items, setItems] = useState<MasrafItem[]>([]);
  const [nextId, setNextId] = useState(1);
  const [form, setForm] = useState<Omit<MasrafItem, "id">>({ ...EMPTY_ITEM });
  const [error, setError] = useState<string | null>(null);

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

  /* ─── Ekle ─── */
  const handleAdd = () => {
    if (!form.masrafAdi.trim()) {
      setError("Masraf adı girin.");
      return;
    }
    if (!Number.isFinite(form.fisToplam) || form.fisToplam <= 0) {
      setError("Geçerli bir tutar girin.");
      return;
    }
    setItems((prev) => [...prev, { ...form, id: nextId }]);
    setNextId((n) => n + 1);
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
    setFirma({ ...DEFAULT_FIRMA });
    setError(null);
  };

  /* ─── Yazdır ─── */
  const handlePrint = () => window.print();

  /* ─── Dağılım tablosunda sadece kullanılan türleri göster ─── */
  const kullanilanTurler = useMemo(() => {
    const kullanilan = new Set(items.map((i) => i.masrafTuru));
    return MASRAF_TURLERI.filter((t) => kullanilan.has(t));
  }, [items]);

  return (
    <div className="space-y-6">
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
                placeholder="Örn. MESKUR KURUMSAL A.Ş."
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
          title="Masraf Ekle"
          subtitle="Yeni masraf kalemi ekleyin"
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleReset}>
                <RotateCcw className="size-3.5" />
                Sıfırla
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handlePrint}>
                <Printer className="size-3.5" />
                Yazdır
              </Button>
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
                  value={formatInputValue(String(form.fisToplam))}
                  onChange={(e) => setForm({ ...form, fisToplam: parseTurkishNumber(e.target.value) })}
                  placeholder="0,00"
                  className="h-9 text-sm tabular-nums"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  value={formatInputValue(String(form.kkeg))}
                  onChange={(e) => setForm({ ...form, kkeg: parseTurkishNumber(e.target.value) })}
                  placeholder="0,00"
                  className="h-9 text-sm tabular-nums"
                />
              </Field>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="button" onClick={handleAdd} className="w-full">
              <Plus className="mr-2 size-4" />
              Masraf Ekle
            </Button>
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
                  <th className="px-2 py-2 text-center w-8"></th>
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
                      <td className="px-2 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold text-foreground">
                  <td colSpan={7} className="px-2 py-2.5 text-right text-xs">TOPLAM</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm">{fmt(hesaplamalar.toplamFis)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm">{fmt(hesaplamalar.toplamMatrah)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm text-orange-600">{fmt(hesaplamalar.toplamKdv)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-sm">{fmt(hesaplamalar.toplamKkeg)}</td>
                  <td colSpan={3}></td>
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
            <FileSpreadsheet className="size-4 text-muted-foreground" />
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
        <div className="rounded-lg border border-dashed bg-card px-6 py-16 text-center">
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
