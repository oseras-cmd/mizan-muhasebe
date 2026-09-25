import { formatInputValue } from "@/lib/finance/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTRY, parseTurkishNumber } from "@/lib/finance/format";
import {
  computePolicySchedule,
  deleteSavedPolicy,
  savePolicy,
  useSavedPolicies,
  type PolicySchedule,
} from "@/lib/finance/policies";
import { cn } from "@/lib/utils";
import {
  Calculator,
  FileDown,
  Save,
  Scale,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CalcCard, Field, InfoNote, PrintButton, PrintHeader, formatNumber } from "./shared";

const EXPENSE_ACCOUNTS = [
  { value: "770", label: "770 — Genel Yönetim Giderleri" },
  { value: "730", label: "730 — Araştırma ve Geliştirme Giderleri" },
  { value: "740", label: "740 — Pazarlama, Satış ve Dağıtım Giderleri" },
  { value: "760", label: "760 — Finansman Giderleri" },
];

function accountBadge(code: string): string {
  if (code === "180") return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (code === "280") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (code === "689") return "bg-destructive/10 text-destructive";
  return "bg-foreground/[0.05] text-foreground";
}

function accountLabel(code: string): string {
  if (code === "180") return "180 — Yıl İçi (Gelecek Aylara Ait)";
  if (code === "280") return "280 — Gelecek Yıllara Ait";
  if (code === "689") return "689 — K.K.E.G. (%30)";
  return `${code} — İlk Ay Gideri`;
}

function hesapAdi(code: string): string {
  if (code === "180") return "180";
  if (code === "280") return "280";
  if (code === "689") return "689";
  return "740/760/770";
}

export function PoliceGider() {
  const [type, setType] = useState("");
  const [account, setAccount] = useState("770");
  const [number, setNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [amount, setAmount] = useState("25000");
  const [schedule, setSchedule] = useState<PolicySchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saved = useSavedPolicies();
  const [compare, setCompare] = useState<{ number: string; amount: number } | null>(null);
  const [compareResult, setCompareResult] = useState<{
    a: { number: string; amount: number };
    b: { number: string; amount: number };
    diff: number;
    pct: number;
  } | null>(null);

  const amountValue = parseTurkishNumber(amount);

  const handleTypeChange = (next: string) => {
    setType(next);
    setAccount(next === "İşyeri Poliçesi" ? "740" : "770");
  };

  const validate = (): boolean => {
    setError(null);
    if (!type) { setError("Lütfen poliçe türünü seçin."); return false; }
    if (!startDate) { setError("Lütfen başlangıç tarihini girin."); return false; }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Lütfen geçerli bir poliçe tutarı girin."); return false;
    }
    return true;
  };

  const compute = () => {
    if (!validate()) return;
    setSchedule(computePolicySchedule({ type, account, startDate, amount: amountValue }));
    setCompareResult(null);
  };

  const handleSave = () => {
    if (!validate()) return;
    savePolicy({ type, account, number: number || "Poliçe", date: startDate, amount: amountValue });
    toast.success("Poliçe kaydedildi.");
  };

  const loadSaved = (policy: (typeof saved)[number]) => {
    setType(policy.type); setAccount(policy.account); setNumber(policy.number);
    setStartDate(policy.date); setAmount(String(policy.amount));
    setSchedule(computePolicySchedule({ type: policy.type, account: policy.account, startDate: policy.date, amount: policy.amount }));
    setCompareResult(null); setError(null);
  };

  const exportCsv = () => {
    if (!schedule) return;
    const qTotals: Record<string, number> = {};
    for (const r of schedule.rows) { qTotals[r.periodLabel] = (qTotals[r.periodLabel] ?? 0) + r.amount; }
    const lines: string[][] = [["Hesap Adı", "Dönemler", "Aylar", "Gün Sayısı", "Aylık Bedel", "Dönemsel Bedel"]];
    for (const row of schedule.rows) {
      const quarterRows = schedule.rows.filter(r => r.periodLabel === row.periodLabel); const isLastInQuarter = quarterRows[quarterRows.length - 1] === row;
      lines.push([hesapAdi(row.accountCode), row.periodLabel, row.monthName, String(row.days), row.amount.toFixed(2), isLastInQuarter ? (qTotals[row.periodLabel] ?? 0).toFixed(2) : "0,00"]);
    }
    if (schedule.kkegAmount > 0) lines.push(["689", "K.K.E.G.", "", "", "", schedule.kkegAmount.toFixed(2)]);
    lines.push(["", "", "", "TOPLAM", "", amountValue.toFixed(2)]);
    const csv = "\uFEFF" + lines.map(l => l.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `${(number.trim() || "police").replace(/\s+/g, "_")}_gider_dagilimi.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  const handleCompare = () => {
    if (!schedule || !Number.isFinite(amountValue)) { setError("Önce hesaplama yapın."); return; }
    if (!compare) { setCompare({ number: number || "Poliçe 1", amount: amountValue }); toast("İlk poliçe kaydedildi. İkinci poliçeyi girip tekrar Karşılaştır'a basın."); return; }
    const diff = amountValue - compare.amount;
    const pct = compare.amount > 0 ? (diff / compare.amount) * 100 : 0;
    setCompareResult({ a: compare, b: { number: number || "Poliçe 2", amount: amountValue }, diff, pct });
    setCompare(null);
  };

  const isBinek = type === "Binek Araç";
  const rows = schedule?.rows ?? [];

  // Dönemsel bedeller: her çeyreğin toplamı
  const quarterTotals: Record<string, number> = {};
  for (const row of rows) { quarterTotals[row.periodLabel] = (quarterTotals[row.periodLabel] ?? 0) + row.amount; }

  return (
    <div className="print-area">
      <PrintHeader
        title="Poliçe Gider Dağılım Raporu"
        subtitle={schedule ? `${type} · ${number || "Poliçe yok"} · ${startDate}` : undefined}
      />
      <CalcCard title="Aylık Poliçe Gider Dağılımı" subtitle="Yıllık poliçe tutarının aylara ve muhasebe hesaplarına göre dağılımı (770 · 180 · 280)">
      <div className="grid gap-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Poliçe Türü">
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Seçiniz…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Binek Araç">Araç — Binek (K.K.E.G. ile)</SelectItem>
                <SelectItem value="Ticari Araç">Araç — Ticari</SelectItem>
                <SelectItem value="İşyeri Poliçesi">İşyeri Poliçesi</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hesap Kodu (İlk Ay Gideri)">
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_ACCOUNTS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Poliçe No">
            <Input value={number} onChange={(e) => setNumber(formatInputValue(e.target.value))} placeholder="Örn: 2025/001" />
          </Field>
          <Field label="Başlangıç Tarihi">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
          <Field label="Brüt Poliçe Tutarı (₺)">
            <Input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(formatInputValue(e.target.value))} placeholder="0,00" className="tabular-nums" required />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={compute}><Calculator className="mr-2 size-4" />Hesapla</Button>
          <Button type="button" variant="outline" onClick={handleSave}><Save className="mr-2 size-4" />Kaydet</Button>
          <Button type="button" variant="outline" onClick={exportCsv}><FileDown className="mr-2 size-4" />Excel</Button>
          <PrintButton className="h-9" />
          <Button type="button" variant="outline" onClick={handleCompare}><Scale className="mr-2 size-4" />Karşılaştır</Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {schedule && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[580px] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Hesap Adı</th>
                  <th className="px-4 py-3 font-medium">Dönemler</th>
                  <th className="px-4 py-3 font-medium">Aylar</th>
                  <th className="px-4 py-3 text-right font-medium">Gün Sayısı</th>
                  <th className="px-4 py-3 text-right font-medium">Aylık Bedel</th>
                  <th className="px-4 py-3 text-right font-medium">Dönemsel Bedel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map((row, index) => {
                  const isNewPeriod = index === 0 || row.quarter !== rows[index - 1].quarter || row.year !== rows[index - 1].year;
                  const quarterRows = rows.filter(r => r.periodLabel === row.periodLabel); const isLastInQuarter = quarterRows[quarterRows.length - 1] === row;
                  return (
                    <FragmentRow key={`${row.year}-${row.monthIndex}`} showPeriod={isNewPeriod} periodLabel={row.periodLabel}>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex rounded px-1.5 py-0.5 font-mono text-xs font-semibold", accountBadge(row.accountCode))}>
                          {hesapAdi(row.accountCode)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.periodLabel}</td>
                      <td className="px-4 py-2.5">{row.monthName}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">{row.days}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatTRY(row.amount)}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                        {isLastInQuarter ? formatTRY(quarterTotals[row.periodLabel] ?? 0) : "₺0,00"}
                      </td>
                    </FragmentRow>
                  );
                })}
              </tbody>
              <tfoot>
                {isBinek && (
                  <tr className="border-t border-border/70 bg-destructive/5">
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex rounded px-1.5 py-0.5 font-mono text-xs font-semibold", accountBadge("689"))}>689</span>
                    </td>
                    <td className="px-4 py-2.5" colSpan={3}>K.K.E.G. (%30)</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-destructive font-semibold" colSpan={2}>{formatTRY(schedule.kkegAmount)}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                  <td className="px-4 py-3" colSpan={4}>Sigorta Acentesi</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums" colSpan={2}>{formatTRY(amountValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {schedule && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hesap Özeti</p>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-4">
              {[
                { code: account, amount: schedule.totals[account] ?? 0 },
                { code: "180", amount: schedule.totals[180] ?? 0 },
                { code: "280", amount: schedule.totals[280] ?? 0 },
                ...(isBinek ? [{ code: "689", amount: schedule.kkegAmount }] : []),
              ].map((item) => (
                <div key={item.code} className="bg-background p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{accountLabel(item.code)}</p>
                  <p className="mt-1.5 font-mono text-base font-semibold tabular-nums">{formatTRY(item.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {compareResult && (
          <div className="rounded-lg border border-dashed p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Karşılaştırma Sonucu</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border bg-card p-4">
                <p className="text-xs text-muted-foreground">A</p>
                <p className="mt-1 text-sm font-semibold">{compareResult.a.number}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatTRY(compareResult.a.amount)}</p>
              </div>
              <div className="rounded-md border bg-card p-4">
                <p className="text-xs text-muted-foreground">B</p>
                <p className="mt-1 text-sm font-semibold">{compareResult.b.number}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatTRY(compareResult.b.amount)}</p>
              </div>
            </div>
            <div className="mt-4 rounded-md border bg-muted/40 p-4 text-center">
              <p className="text-xs text-muted-foreground">Fark (B − A)</p>
              <p className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", compareResult.diff > 0 ? "text-destructive" : compareResult.diff < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-foreground")}>
                {compareResult.diff > 0 ? "+" : ""}{formatTRY(compareResult.diff)} ({compareResult.diff > 0 ? "+" : ""}{formatNumber(compareResult.pct, 2, 2)}%)
              </p>
            </div>
          </div>
        )}

        {saved.length > 0 && (
          <div className="border-t border-border/70 pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kayıtlı Poliçeler ({saved.length})</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {saved.map((policy) => (
                <span key={policy.id} className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs">
                  <button type="button" onClick={() => loadSaved(policy)} className="font-medium text-foreground hover:text-foreground/70">
                    {policy.number || "Poliçe"} · {policy.type}
                  </button>
                  <button type="button" onClick={() => deleteSavedPolicy(policy.id)} className="text-muted-foreground transition-colors hover:text-destructive" aria-label="Poliçeyi sil">
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <InfoNote>
          <strong>ÖNEMLİ:</strong> Binek araç poliçelerinde tutarın %30'u K.K.E.G. (689 hesabı) olarak ayrılır. İlk ay gideri seçilen hesaba (770/730/740/760), sonraki aylar 180 hesabına, yıl dönümünde (Ocak) ise 280 hesabına aktarılır. Hesaplama Burhan ERAY / TÜRMOB standartlarına göredir.
        </InfoNote>
      </div>
      </CalcCard>
    </div>
  );
}

function FragmentRow({ showPeriod, periodLabel, children }: { showPeriod: boolean; periodLabel: string; children: React.ReactNode }) {
  return (
    <>
      {showPeriod && (
        <tr>
          <td colSpan={6} className="bg-muted/40 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {periodLabel}
          </td>
        </tr>
      )}
      <tr>{children}</tr>
    </>
  );
}
