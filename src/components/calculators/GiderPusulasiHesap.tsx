import { formatInputValue, parseTurkishNumber, todayIso } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaGiderPusulasi, GIDER_PUSULASI_BENTLER, type GiderPusulasiBent } from "./engine/calcEngine";
import { ExportButtons } from "./engine/ExportButtons";
import { cn } from "@/lib/utils";

type Yon = "brutten" | "netten";

export function GiderPusulasiHesap() {
  const [yon, setYon] = useState<Yon>("brutten");
  const [bent, setBent] = useState<GiderPusulasiBent>("c");
  const [tutar, setTutar] = useState("10000");
  const [teslim, setTeslim] = useState("");
  const [duzenleme, setDuzenleme] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () =>
      hesaplaGiderPusulasi({
        yon,
        oranBent: bent,
        tutar: parseTurkishNumber(tutar),
        teslimTarihi: teslim || undefined,
        duzenlemeTarihi: duzenleme || undefined,
      }),
    [yon, bent, tutar, teslim, duzenleme],
  );

  const b = GIDER_PUSULASI_BENTLER.find((x) => x.bent === bent) ?? GIDER_PUSULASI_BENTLER[2];

  const excelSections = [
    {
      title: "Girdiler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Hesap Yönü", yon === "brutten" ? "Brütten" : "Netten"],
        ["Alım Türü", b.kisa],
        [yon === "brutten" ? "Brüt Tutar (TL)" : "Elden Ödenecek Net (TL)", parseTurkishNumber(tutar)],
        ["Teslim/Hizmet Tarihi", teslim || "-"],
        ["Düzenleme Tarihi", duzenleme || todayIso()],
      ],
    },
    {
      title: "Gider Pusulası Hesabı",
      headers: ["Kalem", "Tutar (TL)"],
      rows: [
        ["Brüt Tutar", result?.brut ?? 0],
        ["Stopaj", -(result?.stopaj ?? 0)],
        ["Elden Ödenecek", result?.net ?? 0],
      ],
      footers: [
        `Brüt Tutar: ${(result?.brut ?? 0).toFixed(2)} TL`,
        `Stopaj (−): ${(result?.stopaj ?? 0).toFixed(2)} TL`,
        `Elden Ödenecek: ${(result?.net ?? 0).toFixed(2)} TL`,
      ],
      notes: [
        "GVK 94/13 bentleri: a=%2 (evde imal), b=%2 (hurda), c=%5 (mal), ç=%0 (GES), d=%10 (hizmet/ayrıştırılamayan).",
        "VUK m.234: Malın teslimi veya hizmetin yapıldığı tarihten itibaren azami 7 gün içinde düzenlenmezse pusula hiç düzenlenmemiş sayılır.",
        "KDV: Vergiden muaf esnaf teslimleri KDVK 17/4-a istisnası kapsamındadır; gider pusulasında KDV hesaplanmaz.",
      ],
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader
        title="Gider Pusulası Hesaplama Raporu"
        subtitle={`${b.kisa} · ${yon === "brutten" ? "Brütten" : "Netten"}`}
      />
      <CalcCard
        title="Gider Pusulası Hesaplama"
        subtitle="Stopaj oranı, netten brüte çevirme ve VUK 234 yedi gün kontrolü — GVK 94/13"
        actions={
          <ExportButtons
            excelName="mizan-gider-pusulasi"
            excelTitle="Gider Pusulası Hesaplama"
            excelSheet="Gider Pusulası"
            excelSections={excelSections}
            pdfTargetRef={areaRef}
            pdfName="mizan-gider-pusulasi"
            disabled={!result}
          />
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Alım Türü (GVK 94/13)">
              <Select value={bent} onValueChange={(v) => setBent(v as GiderPusulasiBent)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GIDER_PUSULASI_BENTLER.map((x) => (
                    <SelectItem key={x.bent} value={x.bent}>{x.kisa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hesap Yönü">
              <Select value={yon} onValueChange={(v) => setYon(v as Yon)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brutten">Brütten</SelectItem>
                  <SelectItem value="netten">Netten (elden anlaşılan)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={yon === "brutten" ? "Brüt Tutar (₺)" : "Anlaşılan Net Tutar (₺)"}>
              <Input
                type="text" inputMode="decimal" value={tutar}
                onChange={(e) => setTutar(formatInputValue(e.target.value))}
                placeholder="0,00" className="tabular-nums"
              />
            </Field>
            <Field label="Alım Türü Açıklaması">
              <p className="text-xs leading-5 text-muted-foreground">{b.ad}</p>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Malın Teslimi / Hizmetin Yapıldığı Tarih" hint="Yedi gün kontrolü için">
              <Input type="date" value={teslim} onChange={(e) => setTeslim(e.target.value)} />
            </Field>
            <Field label="Düzenleme Tarihi" hint="Boş bırakılırsa bugün kabul edilir">
              <Input type="date" value={duzenleme} onChange={(e) => setDuzenleme(e.target.value)} />
            </Field>
          </div>

          <ResultBox>
            <ResultRow label={`Brüt Tutar ${yon === "netten" ? "(geriye hesaplandı)" : ""}`} value={result ? `${result.brut.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"} />
            <ResultRow
              label={`Stopaj (−) — %${(b.oran * 100).toLocaleString("tr-TR")}`}
              value={result ? `−${result.stopaj.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"}
              valueClassName="text-destructive"
            />
            <ResultTotalRow label="Elden Ödenecek" value={result ? `${result.net.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"} />
          </ResultBox>

          {result?.yediGun.gun != null && (
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                result.yediGun.durum === "icinde"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-red-300 bg-red-50 text-red-800",
              )}
            >
              <strong>Yedi Gün Kontrolü (VUK 234): </strong>
              {result.yediGun.durum === "icinde" ? (
                <>
                  {result.yediGun.gun} gün kaldı — süre içindesiniz. Son düzenleme tarihi: {result.yediGun.sonTarih}.
                </>
              ) : (
                <>
                  Süre aşıldı ({Math.abs(result.yediGun.gun)} gün geçti); son düzenleme tarihi {result.yediGun.sonTarih} idi. Bu süre
                  içinde düzenlenmeyen gider pusulası hiç düzenlenmemiş sayılır.
                </>
              )}
            </div>
          )}

          {/* Aynı brüt tutar için tüm oranlar */}
          {result && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aynı {yon === "brutten" ? "Brüt" : "Net"} Tutar İçin Tüm Oranlar
              </p>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Bent</th>
                      <th className="px-3 py-2 font-medium">Alım Türü</th>
                      <th className="px-3 py-2 text-right font-medium">Oran</th>
                      <th className="px-3 py-2 text-right font-medium">Stopaj</th>
                      <th className="px-3 py-2 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GIDER_PUSULASI_BENTLER.map((x) => {
                      const brut = yon === "netten" ? parseTurkishNumber(tutar) / (1 - x.oran) : parseTurkishNumber(tutar);
                      const stopaj = brut * x.oran;
                      return (
                        <tr key={x.bent} className={cn("border-t", x.bent === bent && "bg-muted/30 font-medium")}>
                          <td className="px-3 py-2">{x.kisa}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{x.ad}</td>
                          <td className="px-3 py-2 text-right tabular-nums">%{(x.oran * 100).toLocaleString("tr-TR")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{stopaj.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{(brut - stopaj).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Mal mı hizmet mi ayıramıyorsanız %10 uygulanır (GVK 94/13-d).
              </p>
            </div>
          )}

          <InfoNote>
            Vergiden muaf esnaf tarafından yapılan teslim ve hizmetler KDV'den istisnadır (KDVK m.17/4-a);
            gider pusulasında KDV hesaplanmaz, alıcı için indirilecek KDV doğmaz. Bedel 7 günlük süre içinde
            banka/PTT üzerinden ödenirse bu kurumların belgeleri gider pusulası yerine geçebilir.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
