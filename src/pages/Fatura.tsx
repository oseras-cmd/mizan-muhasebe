import { formatInputValue } from "@/lib/finance/format";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  accountById,
  contactById,
  invoicesSorted,
} from "@/lib/finance/dashboard";
import {
  formatDate,
  formatTRY,
  parseTurkishNumber,
  todayIso,
} from "@/lib/finance/format";
import { buildInvoicePdf } from "@/lib/finance/invoicePdf";
import {
  addInvoice,
  deleteInvoice,
  setInvoicePaid,
  useFinanceData,
} from "@/lib/finance/store";
import {
  KDV_RATES,
  type Invoice,
  type InvoiceItem,
  type KdvRate,
} from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import {
  Check,
  Download,
  FileText,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ItemFormRow {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  kdvRate: KdvRate;
}

function newItemRow(): ItemFormRow {
  return {
    id: `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    description: "",
    quantity: "1",
    unitPrice: "",
    kdvRate: 20,
  };
}

function lineTotal(row: ItemFormRow): number {
  const qty = parseTurkishNumber(row.quantity);
  const price = parseTurkishNumber(row.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}

type Filter = "tumu" | "bekleyen" | "odendi";

const filters: { value: Filter; label: string }[] = [
  { value: "tumu", label: "Tümü" },
  { value: "bekleyen", label: "Bekleyen" },
  { value: "odendi", label: "Ödendi" },
];

function StatusBadge({ paid }: { paid?: boolean }) {
  return paid ? (
    <span className="flex items-center gap-1 rounded-sm border border-foreground/20 bg-foreground/[0.04] px-1 py-px text-[11px] text-foreground">
      <Check className="size-3" />
      Ödendi
    </span>
  ) : (
    <span className="rounded-sm border border-border/80 px-1 py-px text-[11px] text-muted-foreground">
      Bekliyor
    </span>
  );
}

export default function Fatura() {
  const data = useFinanceData();
  const invoices = invoicesSorted(data);

  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(todayIso);
  const [rows, setRows] = useState<ItemFormRow[]>([newItemRow()]);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("tumu");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paidAccountId, setPaidAccountId] = useState("");
  const [paidDate, setPaidDate] = useState(todayIso);
  const [confirming, setConfirming] = useState<{
    kind: "revert" | "delete";
    id: string;
  } | null>(null);

  const visibleInvoices = invoices.filter((invoice) => {
    if (filter === "bekleyen") return !invoice.paid;
    if (filter === "odendi") return invoice.paid;
    return true;
  });

  const hasItems = rows.some(
    (row) =>
      row.description.trim() !== "" &&
      Number.isFinite(parseTurkishNumber(row.quantity)) &&
      Number.isFinite(parseTurkishNumber(row.unitPrice)),
  );

  const subtotal = rows.reduce(
    (sum, row) => sum + lineTotal(row),
    0,
  );
  const kdvTotal = rows.reduce((sum, row) => {
    const total = lineTotal(row);
    return sum + total * (row.kdvRate / 100);
  }, 0);
  const total = subtotal + kdvTotal;

  const updateRow = (id: string, patch: Partial<ItemFormRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((row) => row.id !== id) : prev,
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!contactId) {
      setError("Lütfen fatura kesilecek cariyi seçin.");
      return;
    }
    const items: InvoiceItem[] = rows
      .filter(
        (row) =>
          row.description.trim() !== "" &&
          Number.isFinite(parseTurkishNumber(row.quantity)) &&
          Number.isFinite(parseTurkishNumber(row.unitPrice)) &&
          parseTurkishNumber(row.quantity) > 0 &&
          parseTurkishNumber(row.unitPrice) >= 0,
      )
      .map((row) => ({
        id: row.id,
        description: row.description.trim(),
        quantity: parseTurkishNumber(row.quantity),
        unitPrice: parseTurkishNumber(row.unitPrice),
        kdvRate: row.kdvRate,
      }));
    if (items.length === 0) {
      setError("En az bir geçerli kalem ekleyin.");
      return;
    }

    const invoice = addInvoice({
      contactId,
      date,
      items,
    });
    toast.success(`${invoice.invoiceNo} numaralı fatura kesildi.`);
    setRows([newItemRow()]);
    setError(null);
  };

  const handleDownload = (invoiceId: string) => {
    const invoice = data.invoices.find((inv) => inv.id === invoiceId);
    const contact = invoice ? contactById(data, invoice.contactId) : undefined;
    if (!invoice || !contact) return;
    const doc = buildInvoicePdf(invoice, contact);
    doc.save(`fatura-${invoice.invoiceNo}.pdf`);
    toast.success(`${invoice.invoiceNo} indirildi.`);
  };

  const startPaying = (invoice: Invoice) => {
    setPayingId(invoice.id);
    setPaidAccountId(
      data.accounts.find((account) => account.type === "banka")?.id ??
        data.accounts[0]?.id ??
        "",
    );
    setPaidDate(todayIso());
    setConfirming(null);
  };

  const confirmPaid = (invoice: Invoice) => {
    if (!paidAccountId) {
      toast.error("Lütfen bir hesap seçin.");
      return;
    }
    setInvoicePaid(invoice.id, true, {
      accountId: paidAccountId,
      date: paidDate,
    });
    toast.success(`${invoice.invoiceNo} ödendi olarak işaretlendi.`);
    setPayingId(null);
  };

  const confirmRevert = (invoice: Invoice) => {
    setInvoicePaid(invoice.id, false);
    toast.success(`${invoice.invoiceNo} ödemesi geri alındı.`);
    setConfirming(null);
  };

  const confirmDelete = (invoice: Invoice) => {
    deleteInvoice(invoice.id);
    toast.success(`${invoice.invoiceNo} silindi.`);
    setConfirming(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        {/* Sayfa başlığı */}
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
            Modül
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Fatura Oluşturma
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Müşteri veya tedarikçiye fatura kesin. KDV (%1, %10, %20)
            otomatik hesaplanır; faturaları PDF olarak indirip ödeme
            durumlarını takip edebilirsiniz.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          {/* Fatura formu */}
          <section className="self-start rounded-lg border bg-card lg:col-span-2">
            <header className="border-b border-border/70 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                Yeni Fatura
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ürün / hizmet kalemlerini ekleyin
              </p>
            </header>
            <form onSubmit={handleSubmit} className="grid gap-5 p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Müşteri / Tedarikçi
                  </Label>
                  <Select
                    value={contactId}
                    onValueChange={setContactId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Cari seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name} (
                          {contact.type === "musteri"
                            ? "Müşteri"
                            : "Tedarikçi"}
                          )
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Tarih
                  </Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Kalemler */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Ürün / Hizmet Kalemleri
                </Label>
                <div className="flex flex-col gap-2">
                  {rows.map((row) => {
                    const rowTotal = lineTotal(row);
                    return (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-background p-2"
                      >
                        <Input
                          value={row.description}
                          onChange={(event) =>
                            updateRow(row.id, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Açıklama"
                          className="min-w-36 flex-1"
                        />
                        <Input
                          value={row.quantity}
                          onChange={(event) =>
                            updateRow(row.id, {
                              quantity: formatInputValue(event.target.value),
                            })
                          }
                          placeholder="Miktar"
                          inputMode="decimal"
                          className="w-16 tabular-nums"
                        />
                        <Input
                          value={row.unitPrice}
                          onChange={(event) =>
                            updateRow(row.id, {
                              unitPrice: formatInputValue(event.target.value),
                            })
                          }
                          placeholder="Birim fiyat"
                          inputMode="decimal"
                          className="w-24 tabular-nums"
                        />
                        <Select
                          value={String(row.kdvRate)}
                          onValueChange={(value) =>
                            updateRow(row.id, {
                              kdvRate: Number(value) as KdvRate,
                            })
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {KDV_RATES.map((rate) => (
                              <SelectItem key={rate} value={String(rate)}>
                                %{rate}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="w-28 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {formatTRY(rowTotal)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="Kalemi kaldır"
                          disabled={rows.length === 1}
                          onClick={() => removeRow(row.id)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setRows((prev) => [...prev, newItemRow()])}
                >
                  <Plus className="size-3.5" />
                  Kalem Ekle
                </Button>
              </div>

              {/* Toplamlar */}
              <div className="space-y-1.5 border-t border-border/70 pt-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Ara Toplam</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatTRY(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>KDV Toplam</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {formatTRY(kdvTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border/70 pt-2 text-sm font-semibold text-foreground">
                  <span>Genel Toplam</span>
                  <span className="font-mono text-base tabular-nums">
                    {formatTRY(total)}
                  </span>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end">
                <Button type="submit" disabled={!hasItems || !contactId}>
                  <FileText className="mr-2 size-4" />
                  Faturayı Kes
                </Button>
              </div>
            </form>
          </section>

          {/* Fatura listesi */}
          <section className="rounded-lg border bg-card lg:col-span-3">
            <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Faturalar
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Kesilen faturalar, ödeme durumu ve PDF indirme
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ReceiptText className="size-3.5" />
                {invoices.length} fatura
              </span>
            </header>

            {/* Durum filtresi */}
            <div className="flex items-center gap-1 border-b border-border/70 px-5 py-3">
              {filters.map((option) => {
                const count =
                  option.value === "tumu"
                    ? invoices.length
                    : invoices.filter((invoice) =>
                        option.value === "bekleyen"
                          ? !invoice.paid
                          : invoice.paid,
                      ).length;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      filter === option.value
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                    <span className="font-mono tabular-nums text-muted-foreground/70">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {visibleInvoices.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-foreground">
                  {invoices.length === 0
                    ? "Henüz fatura yok"
                    : "Bu filtrede fatura yok"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {invoices.length === 0
                    ? "Soldaki formdan ilk faturanızı kesin."
                    : "Başka bir filtre seçin."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {visibleInvoices.map((invoice) => {
                  const contact = contactById(data, invoice.contactId);
                  const isPurchase = invoice.invoiceNo.startsWith("AL");
                  const isPaying = payingId === invoice.id;
                  const isConfirming =
                    confirming?.id === invoice.id;
                  return (
                    <li
                      key={invoice.id}
                      className="px-5 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                            <FileText className="size-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                              <span className="font-mono">{invoice.invoiceNo}</span>
                              <span
                                className={
                                  isPurchase
                                    ? "rounded-sm border border-border/80 px-1 py-px text-[11px] text-muted-foreground"
                                    : "rounded-sm border border-foreground/20 bg-foreground/[0.04] px-1 py-px text-[11px] text-foreground"
                                }
                              >
                                {isPurchase ? "Alış" : "Satış"}
                              </span>
                              <StatusBadge paid={invoice.paid} />
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {contact?.name ?? "Bilinmeyen cari"}
                              {" · "}
                              {formatDate(invoice.date)}
                              {invoice.paidAt
                                ? ` · ödendi ${formatDate(invoice.paidAt)}`
                                : ""}
                              {" · "}
                              {invoice.items.length} kalem
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <p className="font-mono text-sm tabular-nums text-foreground">
                            {formatTRY(invoice.total)}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleDownload(invoice.id)}
                          >
                            <Download className="size-3.5" />
                            PDF
                          </Button>
                        </div>
                      </div>

                      {/* Ödeme işlemleri */}
                      <div className="mt-3 flex items-center justify-end gap-2">
                        {invoice.paid ? (
                          isConfirming && confirming?.kind === "revert" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">
                                Ödemeyi geri al? (bakiye düzeltilir)
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => confirmRevert(invoice)}
                              >
                                Evet, geri al
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
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setConfirming({ kind: "revert", id: invoice.id })
                              }
                            >
                              <RotateCcw className="size-3.5" />
                              Ödemeyi Geri Al
                            </Button>
                          )
                        ) : isPaying ? (
                          <div className="flex flex-wrap items-end justify-end gap-3 rounded-md border border-border/70 bg-background p-3">
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[11px] font-medium text-muted-foreground">
                                Hesap
                              </Label>
                              <Select
                                value={paidAccountId}
                                onValueChange={setPaidAccountId}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {data.accounts.map((account) => (
                                    <SelectItem
                                      key={account.id}
                                      value={account.id}
                                    >
                                      {account.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="max-w-48 text-[11px] leading-4 text-muted-foreground">
                                {(() => {
                                  const account = accountById(
                                    data,
                                    paidAccountId,
                                  );
                                  if (!account) return null;
                                  const sign = isPurchase ? -1 : 1;
                                  const next = account.balance + sign * invoice.total;
                                  return (
                                    <>
                                      {isPurchase ? "Gider kaydı" : "Gelir kaydı"}{" "}
                                      oluşur: {formatTRY(account.balance)} →{" "}
                                      <span className="font-mono tabular-nums">
                                        {formatTRY(next)}
                                      </span>
                                    </>
                                  );
                                })()}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[11px] font-medium text-muted-foreground">
                                Tarih
                              </Label>
                              <Input
                                type="date"
                                value={paidDate}
                                onChange={(event) =>
                                  setPaidDate(event.target.value)
                                }
                                className="w-36"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => confirmPaid(invoice)}
                              >
                                <Check className="mr-1.5 size-3.5" />
                                Ödendi
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPayingId(null)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-muted-foreground hover:text-foreground"
                              onClick={() => startPaying(invoice)}
                            >
                              <Check className="size-3.5" />
                              Ödendi İşaretle
                            </Button>
                            {isConfirming && confirming?.kind === "delete" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">
                                  Fatura silinsin mi?
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => confirmDelete(invoice)}
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
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label="Faturayı sil"
                                onClick={() =>
                                  setConfirming({ kind: "delete", id: invoice.id })
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          Mizan — verileriniz bu tarayıcıda güvenle saklanır ve sayfa
          yenilense de korunur.
        </footer>
      </main>
    </div>
  );
}
