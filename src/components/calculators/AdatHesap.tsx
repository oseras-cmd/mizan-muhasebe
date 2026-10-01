import { formatInputValue, parseTurkishNumber, todayIso } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote, Segmented } from "./shared";
import {
  hesaplaAdat,
  okuAdatExcel,
  varsayilanOranDonemleri,
  type AdatIslem,
  type AdatOranDonemi,
} from "./engine/adatEngine";
import { ExportButtons } from "./engine/ExportButtons";
import { Plus, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

let idCounter = 0;
const yeniId = () => `ad${++idCounter}`;

type Tur = "kasa" | "cari";

export function AdatHesap() {
  const [tur, setTur] = useState<Tur>("kasa");
  const [firma, setFirma] = useState("");
  const [vadeTarihi, setVadeTarihi] = useState(todayIso());
  const [yilGunu, setYilGunu] = useState(365);
  const [azamiTutar, setAzamiTutar] = useState(10000);
  const [kdvOrani, setKdvOrani] = useState(20);
  const [acilisBakiyesi, setAcilisBakiyesi] = useState(0);
  const [donemler, setDonemler] = useState<AdatOranDonemi[]>(() => varsayilanOranDonemleri());
  const [islemler, setIslemler] = useState<AdatIslem[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [sablonBilgi, setSablonBilgi] = useState<string | null>(null);
  const [sablonHata, setSablonHata] = useState<string | null>(null);
  const [sayfalar, setSayfalar] = useState<string[]>([]);
  const [seciliSayfa, setSeciliSayfa] = useState<string>("");
  const fileBufRef = useRef<ArrayBuffer | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const sonuc = useMemo(
    () =>
      hesaplaAdat(islemler, donemler, {
        acilisBakiyesi,
        vadeTarihi,
        yilGunu,
        azamiTutar,
        kdvOrani,
      }),
    [islemler, donemler, acilisBakiyesi, vadeTarihi, yilGunu, azamiTutar, kdvOrani],
  );

  const fmt = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

  const addIslem = () =>
    setIslemler((l) => [...l, { id: yeniId(), tarih: todayIso(), borc: 0, alacak: 0 }]);
  const update = (id: string, patch: Partial<AdatIslem>) =>
    setIslemler((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const addBulk = () => {
    const yeni: AdatIslem[] = [];
    for (const line of bulkText.split("\n").map((s) => s.trim()).filter(Boolean)) {
      const parts = line.split(/\t|;|,/).map((s) => s.trim());
      if (parts.length < 2) continue;
      let tarih = parts[0];
      const m = tarih.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
      if (m) tarih = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) continue;
      const borc = parseTurkishNumber(parts[1]) || 0;
      const alacak = parts[2] ? parseTurkishNumber(parts[2]) || 0 : 0;
      if (borc === 0 && alacak === 0) continue;
      yeni.push({ id: yeniId(), tarih, borc, alacak });
    }
    if (yeni.length > 0) {
      setIslemler((l) => [...l, ...yeni]);
      setBulkText("");
    }
  };

  /** Şablon dosyasından seçilen sayfayı uygula. */
  const sayfaUygula = (ad: string) => {
    const buf = fileBufRef.current;
    if (!buf) return;
    const icerik = okuAdatExcel(buf, ad || undefined);
    if (icerik.islemler.length === 0 && icerik.donemler.length === 0) {
      setSablonHata(`"${ad}" sayfasında işlem veya oran tablosu bulunamadı.`);
      return;
    }
    setSablonHata(null);
    setSeciliSayfa(ad);
    if (icerik.islemler.length > 0) {
      setIslemler(icerik.islemler.map((x) => ({ ...x, id: yeniId() })));
    }
    if (icerik.donemler.length > 0) setDonemler(icerik.donemler);
    if (icerik.firma) setFirma(icerik.firma);
    if (icerik.vadeTarihi) setVadeTarihi(icerik.vadeTarihi);
    // Not: şablondaki "Yıl Günü" hücresi 360 yazsa bile Excel formülleri 36500'e böler;
    // sonuçların şablonla birebir uyuşması için 365 varsayılanı korunur.
    if (icerik.azamiTutar != null && icerik.azamiTutar > 0) setAzamiTutar(icerik.azamiTutar);
    if (icerik.kdvOrani != null) setKdvOrani(icerik.kdvOrani);
    if (icerik.acilisBakiyesi != null) setAcilisBakiyesi(icerik.acilisBakiyesi);
    const kaynak = icerik.kaynakSayfa || ad;
    setSablonBilgi(
      `Şablon yüklendi: ${kaynak} sayfası — ${icerik.islemler.length} işlem, ${icerik.donemler.length} oran dönemi`,
    );
  };

  const onFile = async (file: File) => {
    setSablonHata(null);
    setSablonBilgi(null);
    try {
      const buf = await file.arrayBuffer();
      fileBufRef.current = buf;
      // Hangi sayfalar veri taşıyor? KASA/CARİ tercihli denenir.
      const adaylar = ["KASA", "CARİ"];
      const dolu: string[] = [];
      for (const ad of adaylar) {
        const t = okuAdatExcel(buf, ad);
        if (t.islemler.length > 0 || t.donemler.length > 0) dolu.push(ad);
      }
      if (dolu.length === 0) {
        setSablonHata("Şablonda işlem satırı veya oran tablosu bulunamadı. GD_ADAT şablonunu kullanın.");
        return;
      }
      setSayfalar(dolu);
      sayfaUygula(dolu[0]);
    } catch (e) {
      console.error(e);
      setSablonHata("Dosya okunamadı. .xlsx veya .xlsm dosyası deneyin.");
    }
  };

  const excelSections = [
    {
      title: "Parametreler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Tür", tur === "kasa" ? "Kasa Adat" : "Cari Hesap Adat"],
        ["Firma", firma || "—"],
        ["Vade / Hesaplama Tarihi", vadeTarihi],
        ["Yıl Günü", yilGunu],
        ["Azami (Adat Hariç) Tutar", azamiTutar],
        ["Açılış Bakiyesi", acilisBakiyesi],
        ["KDV Oranı (%)", kdvOrani],
        ["İşlem Sayısı", islemler.length],
      ],
    },
    {
      title: "İşlem Detay ve Faiz Hesabı",
      headers: ["Tarih", "Borç", "Alacak", "Bakiye", "İşlem Görecek", "Oran %", "Gün", "Faiz", "Kümülatif"],
      rows: sonuc.satirlar.map((s) => [
        s.islem.tarih,
        +s.islem.borc.toFixed(2),
        +s.islem.alacak.toFixed(2),
        +s.bakiye.toFixed(2),
        s.islemGorecek == null ? "—" : +s.islemGorecek.toFixed(2),
        s.oran,
        s.gun ?? "—",
        +s.faiz.toFixed(2),
        +s.kumulatif.toFixed(2),
      ]),
      footers: [
        `Toplam Adat Faizi: ${sonuc.toplamFaiz.toFixed(2)} TL`,
        `KDV (%${kdvOrani}): ${sonuc.kdv.toFixed(2)} TL`,
        `Fatura Genel Toplamı: ${sonuc.genelToplam.toFixed(2)} TL`,
      ],
    },
    {
      title: "Uygulanan Oran Dönemleri",
      headers: ["Başlangıç", "Oran (%)"],
      rows: donemler.map((d) => [d.bas, d.oran]),
      notes: [
        "Oranlar TCMB kısa vadeli avans işlemleri faiz oranıdır; şablon dosyadan veya varsayılan tablodan alınır.",
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader
        title="Kasa / Cari Adat Faiz Hesaplama"
        subtitle={`${tur === "kasa" ? "Kasa" : "Cari"} · ${islemler.length} işlem · vade ${vadeTarihi}`}
      />
      <CalcCard
        title="Kasa / Cari Adat (TCMB Faizi) Hesaplama"
        subtitle="Kasada/cari hesapta bekleyen fazla para için TCMB avans faiz oranıyla adat faizi, KDV ve muhasebe fişi — Excel şablonunuzdan doğrudan yükleyebilirsiniz"
        actions={
          <ExportButtons
            excelName="mizan-adat"
            excelTitle="Kasa / Cari Adat Faiz Hesaplama"
            excelSheet="Adat"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-adat"
            disabled={islemler.length === 0}
          />
        }
      >
        <div className="grid gap-6">
          {/* Tür seçimi */}
          <Segmented<Tur>
            options={[
              { value: "kasa", label: "Kasa Adat" },
              { value: "cari", label: "Cari Hesap Adat" },
            ]}
            value={tur}
            onChange={(v) => {
              setTur(v);
              if (v === "cari") setAzamiTutar(0);
              else setAzamiTutar((a) => (a === 0 ? 10000 : a));
            }}
            className="max-w-md"
          />

          {/* Parametreler */}
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Firma / Şahıs Adı">
              <Input value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="Örn. ABC Ltd. Şti." />
            </Field>
            <Field label="Vade / Hesaplama Tarihi" hint="Faiz bu tarihe kadar işler">
              <Input type="date" value={vadeTarihi} onChange={(e) => setVadeTarihi(e.target.value)} />
            </Field>
            <Field label="Yıl Günü" hint="Reeskont uygulamasında 360, adatta genellikle 365">
              <Select value={String(yilGunu)} onValueChange={(v) => setYilGunu(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="365">365</SelectItem>
                  <SelectItem value="360">360</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Azami (Adat Hariç) Tutar" hint="Bu tutara kadar ki bakiye faiz işlemez">
              <Input
                type="text" inputMode="decimal" className="tabular-nums"
                value={azamiTutar ? formatInputValue(String(azamiTutar)) : ""}
                onChange={(e) => setAzamiTutar(parseTurkishNumber(e.target.value) || 0)}
              />
            </Field>
            <Field label="Açılış Bakiyesi" hint="Cari hesapta önceki dönem bakiyesi">
              <Input
                type="text" inputMode="decimal" className="tabular-nums"
                value={acilisBakiyesi ? formatInputValue(String(acilisBakiyesi)) : ""}
                onChange={(e) => setAcilisBakiyesi(parseTurkishNumber(e.target.value) || 0)}
              />
            </Field>
            <Field label="KDV Oranı (%)">
              <Input
                type="text" inputMode="decimal" className="tabular-nums"
                value={kdvOrani ? formatInputValue(String(kdvOrani)) : ""}
                onChange={(e) => setKdvOrani(parseTurkishNumber(e.target.value) || 0)}
              />
            </Field>
          </div>

          {/* Excel şablonu yükleme */}
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Excel Şablonundan Yükle</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  GD_ADAT HESAPLAMA TABLOSU (.xlsx/.xlsm) — KASA veya CARİ sayfası otomatik tanınır
                </p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file" accept=".xlsx,.xlsm" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
                />
                <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60">
                  <Upload className="size-3.5" /> Şablon Seç
                </span>
              </label>
            </div>
            {sayfalar.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sayfa:</span>
                {sayfalar.map((s) => (
                  <button
                    key={s} type="button" onClick={() => sayfaUygula(s)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition-colors",
                      seciliSayfa === s ? "border-foreground bg-foreground text-background" : "hover:bg-muted/60",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {sablonBilgi && <p className="mt-2 text-xs text-emerald-700">{sablonBilgi}</p>}
            {sablonHata && <p className="mt-2 text-xs text-red-700">{sablonHata}</p>}
          </div>

          {/* Toplu yapıştırma */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Toplu İşlem Yapıştır</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Her satır: Tarih[TAB]Borç[TAB]Alacak — tarih GG.AA.YYYY veya YYYY-MM-DD
            </p>
            <Textarea
              className="mt-3 min-h-20 font-mono text-xs"
              placeholder={"15.01.2025\t15000\n2025-03-10\t\t8000"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" className="mt-3 print-hide" onClick={addBulk} disabled={!bulkText.trim()}>
              Satırları Ekle
            </Button>
          </div>

          {/* İşlem tablosu */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Kasa / Cari İşlemleri</p>
            <Button type="button" variant="outline" size="sm" className="print-hide" onClick={addIslem}>
              <Plus className="size-3.5" /> İşlem
            </Button>
          </div>

          {islemler.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Tarih</th>
                    <th className="px-2 py-1.5 text-right font-medium">Borç</th>
                    <th className="px-2 py-1.5 text-right font-medium">Alacak</th>
                    <th className="px-2 py-1.5 text-right font-medium">Bakiye</th>
                    <th className="px-2 py-1.5 text-right font-medium">İşlem Görecek</th>
                    <th className="px-2 py-1.5 text-right font-medium">Oran %</th>
                    <th className="px-2 py-1.5 text-right font-medium">Gün</th>
                    <th className="px-2 py-1.5 text-right font-medium">Adat Faizi</th>
                    <th className="px-2 py-1.5 text-right font-medium">Kümülatif</th>
                    <th className="w-8 print-hide" />
                  </tr>
                </thead>
                <tbody>
                  {sonuc.satirlar.map((s) => {
                    const i = islemler.find((x) => x.id === s.islem.id);
                    if (!i) return null;
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="px-2 py-1.5">
                          <Input type="date" className="h-8 w-36" value={i.tarih} onChange={(e) => update(i.id, { tarih: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Input
                            type="text" inputMode="decimal" className="h-8 w-28 text-right tabular-nums"
                            value={i.borc ? formatInputValue(String(i.borc)) : ""}
                            onChange={(e) => update(i.id, { borc: parseTurkishNumber(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Input
                            type="text" inputMode="decimal" className="h-8 w-28 text-right tabular-nums"
                            value={i.alacak ? formatInputValue(String(i.alacak)) : ""}
                            onChange={(e) => update(i.id, { alacak: parseTurkishNumber(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.bakiye)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {s.islemGorecek == null ? "—" : s.islemGorecek > 0 ? fmt(s.islemGorecek) : "0,00"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{s.oran.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{s.gun ?? "—"}</td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">{s.faiz ? fmt(s.faiz) : "—"}</td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{fmt(s.kumulatif)}</td>
                        <td className="px-2 py-1.5 print-hide">
                          <Button
                            type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground"
                            onClick={() => setIslemler((l) => l.filter((x) => x.id !== i.id))}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              📄 Henüz işlem yok — Excel şablonunuzu yükleyin, toplu yapıştırın veya tek tek ekleyin
            </div>
          )}

          {/* Sonuçlar */}
          {islemler.length > 0 && (
            <>
              <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
                <div className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground">Hesaplanan Adat Faizi</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmt(sonuc.toplamFaiz)}</p>
                </div>
                <div className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground">Hesaplanan KDV (%{kdvOrani})</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmt(sonuc.kdv)}</p>
                </div>
                <div className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground">Fatura Genel Toplamı</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-emerald-600">{fmt(sonuc.genelToplam)}</p>
                </div>
              </div>

              <ResultBox>
                <ResultRow label="Vade Tarihine Kalan Gün" value={sonuc.kalanGun != null ? `${sonuc.kalanGun} gün` : "—"} />
                <ResultRow label="İşlem Sayısı" value={String(islemler.length)} />
                <ResultRow label="Güncel Dönem Oranı" value={`%${donemler[donemler.length - 1]?.oran ?? 0}`} />
              </ResultBox>

              {/* Muhasebe fişi */}
              <div className="rounded-lg border bg-muted/20 px-5 py-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Muhasebe Kaydı</p>
                <div className="mt-2 grid gap-2 font-mono text-[13px] sm:grid-cols-2">
                  <div><strong>Borç</strong> 131 Ortaklardan Alacaklar — {fmt(sonuc.genelToplam)}</div>
                  <div><strong>Alacak</strong> 642 Faiz Gelirleri — {fmt(sonuc.toplamFaiz)}</div>
                  <div><strong>Alacak</strong> 391 Hesaplanan KDV — {fmt(sonuc.kdv)}</div>
                  <div className="text-muted-foreground">FİŞ TOPLAM: {fmt(sonuc.genelToplam)}</div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {tur === "kasa"
                    ? "100 Kasa hesabında azami tutar üzerinde bekleyen para için ortaklara ödendedor sayılan adat faizi."
                    : "Cari hesapta ortak bakiyesi üzerinden hesaplanan adat faizi."}
                </p>
              </div>
            </>
          )}

          {/* Oran dönemleri */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">TCMB Avans Faiz Oranları ({donemler.length} dönem)</p>
              <Button
                type="button" variant="ghost" size="sm" className="print-hide"
                onClick={() => setDonemler(varsayilanOranDonemleri())}
              >
                Varsayılana Dön
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                  <tr className="text-left uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">Başlangıç</th>
                    <th className="px-3 py-1.5 text-right font-medium">Oran (%)</th>
                    <th className="w-8 print-hide" />
                  </tr>
                </thead>
                <tbody>
                  {donemler.map((d, idx) => (
                    <tr key={d.bas + idx} className="border-t">
                      <td className="px-3 py-1">
                        <Input type="date" className="h-7 w-36 text-xs" value={d.bas}
                          onChange={(e) => setDonemler((l) => l.map((x, j) => (j === idx ? { ...x, bas: e.target.value } : x)).sort((a, b) => a.bas.localeCompare(b.bas)))} />
                      </td>
                      <td className="px-3 py-1 text-right">
                        <Input
                          type="text" inputMode="decimal"
                          className="h-7 w-20 text-right text-xs tabular-nums"
                          value={d.oran ? String(d.oran).replace(".", ",") : ""}
                          onChange={(e) => setDonemler((l) => l.map((x, j) => (j === idx ? { ...x, oran: parseTurkishNumber(e.target.value) || 0 } : x)))}
                        />
                      </td>
                      <td className="px-2 py-1 print-hide">
                        <Button
                          type="button" variant="ghost" size="icon" className="size-6 text-muted-foreground"
                          onClick={() => setDonemler((l) => l.filter((_, j) => j !== idx))}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <InfoNote>
            Danıştay kararları uyarınca kasada/cari hesapta bekletilen fazla paranın ortaklara ödendedor
            sayılması için TCMB kısa vadeli avans işlemleri faiz oranı üzerinden adat faizi hesaplanır ve
            642 Faiz Gelirleri olarak kayda alınır. Bu araç GD_ADAT HESAPLAMA TABLOSU şablonundaki formüllerin
            birebir karşılığıdır; hesaplama uygulama içinde canlı yapılır, dosyanız hiçbir sunucuya yüklenmez.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
