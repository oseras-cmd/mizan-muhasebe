import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  contactBalance,
  contactsSorted,
  invoicesForContact,
  totalAlacak,
  totalBorc,
} from "@/lib/finance/dashboard";
import { formatDate, formatTRY } from "@/lib/finance/format";
import {
  addContact,
  deleteContact,
  updateContact,
  useFinanceData,
} from "@/lib/finance/store";
import type { Contact, ContactType } from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("tr");
}

/** Müşteri için pozitif bakiye alacak, tedarikçi için borç demektir. */
function balanceLabel(contact: Contact, balance: number): string {
  const isReceivable =
    contact.type === "musteri" ? balance >= 0 : balance < 0;
  const verb = isReceivable ? "alacak" : "borç";
  return `${formatTRY(Math.abs(balance))} ${verb}`;
}

interface FormState {
  name: string;
  type: ContactType;
  taxNo: string;
  phone: string;
  email: string;
}

const emptyForm: FormState = {
  name: "",
  type: "musteri",
  taxNo: "",
  phone: "",
  email: "",
};

export default function Cariler() {
  const data = useFinanceData();
  const contacts = contactsSorted(data);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const query = search.trim().toLocaleLowerCase("tr");
  const filtered = query
    ? contacts.filter(
        (contact) =>
          contact.name.toLocaleLowerCase("tr").includes(query) ||
          (contact.taxNo ?? "").includes(query),
      )
    : contacts;

  const setField = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const startEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setConfirmingId(null);
    setForm({
      name: contact.name,
      type: contact.type,
      taxNo: contact.taxNo ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Lütfen cari adını girin.");
      return;
    }
    if (editingId) {
      updateContact(editingId, {
        name: form.name.trim(),
        type: form.type,
        taxNo: form.taxNo,
        phone: form.phone,
        email: form.email,
      });
      toast.success("Cari güncellendi.");
    } else {
      addContact({
        name: form.name.trim(),
        type: form.type,
        taxNo: form.taxNo,
        phone: form.phone,
        email: form.email,
      });
      toast.success("Cari eklendi.");
    }
    resetForm();
  };

  const handleDelete = (contact: Contact) => {
    deleteContact(contact.id);
    setConfirmingId(null);
    if (editingId === contact.id) resetForm();
    toast.success("Cari ve bağlı faturaları silindi.");
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
            Cari Yönetimi
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Müşteri ve tedarikçilerinizi yönetin. Bakiyeler kesilen
            faturalardan otomatik hesaplanır.
          </p>
        </div>

        {/* Alacak / Borç özeti */}
        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <UserRound className="size-4" />
              Toplam Alacak
            </p>
            <p className="mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight text-foreground">
              {formatTRY(totalAlacak(data))}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Müşterilerden tahsil edilecek
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Building2 className="size-4" />
              Toplam Borç
            </p>
            <p className="mt-2.5 font-mono text-[22px] font-medium tabular-nums tracking-tight text-foreground">
              {formatTRY(totalBorc(data))}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Tedarikçilere ödenecek
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Cari formu */}
          <section className="self-start rounded-lg border bg-card lg:col-span-2">
            <header className="border-b border-border/70 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                {editingId ? "Cariyi Düzenle" : "Yeni Cari"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {editingId
                  ? "Bilgileri güncelleyip kaydedin"
                  : "Müşteri veya tedarikçi ekleyin"}
              </p>
            </header>
            <form onSubmit={handleSubmit} className="grid gap-5 p-5 sm:p-6">
              {/* Tür seçici */}
              <div className="grid grid-cols-2 gap-px rounded-md border bg-border p-px">
                <button
                  type="button"
                  onClick={() => setField({ type: "musteri" })}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-[5px] py-2 text-sm font-medium transition-colors",
                    form.type === "musteri"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <UserRound className="size-4" />
                  Müşteri
                </button>
                <button
                  type="button"
                  onClick={() => setField({ type: "tedarikci" })}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-[5px] py-2 text-sm font-medium transition-colors",
                    form.type === "tedarikci"
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Building2 className="size-4" />
                  Tedarikçi
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Ad / Unvan
                </Label>
                <Input
                  value={form.name}
                  onChange={(event) => setField({ name: event.target.value })}
                  placeholder="Örn. Yılmaz Tekstil"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Vergi No
                </Label>
                <Input
                  value={form.taxNo}
                  onChange={(event) => setField({ taxNo: event.target.value })}
                  placeholder="İsteğe bağlı"
                  inputMode="numeric"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Telefon
                  </Label>
                  <Input
                    value={form.phone}
                    onChange={(event) =>
                      setField({ phone: event.target.value })
                    }
                    placeholder="İsteğe bağlı"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    E-posta
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setField({ email: event.target.value })
                    }
                    placeholder="İsteğe bağlı"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2">
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                  >
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
                      Cariyi Ekle
                    </>
                  )}
                </Button>
              </div>
            </form>
          </section>

          {/* Cari listesi */}
          <section className="rounded-lg border bg-card lg:col-span-3">
            <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Cari Listesi
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alacak / borç durumuna göre takip
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ara…"
                  className="h-8 w-36 pl-8 text-xs sm:w-44"
                />
              </div>
            </header>

            {filtered.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-foreground">
                  {contacts.length === 0
                    ? "Henüz cari kaydı yok"
                    : "Arama sonucu bulunamadı"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {contacts.length === 0
                    ? "Soldaki formdan ilk müşterinizi veya tedarikçinizi ekleyin."
                    : "Farklı bir ad veya vergi no deneyin."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {filtered.map((contact) => {
                  const balance = contactBalance(data, contact.id);
                  const isReceivable =
                    contact.type === "musteri" ? balance >= 0 : balance < 0;
                  const invoices = invoicesForContact(data, contact.id);
                  const unpaidCount = invoices.filter(
                    (invoice) => !invoice.paid,
                  ).length;
                  const expanded = expandedId === contact.id;
                  return (
                    <li key={contact.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <button
                            type="button"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            aria-label="Faturaları gör"
                            onClick={() =>
                              setExpandedId(expanded ? null : contact.id)
                            }
                          >
                            {initialsOf(contact.name)}
                          </button>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {contact.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              <span className="rounded-sm border border-border/80 px-1 py-px">
                                {contact.type === "musteri"
                                  ? "Müşteri"
                                  : "Tedarikçi"}
                              </span>
                              {contact.taxNo ? ` · VN ${contact.taxNo}` : ""}
                              {" · "}
                              {invoices.length} fatura
                              {unpaidCount > 0
                                ? ` (${unpaidCount} açık)`
                                : ""}
                            </p>
                          </div>
                        </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
                          aria-label="Faturaları aç/kapat"
                          onClick={() =>
                            setExpandedId(expanded ? null : contact.id)
                          }
                        >
                          {expanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                        <div className="text-right">
                          <p
                            className={cn(
                              "font-mono text-sm tabular-nums",
                              isReceivable
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {balanceLabel(contact, balance)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {contactBalance(data, contact.id) === 0
                              ? "Bakiye yok"
                              : isReceivable
                                ? "Tahsil edilecek"
                                : "Ödenecek"}
                          </p>
                        </div>

                        {confirmingId === contact.id ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(contact)}
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
                              onClick={() => startEdit(contact)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Sil"
                              onClick={() => setConfirmingId(contact.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                      </div>

                      {/* Genişletilmiş fatura geçmişi */}
                      {expanded && (
                        <div className="mt-3 rounded-md border border-border/70 bg-background">
                          {invoices.length === 0 ? (
                            <p className="px-4 py-4 text-xs text-muted-foreground">
                              Bu cariye bağlı fatura yok.
                            </p>
                          ) : (
                            <ul className="divide-y divide-border/60">
                              {invoices.map((invoice) => (
                                <li
                                  key={invoice.id}
                                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                                >
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                    <span className="font-mono text-xs text-foreground">
                                      {invoice.invoiceNo}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(invoice.date)}
                                    </span>
                                    <span
                                      className={
                                        invoice.paid
                                          ? "flex items-center gap-1 rounded-sm border border-foreground/20 bg-foreground/[0.04] px-1 py-px text-[10px] text-foreground"
                                          : "rounded-sm border border-border/80 px-1 py-px text-[10px] text-muted-foreground"
                                      }
                                    >
                                      {invoice.paid ? (
                                        <>
                                          <Check className="size-2.5" />
                                          Ödendi
                                        </>
                                      ) : (
                                        "Bekliyor"
                                      )}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      "shrink-0 font-mono text-xs tabular-nums",
                                      invoice.paid
                                        ? "text-muted-foreground"
                                        : "text-foreground",
                                    )}
                                  >
                                    {formatTRY(invoice.total)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
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
