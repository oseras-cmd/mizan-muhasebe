import { AppHeader } from "@/components/AppHeader";
import { FormattedInput } from "@/components/FormattedInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  contactById,
  contactsSorted,
  dueLabel,
  groupPaymentsByDay,
  groupPaymentsByWeek,
  overduePayments,
  type PaymentGroup,
} from "@/lib/finance/dashboard";
import {
  formatDate,
  formatTRY,
  todayIso,
} from "@/lib/finance/format";
import {
  addUpcomingPayment,
  completeUpcomingPayment,
  deleteUpcomingPayment,
  getPaymentHistory,
  setPaymentQueued,
  updateUpcomingPayment,
  useFinanceData,
} from "@/lib/finance/store";
import { type RecurringType, type PaymentCurrency, type PaymentCompany, PAYMENT_CURRENCY_OPTIONS, PAYMENT_COMPANIES, RECURRING_LABELS, companyLabel } from "@/lib/finance/types";
import { useTcmbRates, type TcmbRatesData, type TcmbRate } from "@/lib/finance/tcmbRates";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  FileText,
  GripVertical,
  History,
  Pencil,
  Plus,
  Search,
  Users,
  Printer,
  Repeat,
  Trash2,
  X,
  Table,
  LayoutList,
  Coins,
  Building2,
} from "lucide-react";
import { formatCurrency } from "@/lib/finance/format";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const PAYMENT_CURRENCIES: PaymentCurrency[] = ["TRY", "USD", "EUR"];

type CurrencySum = { currency: PaymentCurrency; total: number };

/** Ödemeleri para birimine göre gruplayıp istenen alanın toplamını döndürür (TL/USD/EUR ayrı satır). */
function sumByCurrency(
  payments: { currency?: PaymentCurrency; amount: number; paidAmount?: number }[],
  pick: (p: { amount: number; paidAmount?: number }) => number,
): CurrencySum[] {
  const map = new Map<PaymentCurrency, number>();
  for (const p of payments) {
    const cur = p.currency ?? "TRY";
    map.set(cur, (map.get(cur) ?? 0) + pick(p));
  }
  return PAYMENT_CURRENCIES.map((currency) => ({
    currency,
    total: map.get(currency) ?? 0,
  })).filter((b) => b.total > 0);
}

/** Para birimi bazlı toplamları "₺1.234,56 · $100,00 · €50,00" biçiminde birleştirir. */
function currencyTotalsText(breakdown: CurrencySum[]): string {
  return breakdown.length > 0
    ? breakdown.map((b) => formatCurrency(b.total, b.currency)).join(" · ")
    : formatCurrency(0, "TRY");
}

/* ─── Dövizli tutarlar: üzerine gelince/tıklanınca TCMB kuruyla TL karşılığı ─── */

const kurFormat = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/**
 * Döviz cinsinden tutar hücresi. TL tutarlar düz metin kalır; USD/EUR tutarlar
 * kesikli altı çizgili gösterilir ve fare ile üzerine gelince (veya tıklayınca)
 * o anki merkez bankası kuruyla TL karşılığı tooltip'te görünür.
 */
function MoneyCell({
  amount,
  currency,
  rates,
  source,
}: {
  amount: number;
  currency: PaymentCurrency;
  rates: Record<string, TcmbRate>;
  source?: TcmbRatesData["source"];
}) {
  const [open, setOpen] = useState(false);
  const rate = currency === "TRY" ? undefined : rates[currency];
  if (!rate) return <>{formatCurrency(amount, currency)}</>;

  /* TCMB alış-satış ortalaması ("merkez" kur); JPY gibi 100 birimlik kurlar için unite bölünür */
  const kur = (rate.forexBuying + rate.forexSelling) / 2 / rate.unit;
  const kaynak = source === "tcmb" ? "TCMB kuru" : "yaklaşık kur";

  return (
    <Tooltip open={open}>
      <TooltipTrigger
        asChild
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span
          role="button"
          tabIndex={0}
          className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4"
        >
          {formatCurrency(amount, currency)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="space-y-0.5 text-left">
          <p className="font-mono text-xs font-semibold tabular-nums">
            ≈ {formatCurrency(amount * kur, "TRY")}
          </p>
          <p className="text-[10px] tabular-nums opacity-80">
            1 {currency} = {kurFormat.format(kur)} ₺ · {kaynak}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

type FilterStatus = "tumu" | "bekliyor" | "odendi" | "kismi" | "gecikti";
type CompanyFilter = "tumu" | "yok" | PaymentCompany;

type ViewMode = "gunluk" | "haftalik";
type DisplayMode = "grup" | "tablo";

export default function Odemeler() {
  const data = useFinanceData();
  const [view, setView] = useState<ViewMode>("haftalik");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("tablo");
  const [confirming, setConfirming] = useState<{
    kind: "complete" | "delete" | "partial" | "edit" | "history";
    id: string;
  } | null>(null);
  const [partialAmount, setPartialAmount] = useState(0);

  /* Düzenleme formu */
  const [editLabel, setEditLabel] = useState("");
  const [editCompany, setEditCompany] = useState<PaymentCompany | "">("");
  const [editContactId, setEditContactId] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editDueDate, setEditDueDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  /* Yeni ödeme formu */
  const [label, setLabel] = useState("");
  const [company, setCompany] = useState<PaymentCompany | "">("");
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState(0);
  const [dueDate, setDueDate] = useState(todayIso());
  const [recurringType, setRecurringType] = useState<RecurringType>("yok");
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>("TRY");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("tumu");
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>("tumu");
  const [showDialog, setShowDialog] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverQueue, setDragOverQueue] = useState(false);

  /* Elindeki para hesabı */
  const [cashOnHand, setCashOnHand] = useState(0);

  const overdue = overduePayments(data);

  /* TCMB canlı kurları — dövizli tutarların TL karşılığı için (5 dakikada bir yenilenir) */
  const tcmb = useTcmbRates();
  const tcmbSource = tcmb.data?.source;
  const ratesByCode = useMemo(() => {
    const map: Record<string, TcmbRate> = {};
    for (const r of tcmb.data?.rates ?? []) map[r.code] = r;
    return map;
  }, [tcmb.data]);

  // Filtreleme
  const filteredPayments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const today = todayIso();
    return data.upcomingPayments.filter((p) => {
      // Arama filtresi
      if (q && !p.label.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) {
        const contact = p.contactId ? contactById(data, p.contactId) : undefined;
        if (!contact || !contact.name.toLowerCase().includes(q)) return false;
      }
      // Şirket filtresi
      if (companyFilter === "yok") {
        if (p.company) return false;
      } else if (companyFilter !== "tumu" && p.company !== companyFilter) {
        return false;
      }
      // Durum filtresi
      const paid = p.paidAmount ?? 0;
      const isOverdue = new Date(p.dueDate) < new Date(today) && paid < p.amount;
      switch (filterStatus) {
        case "bekliyor": return paid < p.amount && !isOverdue;
        case "odendi": return paid >= p.amount;
        case "kismi": return paid > 0 && paid < p.amount;
        case "gecikti": return isOverdue;
        default: return true;
      }
    });
  }, [data, searchQuery, filterStatus, companyFilter]);

  /* Şirket (Ferla/Meskur) borç özeti — tüm ödemeler üzerinden hesaplanır */
  const hasUnassigned = data.upcomingPayments.some((p) => !p.company);
  const companyFilterOptions: { key: CompanyFilter; label: string }[] = [
    { key: "tumu", label: "Tümü" },
    ...PAYMENT_COMPANIES.map((c) => ({ key: c.value as CompanyFilter, label: c.label })),
    ...(hasUnassigned ? [{ key: "yok" as CompanyFilter, label: "Atanmamış" }] : []),
  ];
  const companySummaries = useMemo(() => {
    const defs: { key: CompanyFilter; label: string }[] = PAYMENT_COMPANIES.map((c) => ({
      key: c.value as CompanyFilter,
      label: c.label,
    }));
    if (data.upcomingPayments.some((p) => !p.company)) {
      defs.push({ key: "yok", label: "Atanmamış" });
    }
    return defs.map((def) => {
      const items = data.upcomingPayments.filter((p) =>
        def.key === "yok" ? !p.company : p.company === def.key,
      );
      const unpaid = items.filter((p) => (p.paidAmount ?? 0) < p.amount);
      return {
        key: def.key,
        label: def.label,
        count: unpaid.length,
        remaining: sumByCurrency(unpaid, (p) => p.amount - (p.paidAmount ?? 0)),
      };
    });
  }, [data.upcomingPayments]);

  const rawGroups: PaymentGroup[] =
    view === "gunluk"
      ? groupPaymentsByDay(data)
      : groupPaymentsByWeek(data);

  // Grupları filtrele
  const groups: PaymentGroup[] = rawGroups
    .map((group) => {
      const filtered = group.payments.filter((p) => filteredPayments.includes(p));
      if (filtered.length === 0) return null;
      return {
        ...group,
        payments: filtered,
        total: filtered.reduce((s, p) => s + p.amount, 0),
      };
    })
    .filter((g): g is PaymentGroup => g !== null);

  const paymentCount = filteredPayments.length;

  /* "Şimdi Ödenecekler" kuyruğu — kullanıcının sürükleyip atadığı ödemeler */
  const queuedPayments = useMemo(
    () =>
      data.upcomingPayments
        .filter((p) => p.queued)
        .sort((a, b) => (a.queuedAt ?? "").localeCompare(b.queuedAt ?? "")),
    [data.upcomingPayments],
  );
  const queuedTotal = queuedPayments.reduce(
    (sum, p) => sum + (p.amount - (p.paidAmount ?? 0)),
    0,
  );
  /* Kuyruk toplamı ödendikten sonra elinde kalan para */
  const queueAfter = cashOnHand - queuedTotal;
  const queueNeedMore = queueAfter < 0;

  // Ödeme raporu için istatistikler
  const allPayments = data.upcomingPayments;
  const totalPending = allPayments.reduce((sum, p) => sum + (p.amount - (p.paidAmount ?? 0)), 0);
  const fullyPaidCount = allPayments.filter((p) => (p.paidAmount ?? 0) >= p.amount).length;
  const partialCount = allPayments.filter((p) => (p.paidAmount ?? 0) > 0 && (p.paidAmount ?? 0) < p.amount).length;

  /* Para birimi bazlı dip toplamlar — TL/USD/EUR her zaman ayrı tutulur */
  const listAmounts = sumByCurrency(filteredPayments, (p) => p.amount);
  const listPaid = sumByCurrency(filteredPayments, (p) => p.paidAmount ?? 0);
  const listRemaining = sumByCurrency(filteredPayments, (p) => p.amount - (p.paidAmount ?? 0));
  const pendingAmounts = sumByCurrency(allPayments, (p) => p.amount - (p.paidAmount ?? 0));
  const paidAmounts = sumByCurrency(allPayments, (p) => p.paidAmount ?? 0);
  const overdueAmounts = sumByCurrency(overdue, (p) => p.amount);
  const queuedAmounts = sumByCurrency(queuedPayments, (p) => p.amount - (p.paidAmount ?? 0));

  const renderBreakdownLines = (breakdown: CurrencySum[], valueClass: string) => {
    const rows = breakdown.length > 0 ? breakdown : [{ currency: "TRY" as PaymentCurrency, total: 0 }];
    return (
      <div className="mt-1 space-y-0.5">
        {rows.map((b) => (
          <p key={b.currency} className={cn("font-mono font-semibold tabular-nums", valueClass)}>
            {formatCurrency(b.total, b.currency)}
          </p>
        ))}
      </div>
    );
  };

  /* Elindeki para hesabı: bekleyen ödemeler toplamından düşülür */
  const afterPayments = cashOnHand - totalPending;
  const needMore = afterPayments < 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError("Lütfen ödeme açıklaması girin.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Lütfen geçerli bir tutar girin.");
      return;
    }
    if (!dueDate) {
      setError("Lütfen vade tarihini seçin.");
      return;
    }
    addUpcomingPayment({
      label: label.trim(),
      company: company || undefined,
      contactId: contactId || undefined,
      amount,
      currency: paymentCurrency,
      dueDate,
      recurringType,
      recurringEndDate: recurringEndDate || undefined,
      description: description.trim() || undefined,
    });
    const recurringLabel = recurringType !== "yok" ? ` (${RECURRING_LABELS[recurringType]})` : "";
    toast.success(`Ödeme planlandı${recurringLabel}.`);
    setLabel("");
    setCompany("");
    setContactId("");
    setAmount(0);
    setRecurringType("yok");
    setRecurringEndDate("");
    setDescription("");
    setPaymentCurrency("TRY");
    setError(null);
    setShowDialog(false);
  };

  const handleComplete = (paymentId: string, partial?: number) => {
    const payment = data.upcomingPayments.find((p) => p.id === paymentId);
    if (!payment) return;
    const paid = payment.paidAmount ?? 0;
    const remaining = payment.amount - paid;
    const payAmt = partial ? Math.min(partial, remaining) : remaining;
    completeUpcomingPayment(paymentId, partial);
    setConfirming(null);
    setPartialAmount(0);
    const isFull = !partial || payAmt >= remaining;
    const cur = payment.currency ?? "TRY";
    toast.success(
      isFull
        ? `"${payment.label}" ödendi olarak işaretlendi.`
        : `"${payment.label}" için ${formatCurrency(payAmt, cur)} ödendi. Kalan: ${formatCurrency(remaining - payAmt, cur)}`,
    );
  };

  const handleDelete = (paymentId: string) => {
    const payment = data.upcomingPayments.find((p) => p.id === paymentId);
    deleteUpcomingPayment(paymentId);
    setConfirming(null);
    toast.success(`"${payment?.label}" listeden kaldırıldı.`);
  };

  const startEdit = (paymentId: string) => {
    const payment = data.upcomingPayments.find((p) => p.id === paymentId);
    if (!payment) return;
    setEditLabel(payment.label);
    setEditCompany((payment.company as PaymentCompany) ?? "");
    setEditContactId(payment.contactId ?? "");
    setEditAmount(payment.amount);
    setEditDueDate(payment.dueDate);
    setEditDescription(payment.description ?? "");
    setEditError(null);
    setConfirming({ kind: "edit", id: paymentId });
  };

  const handleEdit = (paymentId: string) => {
    if (!editLabel.trim()) {
      setEditError("Lütfen açıklama girin.");
      return;
    }
    if (!Number.isFinite(editAmount) || editAmount <= 0) {
      setEditError("Lütfen geçerli bir tutar girin.");
      return;
    }
    if (!editDueDate) {
      setEditError("Lütfen vade tarihi seçin.");
      return;
    }
    updateUpcomingPayment(paymentId, {
      label: editLabel.trim(),
      company: editCompany || undefined,
      contactId: editContactId || undefined,
      amount: editAmount,
      dueDate: editDueDate,
      description: editDescription.trim() || undefined,
    });
    setConfirming(null);
    toast.success("Ödeme güncellendi.");
  };

  const handlePrintReport = () => {
    window.print();
  };

  /* --- Sürükle-bırak: kuyruk ataması --- */
  const handleDropOnQueue = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverQueue(false);
    const id = e.dataTransfer.getData("text/mizan-payment");
    if (!id) return;
    const payment = data.upcomingPayments.find((p) => p.id === id);
    if (!payment || payment.queued) return;
    setPaymentQueued(id, true);
    toast.success(`"${payment.label}" şimdi ödenecekler kuyruğuna eklendi.`);
  };

  const handleDropOnList = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/mizan-payment");
    if (!id) return;
    const payment = data.upcomingPayments.find((p) => p.id === id);
    if (!payment || !payment.queued) return;
    setPaymentQueued(id, false);
    toast.success(`"${payment.label}" kuyruktan çıkarıldı.`);
  };

  const renderPaymentActions = (paymentId: string) => {
    const isConfirming = confirming?.id === paymentId;
    if (isConfirming && confirming?.kind === "complete") {
      const payment = data.upcomingPayments.find((p) => p.id === paymentId);
      const paid = payment?.paidAmount ?? 0;
      const remaining = (payment?.amount ?? 0) - paid;
      return (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">              <FormattedInput
              value={partialAmount}
              onChange={setPartialAmount}
              placeholder={formatTRY(remaining).replace('₺', '')}
              className="h-8 w-28"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                handleComplete(paymentId, partialAmount > 0 && partialAmount < remaining ? partialAmount : undefined);
              }}
            >
              {partialAmount > 0 ? 'Kısmi Öde' : 'Tam Öde'}
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setConfirming(null); setPartialAmount(0); }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      );
    }
    if (isConfirming && confirming?.kind === "edit") {
      return (
        <div className="w-full space-y-3 rounded-md border border-border/70 bg-background p-4">
          <div className="grid gap-3">
            <Input
              value={editLabel}
              onChange={(e) => { setEditLabel(e.target.value); setEditError(null); }}
              placeholder="Açıklama"
              className="h-8 text-xs"
            />            <select
              value={editCompany}
              onChange={(e) => { setEditCompany(e.target.value as PaymentCompany | ""); setEditError(null); }}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
            >
              <option value="">Şirket seçin (opsiyonel)</option>
              {PAYMENT_COMPANIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {contactsSorted(data).length > 0 && (
              <select
                value={editContactId}
                onChange={(e) => setEditContactId(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
              >
                <option value="">Cari seçin (opsiyonel)</option>
                {contactsSorted(data).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <FormattedInput
                value={editAmount}
                onChange={(v) => { setEditAmount(v); setEditError(null); }}
                placeholder="Tutar"
                className="h-8 text-xs"
              />
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => { setEditDueDate(e.target.value); setEditError(null); }}
                className="h-8 text-xs"
              />
            </div>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Açıklama notu (opsiyonel)"
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs outline-none focus-visible:border-ring resize-none"
            />
            {editError && <p className="text-xs text-destructive">{editError}</p>}
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" className="h-7 text-xs" onClick={() => handleEdit(paymentId)}>
                Kaydet
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirming(null)}>
                İptal
              </Button>
            </div>
          </div>
        </div>
      );
    }
    if (isConfirming && confirming?.kind === "history") {
      const payment = data.upcomingPayments.find((p) => p.id === paymentId);
      const history = payment ? getPaymentHistory(payment.label) : [];
      const totalPaid = history.reduce((sum, tx) => sum + tx.amount, 0);
      return (
        <div className="w-full space-y-3 rounded-md border border-border/70 bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Ödeme Geçmişi</span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(null)}>
              <X className="size-3.5" />
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Bu kalem için henüz ödeme kaydı yok.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Toplam Ödenen</span>
                <span className="font-mono text-xs font-semibold text-green-600">{formatTRY(totalPaid)}</span>
              </div>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {history.map((tx) => (
                  <li key={tx.id} className="flex items-center justify-between rounded px-3 py-1.5 hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Clock className="size-3 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-foreground">{formatTRY(tx.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    if (isConfirming && confirming?.kind === "delete") {
      return (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(paymentId)}
          >
            Evet, sil
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      );
    }
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setConfirming({ kind: "complete", id: paymentId })}
        >
          <Check className="size-3.5" />
          Öde
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label="Ödemeyi düzenle"
          onClick={() => startEdit(paymentId)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label="Ödeme geçmişi"
          onClick={() => setConfirming({ kind: "history", id: paymentId })}
        >
          <History className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label="Ödemeyi sil"
          onClick={() => setConfirming({ kind: "delete", id: paymentId })}
        >
          <Trash2 className="size-4" />
        </Button>
      </>
    );
  };

  const renderPaymentItem = (payment: typeof data.upcomingPayments[0]) => {
    const paidAmount = payment.paidAmount ?? 0;
    const remaining = payment.amount - paidAmount;
    const hasPartialPayment = paidAmount > 0;
    const isOverdue = new Date(payment.dueDate) < new Date(todayIso()) && remaining > 0;
    const cur = payment.currency ?? "TRY";

    return (
      <li
        key={payment.id}
        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
            isOverdue
              ? "border-destructive/30 bg-destructive/[0.05]"
              : "border-border bg-background"
          )}>
            {isOverdue ? (
              <AlertTriangle className="size-4 text-destructive" />
            ) : (
              <span className="text-xs font-medium tabular-nums text-foreground">
                {Number(payment.dueDate.slice(8, 10))}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-foreground">
                {payment.label}
              </p>
              {payment.recurringType && payment.recurringType !== "yok" && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                  <Repeat className="size-2.5" />
                  {RECURRING_LABELS[payment.recurringType]}
                </span>
              )}
            </div>
            {payment.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground/80 italic">
                {payment.description}
              </p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>{formatDate(payment.dueDate)}</span>
              {payment.company && <span className="font-medium text-primary">{companyLabel(payment.company)}</span>}
              {(() => {
                const contact = payment.contactId ? contactById(data, payment.contactId) : undefined;
                return contact ? <span className="inline-flex items-center gap-0.5 text-primary"><Users className="size-2.5" />{contact.name}</span> : null;
              })()}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
          <div className="text-right">
            <div className="flex items-center gap-2">
              {hasPartialPayment && (
                <span className="text-xs tabular-nums text-green-600">
                  {cur === "TRY" ? (
                    formatCurrency(paidAmount, cur)
                  ) : (
                    <MoneyCell amount={paidAmount} currency={cur} rates={ratesByCode} source={tcmbSource} />
                  )} ✓
                </span>
              )}
              <p className={cn(
                "text-sm tabular-nums font-medium",
                isOverdue ? "text-destructive" : "text-foreground"
              )}>
                {cur === "TRY" ? (
                  hasPartialPayment ? formatCurrency(remaining, cur) : formatCurrency(payment.amount, cur)
                ) : (
                  <MoneyCell
                    amount={hasPartialPayment ? remaining : payment.amount}
                    currency={cur}
                    rates={ratesByCode}
                    source={tcmbSource}
                  />
                )}
              </p>
            </div>
            <p className={cn(
              "mt-0.5 text-xs",
              isOverdue ? "text-destructive" : "text-muted-foreground"
            )}>
              {hasPartialPayment ? (
                <span className="text-orange-600">
                  {Math.round((paidAmount / payment.amount) * 100)}% ödendi · {dueLabel(payment.dueDate)}
                </span>
              ) : (
                dueLabel(payment.dueDate)
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {renderPaymentActions(payment.id)}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-10 print:pt-4">
        {/* Sayfa başlığı */}
        <div className="print:hidden">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
            Modül
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Ödemeler
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Planlanan ödemelerinizi günlük veya haftalık olarak görün;
            vadesi geçenleri kaçırmayın. Kısmi ödeme yapabilir ve
            rapor alabilirsiniz.
          </p>
        </div>

        {/* Yazdırılabilir rapor başlığı */}
        <div className="hidden print:block mb-6">
          <h1 className="text-xl font-bold">Ödeme Raporu</h1>
          <p className="text-sm text-gray-600">
            Tarih: {new Date().toLocaleDateString('tr-TR')} · 
            Toplam: {paymentCount} ödeme · 
            Tutar: {currencyTotalsText(listAmounts)}
          </p>
        </div>

        {/* Elindeki Para hesabı — bekleyen ödemelerden düşer */}
        <section className="mt-5 overflow-hidden rounded-lg border bg-card print:hidden">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
            <div className="flex min-w-[180px] flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Coins className="size-3.5" />
                Elindeki Para
              </span>
              <FormattedInput
                value={cashOnHand}
                onChange={setCashOnHand}
                placeholder="0,00"
                className="h-9 w-40"
              />
            </div>
            <div className="hidden h-10 w-px bg-border sm:block" />
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-[11px] text-muted-foreground">Bekleyen Ödemeler</p>
                {renderBreakdownLines(pendingAmounts, "text-sm text-orange-600")}
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/50" />
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {needMore ? "Eksik Para" : "Kalan"}
                </p>
                <p
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    needMore ? "text-destructive" : "text-emerald-600",
                  )}
                >
                  {needMore ? "−" : "+"}
                  {formatTRY(Math.abs(afterPayments))}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-semibold",
                  needMore
                    ? "bg-destructive/10 text-destructive"
                    : "bg-emerald-500/10 text-emerald-600",
                )}
              >
                {needMore
                  ? `${formatTRY(Math.abs(afterPayments))} paraya ihtiyacın var`
                  : "Tüm ödemeleri karşılayabilirsin"}
              </span>
            </div>
          </div>
        </section>

        {/* Şimdi Ödenecekler — sürükle-bırak kuyruğu */}
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverQueue(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverQueue(false);
          }}
          onDrop={handleDropOnQueue}
          className={cn(
            "mt-5 overflow-hidden rounded-lg border-2 border-dashed transition-colors print:border-0",
            dragOverQueue
              ? "border-primary bg-primary/[0.04]"
              : "border-border/70 bg-card",
          )}
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <GripVertical className="size-4 text-primary" />
                Şimdi Ödenecekler
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Aşağıdaki listeden ödemeleri buraya sürükleyip bırakın; hazır olduğunuzda ödeyin.
              </p>
            </div>
            {queuedPayments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {queuedPayments.length} kalem
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {queuedAmounts.map((b) => (
                    <span
                      key={b.currency}
                      className="font-mono text-sm font-semibold tabular-nums text-foreground"
                    >
                      {formatCurrency(b.total, b.currency)}
                    </span>
                  ))}
                </span>
                <div className="hidden h-5 w-px bg-border sm:block" />
                <span className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs">
                  <Coins className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Elimde:</span>
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {formatCurrency(cashOnHand, "TRY")}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-muted-foreground">Ödeme sonrası:</span>
                  <span
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      queueNeedMore ? "text-destructive" : "text-emerald-600",
                    )}
                  >
                    {queueNeedMore ? "−" : "+"}
                    {formatCurrency(Math.abs(queueAfter), "TRY")}
                  </span>
                </span>
              </div>
            )}
          </header>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnList}
            className="min-h-[52px] p-2"
          >
            {queuedPayments.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-md px-4 py-6 text-xs text-muted-foreground/70">
                <Plus className="size-3.5" />
                Ödemeleri buraya sürükleyin
              </div>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {queuedPayments.map((payment) => {
                  const cur = payment.currency ?? "TRY";
                  const remaining = payment.amount - (payment.paidAmount ?? 0);
                  return (
                    <li
                      key={payment.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/mizan-payment", payment.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(payment.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md border bg-background px-3 py-2 transition-shadow hover:shadow-sm",
                        dragId === payment.id && "opacity-40",
                      )}
                    >
                      <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/50 group-hover:text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="max-w-[220px] truncate text-xs font-medium text-foreground">
                          {payment.label}
                        </p>
                        <p className="text-[10px] tabular-nums text-muted-foreground">
                          {formatCurrency(remaining, cur)}
                          {payment.paidAmount && payment.paidAmount > 0 ? " · kısmi" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Kuyruktan çıkar"
                        onClick={() => {
                          setPaymentQueued(payment.id, false);
                          toast.success(`"${payment.label}" kuyruktan çıkarıldı.`);
                        }}
                        className="ml-1 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Ödeme Listesi — tam genişlik (kuyruğa sürükleme hedefi) */}
        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnList}
          className="mt-5 overflow-hidden rounded-lg border bg-card print:border-0"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Ödeme Listesi</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filteredPayments.length} kalem — toplam {currencyTotalsText(listAmounts)}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setShowDialog(true)}
              className="h-9 gap-1.5 text-xs font-semibold print:hidden"
            >
              <Plus className="size-4" />
              Yeni Ödeme
            </Button>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/70 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 text-center w-8">S.</th>
                  <th className="px-2 py-2">Açıklama</th>
                  <th className="px-2 py-2 w-20">Vade</th>
                  <th className="px-2 py-2 text-center w-10">PB</th>
                  <th className="px-2 py-2 text-right w-28">Tutar</th>
                  <th className="px-2 py-2 text-right w-28">Ödenen</th>
                  <th className="px-2 py-2 text-right w-28">Kalan</th>
                  <th className="px-2 py-2 text-center w-16">Durum</th>
                  <th className="px-2 py-2 w-28">Şirket</th>
                  <th className="px-2 py-2 w-24">Cari</th>
                  <th className="px-2 py-2 text-center w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-16 text-center">
                      <CalendarClock className="mx-auto size-6 text-muted-foreground/60" />
                      <p className="mt-3 text-sm font-medium text-foreground">Ödeme bulunamadı</p>
                      <p className="mt-1 text-xs text-muted-foreground">"Yeni Ödeme" butonuyla ödeme ekleyin.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment, idx) => {
                    const contact = payment.contactId ? contactById(data, payment.contactId) : undefined;
                    const paid = payment.paidAmount ?? 0;
                    const remaining = payment.amount - paid;
                    const isOverdue = new Date(payment.dueDate) < new Date(todayIso()) && remaining > 0;
                    const progress = Math.round((paid / payment.amount) * 100);

                    let durumLabel = "Bekliyor";
                    let durumClass = "bg-orange-50 text-orange-600";
                    if (paid >= payment.amount) {
                      durumLabel = "Ödendi";
                      durumClass = "bg-green-50 text-green-600";
                    } else if (isOverdue) {
                      durumLabel = "Gecikti";
                      durumClass = "bg-red-50 text-destructive";
                    } else if (paid > 0) {
                      durumLabel = "Kısmi";
                      durumClass = "bg-amber-50 text-amber-600";
                    }

                    const cur = payment.currency ?? "TRY";
                    return (
                      <tr
                        key={payment.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/mizan-payment", payment.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(payment.id);
                        }}
                        onDragEnd={() => setDragId(null)}
                        className={cn(
                          "cursor-grab border-b border-border/30 transition-colors hover:bg-muted/30 active:cursor-grabbing",
                          idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                          dragId === payment.id && "opacity-40",
                        )}
                      >
                        <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-foreground">
                              {payment.label}
                            </span>
                            {payment.recurringType && payment.recurringType !== "yok" && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-blue-500/10 px-1 py-0.5 text-[9px] font-medium text-blue-600">
                                <Repeat className="size-2" />
                                {RECURRING_LABELS[payment.recurringType]}
                              </span>
                            )}
                          </div>
                          {payment.description && (
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70 italic">
                              {payment.description}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2 tabular-nums text-muted-foreground">
                          <span className={cn(isOverdue && "font-medium text-destructive")}>
                            {formatDate(payment.dueDate)}
                          </span>
                          {isOverdue && (
                            <span className="ml-1 text-[9px] text-destructive">⚠</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/30 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                            {cur}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums font-medium text-foreground">
                          {cur === "TRY" ? (
                            formatCurrency(payment.amount, cur)
                          ) : (
                            <MoneyCell amount={payment.amount} currency={cur} rates={ratesByCode} source={tcmbSource} />
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {paid > 0 ? (
                            <span className="text-green-600">
                              {cur === "TRY" ? (
                                formatCurrency(paid, cur)
                              ) : (
                                <MoneyCell amount={paid} currency={cur} rates={ratesByCode} source={tcmbSource} />
                              )}
                              <span className="ml-1 text-[9px]">%{progress}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          <span className={cn(
                            "font-medium",
                            isOverdue ? "text-destructive" : "text-foreground",
                          )}>
                            {remaining > 0 ? (
                              cur === "TRY" ? (
                                formatCurrency(remaining, cur)
                              ) : (
                                <MoneyCell amount={remaining} currency={cur} rates={ratesByCode} source={tcmbSource} />
                              )
                            ) : (
                              <span className="text-green-600">✓</span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold", durumClass)}>
                            {durumLabel}
                          </span>
                        </td>
                        <td className="px-2 py-2 truncate">
                          {payment.company ? (
                            <span className="font-medium text-primary">{companyLabel(payment.company)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 truncate">
                          {contact ? (
                            <span className="inline-flex items-center gap-0.5 text-primary">
                              <Users className="size-2.5" />
                              {contact.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            {renderPaymentActions(payment.id)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredPayments.length > 0 && (
                <tfoot>
                  {listAmounts.map((b, idx) => {
                    const paidSum = listPaid.find((x) => x.currency === b.currency)?.total ?? 0;
                    const remainingSum = listRemaining.find((x) => x.currency === b.currency)?.total ?? 0;
                    return (
                      <tr
                        key={b.currency}
                        className={cn(
                          "font-semibold text-foreground",
                          idx === 0 ? "border-t-2 border-border" : "border-t border-border/50",
                        )}
                      >
                        <td colSpan={3} className="px-2 py-2 text-right text-xs">
                          {idx === 0 ? "TOPLAM" : ""}
                        </td>
                        <td className="px-2 py-2 text-center text-xs">{b.currency}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-sm">
                          {b.currency === "TRY" ? (
                            formatCurrency(b.total, b.currency)
                          ) : (
                            <MoneyCell amount={b.total} currency={b.currency} rates={ratesByCode} source={tcmbSource} />
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-sm text-green-600">
                          {paidSum > 0 && b.currency !== "TRY" ? (
                            <MoneyCell amount={paidSum} currency={b.currency} rates={ratesByCode} source={tcmbSource} />
                          ) : (
                            formatCurrency(paidSum, b.currency)
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-sm">
                          {formatCurrency(remainingSum, b.currency)}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    );
                  })}
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <div className="mt-4 grid gap-6 lg:grid-cols-5 print:grid-cols-1">
          {/* Sol panel: rapor */}
          <div className="self-start space-y-6 lg:col-span-2 print:hidden">
            {/* Ödeme Raporu */}
            <section className="rounded-lg border bg-card">
              <header className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="size-4" />
                    Ödeme Raporu
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Genel ödeme durumu
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handlePrintReport}
                >
                  <Printer className="size-4" />
                  Yazdır
                </Button>
              </header>
              <div className="p-5 space-y-4">
                {/* Özet kartları */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border/50 bg-background p-3">
                    <p className="text-xs font-medium text-muted-foreground">Toplam Planlanan</p>
                    {renderBreakdownLines(listAmounts, "text-lg text-foreground")}
                  </div>
                  <div className="rounded-md border border-border/50 bg-background p-3">
                    <p className="text-xs font-medium text-muted-foreground">Bekleyen Tutar</p>
                    {renderBreakdownLines(pendingAmounts, "text-lg text-orange-600")}
                  </div>
                  <div className="rounded-md border border-border/50 bg-background p-3">
                    <p className="text-xs font-medium text-muted-foreground">Ödenen Tutar</p>
                    {renderBreakdownLines(paidAmounts, "text-lg text-green-600")}
                  </div>
                  <div className="rounded-md border border-border/50 bg-background p-3">
                    <p className="text-xs font-medium text-muted-foreground">Geciken Ödeme</p>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-destructive">
                      {overdue.length > 0 ? `${overdue.length} adet` : "Yok"}
                    </p>
                  </div>
                </div>

                {/* Durum dağılımı */}
                <div className="rounded-md border border-border/50 bg-background p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Ödeme Durumu Dağılımı</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Tam Ödenen</span>
                      <span className="font-mono text-sm tabular-nums text-green-600">{fullyPaidCount} adet</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Kısmi Ödenen</span>
                      <span className="font-mono text-sm tabular-nums text-orange-600">{partialCount} adet</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Ödenmemiş</span>
                      <span className="font-mono text-sm tabular-nums text-foreground">
                        {allPayments.length - fullyPaidCount - partialCount} adet
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </section>
          </div>

          {/* Sağ panel: Ödeme listesi */}
          <div className="lg:col-span-3 print:col-span-1">
            {/* Arama + Filtre */}
            <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ödeme ara..."
                  className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border/70 bg-card p-0.5">
                {([
                  { key: "tumu" as FilterStatus, label: "Tümü" },
                  { key: "bekliyor" as FilterStatus, label: "Bekliyor" },
                  { key: "odendi" as FilterStatus, label: "Ödendi" },
                  { key: "kismi" as FilterStatus, label: "Kısmi" },
                  { key: "gecikti" as FilterStatus, label: "Gecikti" },
                ]).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilterStatus(f.key)}
                    className={cn(
                      "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                      filterStatus === f.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Şirket filtresi + borç özeti */}
            <div className="mb-4 space-y-3 print:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Building2 className="size-3.5" />
                  Şirket
                </span>
                <div className="flex items-center gap-1 rounded-md border border-border/70 bg-card p-0.5">
                  {companyFilterOptions.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setCompanyFilter(f.key)}
                      className={cn(
                        "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                        companyFilter === f.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {companySummaries.map((cs) => {
                  const active = companyFilter === cs.key;
                  return (
                    <button
                      key={cs.key}
                      type="button"
                      onClick={() => setCompanyFilter(active ? "tumu" : cs.key)}
                      className={cn(
                        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/[0.06]"
                          : "border-border/70 bg-card hover:bg-muted/30",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            active ? "text-primary" : "text-foreground",
                          )}
                        >
                          {cs.label}
                        </span>
                        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {cs.count} bekleyen
                        </span>
                      </div>
                      {cs.remaining.length > 0 ? (
                        cs.remaining.map((b) => {
                          const r = b.currency === "TRY" ? undefined : ratesByCode[b.currency];
                          const kur = r ? (r.forexBuying + r.forexSelling) / 2 / r.unit : undefined;
                          return (
                            <p
                              key={b.currency}
                              className="font-mono text-sm font-semibold tabular-nums text-foreground"
                            >
                              {formatCurrency(b.total, b.currency)}
                              {kur ? (
                                <span className="ml-1.5 text-[11px] font-normal tabular-nums text-muted-foreground">
                                  ≈ {formatCurrency(b.total * kur, "TRY")}
                                </span>
                              ) : null}
                            </p>
                          );
                        })
                      ) : (
                        <p className="text-xs font-medium text-emerald-600">Borcu yok ✓</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Görünüm seçici + özet */}
            <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
              <div className="flex items-center gap-2">
                {/* Grup/Gösterim modu */}
                <div className="grid grid-cols-2 gap-px rounded-md border bg-border p-px">
                  <button
                    type="button"
                    onClick={() => setDisplayMode("tablo")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
                      displayMode === "tablo"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Table className="size-3.5" />
                    Tablo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode("grup")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
                      displayMode === "grup"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <LayoutList className="size-3.5" />
                    Grup
                  </button>
                </div>
                {/* Grup modu için tarih aralığı */}
                {displayMode === "grup" && (
                  <div className="grid grid-cols-2 gap-px rounded-md border bg-border p-px">
                    <button
                      type="button"
                      onClick={() => setView("gunluk")}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
                        view === "gunluk"
                          ? "bg-background text-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <CalendarDays className="size-3.5" />
                      Günlük
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("haftalik")}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors",
                        view === "haftalik"
                          ? "bg-background text-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <CalendarRange className="size-3.5" />
                      Haftalık
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {paymentCount} ödeme
                </span>
                {" · "}toplam{" "}
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {currencyTotalsText(listAmounts)}
                </span>
                {overdue.length > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-destructive">
                      {overdue.length} gecikti
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Geciken ödemeler */}
            {overdue.length > 0 && (filterStatus === "tumu" || filterStatus === "gecikti") && (
              <section className="mt-6 overflow-hidden rounded-lg border border-destructive/30 bg-card">
                <header className="flex items-center justify-between gap-4 border-b border-destructive/20 px-5 py-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <AlertTriangle className="size-4 text-destructive" />
                      Geciken Ödemeler
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Vadesi geçmiş {overdue.length} ödeme — toplam{" "}
                      <span className="font-mono tabular-nums">
                        {currencyTotalsText(overdueAmounts)}
                      </span>
                    </p>
                  </div>
                </header>
                <ul className="divide-y divide-border/70">
                  {overdue.map(renderPaymentItem)}
                </ul>
              </section>
            )}

            {/* Grup Görünümü */}
            {displayMode === "grup" && (
              groups.length === 0 ? (
                <div className="mt-6 rounded-lg border bg-card px-6 py-16 text-center">
                  <CalendarClock className="mx-auto size-6 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {overdue.length > 0
                      ? "Planlanmış başka ödeme yok"
                      : "Planlanmış ödeme yok"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Soldaki formdan yeni ödeme ekleyin.
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <section key={group.key} className="mt-6">
                    <div className="flex items-end justify-between gap-4 px-1">
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">
                          {group.title}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {group.subtitle}
                        </p>
                      </div>
                      <p className="font-mono text-sm tabular-nums text-foreground">
                        {currencyTotalsText(sumByCurrency(group.payments, (p) => p.amount))}
                      </p>
                    </div>
                    <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-lg border bg-card">
                      {group.payments.map(renderPaymentItem)}
                    </ul>
                  </section>
                ))
              )
            )}
          </div>
        </div>



        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground print:hidden">
          Mizan — verileriniz bu tarayıcıda güvenle saklanır ve sayfa
          yenilense de korunur.
        </footer>
      </main>

      {/* Yeni Ödeme — Açılır Pencere */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Ödeme Ekle</DialogTitle>
            <DialogDescription>
              Planlanacak ödemenin bilgilerini girin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Açıklama
              </Label>
              <Input
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                  setError(null);
                }}
                placeholder="Örn. Tedarikçi ödemesi — Yılmaz Tekstil"
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                <Users className="mr-1 inline-block size-3" />
                Şirket (Opsiyonel)
              </Label>
              <select
                value={company}
                onChange={(event) => {
                  setCompany(event.target.value as PaymentCompany | "");
                  setError(null);
                }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="">Şirket seçin (opsiyonel)</option>
                {PAYMENT_COMPANIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground/70">
                Ferla veya Meskur'a ait masrafları şirkete bağlayın; zorunlu değil.
              </p>
            </div>

            {contactsSorted(data).length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  <Users className="mr-1 inline-block size-3" />
                  Cari (Opsiyonel)
                </Label>
                <select
                  value={contactId}
                  onChange={(event) => setContactId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">Cari seçin (opsiyonel)</option>
                  {contactsSorted(data).map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} ({contact.type === "musteri" ? "Müşteri" : "Tedarikçi"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Tutar
                </Label>
                <FormattedInput
                  value={amount}
                  onChange={(v) => { setAmount(v); setError(null); }}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Vade Tarihi
                </Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                />
              </div>
            </div>

            {/* Tekrarlama seçenekleri */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                <Repeat className="mr-1 inline-block size-3" />
                Tekrarlama
              </Label>
              <select
                value={recurringType}
                onChange={(event) => {
                  setRecurringType(event.target.value as RecurringType);
                  setError(null);
                }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="yok">Tekrar yok (tek seferlik)</option>
                <option value="gunluk">Her gün</option>
                <option value="haftalik">Her hafta</option>
                <option value="aylik">Her ay</option>
                <option value="yillik">Her yıl</option>
              </select>
            </div>

            {recurringType !== "yok" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Bitiş Tarihi (opsiyonel)
                </Label>
                <Input
                  type="date"
                  value={recurringEndDate}
                  onChange={(event) => setRecurringEndDate(event.target.value)}
                  placeholder="Belirtilmezse süresiz tekrarlanır"
                />
                <p className="text-[11px] text-muted-foreground/70">
                  Boş bırakırsanız ödeme süresiz olarak her dönem tekrarlanır.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                <Coins className="mr-1 inline-block size-3" />
                Para Birimi
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_CURRENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentCurrency(opt.value)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      paymentCurrency === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{opt.symbol}</span>
                    <span>{opt.value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Açıklama Notu (Opsiyonel)
              </Label>
              <textarea
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setError(null);
                }}
                placeholder="Ek bilgi veya not"
                rows={2}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowDialog(false); setError(null); }}
              >
                İptal
              </Button>
              <Button type="submit" disabled={!label.trim() || amount <= 0}>
                <Plus className="mr-2 size-4" />
                Ödemeyi Planla
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
