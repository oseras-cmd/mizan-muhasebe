import { AppHeader } from "@/components/AppHeader";
import { FormattedInput } from "@/components/FormattedInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accountLedger,
  transfersSorted,
} from "@/lib/finance/dashboard";
import {
  formatDate,
  formatCurrency,
  formatInputValue,
  formatTRY,
  parseTurkishNumber,
  todayIso,
} from "@/lib/finance/format";
import {
  addAccount,
  addTransfer,
  deleteAccount,
  deleteTransaction,
  deleteTransfer,
  updateAccount,
  useFinanceData,
} from "@/lib/finance/store";
import type { Account, AccountCurrency, AccountType } from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  Check,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AccountFormState {
  name: string;
  type: AccountType;
  balance: string;
  currency: AccountCurrency;
}

const emptyAccountForm: AccountFormState = {
  name: "",
  type: "banka",
  balance: "",
  currency: "TRY",
};

export default function KasaBanka() {
  const data = useFinanceData();
  const transfers = transfersSorted(data);

  /* Hesap formu */
  const [form, setForm] = useState<AccountFormState>(emptyAccountForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Virman formu */
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayIso);
  const [note, setNote] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);

  /* Hesap dökümü */
  const [ledgerAccountId, setLedgerAccountId] = useState("");
  const ledgerAccount =
    data.accounts.find((account) => account.id === ledgerAccountId) ??
    data.accounts[0];
  const ledger =
    ledgerAccount && data.accounts.length > 0
      ? accountLedger(data, ledgerAccount.id)
      : { openingBalance: 0, entries: [] };
  const totalIn = ledger.entries
    .filter((entry) => entry.kind === "gelir" || entry.kind === "virman-giris")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalOut = ledger.entries
    .filter((entry) => entry.kind === "gider" || entry.kind === "virman-cikis")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const totalCash = data.accounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const kasaTotal = data.accounts
    .filter((account) => account.type === "kasa")
    .reduce((sum, account) => sum + account.balance, 0);
  const bankaTotal = data.accounts
    .filter((account) => account.type === "banka")
    .reduce((sum, account) => sum + account.balance, 0);

  const currencyTotals = data.accounts.reduce<Record<string, number>>((acc, account) => {
    acc[account.currency ?? "TRY"] = (acc[account.currency ?? "TRY"] ?? 0) + account.balance;
    return acc;
  }, {});

  const fromAccount = data.accounts.find((a) => a.id === fromAccountId);

  const setField = (patch: Partial<AccountFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setConfirmingId(null);
    setForm({
      name: account.name,
      type: account.type,
      balance: String(account.balance).replace(".", ","),
      currency: account.currency ?? "TRY",
    });
  };

  const resetForm = () => {
    setForm(emptyAccountForm);
    setEditingId(null);
    setError(null);
  };

  const handleAccountSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedBalance = parseTurkishNumber(form.balance);
    if (!form.name.trim()) {
      setError("Lütfen hesap adını girin.");
      return;
    }
    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setError("Lütfen geçerli bir bakiye girin.");
      return;
    }
    if (editingId) {
      updateAccount(editingId, {
        name: form.name.trim(),
        type: form.type,
        balance: parsedBalance,
        currency: form.currency,
      });
      toast.success("Hesap güncellendi.");
    } else {
      addAccount({
        name: form.name.trim(),
        type: form.type,
        balance: parsedBalance,
        currency: form.currency,
      });
      toast.success("Hesap eklendi.");
    }
    resetForm();
  };

  const handleAccountDelete = (account: Account) => {
    if (data.accounts.length === 1) {
      toast.error("Son hesap silinemez.");
      setConfirmingId(null);
      return;
    }
    deleteAccount(account.id);
    setConfirmingId(null);
    if (editingId === account.id) resetForm();
    toast.success("Hesap ve ilgili tüm hareketler silindi.");
  };

  const handleTransferSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTransferError(null);

    if (!fromAccountId || !toAccountId) {
      setTransferError("Lütfen gönderen ve alan hesabı seçin.");
      return;
    }
    if (fromAccountId === toAccountId) {
      setTransferError("Gönderen ve alan hesap aynı olamaz.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setTransferError("Lütfen geçerli bir tutar girin.");
      return;
    }
    if (!fromAccount || fromAccount.balance < amount) {
      setTransferError(
        `Yetersiz bakiye — mevcut: ${formatTRY(fromAccount?.balance ?? 0)}`,
      );
      return;
    }

    addTransfer({
      fromAccountId,
      toAccountId,
      amount,
      date,
      note,
    });
    toast.success(`${formatTRY(amount)} aktarıldı.`);
    setAmount(0);
    setNote("");
  };

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        {/* Sayfa başlığı */}
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
            Modül
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Kasa / Banka Yönetimi
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Nakit kasalarınızı ve banka hesaplarınızı tanımlayın, hesaplar
            arasında virman yapın. Gelir/gider kayıtları bakiyelere anında
            yansır.
          </p>
        </div>

        {/* Bakiye özeti */}
        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">              <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Wallet className="size-4" />
              Toplam Kasa
            </p>
            <div className="mt-2.5 space-y-1">
              {Object.entries(currencyTotals).map(([cur, tot]) => (
                <p key={cur} className="text-[22px] font-medium tabular-nums tracking-tight text-foreground">
                  {formatCurrency(tot, cur)}
                </p>
              ))}
              {Object.keys(currencyTotals).length === 0 && (
                <p className="text-[22px] font-medium tabular-nums tracking-tight text-foreground">
                  {formatTRY(0)}
                </p>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {data.accounts.length} hesap
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Banknote className="size-4" />
              Nakit Kasalar
            </p>
            <p className="mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight text-foreground">
              {formatTRY(kasaTotal)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {data.accounts.filter((a) => a.type === "kasa").length} kasa
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Landmark className="size-4" />
              Bankalar
            </p>
            <p className="mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight text-foreground">
              {formatTRY(bankaTotal)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {data.accounts.filter((a) => a.type === "banka").length} banka
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Sol sütun: hesap formu + virman */}
          <div className="space-y-6 lg:col-span-2">
            <section className="self-start rounded-lg border bg-card">
              <header className="border-b border-border/70 px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">
                  {editingId ? "Hesabı Düzenle" : "Yeni Hesap"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {editingId
                    ? "Hesap bilgilerini güncelleyin"
                    : "Kasa veya banka hesabı tanımlayın"}
                </p>
              </header>
              <form
                onSubmit={handleAccountSubmit}
                className="grid gap-5 p-5 sm:p-6"
              >
                <div className="grid grid-cols-2 gap-px rounded-md border bg-border p-px">
                  <button
                    type="button"
                    onClick={() => setField({ type: "kasa" })}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-[5px] py-2 text-sm font-medium transition-colors",
                      form.type === "kasa"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Banknote className="size-4" />
                    Kasa
                  </button>
                  <button
                    type="button"
                    onClick={() => setField({ type: "banka" })}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-[5px] py-2 text-sm font-medium transition-colors",
                      form.type === "banka"
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Landmark className="size-4" />
                    Banka
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Hesap Adı
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setField({ name: event.target.value })
                    }
                    placeholder="Örn. Garanti BBVA — Ticari"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Para Birimi
                  </Label>
                  <select
                    value={form.currency}
                    onChange={(event) => setField({ currency: event.target.value as AccountCurrency })}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="TRY">₺ Türk Lirası (TRY)</option>
                    <option value="USD">$ ABD Doları (USD)</option>
                    <option value="EUR">€ Euro (EUR)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Başlangıç Bakiyesi
                  </Label>
                  <Input
                    value={form.balance}
                    onChange={(event) =>
                      setField({ balance: formatInputValue(event.target.value) })
                    }
                    placeholder="0,00"
                    inputMode="decimal"
                    className="tabular-nums"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-2">
                  {editingId && (
                    <Button type="button" variant="ghost" onClick={resetForm}>
                      Vazgeç
                    </Button>
                  )}
                  <Button type="submit">
                    {editingId ? (
                      <>
                        <Check className="mr-2 size-4" />
                        Güncelle
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 size-4" />
                        Hesabı Ekle
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </section>

            <section className="rounded-lg border bg-card">
              <header className="border-b border-border/70 px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ArrowRightLeft className="size-4" />
                  Virman
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Hesaplar arası para transferi
                </p>
              </header>
              <form
                onSubmit={handleTransferSubmit}
                className="grid gap-5 p-5 sm:p-6"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Gönderen
                    </Label>
                    <select
                      value={fromAccountId}
                      onChange={(event) =>
                        setFromAccountId(event.target.value)
                      }
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">Hesap seçin</option>
                      {data.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({formatCurrency(account.balance, account.currency ?? "TRY")})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Alan
                    </Label>
                    <select
                      value={toAccountId}
                      onChange={(event) => setToAccountId(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">Hesap seçin</option>
                      {data.accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({formatCurrency(account.balance, account.currency ?? "TRY")})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Tutar (₺)
                    </Label>
                    <FormattedInput
                      value={amount}
                      onChange={setAmount}
                      placeholder="0,00"
                      required
                    />
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

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Açıklama
                  </Label>
                  <Input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="İsteğe bağlı"
                  />
                </div>

                {transferError && (
                  <p className="text-sm text-destructive">{transferError}</p>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={
                      !fromAccountId ||
                      !toAccountId ||
                      fromAccountId === toAccountId ||
                      amount <= 0
                    }
                  >
                    <ArrowRight className="mr-2 size-4" />
                    Virman Yap
                  </Button>
                </div>
              </form>
            </section>
          </div>

          {/* Sağ sütun: hesaplar + virman geçmişi */}
          <div className="space-y-6 lg:col-span-3">
            <section className="rounded-lg border bg-card">
              <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Hesaplar
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Kasa ve banka bakiyeleri
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {data.accounts.length} hesap
                </span>
              </header>
              <ul className="divide-y divide-border/70">
                {data.accounts.map((account) => {
                  const isKasa = account.type === "kasa";
                  return (
                    <li
                      key={account.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                          {isKasa ? (
                            <Banknote className="size-4 text-muted-foreground" />
                          ) : (
                            <Landmark className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {account.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <span className="rounded-sm border border-border/80 px-1 py-px">
                            {isKasa ? "Nakit Kasa" : "Banka"}
                          </span>
                          {' '}&middot;{' '}
                          <button
                            type="button"
                            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            onClick={() => {
                              setLedgerAccountId(account.id);
                              document.getElementById("hesap-dokumu")?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            Hareketleri Gör
                          </button>
                        </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-sm tabular-nums text-foreground">
                          {formatCurrency(account.balance, account.currency ?? "TRY")}
                          <span className="ml-1 text-[10px] font-medium text-muted-foreground">{account.currency ?? "TRY"}</span>
                        </p>
                        {confirmingId === account.id ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleAccountDelete(account)}
                            >
                              Sil
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingId(null)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Düzenle"
                              onClick={() => startEdit(account)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Sil"
                              onClick={() => setConfirmingId(account.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-lg border bg-card">
              <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Virman Geçmişi
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Yapılan para transferleri
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {transfers.length} işlem
                </span>
              </header>
              {transfers.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-foreground">
                    Henüz virman yok
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Soldaki formdan hesaplar arası transfer yapın.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {transfers.map((transfer) => {
                    const from = data.accounts.find(
                      (a) => a.id === transfer.fromAccountId,
                    );
                    const to = data.accounts.find(
                      (a) => a.id === transfer.toAccountId,
                    );
                    return (
                      <li
                        key={transfer.id}
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                            <ArrowRightLeft className="size-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {from?.name ?? "Silinen hesap"}
                              <ArrowRight className="mx-1.5 inline size-3.5 text-muted-foreground" />
                              {to?.name ?? "Silinen hesap"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {formatDate(transfer.date)}
                              {transfer.note ? ` · ${transfer.note}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <p className="text-sm tabular-nums text-foreground">
                            {formatCurrency(transfer.amount, from?.currency ?? "TRY")}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Virmanı Sil"
                            onClick={() => {
                              deleteTransfer(transfer.id);
                              toast.success("Virman silindi.");
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* Hesap dökümü (ekstre) */}
        <section id="hesap-dokumu" className="mt-6 rounded-lg border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Hesap Dökümü
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Seçili hesabın tüm hareketleri ve satır satır bakiye
              </p>
            </div>
            <select
              value={ledgerAccount?.id ?? ""}
              onChange={(event) => setLedgerAccountId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] sm:w-64"
            >
              {data.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({formatCurrency(account.balance, account.currency ?? "TRY")})
                </option>
              ))}
            </select>
          </header>

          {/* Döküm özeti */}
          <div className="grid grid-cols-2 gap-px border-b border-border/70 bg-border sm:grid-cols-4">
            <div className="bg-card p-4">
              <p className="text-xs text-muted-foreground">Açılış Bakiyesi</p>
              <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(ledger.openingBalance, ledgerAccount?.currency ?? "TRY")}
              </p>
            </div>
            <div className="bg-card p-4">
              <p className="text-xs text-muted-foreground">Toplam Giriş</p>
              <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
                +{formatCurrency(totalIn, ledgerAccount?.currency ?? "TRY")}
              </p>
            </div>
            <div className="bg-card p-4">
              <p className="text-xs text-muted-foreground">Toplam Çıkış</p>
              <p className="mt-1 text-sm font-medium tabular-nums text-muted-foreground">
                −{formatCurrency(totalOut, ledgerAccount?.currency ?? "TRY")}
              </p>
            </div>
            <div className="bg-card p-4">
              <p className="text-xs text-muted-foreground">Güncel Bakiye</p>
              <p className="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(ledgerAccount?.balance ?? 0, ledgerAccount?.currency ?? "TRY")}
              </p>
            </div>
          </div>

          {ledger.entries.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                Bu hesapta hareket yok
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Gelir/gider kayıtları ve virmanlar burada görünür.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {ledger.entries.map((entry) => {
                const isIn =
                  entry.kind === "gelir" || entry.kind === "virman-giris";
                const kindLabel =
                  entry.kind === "gelir"
                    ? "Gelir"
                    : entry.kind === "gider"
                      ? "Gider"
                      : entry.kind === "virman-giris"
                        ? "Virman Giriş"
                        : "Virman Çıkış";
                return (
                  <li
                    key={`${entry.id}-${entry.date}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                        <span className="font-mono text-xs font-medium tabular-nums text-foreground">
                          {Number(entry.date.slice(8, 10))}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {entry.description}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {kindLabel} · {formatDate(entry.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <p
                        className={cn(
                          "w-28 shrink-0 text-right font-mono text-sm tabular-nums",
                          isIn
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {isIn ? "+" : "−"}
                        {formatCurrency(entry.amount, ledgerAccount?.currency ?? "TRY")}
                      </p>
                      <p className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(entry.balanceAfter, ledgerAccount?.currency ?? "TRY")}
                      </p>
                      <div className="w-8">
                        {deletingEntryId === entry.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-7 px-1.5 text-xs"
                              onClick={() => {
                                if (entry.kind === "virman-giris" || entry.kind === "virman-cikis") {
                                  const realId = entry.id.replace("trf-", "");
                                  deleteTransfer(realId);
                                } else {
                                  deleteTransaction(entry.id);
                                }
                                setDeletingEntryId(null);
                                toast.success("Hareket silindi.");
                              }}
                            >
                              Sil
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeletingEntryId(null)}
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Hareketi Sil"
                            onClick={() => setDeletingEntryId(entry.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <footer className="mt-14 border-t border-border/70 pt-6 text-center text-xs text-muted-foreground">
          Mizan — verileriniz bu tarayıcıda güvenle saklanır ve sayfa
          yenilense de korunur.
        </footer>
      </main>
    </div>
  );
}
