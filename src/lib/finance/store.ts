import { useSyncExternalStore } from "react";
import { formatTRY, todayIso } from "./format";
import type {
  Account,
  AccountCurrency,
  AccountType,
  BudgetTarget,
  Contact,
  ContactType,
  DocumentCategory,
  FinanceData,
  Invoice,
  InvoiceItem,
  Product,
  RecurringType,
  StoredDocument,
  SubTask,
  TodoPriority,
  TodoSection,
  TodoTask,
  Transaction,
  TransactionCategory,
  TransactionType,
  Transfer,
  UpcomingPayment,
} from "./types";
import { createSeedData } from "./seed";

const STORAGE_KEY = "mizan-finance-data-v1";

type CollectionKey = keyof FinanceData;

const collections: CollectionKey[] = [
  "accounts",
  "transactions",
  "upcomingPayments",
  "contacts",
  "invoices",
  "transfers",
  "todoSections",
  "todos",
  "products",
  "budgetTargets",
  "documents",
];

/** Kayıtlı verinin temel kısmını doğrular (yeni koleksiyonlar tohum veriyle doldurulur). */
function isLegacyFinanceData(value: unknown): value is Partial<FinanceData> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<FinanceData>;
  return (
    Array.isArray(candidate.accounts) &&
    Array.isArray(candidate.transactions) &&
    Array.isArray(candidate.upcomingPayments)
  );
}

/** Dışa/içe aktarma için tüm koleksiyonların var olduğunu doğrular. */
export function isCompleteFinanceData(value: unknown): value is FinanceData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<FinanceData>;
  return collections.every((key) => Array.isArray(candidate[key]));
}

function loadFinanceData(): FinanceData {
  const seed = createSeedData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isLegacyFinanceData(parsed)) {
        // Kullanıcının girdiği verileri koru; yeni eklenen koleksiyonları tohumdan doldur.
        const result: FinanceData = {
          accounts: parsed.accounts ?? seed.accounts,
          transactions: parsed.transactions ?? seed.transactions,
          upcomingPayments: parsed.upcomingPayments ?? seed.upcomingPayments,
          contacts: parsed.contacts ?? seed.contacts,
          invoices: parsed.invoices ?? seed.invoices,
          transfers: parsed.transfers ?? seed.transfers,
          todoSections: parsed.todoSections ?? seed.todoSections,
          todos: parsed.todos ?? seed.todos,
          products: parsed.products ?? seed.products,
          budgetTargets: parsed.budgetTargets ?? seed.budgetTargets,
          documents: parsed.documents ?? seed.documents,
        };
        // Migration: eski hesapların currency alanını ekle
        result.accounts = result.accounts.map((account) => ({
          ...account,
          currency: account.currency ?? "TRY",
        }));
        // Migration: eski belgelerin dataUrl'lerini ayrı depola
        try {
          const existingDocData = loadDocDataMap();
          let migrated = false;
          for (const doc of result.documents) {
            if (doc.dataUrl && doc.dataUrl.length > 100 && !existingDocData[doc.id]) {
              existingDocData[doc.id] = doc.dataUrl;
              doc.dataUrl = "";
              migrated = true;
            }
          }
          if (migrated) saveDocDataMap(existingDocData);
        } catch {
          // Migration hatası kritik değil
        }
        return result;
      }
    }
  } catch {
    // Bozuk veri varsa temiz tohum verisine dön.
  }
  return seed;
}

// Paylaşılan reaktif store: bileşenler veriyi canlı paylaşır ve
// localStorage'a her değişiklikte kalıcı olarak yazılır.
let data: FinanceData = loadFinanceData();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

export function getFinanceData(): FinanceData {
  return data;
}

export function setFinanceData(next: FinanceData) {
  data = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Depolama dolu ya da erişilemezse sessizce devam et.
  }
  emit();
}

/* ---------------------------------- Yedekleme ---------------------------------- */

/** Tüm veriyi indirilebilir JSON metni olarak döndürür. */
export function exportFinanceData(): string {
  return JSON.stringify(
    {
      app: "mizan",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
      docData: getDocDataMap(),
    },
    null,
    2,
  );
}

/** JSON yedekten veriyi yükler; geçerli değilse false döner ve veri değişmez. */
export function importFinanceData(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    const candidate =
      typeof parsed === "object" &&
      parsed !== null &&
      "data" in (parsed as Record<string, unknown>)
        ? (parsed as { data?: unknown }).data
        : parsed;
    if (!isCompleteFinanceData(candidate)) return false;
    setFinanceData(candidate);
    // Belge verilerini de geri yükle
    const imported = typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>).docData
      : undefined;
    if (imported && typeof imported === "object") {
      docDataCache = imported as Record<string, string>;
      saveDocDataMap(docDataCache);
    }
    return true;
  } catch {
    return false;
  }
}

/** Tüm veriyi varsayılan tohum verisine döndürür. */
export function resetFinanceData(): FinanceData {
  const seed = createSeedData();
  setFinanceData(seed);
  return seed;
}

export function useFinanceData(): FinanceData {
  return useSyncExternalStore(subscribe, getFinanceData);
}

// Uygulama başladığında otomatik yedeklemeyi başlat
if (typeof window !== "undefined") {
  import("./backupManager").then(({ startAutoBackup }) => {
    startAutoBackup();
  });
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* ---------------------------------- İşlemler ---------------------------------- */

export interface NewTransactionInput {
  type: TransactionType;
  description: string;
  category: TransactionCategory;
  accountId: string;
  amount: number;
  date: string;
}

/** Gelir/gider kaydı ekler ve seçili hesabın bakiyesini anında günceller. */
export function addTransaction(input: NewTransactionInput): Transaction {
  const transaction: Transaction = {
    id: newId("tx"),
    ...input,
  };
  const sign = input.type === "gelir" ? 1 : -1;
  setFinanceData({
    ...data,
    transactions: [transaction, ...data.transactions],
    accounts: data.accounts.map((account) =>
      account.id === input.accountId
        ? { ...account, balance: round2(account.balance + sign * input.amount) }
        : account,
    ),
  });
  return transaction;
}

/* ---------------------------------- Hesaplar ---------------------------------- */

export interface NewAccountInput {
  name: string;
  type: AccountType;
  balance: number;
  currency?: AccountCurrency;
}

export function addAccount(input: NewAccountInput): Account {
  const account: Account = {
    id: newId("acc"),
    name: input.name.trim(),
    type: input.type,
    balance: round2(input.balance),
    currency: input.currency ?? "TRY",
  };
  setFinanceData({
    ...data,
    accounts: [...data.accounts, account],
  });
  return account;
}

export function updateAccount(id: string, patch: NewAccountInput) {
  setFinanceData({
    ...data,
    accounts: data.accounts.map((account) =>
      account.id === id
        ? {
            ...account,
            name: patch.name.trim(),
            type: patch.type,
            balance: round2(patch.balance),
            currency: patch.currency ?? account.currency ?? "TRY",
          }
        : account,
    ),
  });
}

export function deleteAccount(id: string) {
  // Hesaba bağlı tüm işlemleri, ödemeleri ve virmanları cascade sil
  setFinanceData({
    ...data,
    accounts: data.accounts.filter((account) => account.id !== id),
    transactions: data.transactions.filter((tx) => tx.accountId !== id),
    upcomingPayments: data.upcomingPayments.filter((payment) => payment.accountId !== id),
    transfers: data.transfers.filter(
      (transfer) => transfer.fromAccountId !== id && transfer.toAccountId !== id,
    ),
  });
}

/* ---------------------------------- İşlem & Virman Silme ---------------------------------- */

export function deleteTransaction(id: string) {
  const tx = data.transactions.find((t) => t.id === id);
  if (!tx) return;
  const account = data.accounts.find((a) => a.id === tx.accountId);
  setFinanceData({
    ...data,
    transactions: data.transactions.filter((t) => t.id !== id),
    accounts: account
      ? data.accounts.map((a) =>
          a.id === account.id
            ? { ...a, balance: round2(a.balance + (tx.type === "gelir" ? -tx.amount : tx.amount)) }
            : a,
        )
      : data.accounts,
  });
}

export function deleteTransfer(id: string) {
  const transfer = data.transfers.find((t) => t.id === id);
  if (!transfer) return;
  setFinanceData({
    ...data,
    transfers: data.transfers.filter((t) => t.id !== id),
    accounts: data.accounts.map((a) => {
      if (a.id === transfer.fromAccountId)
        return { ...a, balance: round2(a.balance + transfer.amount) };
      if (a.id === transfer.toAccountId)
        return { ...a, balance: round2(a.balance - transfer.amount) };
      return a;
    }),
  });
}

/* ---------------------------------- Planlı Ödemeler ---------------------------------- */

export interface NewUpcomingPaymentInput {
  label: string;
  accountId: string;
  contactId?: string;
  amount: number;
  currency?: string;
  dueDate: string;
  recurringType?: RecurringType;
  recurringEndDate?: string;
  description?: string;
}

/** Bir sonraki vade tarihini hesapla */
export function getNextDueDate(currentDueDate: string, recurringType: RecurringType): string {
  const date = new Date(currentDueDate);
  switch (recurringType) {
    case "gunluk":
      date.setDate(date.getDate() + 1);
      break;
    case "haftalik":
      date.setDate(date.getDate() + 7);
      break;
    case "aylik":
      date.setMonth(date.getMonth() + 1);
      break;
    case "yillik":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      break;
  }
  return date.toISOString().slice(0, 10);
}

export function addUpcomingPayment(
  input: NewUpcomingPaymentInput,
): UpcomingPayment {
  const recurringType = input.recurringType ?? "yok";
  const groupId = recurringType !== "yok" ? newId("rgrp") : undefined;
  const payment: UpcomingPayment = {
    id: newId("pay"),
    label: input.label.trim(),
    accountId: input.accountId,
    contactId: input.contactId || undefined,
    amount: round2(input.amount),
    dueDate: input.dueDate,
    recurringType,
    recurringGroupId: groupId,
    recurringEndDate: input.recurringEndDate || undefined,
    description: input.description || undefined,
    currency: (input.currency as "TRY" | "USD" | "EUR") || "TRY",
  };
  setFinanceData({
    ...data,
    upcomingPayments: [...data.upcomingPayments, payment],
  });
  return payment;
}

export function updateUpcomingPayment(
  id: string,
  patch: { label?: string; accountId?: string; contactId?: string; amount?: number; dueDate?: string; description?: string },
) {
  setFinanceData({
    ...data,
    upcomingPayments: data.upcomingPayments.map((payment) =>
      payment.id === id
        ? {
            ...payment,
            ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
            ...(patch.accountId !== undefined ? { accountId: patch.accountId } : {}),
            ...(patch.contactId !== undefined ? { contactId: patch.contactId } : {}),
            ...(patch.amount !== undefined ? { amount: round2(patch.amount) } : {}),
            ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
          }
        : payment,
    ),
  });
}

export function deleteUpcomingPayment(id: string) {
  setFinanceData({
    ...data,
    upcomingPayments: data.upcomingPayments.filter(
      (payment) => payment.id !== id,
    ),
  });
}

/** Ödemeyi tamamlar (tam veya kısmi). Kısmi ödeme yapıldığında listede kalır. Tekrarlayan ödemeler tamamlandığında bir sonraki taksidi otomatik oluşturulur. */
export function completeUpcomingPayment(id: string, partialAmount?: number) {
  const payment = data.upcomingPayments.find((p) => p.id === id);
  if (!payment) return;
  const alreadyPaid = payment.paidAmount ?? 0;
  const remaining = round2(payment.amount - alreadyPaid);
  const payAmount = partialAmount ? Math.min(round2(partialAmount), remaining) : remaining;
  if (payAmount <= 0) return;
  const newPaidTotal = round2(alreadyPaid + payAmount);
  const isFullyPaid = newPaidTotal >= payment.amount;
  const now = todayIso();
  const transaction: Transaction = {
    id: newId("tx"),
    type: "gider",
    description: isFullyPaid
      ? `Planlı ödeme — ${payment.label}`
      : `Kısmi ödeme — ${payment.label} (${formatTRY(newPaidTotal)}/${formatTRY(payment.amount)})`,
    category: "Ödeme",
    accountId: payment.accountId,
    amount: payAmount,
    date: now,
  };

  // Tekrarlayan ödeme tamamlandıysa bir sonraki taksidi oluştur
  const isRecurring = payment.recurringType && payment.recurringType !== "yok";
  let nextPayments = data.upcomingPayments;
  if (isFullyPaid && isRecurring) {
    const nextDueDate = getNextDueDate(payment.dueDate, payment.recurringType!);
    // Bitiş tarihi kontrolü
    const endDate = payment.recurringEndDate;
    const shouldCreateNext = !endDate || nextDueDate <= endDate;
    if (shouldCreateNext) {
      const nextPayment: UpcomingPayment = {
        id: newId("pay"),
        label: payment.label,
        accountId: payment.accountId,
        amount: payment.amount,
        dueDate: nextDueDate,
        recurringType: payment.recurringType,
        recurringGroupId: payment.recurringGroupId,
        recurringEndDate: payment.recurringEndDate,
      };
      nextPayments = [nextPayment, ...data.upcomingPayments.filter((p) => p.id !== id)];
    } else {
      nextPayments = data.upcomingPayments.filter((p) => p.id !== id);
    }
  }

  setFinanceData({
    ...data,
    upcomingPayments: isFullyPaid
      ? isRecurring
        ? nextPayments
        : data.upcomingPayments.filter((p) => p.id !== id)
      : data.upcomingPayments.map((p) =>
          p.id === id ? { ...p, paidAmount: newPaidTotal, firstPaidAt: p.firstPaidAt ?? now } : p,
        ),
    transactions: [transaction, ...data.transactions],
    accounts: data.accounts.map((account) =>
      account.id === payment.accountId
        ? { ...account, balance: round2(account.balance - payAmount) }
        : account,
    ),
  });
}

/* ---------------------------------- Virman ---------------------------------- */

export interface NewTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}

/** Hesaplar arası para transferi yapar; iki bakiyeyi de atomik günceller. */
export function addTransfer(input: NewTransferInput): Transfer {
  const transfer: Transfer = {
    id: newId("trf"),
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: round2(input.amount),
    date: input.date,
    note: input.note?.trim() || undefined,
  };
  setFinanceData({
    ...data,
    transfers: [transfer, ...data.transfers],
    accounts: data.accounts.map((account) => {
      if (account.id === input.fromAccountId) {
        return { ...account, balance: round2(account.balance - input.amount) };
      }
      if (account.id === input.toAccountId) {
        return { ...account, balance: round2(account.balance + input.amount) };
      }
      return account;
    }),
  });
  return transfer;
}

/* ---------------------------------- Cariler ---------------------------------- */

export interface NewContactInput {
  name: string;
  type: ContactType;
  taxNo?: string;
  phone?: string;
  email?: string;
}

export function addContact(input: NewContactInput): Contact {
  const contact: Contact = {
    id: newId("ct"),
    name: input.name,
    type: input.type,
    taxNo: input.taxNo?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim() || undefined,
  };
  setFinanceData({
    ...data,
    contacts: [...data.contacts, contact],
  });
  return contact;
}

export function updateContact(id: string, patch: NewContactInput) {
  setFinanceData({
    ...data,
    contacts: data.contacts.map((contact) =>
      contact.id === id
        ? {
            ...contact,
            name: patch.name,
            type: patch.type,
            taxNo: patch.taxNo?.trim() || undefined,
            phone: patch.phone?.trim() || undefined,
            email: patch.email?.trim() || undefined,
          }
        : contact,
    ),
  });
}

/** Cariyi ve ona bağlı faturaları siler. */
export function deleteContact(id: string) {
  setFinanceData({
    ...data,
    contacts: data.contacts.filter((contact) => contact.id !== id),
    invoices: data.invoices.filter((invoice) => invoice.contactId !== id),
  });
}

/* ---------------------------------- Faturalar ---------------------------------- */

export interface NewInvoiceInput {
  contactId: string;
  date: string;
  items: InvoiceItem[];
}

function nextInvoiceNo(
  invoices: Invoice[],
  prefix: string,
  year: string,
): string {
  const series = `${prefix}-${year}-`;
  const count = invoices.filter((invoice) =>
    invoice.invoiceNo.startsWith(series),
  ).length;
  return `${series}${String(count + 1).padStart(4, "0")}`;
}

/** Tutarları sunucu tarafında (store'da) hesaplar; istemci matematiğine güvenmez. */
export function addInvoice(input: NewInvoiceInput): Invoice {
  const contact = data.contacts.find((c) => c.id === input.contactId);
  const prefix = contact?.type === "tedarikci" ? "AL" : "FT";
  const year = input.date.slice(0, 4);

  const subtotal = round2(
    input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  const kdvTotal = round2(
    input.items.reduce(
      (sum, item) =>
        sum + item.quantity * item.unitPrice * (item.kdvRate / 100),
      0,
    ),
  );
  const total = round2(subtotal + kdvTotal);

  const invoice: Invoice = {
    id: newId("inv"),
    invoiceNo: nextInvoiceNo(data.invoices, prefix, year),
    contactId: input.contactId,
    date: input.date,
    items: input.items,
    subtotal,
    kdvTotal,
    total,
  };
  setFinanceData({
    ...data,
    invoices: [invoice, ...data.invoices],
  });
  return invoice;
}

/** Faturayı ödendi olarak işaretler (veya geri alır); hesaba bağlı tahsilat/ödeme kaydı oluşturur. */
export function setInvoicePaid(
  invoiceId: string,
  paid: boolean,
  options?: { accountId?: string; date?: string },
): Invoice | undefined {
  const invoice = data.invoices.find((inv) => inv.id === invoiceId);
  if (!invoice) return undefined;
  const contact = data.contacts.find((c) => c.id === invoice.contactId);
  const isSales = invoice.invoiceNo.startsWith("FT");

  if (paid) {
    const accountId = options?.accountId;
    if (!accountId) return invoice;
    const paidAt = options?.date ?? todayIso();
    const linked: Transaction = {
      id: newId("tx"),
      type: isSales ? "gelir" : "gider",
      description: `${isSales ? "Fatura tahsilatı" : "Fatura ödemesi"} — ${invoice.invoiceNo} (${contact?.name ?? "cari"})`,
      category: isSales ? "Tahsilat" : "Ödeme",
      accountId,
      amount: invoice.total,
      date: paidAt,
      invoiceId,
    };
    const sign = isSales ? 1 : -1;
    setFinanceData({
      ...data,
      invoices: data.invoices.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, paid: true, paidAt }
          : inv,
      ),
      transactions: [linked, ...data.transactions],
      accounts: data.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              balance: round2(account.balance + sign * invoice.total),
            }
          : account,
      ),
    });
    return invoice;
  }

  // Ödemeyi geri al: bağlı kaydı kaldır, bakiyeyi ters çevir.
  const linkedTx = data.transactions.find((tx) => tx.invoiceId === invoiceId);
  const reversal = linkedTx
    ? (linkedTx.type === "gelir" ? -1 : 1) * linkedTx.amount
    : 0;
  setFinanceData({
    ...data,
    invoices: data.invoices.map((inv) =>
      inv.id === invoiceId ? { ...inv, paid: false, paidAt: undefined } : inv,
    ),
    transactions: linkedTx
      ? data.transactions.filter((tx) => tx.id !== linkedTx.id)
      : data.transactions,
    accounts: linkedTx
      ? data.accounts.map((account) =>
          account.id === linkedTx.accountId
            ? { ...account, balance: round2(account.balance + reversal) }
            : account,
        )
      : data.accounts,
  });
  return invoice;
}

/** Faturayı ve varsa bağlı tahsilat/ödeme kaydını siler (bakiye ters çevrilir). */
export function deleteInvoice(id: string) {
  const linkedTx = data.transactions.find((tx) => tx.invoiceId === id);
  const reversal = linkedTx
    ? (linkedTx.type === "gelir" ? -1 : 1) * linkedTx.amount
    : 0;
  setFinanceData({
    ...data,
    invoices: data.invoices.filter((invoice) => invoice.id !== id),
    transactions: linkedTx
      ? data.transactions.filter((tx) => tx.id !== linkedTx.id)
      : data.transactions,
    accounts: linkedTx
      ? data.accounts.map((account) =>
          account.id === linkedTx.accountId
            ? { ...account, balance: round2(account.balance + reversal) }
            : account,
        )
      : data.accounts,
  });
}

/* ---------------------------------- Ödeme Geçmişi ---------------------------------- */

/** Belirli bir ödeme kalemi için yapılan tüm ödeme işlemlerini döndürür.
 *  Transaction description içinde ödeme etiketi geçen tüm gider kayıtlarını bulur.
 */
export function getPaymentHistory(paymentLabel: string): Transaction[] {
  const normalizedLabel = paymentLabel.trim().toLowerCase();
  return data.transactions
    .filter((tx) => {
      if (tx.type !== "gider") return false;
      const desc = tx.description.toLowerCase();
      return (
        desc.includes(normalizedLabel) &&
        (desc.includes("planlı ödeme") || desc.includes("kısmi ödeme") || desc.includes("ödeme —"))
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date)); // en yeniden en eskiye
}

/** Bir ödeme kaleminin toplam ödenen tutarını hesaplar */
export function getTotalPaidForLabel(paymentLabel: string): number {
  const history = getPaymentHistory(paymentLabel);
  return history.reduce((sum, tx) => sum + tx.amount, 0);
}

/* ---------------------------------- Görevler (Todo) ---------------------------------- */

export function addTodoSection(name: string, color: string): TodoSection {
  const section: TodoSection = {
    id: newId("tsec"),
    name: name.trim(),
    color,
    order: data.todoSections.length,
  };
  setFinanceData({ ...data, todoSections: [...data.todoSections, section] });
  return section;
}

export function updateTodoSection(id: string, patch: { name?: string; color?: string }) {
  setFinanceData({
    ...data,
    todoSections: data.todoSections.map((s) =>
      s.id === id
        ? { ...s, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}), ...(patch.color !== undefined ? { color: patch.color } : {}) }
        : s,
    ),
  });
}

export function deleteTodoSection(id: string) {
  setFinanceData({
    ...data,
    todoSections: data.todoSections.filter((s) => s.id !== id),
    todos: data.todos.map((t) => (t.sectionId === id ? { ...t, sectionId: undefined } : t)),
  });
}

export function addTodo(input: {
  title: string;
  description?: string;
  sectionId?: string;
  priority?: TodoPriority;
  dueDate?: string;
  labels?: string[];
  estimatedHours?: number;
  actualHours?: number;
  startTime?: string;
  endTime?: string;
  recurringType?: RecurringType;
  recurringEndDate?: string;
  reminderDays?: number;
}): TodoTask {
  const recurringType = input.recurringType ?? "yok";
  const groupId = recurringType !== "yok" ? newId("rgrp") : undefined;
  const task: TodoTask = {
    id: newId("todo"),
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    sectionId: input.sectionId || undefined,
    priority: input.priority ?? 4,
    dueDate: input.dueDate || undefined,
    completed: false,
    createdAt: todayIso(),
    labels: input.labels,
    subtasks: [],
    estimatedHours: input.estimatedHours,
    actualHours: input.actualHours,
    startTime: input.startTime || undefined,
    endTime: input.endTime || undefined,
    recurringType,
    recurringGroupId: groupId,
    recurringEndDate: input.recurringEndDate || undefined,
    reminderDays: input.reminderDays,
    reminderSent: false,
  };
  setFinanceData({ ...data, todos: [...data.todos, task] });
  return task;
}

export function updateTodo(
  id: string,
  patch: Partial<Pick<TodoTask, "title" | "description" | "sectionId" | "priority" | "dueDate" | "labels" | "estimatedHours" | "actualHours" | "startTime" | "endTime" | "recurringType" | "recurringEndDate" | "reminderDays">>,
) {
  setFinanceData({
    ...data,
    todos: data.todos.map((t) =>
      t.id === id
        ? {
            ...t,
            ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
            ...(patch.description !== undefined ? { description: patch.description?.trim() || undefined } : {}),
            ...(patch.sectionId !== undefined ? { sectionId: patch.sectionId } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
            ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
            ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
            ...(patch.estimatedHours !== undefined ? { estimatedHours: patch.estimatedHours } : {}),
            ...(patch.actualHours !== undefined ? { actualHours: patch.actualHours } : {}),
            ...(patch.startTime !== undefined ? { startTime: patch.startTime } : {}),
            ...(patch.endTime !== undefined ? { endTime: patch.endTime } : {}),
            ...(patch.recurringType !== undefined ? { recurringType: patch.recurringType } : {}),
            ...(patch.recurringEndDate !== undefined ? { recurringEndDate: patch.recurringEndDate } : {}),
            ...(patch.reminderDays !== undefined ? { reminderDays: patch.reminderDays } : {}),
          }
        : t,
    ),
  });
}

export function toggleTodoComplete(id: string) {
  const task = data.todos.find((t) => t.id === id);
  if (!task) return;

  const wasCompleted = task.completed;
  const isCompleting = !wasCompleted;
  const now = todayIso();

  // Tekrarlayan görev tamamlanırsa bir sonraki periyodu oluştur
  const isRecurring = isCompleting && task.recurringType && task.recurringType !== "yok";
  let nextTodos = data.todos;
  if (isRecurring && task.dueDate) {
    const nextDueDate = getNextDueDate(task.dueDate, task.recurringType!);
    const endDate = task.recurringEndDate;
    const shouldCreateNext = !endDate || nextDueDate <= endDate;
    if (shouldCreateNext) {
      const nextTask: TodoTask = {
        ...task,
        id: newId("todo"),
        dueDate: nextDueDate,
        completed: false,
        completedAt: undefined,
        createdAt: now,
        reminderSent: false,
        subtasks: (task.subtasks ?? []).map((s) => ({ ...s, id: newId("sub"), completed: false })),
      };
      nextTodos = [nextTask, ...data.todos.map((t) => (t.id === id ? { ...t, completed: true, completedAt: now } : t))];
    } else {
      nextTodos = data.todos.map((t) => (t.id === id ? { ...t, completed: true, completedAt: now } : t));
    }
  } else {
    nextTodos = data.todos.map((t) =>
      t.id === id
        ? { ...t, completed: isCompleting, completedAt: isCompleting ? now : undefined }
        : t,
    );
  }

  setFinanceData({ ...data, todos: nextTodos });
}

export function deleteTodo(id: string) {
  setFinanceData({ ...data, todos: data.todos.filter((t) => t.id !== id) });
}

export function addSubtask(todoId: string, title: string): SubTask {
  const subtask: SubTask = { id: newId("sub"), title: title.trim(), completed: false };
  setFinanceData({
    ...data,
    todos: data.todos.map((t) =>
      t.id === todoId ? { ...t, subtasks: [...(t.subtasks ?? []), subtask] } : t,
    ),
  });
  return subtask;
}

export function toggleSubtask(todoId: string, subId: string) {
  setFinanceData({
    ...data,
    todos: data.todos.map((t) =>
      t.id === todoId
        ? { ...t, subtasks: (t.subtasks ?? []).map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s)) }
        : t,
    ),
  });
}

export function deleteSubtask(todoId: string, subId: string) {
  setFinanceData({
    ...data,
    todos: data.todos.map((t) =>
      t.id === todoId ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== subId) } : t,
    ),
  });
}

/* ---------------------------------- Görev Hatırlatmaları ---------------------------------- */

export interface TodoReminder {
  task: TodoTask;
  daysLeft: number;
  urgency: "today" | "tomorrow" | "soon" | "overdue";
  message: string;
}

export function getTodoReminders(): TodoReminder[] {
  const now = new Date();
  const todayStr = todayIso();
  const reminders: TodoReminder[] = [];

  for (const task of data.todos) {
    if (task.completed || !task.dueDate) continue;

    const due = new Date(task.dueDate);
    const diffMs = due.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const reminderDays = task.reminderDays ?? 1; // Varsayılan 1 gün öncesinden hatırlat

    let urgency: TodoReminder["urgency"];
    let message: string;

    if (days < 0) {
      urgency = "overdue";
      message = `${Math.abs(days)} gün gecikti!`;
    } else if (days === 0) {
      urgency = "today";
      message = "Bugün bitirilmesi gerekiyor";
    } else if (days === 1) {
      urgency = "tomorrow";
      message = "Yarın vadesi doluyor";
    } else if (days <= reminderDays) {
      urgency = "soon";
      message = `${days} gün kaldı`;
    } else {
      continue;
    }

    reminders.push({ task, daysLeft: days, urgency, message });
  }

  return reminders.sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ---------------------------------- Ürün/Hizmet Listesi ---------------------------------- */

export function addProduct(input: { name: string; unit: string; price: number; currency?: "TRY" | "USD"; category?: string; description?: string }): Product {
  const product: Product = {
    id: newId("prod"),
    name: input.name.trim(),
    unit: input.unit.trim(),
    price: round2(input.price),
    currency: input.currency ?? "TRY",
    category: input.category?.trim() || undefined,
    description: input.description?.trim() || undefined,
  };
  setFinanceData({ ...data, products: [...data.products, product] });
  return product;
}

export function updateProduct(id: string, patch: Partial<Pick<Product, "name" | "unit" | "price" | "currency" | "category" | "description">>) {
  setFinanceData({
    ...data,
    products: data.products.map((p) =>
      p.id === id
        ? {
            ...p,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.unit !== undefined ? { unit: patch.unit.trim() } : {}),
            ...(patch.price !== undefined ? { price: round2(patch.price) } : {}),
            ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
            ...(patch.category !== undefined ? { category: patch.category?.trim() || undefined } : {}),
            ...(patch.description !== undefined ? { description: patch.description?.trim() || undefined } : {}),
          }
        : p,
    ),
  });
}

export function deleteProduct(id: string) {
  setFinanceData({ ...data, products: data.products.filter((p) => p.id !== id) });
}

/* ---------------------------------- Bütçe Hedefleri ---------------------------------- */

export function addBudgetTarget(input: { month: string; category: TransactionCategory; targetAmount: number; type: "gelir" | "gider" }): BudgetTarget {
  const target: BudgetTarget = {
    id: newId("bt"),
    month: input.month,
    category: input.category,
    targetAmount: round2(input.targetAmount),
    type: input.type,
  };
  setFinanceData({ ...data, budgetTargets: [...data.budgetTargets, target] });
  return target;
}

export function updateBudgetTarget(id: string, patch: Partial<Pick<BudgetTarget, "targetAmount" | "category" | "type" | "month">>) {
  setFinanceData({
    ...data,
    budgetTargets: data.budgetTargets.map((bt) =>
      bt.id === id
        ? {
            ...bt,
            ...(patch.month !== undefined ? { month: patch.month } : {}),
            ...(patch.category !== undefined ? { category: patch.category } : {}),
            ...(patch.targetAmount !== undefined ? { targetAmount: round2(patch.targetAmount) } : {}),
            ...(patch.type !== undefined ? { type: patch.type } : {}),
          }
        : bt,
    ),
  });
}

export function deleteBudgetTarget(id: string) {
  setFinanceData({ ...data, budgetTargets: data.budgetTargets.filter((bt) => bt.id !== id) });
}

/* ---------------------------------- Belgeler ---------------------------------- */

/** localStorage kapasitesi nedeniyle dosya başına üst sınır (bayt) */
export const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024; // 2 MB

/** Belge base64 verileri ayrı depolanır — ana state'i şişirmez */
const DOC_DATA_KEY = "mizan-doc-data-v1";

function loadDocDataMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(DOC_DATA_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDocDataMap(map: Record<string, string>) {
  window.localStorage.setItem(DOC_DATA_KEY, JSON.stringify(map));
}

let docDataCache: Record<string, string> | null = null;

function getDocDataMap(): Record<string, string> {
  if (!docDataCache) docDataCache = loadDocDataMap();
  return docDataCache;
}

/** Belge base64 verisini yükle (lazy) */
export function getDocumentDataUrl(id: string): string | null {
  return getDocDataMap()[id] ?? null;
}

/** Belge base64 verisini kaydet */
function setDocumentDataUrl(id: string, dataUrl: string) {
  const map = getDocDataMap();
  map[id] = dataUrl;
  saveDocDataMap(map);
}

/** Belge base64 verisini sil */
function removeDocumentDataUrl(id: string) {
  const map = getDocDataMap();
  delete map[id];
  saveDocDataMap(map);
}

export interface NewDocumentInput {
  name: string;
  category: DocumentCategory;
  contactId?: string;
  note?: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export function addDocument(input: NewDocumentInput): StoredDocument {
  const doc: StoredDocument = {
    id: newId("doc"),
    name: input.name.trim() || input.fileName,
    category: input.category,
    contactId: input.contactId || undefined,
    note: input.note?.trim() || undefined,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    dataUrl: input.dataUrl,
    uploadedAt: new Date().toISOString(),
  };
  // base64 verisini ayrı depola, ana state'e koyma
  setDocumentDataUrl(doc.id, input.dataUrl);
  const docMeta = { ...doc, dataUrl: "" };
  setFinanceData({ ...data, documents: [docMeta, ...data.documents] });
  return doc;
}

export function updateDocument(
  id: string,
  patch: Partial<Pick<StoredDocument, "name" | "category" | "contactId" | "note">>,
) {
  setFinanceData({
    ...data,
    documents: data.documents.map((doc) =>
      doc.id === id
        ? {
            ...doc,
            ...(patch.name !== undefined ? { name: patch.name.trim() || doc.fileName } : {}),
            ...(patch.category !== undefined ? { category: patch.category } : {}),
            ...(patch.contactId !== undefined ? { contactId: patch.contactId || undefined } : {}),
            ...(patch.note !== undefined ? { note: patch.note?.trim() || undefined } : {}),
          }
        : doc,
    ),
  });
}

export function deleteDocument(id: string) {
  setFinanceData({ ...data, documents: data.documents.filter((doc) => doc.id !== id) });
  removeDocumentDataUrl(id);
}
