import { formatInputValue, parseTurkishNumber } from "@/lib/finance/format";
import { useFinanceData } from "@/lib/finance/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, InfoNote } from "./shared";
import { analizMizan, type MizanSatir } from "./engine/calcEngine";
import {
  KATEGORI_ETIKET,
  SEVIYE_ETIKET,
  kontrolAsistani,
  type KontrolBulgu,
} from "./engine/kontrolAsistani";
import { ExportButtons } from "./engine/ExportButtons";
import { Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

function bosSatir(): MizanSatir {
  return { hesap: "", ad: "", borcToplam: 0, alacakToplam: 0, borcBakiye: 0, alacakBakiye: 0 };
}

/** Bir sayfayı MizanSatir[]'e çevirir; geçerli satır yoksa null döner. */
function sheetToMizan(wb: XLSX.WorkBook, sheetName: string): MizanSatir[] | null {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: 0 });
  const yeni: MizanSatir[] = [];
  for (const row of json) {
    const keys = Object.keys(row);
    const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[ıi̇şğüöç]/gi, "").replace(/\s+/g, "");
    const findKey = (patterns: string[]) => keys.find((k) => patterns.some((p) => norm(k).includes(p)));
    const kodK = findKey(["hesapkodu", "kod", "hesap"]) ?? keys[0];
    const adK = findKey(["hesapadi", "ad", "aciklama"]) ?? keys[1];
    const btK = findKey(["borctoplam", "borc"]);
    const atK = findKey(["alacktoplam", "alack", "alacakt"]);
    const bbK = findKey(["borcbakiye"]);
    const abK = findKey(["alackbakiye", "alacakbakiye"]);
    const hesap = String(row[kodK] ?? "").trim();
    if (!hesap) continue;
    const num = (k?: string) => (k ? (typeof row[k] === "number" ? (row[k] as number) : parseTurkishNumber(String(row[k] ?? "0")) || 0) : 0);
    yeni.push({
      hesap, ad: String(row[adK] ?? ""),
      borcToplam: num(btK), alacakToplam: num(atK),
      borcBakiye: num(bbK), alacakBakiye: num(abK),
    });
  }
  return yeni.length > 0 ? yeni : null;
}

function hesapNiteligi(hesap: string): "borc" | "alacak" {
  const g = hesap.slice(0, 1);
  return g === "1" || g === "2" ? "borc" : "alacak";
}

export function MizanAnalizHesap() {
  const [rows, setRows] = useState<MizanSatir[]>([
    { hesap: "100", ad: "Kasa", borcToplam: 500000, alacakToplam: 420000, borcBakiye: 80000, alacakBakiye: 0 },
    { hesap: "320", ad: "Satıcılar", borcToplam: 0, alacakToplam: 0, borcBakiye: 0, alacakBakiye: 150000 },
    { hesap: "391", ad: "Hesaplanan KDV", borcToplam: 120000, alacakToplam: 120000, borcBakiye: 0, alacakBakiye: 0 },
  ]);
  const [excelHata, setExcelHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sheetList, setSheetList] = useState<{ ad: string; satir: number }[]>([]);
  const [seciliSayfa, setSeciliSayfa] = useState<string | null>(null);
  const wbRef = useRef<XLSX.WorkBook | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const data = useFinanceData();

  const analiz = useMemo(() => analizMizan(rows.filter((r) => r.hesap.trim() !== "")), [rows]);

  // Muhasebe kontrol asistanı: mizan + kayıtlı fiş/fatura/belge verisini tarar.
  // Yalnızca öneri üretir; store'a hiçbir yazma yapmaz.
  const asistan = useMemo(
    () =>
      kontrolAsistani({
        transactions: data.transactions,
        invoices: data.invoices,
        documents: data.documents,
        transfers: data.transfers,
        accounts: data.accounts,
        contacts: data.contacts,
        mizan: rows.filter((r) => r.hesap.trim() !== ""),
      }),
    [data, rows],
  );
  const asistanSayi = useMemo(
    () => ({
      kritik: asistan.filter((b) => b.seviye === "kritik").length,
      uyari: asistan.filter((b) => b.seviye === "uyari").length,
      bilgi: asistan.filter((b) => b.seviye === "bilgi").length,
    }),
    [asistan],
  );

  const seviyeSinif = (s: KontrolBulgu["seviye"]) =>
    s === "kritik"
      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      : s === "uyari"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        : "bg-muted text-muted-foreground";

  const fmt = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2 });

  const update = (i: number, patch: Partial<MizanSatir>) =>
    setRows((l) => l.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const sayfayiUygula = (ad: string) => {
    const wb = wbRef.current;
    if (!wb) return;
    const yeni = sheetToMizan(wb, ad);
    if (yeni) {
      setRows(yeni);
      setSeciliSayfa(ad);
      setExcelHata(null);
    } else {
      setExcelHata(`"${ad}" sayfasında geçerli mizan satırı bulunamadı. Hesap kodu sütunu gerekli.`);
    }
  };

  const onFile = async (file: File) => {
    setYukleniyor(true);
    setExcelHata(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      wbRef.current = wb;
      const adaylar = wb.SheetNames.map((ad) => ({ ad, satir: sheetToMizan(wb, ad)?.length ?? 0 }));
      const gecerli = adaylar.filter((s) => s.satir > 0);
      if (gecerli.length === 0) {
        setSheetList([]);
        setSeciliSayfa(null);
        wbRef.current = null;
        setExcelHata("Dosyada geçerli mizan satırı bulunamadı. Hesap kodu sütunu gerekli.");
        return;
      }
      setSheetList(gecerli);
      sayfayiUygula(gecerli[0].ad);
    } catch (e) {
      console.error(e);
      setSheetList([]);
      setSeciliSayfa(null);
      setExcelHata("Dosya okunamadı. .xlsx, .xls veya .csv deneyin.");
    } finally {
      setYukleniyor(false);
    }
  };

  const excelSections = [
    {
      title: "Özet",
      headers: ["Kontrol", "Sonuç"],
      rows: [
        ["Toplam Hesap", rows.filter((r) => r.hesap.trim()).length],
        ["Ters Bakiye", analiz.tersBakiye.length],
        ["Olağandışı Hesap", analiz.olaganDisi.length],
        ["Riskli Hesap", analiz.riskli.length],
        ["KDV Uyumsuzluk", analiz.kdvKontroller.filter((k) => k.durum === "uyari").length],
        ["Mizan Dengeli mi", analiz.dengeliMi ? "Evet" : "HAYIR — borç/alacak eşit değil"],
      ],
    },
    { title: "Ters Bakiye Tespit Edilen Hesaplar", headers: ["Hesap", "Hesap Adı", "Borç Bakiye", "Alacak Bakiye", "Sorun"], rows: analiz.tersBakiye.map((u) => [u.hesap, u.ad, u.bakiye > 0 ? u.bakiye : 0, u.bakiye < 0 ? -u.bakiye : 0, u.detay]) },
    { title: "Olağandışı Hesap Hareketleri", headers: ["Hesap", "Hesap Adı", "Bakiye", "Uyarı"], rows: analiz.olaganDisi.map((u) => [u.hesap, u.ad, +u.bakiye.toFixed(2), u.detay]) },
    { title: "Riskli Hesaplar (Vergi İnceleme Riski)", headers: ["Hesap", "Hesap Adı", "Bakiye", "Risk", "Açıklama"], rows: analiz.riskli.map((u) => [u.hesap, u.ad, +u.bakiye.toFixed(2), u.seviye === "yuksek" ? "Yüksek" : "Orta", u.detay]) },
    { title: "KDV Analizi", headers: ["Kontrol", "Durum", "Açıklama"], rows: analiz.kdvKontroller.map((k) => [k.kontrol, k.durum === "ok" ? "Uygun" : k.durum === "uyari" ? "UYARI" : "Bilgi", k.aciklama]) },
    {
      title: "Muhasebe Kontrol Asistanı",
      headers: ["Seviye", "Kategori", "Bulgu", "Açıklama", "Öneri"],
      rows: asistan.map((b) => [
        SEVIYE_ETIKET[b.seviye],
        KATEGORI_ETIKET[b.kategori],
        b.baslik,
        b.detay,
        b.oneri,
      ]),
      footers: ["Asistan yalnızca öneri üretir; hiçbir finansal kaydı değiştirmez."],
    },
    {
      title: "Genel Mizan Tablosu",
      headers: ["Hesap Kodu", "Hesap Adı", "Borç Toplamı", "Alacak Toplamı", "Borç Bakiye", "Alacak Bakiye"],
      rows: rows.filter((r) => r.hesap.trim()).map((r) => [r.hesap, r.ad, r.borcToplam, r.alacakToplam, r.borcBakiye, r.alacakBakiye]),
      footers: [
        `TOPLAM Borç: ${fmt(analiz.toplamBorcToplam)} · Alacak: ${fmt(analiz.toplamAlacakToplam)}`,
        `TOPLAM Borç Bakiye: ${fmt(analiz.toplamBorcBakiye)} · Alacak Bakiye: ${fmt(analiz.toplamAlacakBakiye)}`,
      ],
    },
  ];

  const durumRenk = (d: "ok" | "uyari" | "bilgi") =>
    d === "ok" ? "text-emerald-600" : d === "uyari" ? "text-red-600" : "text-muted-foreground";

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Mizan Analiz Raporu" subtitle={`${rows.filter((r) => r.hesap.trim()).length} hesap`} />
      <CalcCard
        title="Mizan Analiz Aracı"
        subtitle="Excel mizan dosyanızı yükleyin, ters bakiye, olağandışı hareketler, riskli hesaplar ve KDV uyumsuzluklarını anında tespit edin"
        actions={
          <ExportButtons
            excelName="mizan-analiz"
            excelTitle="Mizan Analiz Raporu"
            excelSheet="Mizan Analiz"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-analiz"
            disabled={rows.length === 0}
          />
        }
      >
        <Tabs defaultValue="giris">
          <TabsList className="print-hide">
            <TabsTrigger value="giris">Veri Girişi</TabsTrigger>
            <TabsTrigger value="sonuc">Analiz Sonucu</TabsTrigger>
            <TabsTrigger value="asistan">Kontrol Asistanı</TabsTrigger>
          </TabsList>

          <TabsContent value="giris" className="mt-4 grid gap-5">
            {/* Excel yükleme */}
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors hover:bg-muted/40 print-hide"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void onFile(f);
              }}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
              <Upload className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">Excel Mizan Dosyanızı Sürükleyip Bırakın</p>
              <p className="text-xs text-muted-foreground">veya tıklayarak seçin (.xlsx, .xls, .csv) — çok sayfalı dosyalar desteklenir{yukleniyor ? " — dosya okunuyor…" : ""}</p>
            </label>
            {excelHata && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{excelHata}</div>
            )}
            {sheetList.length > 0 && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 print-hide">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dosyadaki sayfalar ({sheetList.length}) — içe aktarılacak sayfayı seçin</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sheetList.map((s) => (
                    <button
                      key={s.ad}
                      type="button"
                      onClick={() => sayfayiUygula(s.ad)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs transition-colors",
                        seciliSayfa === s.ad ? "border-foreground bg-foreground text-background" : "hover:bg-muted/60",
                      )}
                    >
                      {s.ad} <span className="opacity-60">({s.satir} satır)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Manuel Mizan Girişi</p>
              <Button type="button" variant="outline" size="sm" className="print-hide" onClick={() => setRows((l) => [...l, bosSatir()])}>
                <Plus className="size-3.5" /> Satır
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Hesap kodu, hesap adı, borç/alacak toplamları ve bakiyeler. Her satır bir hesap. Excel'deki formüller hesaplanmış sonucu (değer) ile içe aktarılır.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Hesap Kodu</th>
                    <th className="px-2 py-1.5 font-medium">Hesap Adı</th>
                    <th className="px-2 py-1.5 text-right font-medium">Borç Toplamı</th>
                    <th className="px-2 py-1.5 text-right font-medium">Alacak Toplamı</th>
                    <th className="px-2 py-1.5 text-right font-medium">Borç Bakiyesi</th>
                    <th className="px-2 py-1.5 text-right font-medium">Alacak Bakiyesi</th>
                    <th className="w-8 print-hide" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const bakiye = r.borcBakiye - r.alacakBakiye;
                    const ters = r.hesap.trim() && ((hesapNiteligi(r.hesap) === "borc" && bakiye < -0.005) || (hesapNiteligi(r.hesap) === "alacak" && bakiye > 0.005));
                    return (
                      <tr key={i} className={cn("border-t", ters && "bg-red-50/50")}>
                        <td className="px-2 py-1.5"><Input className="h-8 w-24" value={r.hesap} onChange={(e) => update(i, { hesap: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><Input className="h-8 w-40" value={r.ad} onChange={(e) => update(i, { ad: e.target.value })} /></td>
                        {([["borcToplam", "0,00"], ["alacakToplam", "0,00"], ["borcBakiye", "0,00"], ["alacakBakiye", "0,00"]] as const).map(([key, ph]) => (
                          <td key={key} className="px-2 py-1.5 text-right">
                            <Input
                              className="h-8 w-28 text-right tabular-nums" type="text" inputMode="decimal"
                              value={r[key] ? formatInputValue(String(r[key])) : ""}
                              placeholder={ph}
                              onChange={(e) => update(i, { [key]: parseTurkishNumber(e.target.value) || 0 } as Partial<MizanSatir>)}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 print-hide">
                          <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => setRows((l) => l.filter((_, idx) => idx !== i))}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="sonuc" className="mt-4 grid gap-6">
            {/* Özet kutuları */}
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
              {[
                { label: "Toplam Hesap", v: String(rows.filter((r) => r.hesap.trim()).length), cls: "" },
                { label: "Ters Bakiye", v: String(analiz.tersBakiye.length), cls: analiz.tersBakiye.length ? "text-red-600" : "text-emerald-600" },
                { label: "Olağandışı Hareket", v: String(analiz.olaganDisi.length), cls: analiz.olaganDisi.length ? "text-amber-600" : "text-emerald-600" },
                { label: "KDV Uyumsuzluk", v: String(analiz.kdvKontroller.filter((k) => k.durum === "uyari").length), cls: analiz.kdvKontroller.some((k) => k.durum === "uyari") ? "text-orange-600" : "text-emerald-600" },
              ].map((x) => (
                <div key={x.label} className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">{x.label}</p>
                  <p className={cn("mt-1 font-mono text-xl font-semibold tabular-nums", x.cls)}>{x.v}</p>
                </div>
              ))}
            </div>

            {!analiz.dengeliMi && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                <strong>Mizan dengesiz!</strong> Borç toplamları {fmt(analiz.toplamBorcToplam)} TL, alacak
                toplamları {fmt(analiz.toplamAlacakToplam)} TL. Bakiyeler: borç {fmt(analiz.toplamBorcBakiye)} /
                alacak {fmt(analiz.toplamAlacakBakiye)}. Farkı kontrol edin.
              </div>
            )}

            {/* Ters bakiye */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ters Bakiye Tespit Edilen Hesaplar</p>
              {analiz.tersBakiye.length === 0 ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Ters bakiye tespit edilmedi. Tebrikler!</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">Hesap</th><th className="px-3 py-2 font-medium">Hesap Adı</th><th className="px-3 py-2 text-right font-medium">Borç Bakiye</th><th className="px-3 py-2 text-right font-medium">Alacak Bakiye</th><th className="px-3 py-2 font-medium">Sorun</th></tr></thead>
                    <tbody>
                      {analiz.tersBakiye.map((u, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-mono">{u.hesap}</td>
                          <td className="px-3 py-2">{u.ad}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{u.bakiye > 0 ? fmt(u.bakiye) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{u.bakiye < 0 ? fmt(-u.bakiye) : "—"}</td>
                          <td className="px-3 py-2 text-xs text-red-700">{u.detay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Olağandışı */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Olağandışı Hesap Hareketleri</p>
              {analiz.olaganDisi.length === 0 ? (
                <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">Olağandışı hareket tespit edilmedi.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">Hesap</th><th className="px-3 py-2 font-medium">Hesap Adı</th><th className="px-3 py-2 text-right font-medium">Bakiye</th><th className="px-3 py-2 font-medium">Uyarı</th></tr></thead>
                    <tbody>
                      {analiz.olaganDisi.map((u, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-mono">{u.hesap}</td>
                          <td className="px-3 py-2">{u.ad}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(u.bakiye)}</td>
                          <td className="px-3 py-2 text-xs text-amber-700">{u.detay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Riskli */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Riskli Hesaplar (Vergi İnceleme Riski)</p>
              {analiz.riskli.length === 0 ? (
                <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">Riskli hesap tespit edilmedi.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">Hesap</th><th className="px-3 py-2 font-medium">Hesap Adı</th><th className="px-3 py-2 text-right font-medium">Bakiye</th><th className="px-3 py-2 font-medium">Risk</th><th className="px-3 py-2 font-medium">Açıklama</th></tr></thead>
                    <tbody>
                      {analiz.riskli.map((u, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-mono">{u.hesap}</td>
                          <td className="px-3 py-2">{u.ad}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(u.bakiye)}</td>
                          <td className="px-3 py-2"><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", u.seviye === "yuksek" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>{u.seviye === "yuksek" ? "YÜKSEK" : "ORTA"}</span></td>
                          <td className="px-3 py-2 text-xs">{u.detay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* KDV */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">KDV Analizi ve Uyumsuzluk Kontrolü</p>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">Kontrol</th><th className="px-3 py-2 font-medium">Durum</th><th className="px-3 py-2 font-medium">Açıklama</th></tr></thead>
                  <tbody>
                    {analiz.kdvKontroller.map((k, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{k.kontrol}</td>
                        <td className={cn("px-3 py-2 text-xs font-semibold", durumRenk(k.durum))}>{k.durum === "ok" ? "✓ Uygun" : k.durum === "uyari" ? "⚠ UYARI" : "ℹ Bilgi"}</td>
                        <td className="px-3 py-2 text-xs">{k.aciklama}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Genel mizan */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Genel Mizan Tablosu</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-2 font-medium">Hesap Kodu</th><th className="px-3 py-2 font-medium">Hesap Adı</th><th className="px-3 py-2 text-right font-medium">Borç Toplamı</th><th className="px-3 py-2 text-right font-medium">Alacak Toplamı</th><th className="px-3 py-2 text-right font-medium">Borç Bakiye</th><th className="px-3 py-2 text-right font-medium">Alacak Bakiye</th></tr></thead>
                  <tbody>
                    {rows.filter((r) => r.hesap.trim()).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 font-mono">{r.hesap}</td>
                        <td className="px-3 py-2">{r.ad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.borcToplam)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.alacakToplam)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.borcBakiye)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.alacakBakiye)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/40 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>TOPLAM</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(analiz.toplamBorcToplam)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(analiz.toplamAlacakToplam)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(analiz.toplamBorcBakiye)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(analiz.toplamAlacakBakiye)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <InfoNote>
              Mizan verileri tarayıcınızdan çıkmaz; dosya yükleme tamamen istemci tarafında işlenir.
              100 Kasa üzerinde 500.000 TL bakiye, 131/231 ortaklardan alacaklar, 331 ortaklara borçlar ve 7xx
              yansıtma hesaplarındaki bakiyeler vergi incelemesinde özellikle incelenir.
            </InfoNote>
          </TabsContent>

          <TabsContent value="asistan" className="mt-4 grid gap-6">
            {/* Özet kutuları */}
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
              {[
                { label: "Toplam Bulgu", v: String(asistan.length), cls: asistan.length ? "text-foreground" : "text-emerald-600" },
                { label: "Kritik", v: String(asistanSayi.kritik), cls: asistanSayi.kritik ? "text-red-600" : "text-emerald-600" },
                { label: "Uyarı", v: String(asistanSayi.uyari), cls: asistanSayi.uyari ? "text-amber-600" : "text-emerald-600" },
                { label: "Bilgi", v: String(asistanSayi.bilgi), cls: "text-muted-foreground" },
              ].map((x) => (
                <div key={x.label} className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">{x.label}</p>
                  <p className={cn("mt-1 font-mono text-xl font-semibold tabular-nums", x.cls)}>{x.v}</p>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>
                <strong>Kontrol Asistanı</strong> dengesiz fişleri, mükerrer belgeleri, olağandışı
                tutarları ve eksik kayıtları tarar; yalnızca öneri sunar. Hiçbir finansal kaydı
                değiştirmez, silmez veya oluşturmaz — karar ve onay her zaman sizde.
              </p>
            </div>

            {asistan.length === 0 ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Kontrol edilecek bir sorun tespit edilmedi. Tebrikler!
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Seviye</th>
                      <th className="px-3 py-2 font-medium">Kategori</th>
                      <th className="px-3 py-2 font-medium">Bulgu</th>
                      <th className="px-3 py-2 font-medium">Açıklama</th>
                      <th className="px-3 py-2 font-medium">Öneri</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistan.map((b, i) => (
                      <tr key={i} className="border-t align-top">
                        <td className="px-3 py-2">
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", seviyeSinif(b.seviye))}>
                            {SEVIYE_ETIKET[b.seviye].toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">{KATEGORI_ETIKET[b.kategori]}</td>
                        <td className="px-3 py-2 text-xs font-medium">
                          {b.baslik}
                          {b.adet && b.adet > 1 && (
                            <span className="ml-1 text-muted-foreground">({b.adet})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{b.detay}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{b.oneri}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <InfoNote>
              Asistan; mizan (yüklediğiniz dosya), kasa/banka fişleri, faturalar, cariler ve belge
              okuma taslaklarını birlikte kontrol eder. Eşikler istatistiksel olarak belirlenir
              (kategori içi 3× IQR) ve sonuçlar bilgilendirme amaçlıdır; resmî beyanname yerine geçmez.
            </InfoNote>
          </TabsContent>
        </Tabs>
      </CalcCard>
    </div>
  );
}
