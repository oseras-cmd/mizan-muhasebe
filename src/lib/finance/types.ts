export type AccountType = "kasa" | "banka";

export type AccountCurrency = "TRY" | "USD" | "EUR";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: AccountCurrency;
}

export type TransactionType = "gelir" | "gider";

export const TRANSACTION_CATEGORIES = [
  "Satış",
  "Hizmet",
  "Tahsilat",
  "Maaş",
  "Kira",
  "Fatura",
  "Vergi",
  "Malzeme",
  "Ulaşım",
  "Ödeme",
  "Diğer",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  category: TransactionCategory;
  accountId: string;
  amount: number;
  /** ISO tarih (yyyy-aa-gg) */
  date: string;
  /** Fatura ödemesiyle otomatik oluşturulduysa bağlı fatura */
  invoiceId?: string;
}

export type RecurringType = "yok" | "gunluk" | "haftalik" | "aylik" | "yillik";

export const RECURRING_LABELS: Record<RecurringType, string> = {
  yok: "Tekrar yok",
  gunluk: "Her gün",
  haftalik: "Her hafta",
  aylik: "Her ay",
  yillik: "Her yıl",
};

export type PaymentCurrency = "TRY" | "USD" | "EUR";

export const PAYMENT_CURRENCY_OPTIONS: { value: PaymentCurrency; label: string; symbol: string }[] = [
  { value: "TRY", label: "Türk Lirası", symbol: "₺" },
  { value: "USD", label: "Amerikan Doları", symbol: "$" },
  { value: "EUR", label: "Euro", symbol: "€" },
];

export interface UpcomingPayment {
  id: string;
  label: string;
  accountId: string;
  /** Bağlı cari (opsiyonel) */
  contactId?: string;
  amount: number;
  /** Para birimi */
  currency?: PaymentCurrency;
  /** ISO tarih (yyyy-aa-gg) */
  dueDate: string;
  /** Toplam ödenen tutar (kısmi ödemeler toplamı) */
  paidAmount?: number;
  /** İlk ödeme tarihi */
  firstPaidAt?: string;
  /** Tekrarlama türü */
  recurringType?: RecurringType;
  /** Tekrarlanan ödemelerin ortak grubu ID'si */
  recurringGroupId?: string;
  /** "Şimdi Ödenecekler" kuyruğuna atanmış mı (sürükle-bırak) */
  queued?: boolean;
  /** Kuyruğa atanma zamanı (ISO) */
  queuedAt?: string;
  /** Bitiş tarihi (opsiyonel, belirtilmezse süresiz) */
  recurringEndDate?: string;
  /** Açıklama notu */
  description?: string;
}

export type ContactType = "musteri" | "tedarikci";

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  /** Vergi kimlik numarası */
  taxNo?: string;
  phone?: string;
  email?: string;
}

/** KDV oranları (%) — 1, 10, 20 */
export const KDV_RATES = [1, 10, 20] as const;

export type KdvRate = (typeof KDV_RATES)[number];

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  kdvRate: KdvRate;
}

export interface Invoice {
  id: string;
  /** Örn. FT-2026-0001 (satış) / AL-2026-0001 (alış) */
  invoiceNo: string;
  contactId: string;
  /** ISO tarih (yyyy-aa-gg) */
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  kdvTotal: number;
  total: number;
  /** Ödendi olarak işaretlendi mi */
  paid?: boolean;
  /** Ödendi işaretlendiği tarih (ISO) */
  paidAt?: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  /** ISO tarih (yyyy-aa-gg) */
  date: string;
  note?: string;
}

// FinanceData moved to after Product/BudgetTarget definitions

/* ---------------------------------- Görevler (Todo) ---------------------------------- */

export type TodoPriority = 0 | 1 | 2 | 3 | 4;

export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  0: "Yüksek",
  1: "Yüksek",
  2: "Orta",
  3: "Düşük",
  4: "Normal",
};

export const TODO_PRIORITY_COLORS: Record<TodoPriority, string> = {
  0: "text-red-500",
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-blue-500",
  4: "text-muted-foreground",
};

export interface TodoSection {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface TodoTask {
  id: string;
  title: string;
  description?: string;
  sectionId?: string;
  priority: TodoPriority;
  /** ISO tarih */
  dueDate?: string;
  completed: boolean;
  /** Tamamlanma tarihi */
  completedAt?: string;
  /** Oluşturulma tarihi */
  createdAt: string;
  /** Alt görevler */
  subtasks?: SubTask[];
  /** Etiketler */
  labels?: string[];
  /** Tahmini çalışma süresi (saat) */
  estimatedHours?: number;
  /** Gerçek harcanan süre (saat) */
  actualHours?: number;
  /** Başlangıç saati (HH:mm) */
  startTime?: string;
  /** Bitiş saati (HH:mm) */
  endTime?: string;
  /** Tekrarlama türü */
  recurringType?: RecurringType;
  /** Tekrarlayan görevlerin ortak grup ID */
  recurringGroupId?: string;
  /** Bitiş tarihi (opsiyonel) */
  recurringEndDate?: string;
  /** Hatırlatma (gün olarak, vade öncesi) */
  reminderDays?: number;
  /** Hatırlatma gönderildi mi */
  reminderSent?: boolean;
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

/* ---------------------------------- Ürün/Hizmet Listesi ---------------------------------- */

export interface Product {
  id: string;
  name: string;
  unit: string; // adet, kg, lt, saat vb.
  price: number;
  currency: "TRY" | "USD";
  category?: string;
  description?: string;
}

/* ---------------------------------- Bütçe ---------------------------------- */

export interface BudgetTarget {
  id: string;
  month: string; // yyyy-aa formatında
  category: TransactionCategory;
  targetAmount: number;
  type: "gelir" | "gider";
}

/* ---------------------------------- Belgeler ---------------------------------- */

export const DOCUMENT_CATEGORIES = [
  "Fatura",
  "Sözleşme",
  "Makbuz",
  "Dekont",
  "Beyanname",
  "Diğer",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** localStorage'da base64 veri URL'si olarak saklanan yüklenmiş belge */
export interface StoredDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  /** Bağlı cari (opsiyonel) */
  contactId?: string;
  note?: string;
  fileName: string;
  mimeType: string;
  /** Bayt cinsinden dosya boyutu */
  size: number;
  /** Base64 data URL */
  dataUrl: string;
  uploadedAt: string;
}

export interface FinanceData {
  accounts: Account[];
  transactions: Transaction[];
  upcomingPayments: UpcomingPayment[];
  contacts: Contact[];
  invoices: Invoice[];
  transfers: Transfer[];
  todoSections: TodoSection[];
  todos: TodoTask[];
  products: Product[];
  budgetTargets: BudgetTarget[];
  documents: StoredDocument[];
}
