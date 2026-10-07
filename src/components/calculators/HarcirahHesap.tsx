import { formatNumberInput, parseTurkishNumber } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaHarcirah, harcirahIstisnaGunluk, HARCIRAH_STATU_ADLARI, HARCIRAH_YURT_DISI_GRUPLARI, type HarcirahPersonel } from "./engine/calcEngine";
import { PARAMS_2026 } from "./engine/params";
import { ExportButtons } from "./engine/ExportButtons";
import { Trash2, Plus } from "lucide-react";

let idCounter = 0;
const yeniId = () => `p${++idCounter}`;

function yeniPersonel(tur: "yurtIci" | "yurtDisi" = "yurtIci"): HarcirahPersonel {
  return {
    id: yeniId(),
    ad: `Personel ${idCounter}`,
    tur,
    ulkeGrup: HARCIRAH_YURT_DISI_GRUPLARI[4].grup,
    statu: "memur",
    gundelikOdenen: 900,
    konaklama: 0,
    ulasim: 0,
    geceSayisi: 3,
  };
}

export function HarcirahHesap() {
  const [personeller, setPersoneller] = useState<HarcirahPersonel[]>([yeniPersonel()]);
  const areaRef = useRef<HTMLDivElement>(null);

  const sonuclar = useMemo(
    () => personeller.map((p) => hesaplaHarcirah(p)).filter((x): x is NonNullable<typeof x> => x != null),
    [personeller],
  );
  const toplamHarcirah = sonuclar.reduce((a, x) => a + x.toplam, 0);
  const toplamVergiyeTabi = sonuclar.reduce((a, x) => a + x.vergiyeTabi, 0);
  const toplamIstisna = sonuclar.reduce((a, x) => a + x.istisnaToplam, 0);

  const fmt = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

  const update = (id: string, patch: Partial<HarcirahPersonel>) =>
    setPersoneller((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const excelSections = [
    {
      title: "Personel Bazında Harcırah Hesabı",
      headers: ["Personel", "Tür", "Statü", "Gece", "Gündelik/Gün", "İstisna/Gün", "İstisna Toplam", "İstisnayı Aşan", "Konaklama", "Ulaşım", "Toplam"],
      rows: sonuclar.map((r) => {
        const p = personeller.find((x) => x.id === r.id)!;
        return [
          r.ad, p.tur === "yurtIci" ? "Yurt içi" : "Yurt dışı",
          HARCIRAH_STATU_ADLARI[p.statu], p.geceSayisi,
          p.gundelikOdenen, r.istisnaGunluk, r.istisnaToplam, r.asanToplam,
          r.konaklama, r.ulasim, r.toplam,
        ];
      }),
    },
    {
      title: "Özet",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        ["Toplam Harcırah", toplamHarcirah],
        ["GV'den İstisna Toplam", toplamIstisna],
        ["Vergiye Tabi (Bordrolanacak)", toplamVergiyeTabi],
      ],
      notes: [
        "GVK m.24: GV istisnası devlet memuruna verilen en yüksek gündeliğin kendisiyle sınırlıdır (2026: 900 TL); aşan kısım ücret olarak vergilendirilir.",
        "Konaklama belgeli olmak koşuluyla tamamen istisnadır. Muhasebe: 770 Genel Yönetim Giderleri / 100 Kasa / 102 Bankalar.",
        `2026 yurt içi istisna gündelikleri: Ücretli/memur ×1 = ${fmt(PARAMS_2026.DEVLET_GUNDELIK)} · İşveren vekili ×8 = ${fmt(PARAMS_2026.DEVLET_GUNDELIK * 8)} · İşveren ×6 = ${fmt(PARAMS_2026.DEVLET_GUNDELIK * 6)}.`,
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Harcırah Hesaplama Raporu" subtitle={`${sonuclar.length} personel`} />
      <CalcCard
        title="Harcırah Hesaplayıcı"
        subtitle="Yurt içi/dışı harcırah, GV istisnası, gündelik ve konaklama tutarları — toplu personel girişi"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 print-hide" onClick={() => setPersoneller((l) => [...l, yeniPersonel("yurtIci")])}>
              <Plus className="size-3.5" /> Personel
            </Button>
            <ExportButtons
              excelName="mizan-harcirah"
              excelTitle="Harcırah Hesaplama"
              excelSheet="Harcırah"
              excelSections={excelSections}
              pdfTargetRef={areaRef}
              pdfName="mizan-harcirah"
              disabled={sonuclar.length === 0}
            />
          </div>
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Seyahat Türü (yeni personel için)">
              <Select
                defaultValue="yurtIci"
                onValueChange={(v) => setPersoneller((l) => [...l, yeniPersonel(v as "yurtIci" | "yurtDisi")])}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yurtIci">Yurt içi</SelectItem>
                  <SelectItem value="yurtDisi">Yurt dışı</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
              GV istisna gündelik (yurt içi, ücretli/memur): <strong>{fmt(PARAMS_2026.DEVLET_GUNDELIK)}</strong> ·
              İstisna, devlet memuruna verilen en yüksek gündelik tutarının kendisiyle sınırlıdır; aşan kısım
              ücret olarak vergilendirilir (GVK 24/2).
            </div>
          </div>

          <div className="space-y-4">
            {personeller.map((p, i) => {
              const r = sonuclar.find((x) => x.id === p.id);
              return (
                <div key={p.id} className="rounded-lg border bg-card p-4 print-avoid-break">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">{i + 1}. {p.ad || "Personel"} {p.tur === "yurtDisi" && "· Yurt dışı"}</p>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="size-7 text-muted-foreground print-hide"
                      onClick={() => setPersoneller((l) => l.filter((x) => x.id !== p.id))}
                      disabled={personeller.length <= 1}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Ad">
                      <Input value={p.ad} onChange={(e) => update(p.id, { ad: e.target.value })} />
                    </Field>
                    <Field label="Personel Statüsü">
                      <Select value={p.statu} onValueChange={(v) => update(p.id, { statu: v as HarcirahPersonel["statu"] })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(HARCIRAH_STATU_ADLARI) as HarcirahPersonel["statu"][]).map((s) => (
                            <SelectItem key={s} value={s}>{HARCIRAH_STATU_ADLARI[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {p.tur === "yurtDisi" && (
                      <Field label="Ülke Grubu">
                        <Select value={p.ulkeGrup} onValueChange={(v) => update(p.id, { ulkeGrup: v })}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {HARCIRAH_YURT_DISI_GRUPLARI.map((g) => (
                              <SelectItem key={g.grup} value={g.grup}>{g.grup}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    <Field label="Ödenen Gündelik (₺/gün)">
                      <Input type="text" inputMode="decimal" value={formatNumberInput(p.gundelikOdenen)} onChange={(e) => update(p.id, { gundelikOdenen: parseTurkishNumber(e.target.value) || 0 })} className="tabular-nums" />
                    </Field>
                    <Field label="Gece Sayısı">
                      <Input type="text" inputMode="numeric" value={String(p.geceSayisi)} onChange={(e) => update(p.id, { geceSayisi: Math.max(1, parseInt(e.target.value) || 1) })} className="tabular-nums" />
                    </Field>
                    <Field label="Konaklama Bedeli (₺, toplam)">
                      <Input type="text" inputMode="decimal" value={formatNumberInput(p.konaklama)} onChange={(e) => update(p.id, { konaklama: parseTurkishNumber(e.target.value) || 0 })} className="tabular-nums" />
                    </Field>
                    <Field label="Ulaşım Bedeli (₺, toplam)">
                      <Input type="text" inputMode="decimal" value={formatNumberInput(p.ulasim)} onChange={(e) => update(p.id, { ulasim: parseTurkishNumber(e.target.value) || 0 })} className="tabular-nums" />
                    </Field>
                  </div>
                  {r && (
                    <div className="mt-3 grid gap-2 rounded-md bg-muted/40 px-4 py-3 text-xs sm:grid-cols-4">
                      <span>Seyahat Süresi: <strong>{p.geceSayisi} gece</strong></span>
                      <span>İstisna Gündelik: <strong>{fmt(r.istisnaGunluk)}/gün</strong></span>
                      <span>İstisna Toplam: <strong>{fmt(r.istisnaToplam)}</strong></span>
                      <span className={r.tamIstisna ? "text-emerald-600" : "text-amber-600"}>
                        {r.tamIstisna ? "Tamamı istisna — kesinti yok" : `Vergiye tabi: ${fmt(r.vergiyeTabi)}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <ResultBox>
            <ResultRow label="Toplam Harcırah" value={fmt(toplamHarcirah)} />
            <ResultRow label="GV'den İstisna Toplam" value={fmt(toplamIstisna)} />
            <ResultTotalRow label="Vergiye Tabi (Bordrolanacak)" value={fmt(toplamVergiyeTabi)} valueClassName={toplamVergiyeTabi > 0 ? "text-destructive" : "text-emerald-600"} />
          </ResultBox>

          <div className="rounded-lg border bg-muted/20 px-5 py-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Muhasebe Kaydı</p>
            <div className="mt-2 grid gap-2 font-mono text-[13px] sm:grid-cols-2">
              <div><strong>Borç</strong> 770 Genel Yönetim Giderleri</div>
              <div><strong>Alacak</strong> 100 Kasa / 102 Bankalar</div>
            </div>
          </div>

          <InfoNote>
            Yurt dışı görevlendirmelerde ülke grubuna göre katsayı uygulanır. Konaklama bedeli belgeli olmak
            koşuluyla tamamen istisnadır; yalnızca gündeliğin istisnayı aşan kısmı ücret olarak
            vergilendirilir (GV + SGK + damga vergisi).
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
