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
import { accountById } from "@/lib/finance/dashboard";
import { exportTransactionsCSV } from "@/lib/finance/csvExport";
import {
  formatDate,
  formatTRY,
  parseTurkishNumber,
  todayIso,
} from "@/lib/finance/format";
import { addTransaction, useFinanceData } from "@/lib/finance/store";
import {
  TRANSACTION_CATEGORIES,
  companyLabel,
  type TransactionCategory,
  type TransactionType,
} from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Plus,
  ReceiptText,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export default function GelirGider() {
  const data = useFinanceData();
  const [type, setType] = useState<TransactionType>("gelir");
  const [date, setDate] = useState(todayIso);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("Satış");
  const [accountId, setAccountId] = useState(
    () => data.accounts[0]?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [proje, setProje] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Liste filtreleri
  const [query, setQuery] = useState("");
  const [turFiltre, setTurFiltre] = useState<"hepsi" | TransactionType>("hepsi");
  const [projeFiltre, setProjeFiltre] = useState("hepsi");

  const selectedAccount = accountById(data, accountId);
  const projeler = Array.from(
    new Set(
      data.transactions
        .map((t) => t.proje)
        .filter((p): p is string => !!p),
    ),
  );
  // Tam metin arama (açıklama, kategori, proje, şirket, hesap, tutar, tarih) + filtreler
  const filtered = data.transactions.filter((tx) => {
    if (turFiltre !== "hepsi" && tx.type !== turFiltre) return false;
    if (projeFiltre !== "hepsi" && (tx.proje ?? "") !== projeFiltre)
      return false;
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return true;
    const metin = [
      tx.description,
      tx.category,
      tx.proje ?? "",
      companyLabel(tx.company),
      accountById(data, tx.accountId)?.name ?? "",
      String(tx.amount),
      tx.date,
    ]
      .join(" ")
      .toLocaleLowerCase("tr");
    return metin.includes(q);
  });
  const limited = filtered.slice(0, 100);

  const handleTypeChange = (next: TransactionType) => {
    setType(next);
    setCategory(next === "gelir" ? "Satış" : "Maaş");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsedAmount = parseTurkishNumber(amount);
    if (!description.trim()) {
      setError("Lütfen bir açıklama girin.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Lütfen geçerli bir tutar girin.");
      return;
    }

    addTransaction({
      type,
      description: description.trim(),
      category,
      accountId,
      amount: parsedAmount,
      date,
      proje: proje.trim() || undefined,
    });
    toast.success(type === "gelir" ? "Gelir kaydedildi." : "Gider kaydedildi.");
    setDescription("");
    setAmount("");
    setProje("");
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
            Gelir / Gider Takibi
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Yeni gelir ve gider kayıtlarınızı ekleyin. Değişiklikler anında
            kaydedilir ve Genel Bakış paneline yansır.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          {/* Yeni kayıt formu */}
          <section className="self-start rounded-lg border bg-card lg:col-span-2">
            <header className="border-b border-border/70 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                Yeni Kayıt
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gelir veya gider hareketi ekleyin
              </p>
            </header>
            <form
              onSubmit={handleSubmit}
              className="grid gap-5 p-5 sm:p-6"
            >
              {/* Tür seçici */}
              <div className="grid grid-cols-2 gap-px rounded-md border bg-border p-px">
                <button
                  type="button"
                  onClick={() => handleTypeChange("gelir")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-[5px] py-2 text-sm font-medium transition-colors",
                    type === "gelir"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ArrowUpRight className="size-4" />
                  Gelir
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange("gider")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-[5px] py-2 text-sm font-medium transition-colors",
                    type === "gider"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ArrowDownRight className="size-4" />
                  Gider
                </button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Tarih">
                  <Input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    required
                  />
                </Field>
                <Field label="Kategori">
                  <Select
                    value={category}
                    onValueChange={(value) =>
                      setCategory(value as TransactionCategory)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Kasa / Banka">
                  <Select
                    value={accountId}
                    onValueChange={setAccountId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Hesap seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAccount && (
                    <p className="text-xs text-muted-foreground">
                      Mevcut bakiye: {formatTRY(selectedAccount.balance)}
                    </p>
                  )}
                </Field>
                <Field label="Tutar (₺)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(formatInputValue(event.target.value))}
                    placeholder="0,00"
                    className="tabular-nums"
                    required
                  />
                </Field>
              </div>

              <Field label="Açıklama">
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Örn. Perakende satış — Günlük hasılat"
                  required
                />
              </Field>

              <Field label="Proje / Etiket (opsiyonel)">
                <Input
                  list="gg-proje-listesi"
                  value={proje}
                  onChange={(event) => setProje(event.target.value)}
                  placeholder="Örn. Şube 2, Web Projesi…"
                />
                <datalist id="gg-proje-listesi">
                  {projeler.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end">
                <Button type="submit">
                  <Plus className="mr-2 size-4" />
                  {type === "gelir" ? "Geliri Kaydet" : "Gideri Kaydet"}
                </Button>
              </div>
            </form>
          </section>

          {/* Son kayıtlar */}
          <section className="rounded-lg border bg-card lg:col-span-3">
            <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Kayıtlar
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {query.trim() || turFiltre !== "hepsi" || projeFiltre !== "hepsi"
                    ? `${filtered.length} eşleşme (filtreli görünüm)`
                    : "Tüm gelir ve gider hareketleri"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <ReceiptText className="size-3.5" />
                  {filtered.length} hareket
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={filtered.length === 0}
                  onClick={() =>
                    exportTransactionsCSV(
                      filtered.map((t) => ({
                        type: t.type,
                        description: t.description,
                        category: t.category,
                        amount: t.amount,
                        date: t.date,
                        proje: t.proje,
                        accountName: accountById(data, t.accountId)?.name,
                        company: companyLabel(t.company) || undefined,
                      })),
                    )
                  }
                >
                  <Download className="size-3.5" />
                  CSV
                </Button>
              </div>
            </header>

            {/* Arama ve filtreler */}
            <div className="grid gap-2 border-b border-border/70 px-5 py-3 lg:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Açıklama, kategori, proje, hesap, tutar ara…"
                  className="h-9 pl-8"
                />
              </div>
              <Select
                value={turFiltre}
                onValueChange={(value) =>
                  setTurFiltre(value as "hepsi" | TransactionType)
                }
              >
                <SelectTrigger className="h-9 lg:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hepsi">Tüm türler</SelectItem>
                  <SelectItem value="gelir">Gelir</SelectItem>
                  <SelectItem value="gider">Gider</SelectItem>
                </SelectContent>
              </Select>
              <Select value={projeFiltre} onValueChange={setProjeFiltre}>
                <SelectTrigger className="h-9 lg:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hepsi">Tüm projeler</SelectItem>
                  {projeler.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ul className="divide-y divide-border/70">
              {limited.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Kritere uyan kayıt yok — aramayı veya filtreleri değiştirin.
                </li>
              )}
              {limited.map((tx) => {
                const account = accountById(data, tx.accountId);
                const isIncome = tx.type === "gelir";
                return (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                          isIncome
                            ? "border-foreground/15 bg-foreground/[0.04]"
                            : "border-border bg-background",
                        )}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="size-4 text-foreground" />
                        ) : (
                          <ArrowDownRight className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {tx.description}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {tx.category}
                          {tx.proje ? ` · #${tx.proje}` : ""}
                          {account ? ` · ${account.name}` : ""} ·{" "}
                          {formatDate(tx.date)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 font-mono text-sm tabular-nums",
                        isIncome ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {isIncome ? "+" : "−"}
                      {formatTRY(tx.amount)}
                    </p>
                  </li>
                );
              })}
            </ul>
            {filtered.length > limited.length && (
              <p className="border-t border-border/70 px-5 py-3 text-center text-[11px] text-muted-foreground">
                İlk {limited.length} kayıt gösteriliyor — daraltmak için arama veya filtre kullanın.
              </p>
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
