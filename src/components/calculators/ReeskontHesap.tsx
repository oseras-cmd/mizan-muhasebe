import { formatInputValue, parseTurkishNumber, todayIso } from "@/lib/finance/format";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useRef, useState } from "react";
import { CalcCard, Field, PrintHeader, ResultBox, ResultRow, ResultTotalRow, InfoNote } from "./shared";
import { hesaplaReeskont, hesaplaAdat, type Senet } from "./engine/calcEngine";
import { PARAMS_2026 } from "./engine/params";
import { ExportButtons } from "./engine/ExportButtons";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

let idCounter = 0;
const yeniId = () => `s${++idCounter}`;

export function ReeskontHesap() {
  const [degerlemeTarihi, setDegerlemeTarihi] = useState(todayIso());
  const [oran, setOran] = useState(String(PARAMS_2026.TCMB_AVANS_ORANI));
  const [senetler, setSenetler] = useState<Senet[]>([]);
  const [bulkText, setBulkText] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);

  const oranNum = parseTurkishNumber(oran);
  const r = useMemo(() => hesaplaReeskont(senetler, oranNum, degerlemeTarihi), [senetler, oranNum, degerlemeTarihi]);
  const adat = useMemo(
    () => hesaplaAdat(r.satirlar.filter((x) => !x.vadesiGecen).map((x) => ({ tutar: x.tutar, gun: x.gun }))),
    [r],
  );

  const fmt = (v: number) => `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;

  const addSenet = (tur: Senet["tur"] = "senet") =>
    setSenetler((l) => [...l, { id: yeniId(), tur, tutar: 0, vade: "" }]);

  const addBulk = () => {
    const rows = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const yeni: Senet[] = [];
    for (const line of rows) {
      const parts = line.split(/\t|;|,/).map((s) => s.trim());
      if (parts.length < 2) continue;
      const tutar = parseTurkishNumber(parts[0]);
      let vade = parts[1];
      // GG.AA.YYYY → YYYY-MM-DD
      const m = vade.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
      if (m) vade = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      if (!Number.isFinite(tutar) || tutar <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(vade)) continue;
      yeni.push({ id: yeniId(), tur: "senet", tutar, vade });
    }
    if (yeni.length > 0) {
      setSenetler((l) => [...l, ...yeni]);
      setBulkText("");
    }
  };

  const excelSections = [
    {
      title: "Parametreler",
      headers: ["Parametre", "Değer"],
      rows: [
        ["Değerleme Tarihi", degerlemeTarihi],
        ["İskonto Faiz Oranı (yıllık %)", oranNum],
      ],
    },
    {
      title: "Senet/Çek Reeskont Tablosu",
      headers: ["#", "Tür", "Nominal Tutar (TL)", "Vade", "Gün", "Reeskont (TL)", "Şimdiki Değer (TL)"],
      rows: r.satirlar.map((s, i) => [i + 1, s.vadesiGecen ? "— (vadesi geçmiş)" : (senetler.find((x) => x.id === s.id)?.tur ?? "senet"), +s.tutar.toFixed(2), s.vade, s.gun, +s.reeskont.toFixed(2), +s.simdikiDeger.toFixed(2)]),
      footers: [
        `Nominal Toplam: ${r.nominalToplam.toFixed(2)} TL`,
        `Toplam Reeskont: ${r.reeskontToplam.toFixed(2)} TL`,
        `Şimdiki Değer: ${r.simdikiToplam.toFixed(2)} TL`,
      ],
      notes: [
        "VUK m.281/285 ve 238 seri no'lu VUK GT: Senette faiz oranı belirtilmemişse TCMB kısa vadeli avans işlemleri faiz oranı kullanılır (güncel: %39,75 — 20.12.2025'ten itibaren).",
        "Formül: Reeskont = Nominal × Oran × Gün / (36.500 + Oran × Gün).",
        "Vadesi geçmiş (protestolu olmayan) senetler için reeskont hesaplanmaz.",
        r.gecenSayisi > 0 ? `Dikkat: ${r.gecenSayisi} adet vadesi geçmiş senet bulundu; reeskont sıfır alındı.` : "",
        "Muhasebe: Alacak senetleri — 657 Reeskont Faiz Giderleri / 122 Alacak Senetleri Reeskontu. Borç senetleri — 322 Borç Senetleri Reeskontu / 647 Reeskont Faiz Gelirleri.",
        adat ? `Adat: Toplam tutar-gün ${adat.toplamTutarGun.toLocaleString("tr-TR")} · Ortalama vade ${adat.ortalamaVade.toFixed(1)} gün · Ağırlıklı ortalama vade ${r.agirlikliVade.toFixed(1)} gün.` : "",
      ].filter(Boolean),
    },
  ];

  return (
    <div className="print-area" ref={areaRef}>
      <PrintHeader title="Reeskont & Adat Hesaplama" subtitle={`${r.satirlar.length} senet/çek · oran %${oranNum}`} />
      <CalcCard
        title="Reeskont & Adat Hesaplama"
        subtitle="Çek/senet toplu reeskont hesabı, ortalama vade ve TCMB faiz oranıyla otomatik değerleme"
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 print-hide" onClick={() => addSenet("senet")}>
              <Plus className="size-3.5" /> Senet/Çek
            </Button>
            <ExportButtons
              excelName="mizan-reeskont"
              excelTitle="Reeskont ve Adat Hesaplama"
              excelSheet="Reeskont"
              excelSections={excelSections}
              pdfTargetRef={areaRef}
              pdfName="mizan-reeskont"
              disabled={r.satirlar.length === 0}
            />
          </div>
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Değerleme Tarihi">
              <Input type="date" value={degerlemeTarihi} onChange={(e) => setDegerlemeTarihi(e.target.value)} />
            </Field>
            <Field label="İskonto Faiz Oranı (%)" hint="VUK 281/285: TCMB kısa vadeli avans faiz oranı (güncel %39,75)">
              <Input type="text" inputMode="decimal" value={oran} onChange={(e) => setOran(formatInputValue(e.target.value))} className="tabular-nums" />
            </Field>
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
              <strong className="text-foreground">Not:</strong> VUK 281/285 madde uygulaması için TCMB kısa
              vadeli avans faiz oranı kullanılır (reeskont oranı değil). Güncel oranı tcmb.gov.tr üzerinden
              doğrulayın.
            </div>
          </div>

          {/* Toplu yapıştırma */}
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Excel'den Toplu Yapıştır</p>
            <p className="mt-1 text-xs text-muted-foreground">Her satır: Tutar[TAB]Vade (GG.AA.YYYY veya YYYY-MM-DD) — ayırıcı: sekme, noktalı virgül veya virgül</p>
            <Textarea
              className="mt-3 min-h-20 font-mono text-xs"
              placeholder={"10500\t15.01.2027\n23.500,75\t2027-02-28"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" className="mt-3 print-hide" onClick={addBulk} disabled={!bulkText.trim()}>
              Satırları Ekle
            </Button>
          </div>

          {/* Senet listesi */}
          {senetler.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Tür</th>
                    <th className="px-2 py-2 text-right font-medium">Nominal Tutar</th>
                    <th className="px-2 py-2 font-medium">Vade</th>
                    <th className="px-2 py-2 text-right font-medium">Gün</th>
                    <th className="px-2 py-2 text-right font-medium">Reeskont</th>
                    <th className="px-2 py-2 text-right font-medium">Şimdiki Değer</th>
                    <th className="w-8 print-hide" />
                  </tr>
                </thead>
                <tbody>
                  {r.satirlar.map((s, i) => {
                    const senet = senetler.find((x) => x.id === s.id);
                    return (
                      <tr key={s.id} className={cn("border-t", s.vadesiGecen && "text-muted-foreground")}>
                        <td className="px-2 py-2">{i + 1}</td>
                        <td className="px-2 py-2">
                          <Select value={senet?.tur ?? "senet"} onValueChange={(v) => setSenetler((l) => l.map((x) => (x.id === s.id ? { ...x, tur: v as Senet["tur"] } : x)))}>
                            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="senet">Senet</SelectItem>
                              <SelectItem value="cek">Çek</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            type="text" inputMode="decimal"
                            className="h-8 w-32 text-right tabular-nums"
                            value={senet?.tutar ? formatInputValue(String(senet.tutar)) : ""}
                            onChange={(e) => setSenetler((l) => l.map((x) => (x.id === s.id ? { ...x, tutar: parseTurkishNumber(e.target.value) || 0 } : x)))}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="date"
                            className="h-8 w-36"
                            value={senet?.vade ?? ""}
                            onChange={(e) => setSenetler((l) => l.map((x) => (x.id === s.id ? { ...x, vade: e.target.value } : x)))}
                          />
                        </td>
                        <td className={cn("px-2 py-2 text-right tabular-nums", s.vadesiGecen && "text-red-600")}>
                          {s.vadesiGecen ? "(geçmiş)" : s.gun}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(s.reeskont)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(s.simdikiDeger)}</td>
                        <td className="px-2 py-2 print-hide">
                          <Button
                            type="button" variant="ghost" size="icon"
                            className="size-7 text-muted-foreground"
                            onClick={() => setSenetler((l) => l.filter((x) => x.id !== s.id))}
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
          )}

          {senetler.length === 0 && (
            <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              📄 Henüz senet/çek eklenmedi — tek tek veya Excel'den toplu olarak ekleyin
            </div>
          )}

          {r.satirlar.length > 0 && (
            <>
              <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
                <div className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground">Nominal Toplam</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmt(r.nominalToplam)}</p>
                </div>
                <div className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground">Toplam Reeskont</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-destructive">{fmt(r.reeskontToplam)}</p>
                </div>
                <div className="bg-card px-5 py-4">
                  <p className="text-xs text-muted-foreground">Şimdiki Değer</p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{fmt(r.simdikiToplam)}</p>
                </div>
              </div>

              <ResultBox>
                <ResultRow label="Ortalama Vade" value={`${r.ortalamaVade.toFixed(1)} gün`} />
                <ResultRow label="Ağırlıklı Ortalama Vade" value={`${r.agirlikliVade.toFixed(1)} gün`} />
                {adat && <ResultRow label="Adat Katsayısı (Σ tutar×gün / 1000)" value={adat.adatKatsayisi.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} />}
                {adat && <ResultRow label="Toplam Tutar × Gün" value={adat.toplamTutarGun.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} />}
              </ResultBox>

              {r.gecenSayisi > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                  {r.gecenSayisi} adet vadesi geçmiş senet var. Vadesi geçmiş (protestolu olmayan) senetler
                  için reeskont hesaplanmaz; reeskont tutarı sıfır yansıtıldı. Protestolu senetler ayrıca
                  değerlendirilmelidir.
                </div>
              )}

              <div className="rounded-lg border bg-muted/20 px-5 py-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Muhasebe Kaydı (Dönem Sonu)</p>
                <div className="mt-2 grid gap-2 font-mono text-[13px] sm:grid-cols-2">
                  <div><strong>Borç</strong> 657 Reeskont Faiz Giderleri</div>
                  <div><strong>Alacak</strong> 122 Alacak Senetleri Reeskontu</div>
                  <div><strong>Borç</strong> 322 Borç Senetleri Reeskontu</div>
                  <div><strong>Alacak</strong> 647 Reeskont Faiz Gelirleri</div>
                </div>
              </div>
            </>
          )}

          <InfoNote>
            Alacak senetlerini reeskonta tabi tutan mükellefler borç senetlerini de reeskonta tabi tutmak
            zorundadır. İzleyen dönem başında ters kayıtla reeskont iptal edilir. İleri tarihli çekler de
            reeskonta tabi tutulabilir; vadesiz çekler ve protestolu senetler kapsam dışıdır.
          </InfoNote>
        </div>
      </CalcCard>
    </div>
  );
}
