import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { CalcCard, PrintHeader, InfoNote } from "./shared";
import { ExportButtons } from "./engine/ExportButtons";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface YevFis {
  yevNo: string;
  tarih: string;
  fisNo: string;
  satirlar: { hesap: string; ad: string; aciklama: string; belge: string; borc: number; alacak: number }[];
}
interface KebirSatir {
  yevTarih: string;
  yevNo: string;
  hesap: string;
  ad: string;
  aciklama: string;
  borc: number;
  alacak: number;
}
interface BeratBilgi {
  basliklar: { etiket: string; deger: string }[];
}

type DefterTuru = "yevmiye" | "kebir" | "berat";

function localText(el: Element | null | undefined): string {
  return (el?.textContent ?? "").trim();
}

function firstByLocal(root: Element | null | undefined, localName: string, nsUris: string[]): Element | null {
  if (!root) return null;
  for (const ns of nsUris) {
    const el = root.getElementsByTagNameNS(ns, localName)[0];
    if (el) return el;
  }
  const all = root.getElementsByTagName("*");
  for (const el of Array.from(all)) {
    if (el.localName === localName) return el;
  }
  return null;
}

function allByLocal(root: Element, localName: string): Element[] {
  const all = root.getElementsByTagName("*");
  return Array.from(all).filter((el) => el.localName === localName);
}

function parseDefterXml(xml: string): { tur: DefterTuru; yevmiye: YevFis[]; kebir: KebirSatir[]; berat: BeratBilgi | null; toplamBorc: number; toplamAlacak: number } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) throw new Error("XML ayrıştırılamadı — dosya bozuk olabilir.");
  const root = doc.documentElement;

  // İsim alanlarını keşfet
  const nsSet = new Set<string>();
  const walk = (el: Element) => {
    if (el.namespaceURI) nsSet.add(el.namespaceURI);
    for (const c of Array.from(el.children)) walk(c);
  };
  walk(root);
  const nsUris = Array.from(nsSet);

  const num = (s: string) => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : 0;
  };

  const yevmiye: YevFis[] = [];
  const kebir: KebirSatir[] = [];
  let berat: BeratBilgi | null = null;
  let toplamBorc = 0;
  let toplamAlacak = 0;

  // XBRL-GL: journal → journalEntry (yevmiye)
  const journal = firstByLocal(root, "journal", nsUris);
  if (journal) {
    for (const je of allByLocal(journal, "journalEntry")) {
      const yevNo = localText(firstByLocal(je, "enteredBy", nsUris)?.getElementsByTagName("*")[0] ?? null) || "";
      const tarihEl = firstByLocal(je, "enteredDate", nsUris);
      const fisNoEl = firstByLocal(je, "documentNumber", nsUris) ?? firstByLocal(je, "documentType", nsUris);
      const fis: YevFis = {
        yevNo,
        tarih: localText(tarihEl).slice(0, 10),
        fisNo: localText(fisNoEl),
        satirlar: [],
      };
      for (const line of allByLocal(je, "line")) {
        // amount
        const amount = num(localText(firstByLocal(line, "amount", nsUris)));
        const detail = firstByLocal(line, "detail", nsUris) ?? line;
        const acct = firstByLocal(detail, "account", nsUris) ?? firstByLocal(line, "account", nsUris);
        const hesap = localText(firstByLocal(acct, "id", nsUris)) || localText(firstByLocal(detail, "accountSub", nsUris));
        const ad = localText(acct?.getElementsByTagName("*")[1] ?? null);
        const aciklama = localText(firstByLocal(detail, "comment", nsUris)) || localText(firstByLocal(detail, "detailComment", nsUris));
        const belge = localText(firstByLocal(detail, "documentNumber", nsUris));
        const dc = localText(firstByLocal(detail, "debitCreditCode", nsUris)) || localText(firstByLocal(line, "debitCreditCode", nsUris));
        const borc = dc === "D" || dc === "1" ? amount : 0;
        const alacak = dc === "C" || dc === "2" ? amount : 0;
        fis.satirlar.push({ hesap, ad, aciklama, belge, borc, alacak });
        toplamBorc += borc;
        toplamAlacak += alacak;
      }
      if (fis.satirlar.length > 0) yevmiye.push(fis);
    }
  }

  // ledgerTransaction (kebir)
  const ledger = firstByLocal(root, "ledger", nsUris);
  if (ledger) {
    for (const lt of allByLocal(ledger, "ledgerTransaction")) {
      const tarih = localText(firstByLocal(lt, "enteredDate", nsUris)).slice(0, 10);
      for (const line of allByLocal(lt, "line")) {
        const amount = num(localText(firstByLocal(line, "amount", nsUris)));
        const detail = firstByLocal(line, "detail", nsUris) ?? line;
        const acct = firstByLocal(detail, "account", nsUris) ?? firstByLocal(line, "account", nsUris);
        const hesap = localText(firstByLocal(acct, "id", nsUris));
        const ad = localText(acct?.getElementsByTagName("*")[1] ?? null);
        const dc = localText(firstByLocal(detail, "debitCreditCode", nsUris)) || localText(firstByLocal(line, "debitCreditCode", nsUris));
        const borc = dc === "D" || dc === "1" ? amount : 0;
        const alacak = dc === "C" || dc === "2" ? amount : 0;
        kebir.push({ yevTarih: tarih, yevNo: "", hesap, ad, aciklama: "", borc, alacak });
        toplamBorc += borc;
        toplamAlacak += alacak;
      }
    }
  }

  // Berat: genel bilgi alanları
  const basliklar: { etiket: string; deger: string }[] = [];
  const infTanim = [
    { etiket: "Dönem", locals: ["periodStart", "periodEnd", "period"] },
    { etiket: "Mükellef VKN", locals: ["taxNumber", "vkn", "entityIdentification"] },
    { etiket: "Mükellef Unvan", locals: ["entityDescription", "unvan", "companyName"] },
    { etiket: "Mükellef Adres", locals: ["address", "adres"] },
    { etiket: "Defter Türü", locals: ["defterTur", "ledgerType"] },
    { etiket: "Yıl", locals: ["year", "yil"] },
  ];
  for (const t of infTanim) {
    for (const l of t.locals) {
      const el = firstByLocal(root, l, nsUris);
      if (el) {
        const deger = localText(el);
        if (deger) { basliklar.push({ etiket: t.etiket, deger }); break; }
      }
    }
  }
  // imza/GIB onay değerleri
  for (const tag of ["SignatureValue", "hash", "digest", "imzaDegeri"]) {
    const el = firstByLocal(root, tag, nsUris);
    if (el) { basliklar.push({ etiket: "İmza / Özet Değer", deger: localText(el).slice(0, 120) }); break; }
  }
  if (basliklar.length > 0 || (yevmiye.length === 0 && kebir.length === 0)) {
    berat = { basliklar };
  }

  const tur: DefterTuru = yevmiye.length > 0 ? "yevmiye" : kebir.length > 0 ? "kebir" : "berat";
  return { tur, yevmiye, kebir, berat, toplamBorc, toplamAlacak };
}

export function XmlEdefterHesap() {
  const [tur, setTur] = useState<DefterTuru>("yevmiye");
  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [parsed, setParsed] = useState<ReturnType<typeof parseDefterXml> | null>(null);
  const [arama, setArama] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);

  const onFile = async (file: File) => {
    setYukleniyor(true);
    setHata(null);
    try {
      const text = await file.text();
      const p = parseDefterXml(text);
      setParsed(p);
      setDosyaAdi(file.name);
    } catch (e) {
      console.error(e);
      setParsed(null);
      setHata(e instanceof Error ? e.message : "XML okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  };

  const f = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2 });
  const aranan = arama.toLocaleLowerCase("tr-TR");
  const matchYev = (s: { hesap: string; ad: string; aciklama: string; belge: string }) =>
    !aranan || [s.hesap, s.ad, s.aciklama, s.belge].some((x) => x.toLocaleLowerCase("tr-TR").includes(aranan));

  const excelSections = parsed
    ? [
        ...(parsed.yevmiye.length > 0
          ? [{
              title: "Yevmiye Defteri",
              headers: ["Fiş", "Tarih", "Hesap", "Ad", "Açıklama", "Belge", "Borç", "Alacak"],
              rows: parsed.yevmiye.flatMap((fis) => fis.satirlar.map((s) => [fis.fisNo || fis.yevNo, fis.tarih, s.hesap, s.ad, s.aciklama, s.belge, s.borc, s.alacak])),
              footers: [`TOPLAM Borç: ${f(parsed.toplamBorc)} · Alacak: ${f(parsed.toplamAlacak)}`],
            }]
          : []),
        ...(parsed.kebir.length > 0
          ? [{
              title: "Büyük Defter (Kebir)",
              headers: ["Yev. Tarih", "Hesap", "Ad", "Borç", "Alacak"],
              rows: parsed.kebir.map((s) => [s.yevTarih, s.hesap, s.ad, s.borc, s.alacak]),
              footers: [`TOPLAM Borç: ${f(parsed.toplamBorc)} · Alacak: ${f(parsed.toplamAlacak)}`],
            }]
          : []),
        ...(parsed.berat && parsed.berat.basliklar.length > 0
          ? [{
              title: "Berat / Defter Bilgileri",
              headers: ["Alan", "Değer"],
              rows: parsed.berat.basliklar.map((b) => [b.etiket, b.deger]),
            }]
          : []),
      ]
    : [];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="XML e-Defter Görüntüleyici" subtitle={dosyaAdi ?? undefined} />
      <CalcCard
        title="XML e-Defter Görüntüleyici"
        subtitle="Yevmiye, Kebir, Berat ve Defter Raporu XML dosyalarınızı saniyeler içinde okunabilir, yazdırılabilir belgeye çevirin — %100 cihazınızda işlenir"
        actions={
          <ExportButtons
            excelName="mizan-edefter"
            excelTitle="XML e-Defter Görüntüleme"
            excelSheet="e-Defter"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-edefter"
            disabled={!parsed}
          />
        }
      >
        <div className="grid gap-6">
          {/* 1. tür seçimi */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1. Defter türünü seçin</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {([
                { id: "yevmiye", label: "Yevmiye Defteri" },
                { id: "kebir", label: "Büyük Defter (Kebir)" },
                { id: "berat", label: "Berat" },
                { id: "berat", label: "Defter Raporu" },
              ] as { id: DefterTuru; label: string }[]).map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTur(t.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-colors",
                    tur === t.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted/50",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. yükleme */}
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/40 print-hide"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) void onFile(file);
            }}
          >
            <input
              type="file" accept=".xml" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file); }}
            />
            <Upload className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">Dosyayı sürükleyip bırakın ya da göz atın</p>
            <p className="text-xs text-muted-foreground">GİB e-Defter XML · en fazla 80 MB · sunucuya yüklenmez{yukleniyor ? " · dosya işleniyor…" : ""}</p>
          </label>

          {hata && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{hata}</div>}

          {parsed && (
            <Tabs defaultValue={parsed.tur}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="print-hide">
                  {parsed.yevmiye.length > 0 && <TabsTrigger value="yevmiye">Yevmiye</TabsTrigger>}
                  {parsed.kebir.length > 0 && <TabsTrigger value="kebir">Kebir</TabsTrigger>}
                  {parsed.berat && <TabsTrigger value="berat">Berat / Bilgiler</TabsTrigger>}
                </TabsList>
                {(parsed.yevmiye.length > 0 || parsed.kebir.length > 0) && (
                  <Input
                    className="w-64 print-hide"
                    placeholder="Hesap kodu / açıklama / belge ara…"
                    value={arama}
                    onChange={(e) => setArama(e.target.value)}
                  />
                )}
              </div>

              {/* Özet */}
              <div className="mt-4 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
                <div className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">{parsed.tur === "yevmiye" ? "Fiş / Kayıt" : "Satır"}</p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{parsed.yevmiye.length > 0 ? parsed.yevmiye.length : parsed.kebir.length || parsed.berat?.basliklar.length || 0}</p>
                </div>
                <div className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Satır Sayısı</p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {parsed.yevmiye.reduce((a, x) => a + x.satirlar.length, 0) || parsed.kebir.length || 0}
                  </p>
                </div>
                <div className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Toplam Borç</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{f(parsed.toplamBorc)}</p>
                </div>
                <div className="bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">Toplam Alacak</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{f(parsed.toplamAlacak)}</p>
                </div>
              </div>

              <TabsContent value="yevmiye" className="mt-4 grid gap-4">
                {parsed.yevmiye.map((fis, fi) => (
                  <div key={fi} className="overflow-hidden rounded-lg border print-avoid-break">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2 text-xs">
                      <span className="font-semibold">Fiş #{fis.fisNo || fi + 1} {fis.yevNo && `· Yev. No: ${fis.yevNo}`}</span>
                      <span className="text-muted-foreground">{fis.tarih} · Muhasebe Fiş No: {fis.fisNo || "—"}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-1.5 font-medium">Tarih</th>
                            <th className="px-2 py-1.5 font-medium">Hesap Kodu</th>
                            <th className="px-2 py-1.5 font-medium">Hesap Adı</th>
                            <th className="px-2 py-1.5 font-medium">Açıklama</th>
                            <th className="px-2 py-1.5 font-medium">Belge</th>
                            <th className="px-2 py-1.5 text-right font-medium">Borç</th>
                            <th className="px-2 py-1.5 text-right font-medium">Alacak</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fis.satirlar.filter(matchYev).map((s, si) => (
                            <tr key={si} className="border-t">
                              <td className="px-2 py-1.5">{fis.tarih}</td>
                              <td className="px-2 py-1.5 font-mono">{s.hesap}</td>
                              <td className="px-2 py-1.5">{s.ad}</td>
                              <td className="px-2 py-1.5 max-w-48 truncate" title={s.aciklama}>{s.aciklama}</td>
                              <td className="px-2 py-1.5">{s.belge}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{s.borc ? f(s.borc) : ""}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{s.alacak ? f(s.alacak) : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="kebir" className="mt-4 overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">Yev. Tarih</th>
                      <th className="px-2 py-1.5 font-medium">Hesap Kodu</th>
                      <th className="px-2 py-1.5 font-medium">Hesap Adı</th>
                      <th className="px-2 py-1.5 text-right font-medium">Borç</th>
                      <th className="px-2 py-1.5 text-right font-medium">Alacak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.kebir.filter((s) => !aranan || [s.hesap, s.ad].some((x) => x.toLocaleLowerCase("tr-TR").includes(aranan))).map((s, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5">{s.yevTarih}</td>
                        <td className="px-2 py-1.5 font-mono">{s.hesap}</td>
                        <td className="px-2 py-1.5">{s.ad}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{s.borc ? f(s.borc) : ""}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{s.alacak ? f(s.alacak) : ""}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-muted/40 font-semibold">
                      <td className="px-2 py-1.5" colSpan={3}>GENEL TOPLAM</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{f(parsed.toplamBorc)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{f(parsed.toplamAlacak)}</td>
                    </tr>
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="berat" className="mt-4 grid gap-4">
                {parsed.berat && parsed.berat.basliklar.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <tbody>
                        {parsed.berat.basliklar.map((b, i) => (
                          <tr key={i} className="border-t first:border-t-0">
                            <td className="w-56 bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{b.etiket}</td>
                            <td className="px-3 py-2 font-mono text-xs">{b.deger}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">
                    Bu dosyada berat bilgisi bulunamadı. Yevmiye/kebir içeriyor olabilir.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          )}

          {!parsed && !hata && (
            <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              Dosya yükleyin — defter bilgileri, yevmiye fişleri, borç/alacak denkliği otomatik hesaplanır
            </div>
          )}

          <InfoNote>
            GİB e-Defter XML dosyaları XBRL-GL standardındadır. Bu araç tamamen tarayıcınızda çalışır; dosyanız
            hiçbir sunucuya yüklenmez (VUK sır saklama ve KVKK uyumlu). Borç/alacak denkliği (borç = alacak)
            fiş bazında kontrol edilebilir.
          </InfoNote>
          <Button type="button" variant="ghost" size="sm" className="print-hide" onClick={() => { setParsed(null); setDosyaAdi(null); }} disabled={!parsed}>
            Temizle
          </Button>
        </div>
      </CalcCard>
    </div>
  );
}
