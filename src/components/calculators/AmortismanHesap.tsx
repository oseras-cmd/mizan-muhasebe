import { formatInputValue, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, InfoNote } from "./shared";
import { hesaplaAmortisman, type Kiyimet } from "./engine/calcEngine";
import { ExportButtons } from "./engine/ExportButtons";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

let idCounter = 0;
const yeniId = () => `k${++idCounter}`;

const SIK_OMURLER = [
  { label: "Bina (50 yıl)", omur: 50 },
  { label: "Binek oto (5 yıl)", omur: 5 },
  { label: "Bilgisayar donanımı (4 yıl)", omur: 4 },
  { label: "Büro mobilyası (5 yıl)", omur: 5 },
  { label: "Makine-teçhizat (10 yıl)", omur: 10 },
  { label: "Demirbaş — 3 yıl 3.700₺ üstü (3 yıl)", omur: 3 },
];

function yeniKiyimet(): Kiyimet {
  return { id: yeniId(), ad: "", bedel: 0, faydaliOmr: 5, yontem: "normal", kist: false, aktifAy: new Date().getMonth() + 1 };
}

export function AmortismanHesap() {
  const [kiyimetler, setKiyimetler] = useState<Kiyimet[]>([yeniKiyimet()]);
  const [vergiYili, setVergiYili] = useState(new Date().getFullYear());
  const areaRef = useRef<HTMLDivElement>(null);

  const sonuclar = useMemo(
    () =>
      kiyimetler.map((k) => ({ kiyimet: k, r: hesaplaAmortisman(k, vergiYili) })),
    [kiyimetler, vergiYili],
  );
  const toplamBedel = kiyimetler.reduce((a, k) => a + (k.bedel || 0), 0);
  const buYilToplam = sonuclar.reduce((a, x) => a + (x.r?.satirlar.find((s) => s.yil === vergiYili)?.amortisman ?? 0), 0);

  const fmt = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2 });

  const update = (id: string, patch: Partial<Kiyimet>) =>
    setKiyimetler((list) => list.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  const excelSections: import("./engine/calcExport").ExcelSection[] = [];
  for (const { kiyimet: k, r } of sonuclar) {
    if (!r) continue;
    excelSections.push({
      title: `${k.ad || "Kıymet"} — ${k.yontem === "azalan" ? "Azalan Bakiyeler" : "Normal"}${k.kist ? " + Kıst" : ""} (${fmt(k.bedel)} TL, ${k.faydaliOmr} yıl)`,
      headers: ["Yıl", "Oran", "Amortisman", "Birikmiş", "Net Defter"],
      rows: r.satirlar.map((s) => [s.yil, `%${(s.oran * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`, +s.amortisman.toFixed(2), +s.birikmis.toFixed(2), +s.netDefter.toFixed(2)]),
    });
  }
  excelSections.push({
    title: "Özet",
    headers: ["Kalem", "Tutar (TL)"],
    rows: [
      ["Toplam Kıymet Değeri", toplamBedel],
      ["Bu Yıl Toplam Amortisman", buYilToplam],
    ],
    notes: [
      "VUK m.313-320. Azalan bakiyeler: normal oranın 2 katı, max %50. Kıst amortisman: binek otolarda aktife girdiği ay kesri tam sayılmak suretiyle kalan aylar kadar; ilk yılda ayrılmayan kısım son yıla eklenir.",
      "Faydalı ömürler Maliye Bakanlığı amortisman listelerine göre (örn. bilgisayar 4 yıl, binek oto 5 yıl, bina 50 yıl).",
    ],
  });

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Amortisman Hesaplama & Takip" subtitle={`${kiyimetler.length} kıymet · ${vergiYili}`} />
      <CalcCard
        title="Amortisman Hesaplama & Takip"
        subtitle="Normal/azalan bakiye, kıst amortisman, çoklu kıymet girişi ve yıllık amortisman tablosu"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 print-hide" onClick={() => setKiyimetler((l) => [...l, yeniKiyimet()])}>
              <Plus className="size-3.5" /> Kıymet
            </Button>
            <ExportButtons
              excelName="mizan-amortisman"
              excelTitle="Amortisman Hesaplama"
              excelSheet="Amortisman"
              excelSections={excelSections}
              pdfTargetRef={areaRef}
              pdfName="mizan-amortisman"
              disabled={sonuclar.every((x) => !x.r)}
            />
          </div>
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Amortisman Vergi Yılı (ilk yıl)">
              <Select value={String(vergiYili)} onValueChange={(v) => setVergiYili(parseInt(v))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:col-span-2">
              <strong className="text-foreground">Sık kullanılan faydalı ömürler:</strong>{" "}
              {SIK_OMURLER.map((o) => o.label).join(" · ")}
            </div>
          </div>

          <div className="space-y-4">
            {kiyimetler.map((k, i) => {
              const r = sonuclar.find((x) => x.kiyimet.id === k.id)?.r;
              return (
                <div key={k.id} className="rounded-lg border bg-card p-4 print-avoid-break">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">{i + 1}. Kıymet</p>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="size-7 text-muted-foreground print-hide"
                      onClick={() => setKiyimetler((l) => l.filter((x) => x.id !== k.id))}
                      disabled={kiyimetler.length <= 1}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Kıymet Adı">
                      <Input value={k.ad} onChange={(e) => update(k.id, { ad: e.target.value })} placeholder="örn. Binek oto" />
                    </Field>
                    <Field label="Alış Bedeli (₺)">
                      <Input type="text" inputMode="decimal" value={k.bedel ? formatInputValue(String(k.bedel)) : ""} onChange={(e) => update(k.id, { bedel: parseTurkishNumber(e.target.value) || 0 })} className="tabular-nums" placeholder="0,00" />
                    </Field>
                    <Field label="Faydalı Ömür (Yıl)">
                      <Input type="text" inputMode="numeric" value={String(k.faydaliOmr)} onChange={(e) => update(k.id, { faydaliOmr: Math.max(1, parseInt(e.target.value) || 1) })} className="tabular-nums" />
                    </Field>
                    <Field label="Amortisman Yöntemi">
                      <Select value={k.yontem} onValueChange={(v) => update(k.id, { yontem: v as Kiyimet["yontem"] })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal (Eşit Tutarlı)</SelectItem>
                          <SelectItem value="azalan">Azalan Bakiyeler</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Kıst Amortisman (binek oto vb.)">
                      <div className="flex h-9 items-center gap-3">
                        <Switch checked={k.kist} onCheckedChange={(v) => update(k.id, { kist: v })} id={`kist-${k.id}`} />
                        <Label htmlFor={`kist-${k.id}`} className="text-xs text-muted-foreground">{k.kist ? "Uygulanır" : "Uygulanmaz"}</Label>
                      </div>
                    </Field>
                    {k.kist && (
                      <Field label="Aktife Giriş Ayı">
                        <Select value={String(k.aktifAy)} onValueChange={(v) => update(k.id, { aktifAy: parseInt(v) })}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"].map((m, idx) => (
                              <SelectItem key={idx} value={String(idx + 1)}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </div>
                  {r && r.satirlar.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-1.5 font-medium">Yıl</th>
                            <th className="px-2 py-1.5 text-right font-medium">Oran</th>
                            <th className="px-2 py-1.5 text-right font-medium">Amortisman</th>
                            <th className="px-2 py-1.5 text-right font-medium">Birikmiş</th>
                            <th className="px-2 py-1.5 text-right font-medium">Net Defter</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.satirlar.map((s) => (
                            <tr key={s.yil} className={cn("border-t", s.yil === vergiYili && "bg-primary/5 font-medium")}>
                              <td className="px-2 py-1.5">{s.yil}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">%{(s.oran * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.amortisman)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.birikmis)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.netDefter)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
            <div className="bg-card px-5 py-4">
              <p className="text-xs text-muted-foreground">Toplam Kıymet Değeri</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmt(toplamBedel)} ₺</p>
            </div>
            <div className="bg-card px-5 py-4">
              <p className="text-xs text-muted-foreground">{vergiYili} Yılı Toplam Amortisman</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmt(buYilToplam)} ₺</p>
            </div>
          </div>

          <InfoNote>
            Azalan bakiyelerde normal amortisman oranının iki katı uygulanır ancak oran %50'yi aşamaz.
            Seçilen yöntemden normal amortismana geçilebilir; normalden azalan bakiyelere geçilemez (VUK m.315).
            Kıst amortisman: binek otomobillerde aktife girdikleri ay kesri tam sayılmak suretiyle kalan ay
            süresi kadar ayrılır; ilk yılda ayrılmayan kısım itfa süresinin son yılına eklenir (VUK m.320).
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
