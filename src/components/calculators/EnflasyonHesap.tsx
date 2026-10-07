import { formatNumberInput, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaEnflasyon, type EnflasyonKalem } from "./engine/calcEngine";
import { YIUFE, yiufeDeger, yiufeGuncelDonem } from "./engine/yiufe";
import { ExportButtons } from "./engine/ExportButtons";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

let idCounter = 0;
const yeniId = () => `e${++idCounter}`;

const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const HIZLI_EKLE = [
  { hesap: "255", ad: "Binalar", tur: "aktif" as const },
  { hesap: "257", ad: "Demirbaşlar", tur: "aktif" as const },
  { hesap: "253", ad: "Tesis Makine ve Cihazlar", tur: "aktif" as const },
  { hesap: "254", ad: "Taşıtlar", tur: "aktif" as const },
  { hesap: "153", ad: "Teçhizat ve Malzemeler (Stok)", tur: "aktif" as const },
  { hesap: "500", ad: "Sermaye", tur: "pasif" as const },
  { hesap: "540", ad: "Yasal Yedekler", tur: "pasif" as const },
  { hesap: "570", ad: "Geçmiş Yıllar Kârları", tur: "pasif" as const },
];

function yeniKalem(): EnflasyonKalem {
  return { id: yeniId(), hesap: "255", ad: "Binalar", tur: "aktif", edinmeYil: 2023, edinmeAy: 1, defterDegeri: 0 };
}

export function EnflasyonHesap() {
  const guncel = yiufeGuncelDonem();
  const [donemSonuYil, setDonemSonuYil] = useState(guncel.yil);
  const [donemSonuAy, setDonemSonuAy] = useState(guncel.ay);
  const [kalemler, setKalemler] = useState<EnflasyonKalem[]>([]);
  const areaRef = useRef<HTMLDivElement>(null);

  const donemSonuEndeks = yiufeDeger(donemSonuYil, donemSonuAy);
  const r = useMemo(() => hesaplaEnflasyon(kalemler, donemSonuYil, donemSonuAy), [kalemler, donemSonuYil, donemSonuAy]);

  const fmt = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2 });

  const update = (id: string, patch: Partial<EnflasyonKalem>) =>
    setKalemler((l) => l.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  const endeksYillari: number[] = [];
  for (let y = 2026; y >= 1994; y--) endeksYillari.push(y);

  const excelSections = [
    {
      title: `Enflasyon Düzeltme Tablosu — Dönem Sonu: ${donemSonuYil}/${String(donemSonuAy).padStart(2, "0")} (Endeks: ${donemSonuEndeks?.toLocaleString("tr-TR") ?? "-"})`,
      headers: ["#", "Hesap", "Kalem", "A/P", "Edinme", "Defter Değeri", "Edinme End.", "Katsayı", "Düzeltilmiş", "Düzeltme Farkı"],
      rows: (r?.satirlar ?? []).map((s, i) => [
        i + 1, s.hesap, s.ad, s.tur === "aktif" ? "A" : "P",
        `${s.edinmeEndeksi > 0 ? `${s.id ? kalemler.find((k) => k.id === s.id)?.edinmeYil : ""}` : "-"}`,
        +s.defterDegeri.toFixed(2), s.edinmeEndeksi > 0 ? s.edinmeEndeksi : "-",
        s.katsayi > 0 ? +s.katsayi.toFixed(5) : "-", +s.duzeltilmis.toFixed(2), +s.fark.toFixed(2),
      ]),
      footers: [
        `AKTİF TOPLAM — Defter: ${(r?.aktifToplam.defter ?? 0).toFixed(2)} · Düzeltilmiş: ${(r?.aktifToplam.duzeltilmis ?? 0).toFixed(2)} · Fark: ${(r?.aktifToplam.fark ?? 0).toFixed(2)}`,
        `PASİF TOPLAM — Defter: ${(r?.pasifToplam.defter ?? 0).toFixed(2)} · Düzeltilmiş: ${(r?.pasifToplam.duzeltilmis ?? 0).toFixed(2)} · Fark: ${(r?.pasifToplam.fark ?? 0).toFixed(2)}`,
        `ENFLASYON DÜZELTME KÂRI/ZARARI: ${(r?.kzarar ?? 0).toFixed(2)} TL`,
      ],
      notes: [
        "VUK Mükerrer md.298 · 555 sıra no'lu VUK GT. Düzeltme Katsayısı = Dönem Sonu Yİ-ÜFE / Edinme Tarihi Yİ-ÜFE (2003=100).",
        "Parasal kalemler (kasa, banka, alacaklar, borçlar) enflasyon düzeltmesine tabi değildir.",
        "Enflasyon Düzeltme K/Z = Aktif Düzeltme Farkı − Pasif Düzeltme Farkı.",
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Enflasyon Düzeltmesi Hesaplama" subtitle={`Dönem sonu: ${donemSonuYil}/${String(donemSonuAy).padStart(2, "0")} · Endeks: ${donemSonuEndeks?.toLocaleString("tr-TR") ?? "girilmedi"}`} />
      <CalcCard
        title="Enflasyon Düzeltmesi (VUK Mük. md.298)"
        subtitle="Yİ-ÜFE endeks tablosu, düzeltme katsayısı, dönemsel düzeltme raporu"
        actions={
          <ExportButtons
            excelName="mizan-enflasyon-duzeltmesi"
            excelTitle="Enflasyon Düzeltmesi Hesaplama"
            excelSheet="Enflasyon"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-enflasyon-duzeltmesi"
            disabled={!r}
          />
        }
      >
        <Tabs defaultValue="hesap">
          <TabsList className="print-hide">
            <TabsTrigger value="hesap">Hesap</TabsTrigger>
            <TabsTrigger value="endeks">Endeks Tablosu</TabsTrigger>
          </TabsList>

          <TabsContent value="hesap" className="mt-4 grid gap-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Düzeltme Dönemi Sonu (Yıl)">
                <Select value={String(donemSonuYil)} onValueChange={(v) => setDonemSonuYil(parseInt(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {endeksYillari.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Dönem Sonu Ayı">
                <Select value={String(donemSonuAy)} onValueChange={(v) => setDonemSonuAy(parseInt(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AY_ADLARI.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)} disabled={yiufeDeger(donemSonuYil, i + 1) == null}>
                        {m}{yiufeDeger(donemSonuYil, i + 1) == null ? " (endeks yok)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {donemSonuEndeks == null && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                ⚠️ Hesaplama için seçili dönemin Yİ-ÜFE endeksi yok. "Endeks Tablosu" sekmesinden başka bir ay seçin.
              </div>
            )}

            <div className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">Parasal Olmayan Kalemler</p>
                <div className="flex flex-wrap items-center gap-1.5 print-hide">
                  <span className="text-xs text-muted-foreground">Hızlı ekle:</span>
                  {HIZLI_EKLE.map((h) => (
                    <Button
                      key={h.hesap} type="button" variant="outline" size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setKalemler((l) => [...l, { ...yeniKalem(), hesap: h.hesap, ad: h.ad, tur: h.tur }])}
                    >
                      {h.hesap} {h.ad}
                    </Button>
                  ))}
                </div>
              </div>

              {kalemler.length === 0 ? (
                <div className="mt-3 rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
                  Henüz kalem eklenmedi — hızlı ekle butonlarını veya "Kalem Ekle"yi kullanın
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {kalemler.map((k, i) => {
                    const satir = r?.satirlar.find((s) => s.id === k.id);
                    return (
                      <div key={k.id} className="grid items-center gap-2 rounded-md border bg-muted/20 p-2 sm:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
                        <Field label="Hesap Kodu">
                          <Input className="h-8" value={k.hesap} onChange={(e) => update(k.id, { hesap: e.target.value })} />
                        </Field>
                        <Field label="Kalem Adı">
                          <Input className="h-8" value={k.ad} onChange={(e) => update(k.id, { ad: e.target.value })} />
                        </Field>
                        <Field label="A/P">
                          <Select value={k.tur} onValueChange={(v) => update(k.id, { tur: v as EnflasyonKalem["tur"] })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aktif">Aktif</SelectItem>
                              <SelectItem value="pasif">Pasif</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Edinme (Yıl/Ay)">
                          <div className="flex gap-1">
                            <Input className="h-8" type="number" min={1994} max={2026} value={k.edinmeYil} onChange={(e) => update(k.id, { edinmeYil: parseInt(e.target.value) || 2023 })} />
                            <Select value={String(k.edinmeAy)} onValueChange={(v) => update(k.id, { edinmeAy: parseInt(v) })}>
                              <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {AY_ADLARI.map((m, mi) => <SelectItem key={mi} value={String(mi + 1)}>{mi + 1}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </Field>
                        <Field label="Defter Değeri (₺)">
                          <Input className="h-8 text-right tabular-nums" type="text" inputMode="decimal" value={k.defterDegeri ? formatNumberInput(k.defterDegeri) : ""} onChange={(e) => update(k.id, { defterDegeri: parseTurkishNumber(e.target.value) || 0 })} placeholder="0,00" />
                        </Field>
                        <div className="text-xs tabular-nums text-muted-foreground sm:pb-1">
                          <div>Endeks: {satir && satir.edinmeEndeksi > 0 ? satir.edinmeEndeksi.toLocaleString("tr-TR") : "YOK"}</div>
                          <div>Katsayı: {satir && satir.katsayi > 0 ? satir.katsayi.toFixed(5) : "-"}</div>
                          <div className={cn(satir && satir.fark > 0 && "text-emerald-600", satir && satir.fark < 0 && "text-red-600")}>
                            Fark: {satir && satir.katsayi > 0 ? fmt(satir.fark) : "-"}
                          </div>
                        </div>
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="size-7 text-muted-foreground print-hide"
                          onClick={() => setKalemler((l) => l.filter((x) => x.id !== k.id))}
                          title={`${i + 1}. satırı sil`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button type="button" variant="outline" size="sm" className="print-hide" onClick={() => setKalemler((l) => [...l, yeniKalem()])}>
                    <Plus className="size-3.5" /> Kalem Ekle
                  </Button>
                </div>
              )}
            </div>

            {r && kalemler.some((k) => k.defterDegeri > 0) && (
              <>
                <ResultBox>
                  <ResultRow label="Aktif Düzeltme Farkı Toplamı" value={fmt(r.aktifToplam.fark)} />
                  <ResultRow label="Pasif Düzeltme Farkı Toplamı" value={fmt(r.pasifToplam.fark)} />
                  <ResultTotalRow
                    label="Enflasyon Düzeltme Kârı / Zararı"
                    value={`${r.kzarar >= 0 ? "+" : ""}${fmt(r.kzarar)} ₺`}
                    valueClassName={r.kzarar >= 0 ? "text-emerald-600" : "text-destructive"}
                  />
                </ResultBox>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktif Kalemler</p>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-1.5 font-medium">Kalem</th>
                            <th className="px-2 py-1.5 text-right font-medium">Defter</th>
                            <th className="px-2 py-1.5 text-right font-medium">Düzeltilmiş</th>
                            <th className="px-2 py-1.5 text-right font-medium">Fark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.satirlar.filter((s) => s.tur === "aktif" && s.katsayi > 0).map((s) => (
                            <tr key={s.id} className="border-t">
                              <td className="px-2 py-1.5">{s.hesap} {s.ad}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.defterDegeri)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.duzeltilmis)}</td>
                              <td className={cn("px-2 py-1.5 text-right tabular-nums", s.fark >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(s.fark)}</td>
                            </tr>
                          ))}
                          <tr className="border-t bg-muted/30 font-semibold">
                            <td className="px-2 py-1.5">TOPLAM</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.aktifToplam.defter)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.aktifToplam.duzeltilmis)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.aktifToplam.fark)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pasif Kalemler</p>
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-1.5 font-medium">Kalem</th>
                            <th className="px-2 py-1.5 text-right font-medium">Defter</th>
                            <th className="px-2 py-1.5 text-right font-medium">Düzeltilmiş</th>
                            <th className="px-2 py-1.5 text-right font-medium">Fark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.satirlar.filter((s) => s.tur === "pasif" && s.katsayi > 0).map((s) => (
                            <tr key={s.id} className="border-t">
                              <td className="px-2 py-1.5">{s.hesap} {s.ad}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.defterDegeri)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(s.duzeltilmis)}</td>
                              <td className={cn("px-2 py-1.5 text-right tabular-nums", s.fark >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(s.fark)}</td>
                            </tr>
                          ))}
                          <tr className="border-t bg-muted/30 font-semibold">
                            <td className="px-2 py-1.5">TOPLAM</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.pasifToplam.defter)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.pasifToplam.duzeltilmis)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.pasifToplam.fark)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="endeks" className="mt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Yİ-ÜFE Endeks Tablosu (2003=100) — Kaynak: TÜİK. Son yayımlanan: {guncel.yil} {AY_ADLARI[guncel.ay - 1]} ({YIUFE[YIUFE.length - 1]}). Değerleri doğrulayınız.
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Yıl</th>
                    {AY_ADLARI.map((m) => <th key={m} className="px-1.5 py-1.5 text-right font-medium">{m.slice(0, 3)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019].map((y) => (
                    <tr key={y} className="border-t">
                      <td className="px-2 py-1.5 font-medium">{y}</td>
                      {AY_ADLARI.map((_, mi) => {
                        const v = yiufeDeger(y, mi + 1);
                        return (
                          <td key={mi} className={cn("px-1.5 py-1.5 text-right tabular-nums", v == null && "text-muted-foreground/40")}>
                            {v != null ? v.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InfoNote>
              Parazit koruması: düzeltme katsayısı = dönem sonu endeksi / edinme tarihi endeksi. Kırmızı/başlıklı
              aylarda endeks henüz yayımlanmadı.
            </InfoNote>
          </TabsContent>
        </Tabs>
      </CalcCard>
    </div>
  );
}
