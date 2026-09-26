import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, InfoNote } from "./shared";
import { TAKVIM_UNIQUE, takvimSiradaki, takvimSonraki, takvimTarih, sonrakiIsGunu, AY_ADLARI, type TakvimKaydi } from "./engine/vergiTakvimi";
import { ExportButtons } from "./engine/ExportButtons";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";

const KATEGORI_RENK: Record<TakvimKaydi["kategori"], string> = {
  KDV: "bg-blue-100 text-blue-700",
  Vergi: "bg-violet-100 text-violet-700",
  SGK: "bg-emerald-100 text-emerald-700",
  "E-Belge": "bg-amber-100 text-amber-700",
};

type PeriyotFiltre = "tumu" | "Aylık" | "3 Aylık" | "6 Aylık" | "Yıllık";

export function VergiTakvimiHesap() {
  const [periyot, setPeriyot] = useState<PeriyotFiltre>("tumu");
  const areaRef = useRef<HTMLDivElement>(null);

  const bugun = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const siradaki = useMemo(() => takvimSiradaki({ periyot }, bugun), [periyot, bugun]);
  const sonraki = useMemo(() => takvimSonraki({ periyot }, bugun), [periyot, bugun]);

  // Ay bazlı gruplama (sadece gelecek/bugün)
  const ayGruplari = useMemo(() => {
    const map = new Map<number, { kayit: TakvimKaydi; tarih: Date; kalanGun: number }[]>();
    for (const x of siradaki) {
      const ay = x.tarih.getMonth() + 1;
      if (!map.has(ay)) map.set(ay, []);
      map.get(ay)!.push(x);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [siradaki]);

  const acil = siradaki.filter((x) => x.kalanGun <= 5);
  const buAyToplam = siradaki.filter((x) => x.tarih.getMonth() === bugun.getMonth()).length;

  const fmtTarih = (d: Date) => `${String(d.getDate()).padStart(2, "0")} ${AY_ADLARI[d.getMonth()]} ${d.getFullYear()}`;

  const excelSections = [
    {
      title: "2026 Vergi Takvimi — Sırada Bekleyenler",
      headers: ["Son Tarih", "Gün", "Beyanname / İşlem", "Kategori", "Periyot", "Not"],
      rows: siradaki.map((x) => [fmtTarih(x.tarih), x.kalanGun, x.kayit.ad, x.kayit.kategori, x.kayit.periyot, x.kayit.not ?? ""]),
      notes: [
        "Son gün resmî tatile denk gelirse süre, takip eden ilk iş günü sonuna kadar uzar.",
        "Form Ba-Bs bildirimi kaldırılmıştır (565 sıra no'lu VUK GT; Eylül 2024 döneminden itibaren).",
        "Geçici vergi dönemleri: izleyen ikinci ayın 17'si. KDV beyannamesi ve ödemesi: takip eden ayın 28'i.",
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="2026 Vergi Takvimi" subtitle={sonraki ? `Sıradaki: ${sonraki.kayit.ad} — ${fmtTarih(sonraki.tarih)}` : undefined} />
      <CalcCard
        title="2026 — Aya Göre Vergi Takvimi"
        subtitle="Beyannameler için tek takvim: KDV, Muhtasar, SGK, ÖTV, GEKAP — bütün son tarihler tek yerde"
        actions={
          <ExportButtons
            excelName="mizan-vergi-takvimi"
            excelTitle="2026 Vergi Takvimi"
            excelSheet="Vergi Takvimi"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-vergi-takvimi"
            disabled={false}
          />
        }
      >
        <div className="grid gap-6">
          {/* Sıradaki son tarih kartı */}
          {sonraki && (
            <div className="rounded-lg border bg-muted/30 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sıradaki son tarih</p>
                  <p className="mt-1 text-base font-semibold">{sonraki.kayit.ad}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {fmtTarih(sonraki.tarih)} · {sonraki.kalanGun === 0 ? "Bugün" : sonraki.kalanGun === 1 ? "Yarın" : `${sonraki.kalanGun} gün`}
                  </p>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-background px-4 py-2 ring-1 ring-border">
                  <span className="font-mono text-2xl font-bold tabular-nums">{sonraki.kalanGun}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">gün</span>
                </div>
              </div>
            </div>
          )}

          {/* Özet */}
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
            {[
              { label: "Bugün", v: `${bugun.getDate()} ${AY_ADLARI[bugun.getMonth()]}` },
              { label: "Bu Ay", v: `${buAyToplam} bildirim` },
              { label: "Acil (≤5 gün)", v: `${acil.length}` },
              { label: "Sırada Bekleyen", v: `${siradaki.length}` },
            ].map((x) => (
              <div key={x.label} className="bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{x.label}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{x.v}</p>
              </div>
            ))}
          </div>

          {/* Filtre */}
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Periyot">
              <Select value={periyot} onValueChange={(v) => setPeriyot(v as PeriyotFiltre)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tumu">Tümü</SelectItem>
                  <SelectItem value="Aylık">Aylık</SelectItem>
                  <SelectItem value="3 Aylık">3 Aylık</SelectItem>
                  <SelectItem value="6 Aylık">6 Aylık</SelectItem>
                  <SelectItem value="Yıllık">Yıllık</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="self-end text-xs text-muted-foreground sm:col-span-2">
              {TAKVIM_UNIQUE.length} kayıtlı yükümlülük · {siradaki.length} tanesi sırada
            </p>
          </div>

          {/* Ay bazlı liste */}
          {ayGruplari.length === 0 ? (
            <p className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">Sırada bekleyen kayıt yok.</p>
          ) : (
            <div className="space-y-6">
              {ayGruplari.map(([ay, items]) => (
                <div key={ay}>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    {AY_ADLARI[ay - 1]} {2026}
                    <span className="text-xs font-normal text-muted-foreground">({items.length} bildirim)</span>
                  </p>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <tbody>
                        {items.map((x, i) => (
                          <tr key={`${x.kayit.ad}-${i}`} className={cn("border-t first:border-t-0", x.kalanGun === 0 && "bg-amber-50/60")}>
                            <td className="w-20 px-3 py-2 align-top">
                              <div className="text-center">
                                <p className="font-mono text-lg font-bold leading-none tabular-nums">{String(x.tarih.getDate()).padStart(2, "0")}</p>
                                <p className="text-[10px] uppercase text-muted-foreground">{AY_ADLARI[x.tarih.getMonth()].slice(0, 3)}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <p className="text-[13px] font-medium leading-snug">{x.kayit.ad}</p>
                              {x.kayit.not && <p className="mt-0.5 text-[11px] text-muted-foreground">{x.kayit.not}</p>}
                            </td>
                            <td className="w-20 px-2 py-2">
                              <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold", KATEGORI_RENK[x.kayit.kategori])}>
                                {x.kayit.kategori}
                              </span>
                            </td>
                            <td className="w-28 px-3 py-2 text-right">
                              <span className={cn(
                                "text-xs font-medium",
                                x.kalanGun === 0 ? "text-amber-700" : x.kalanGun <= 5 ? "text-red-600" : "text-muted-foreground",
                              )}>
                                {x.kalanGun === 0 ? "Bugün" : x.kalanGun === 1 ? "Yarın" : `${x.kalanGun} gün`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Yıllık özet: 12 aylık grid */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">2026 Yıllık Görünüm — her ayın yükümlülük sayısı</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
              {AY_ADLARI.map((m, idx) => {
                const sayi = TAKVIM_UNIQUE.filter((k) => k.ay === idx + 1).length;
                const gecmis = idx + 1 < bugun.getMonth() + 1;
                return (
                  <div key={m} className={cn("rounded-lg border px-2 py-2 text-center", gecmis && "opacity-40")}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{m.slice(0, 3)}</p>
                    <p className="font-mono text-lg font-bold tabular-nums">{sayi}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <InfoNote>
            Son gün resmî tatile denk gelirse süre, takip eden ilk iş günü sonuna kadar uzar. Geçici vergi
            beyannameleri izleyen ikinci ayın 17'sine kadar verilir. Beyanname sürelerine uyulmaması halinde
            vergi ziyaı cezası ve gecikme faizi uygulanır.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
