import type {
  FinanceData,
  TransactionCategory,
  TransactionType,
} from "./types";

/** Bugünden itibaren ±days gün sonraki/önceki tarihi yyyy-aa-gg olarak döndürür (yerel saat). */
function isoFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type TxSeed = readonly [
  id: string,
  type: TransactionType,
  description: string,
  category: TransactionCategory,
  accountId: string,
  amount: number,
  daysAgo: number,
];

const txSeeds: TxSeed[] = [
  ["tx-01", "gelir", "Perakende satış — Günlük hasılat", "Satış", "bank-1", 12450, 0],
  ["tx-02", "gelir", "Hizmet faturası — Danışmanlık", "Hizmet", "bank-1", 24000, 1],
  ["tx-03", "gider", "Ofis malzemeleri", "Malzeme", "bank-2", 1890, 2],
  ["tx-04", "gelir", "Perakende satış — Haftalık hasılat", "Satış", "bank-1", 8750, 2],
  ["tx-05", "gider", "Personel maaşları — Ağustos", "Maaş", "bank-2", 42000, 3],
  ["tx-06", "gelir", "Perakende satış — Günlük hasılat", "Satış", "bank-1", 6300, 4],
  ["tx-07", "gider", "Elektrik faturası", "Fatura", "bank-2", 2340, 5],
  ["tx-08", "gider", "İnternet ve telefon faturası", "Fatura", "bank-2", 1120, 6],
  ["tx-09", "gelir", "Toptan satış — Yılmaz Tekstil", "Satış", "bank-1", 31200, 7],
  ["tx-10", "gider", "Araç yakıt gideri", "Ulaşım", "kasa-1", 980, 8],
  ["tx-11", "gider", "Dükkân kirası — Ağustos", "Kira", "bank-2", 18500, 9],
  ["tx-12", "gelir", "Danışmanlık hizmeti — Yılmaz Tekstil", "Hizmet", "bank-1", 9500, 10],
  ["tx-13", "gider", "SGK primi ödemesi", "Vergi", "bank-2", 6120, 11],
  ["tx-14", "gelir", "Perakende satış — Hafta sonu", "Satış", "kasa-1", 5640, 12],
  ["tx-15", "gider", "Kırtasiye ve sarf malzemesi", "Malzeme", "kasa-1", 460, 13],
  ["tx-16", "gelir", "Hizmet — Bakım anlaşması", "Hizmet", "bank-1", 7800, 14],
  ["tx-17", "gelir", "Perakende satış — Günlük hasılat", "Satış", "kasa-1", 4980, 15],
  ["tx-18", "gelir", "Toptan satış — Anadolu Market", "Satış", "bank-1", 22400, 18],
  ["tx-19", "gider", "Personel maaşları — Temmuz", "Maaş", "bank-2", 40500, 22],
  ["tx-20", "gelir", "Perakende satış — Haftalık hasılat", "Satış", "kasa-1", 7120, 26],
];

export function createSeedData(): FinanceData {
  const year = new Date().getFullYear();
  return {
    accounts: [
      { id: "kasa-1", name: "Nakit Kasa", type: "kasa", balance: 48250, currency: "TRY" },
      { id: "bank-1", name: "Garanti BBVA — Ticari", type: "banka", balance: 182400, currency: "TRY" },
      { id: "bank-2", name: "İş Bankası — Ödemeler", type: "banka", balance: 64900, currency: "TRY" },
    ],
    transactions: txSeeds.map(
      ([id, type, description, category, accountId, amount, daysAgo]) => ({
        id,
        type,
        description,
        category,
        accountId,
        amount,
        date: isoFromToday(-daysAgo),
      }),
    ),
    upcomingPayments: [
      {
        id: "pay-0",
        label: "Tedarikçi ödemesi — Kardeşler Toptan",
        accountId: "bank-1",
        amount: 33360,
        dueDate: isoFromToday(-3),
      },
      {
        id: "pay-1",
        label: "Tedarikçi ödemesi — Yılmaz Tekstil",
        accountId: "bank-1",
        amount: 27800,
        dueDate: isoFromToday(2),
      },
      {
        id: "pay-2",
        label: "Elektrik faturası (Enerjisa)",
        accountId: "bank-2",
        amount: 2340,
        dueDate: isoFromToday(5),
      },
      {
        id: "pay-3",
        label: "Dükkân kirası — Eylül",
        accountId: "bank-2",
        amount: 18500,
        dueDate: isoFromToday(12),
      },
      {
        id: "pay-4",
        label: "KDV tahakkuk ödemesi",
        accountId: "bank-1",
        amount: 14260,
        dueDate: isoFromToday(16),
      },
      {
        id: "pay-5",
        label: "Kredi kartı ekstresi — Ağustos",
        accountId: "bank-2",
        amount: 8940,
        dueDate: isoFromToday(21),
      },
      {
        id: "pay-6",
        label: "SGK prim ödemesi — Eylül",
        accountId: "bank-2",
        amount: 6120,
        dueDate: isoFromToday(27),
      },
    ],
    contacts: [
      {
        id: "ct-1",
        name: "Yılmaz Tekstil",
        type: "musteri",
        taxNo: "1234567890",
        phone: "0212 555 12 34",
        email: "info@yilmaztekstil.com",
      },
      {
        id: "ct-2",
        name: "Anadolu Market",
        type: "musteri",
        taxNo: "0987654321",
        phone: "0232 555 67 89",
      },
      {
        id: "ct-3",
        name: "Kardeşler Toptan",
        type: "tedarikci",
        taxNo: "1112223334",
        phone: "0216 555 45 67",
      },
      {
        id: "ct-4",
        name: "Enerjisa Enerji",
        type: "tedarikci",
        taxNo: "4445556667",
      },
    ],
    invoices: [
      {
        id: "inv-seed-1",
        invoiceNo: `FT-${year}-0001`,
        contactId: "ct-1",
        date: isoFromToday(-14),
        items: [
          {
            id: "it-1",
            description: "Pamuklu kumaş — top",
            quantity: 20,
            unitPrice: 1560,
            kdvRate: 20,
          },
        ],
        subtotal: 31200,
        kdvTotal: 6240,
        total: 37440,
      },
      {
        id: "inv-seed-2",
        invoiceNo: `FT-${year}-0002`,
        contactId: "ct-2",
        date: isoFromToday(-18),
        items: [
          {
            id: "it-2",
            description: "Gıda ürünleri — koli",
            quantity: 40,
            unitPrice: 560,
            kdvRate: 10,
          },
        ],
        subtotal: 22400,
        kdvTotal: 2240,
        total: 24640,
      },
      {
        id: "inv-seed-3",
        invoiceNo: `AL-${year}-0001`,
        contactId: "ct-3",
        date: isoFromToday(-9),
        items: [
          {
            id: "it-3",
            description: "Hammadde partisi",
            quantity: 10,
            unitPrice: 2780,
            kdvRate: 20,
          },
        ],
        subtotal: 27800,
        kdvTotal: 5560,
        total: 33360,
      },
      {
        id: "inv-seed-4",
        invoiceNo: `AL-${year}-0002`,
        contactId: "ct-4",
        date: isoFromToday(-5),
        items: [
          {
            id: "it-4",
            description: "Elektrik tüketimi — Ağustos",
            quantity: 1,
            unitPrice: 2340,
            kdvRate: 1,
          },
        ],
        subtotal: 2340,
        kdvTotal: 23.4,
        total: 2363.4,
      },
    ],
    transfers: [
      {
        id: "trf-seed-1",
        fromAccountId: "bank-1",
        toAccountId: "kasa-1",
        amount: 10000,
        date: isoFromToday(-6),
        note: "Haftalık kasa ihtiyacı",
      },
      {
        id: "trf-seed-2",
        fromAccountId: "bank-1",
        toAccountId: "bank-2",
        amount: 15000,
        date: isoFromToday(-20),
        note: "Ödeme hesabına aktarım",
      },
    ],
    todoSections: [
      { id: "tsec-1", name: "Genel", color: "#6366f1", order: 0 },
      { id: "tsec-2", name: "Vergi", color: "#ef4444", order: 1 },
      { id: "tsec-3", name: "Müşteri", color: "#22c55e", order: 2 },
    ],
    todos: [
      {
        id: "todo-seed-1",
        title: "KDV beyannamesini hazırla",
        description: "Bu ayki KDV beyannamesi için faturaları kontrol et",
        sectionId: "tsec-2",
        priority: 0,
        dueDate: isoFromToday(2),
        completed: false,
        createdAt: isoFromToday(-3),
        subtasks: [
          { id: "sub-1", title: "Gelen faturaları topla", completed: true },
          { id: "sub-2", title: "Giden faturaları topla", completed: false },
          { id: "sub-3", title: "KDV hesapla", completed: false },
        ],
        labels: ["vergi"],
      },
      {
        id: "todo-seed-2",
        title: "Müşteri ziyareti — Yılmaz Tekstil",
        description: "Yeni sipariş için görüşme planla",
        sectionId: "tsec-3",
        priority: 2,
        dueDate: isoFromToday(5),
        completed: false,
        createdAt: isoFromToday(-1),
        subtasks: [],
        labels: ["müşteri"],
      },
      {
        id: "todo-seed-3",
        title: "Banka hesap özeti kontrol et",
        sectionId: "tsec-1",
        priority: 3,
        dueDate: isoFromToday(0),
        completed: false,
        createdAt: isoFromToday(-2),
        subtasks: [],
        labels: ["banka"],
      },
    ],
    products: [
      { id: "prod-1", name: "Pamuklu Kumaş", unit: "top", price: 1560, currency: "TRY", category: "Hammadde", description: "150cm genişliğinde" },
      { id: "prod-2", name: "Gıda Ürünleri", unit: "koli", price: 560, currency: "TRY", category: "Gıda" },
      { id: "prod-3", name: "Danışmanlık", unit: "saat", price: 750, currency: "TRY", category: "Hizmet" },
      { id: "prod-4", name: "Bakım Anlaşması", unit: "ay", price: 2500, currency: "TRY", category: "Hizmet" },
    ],
    budgetTargets: [
      { id: "bt-1", month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`, category: "Satış", targetAmount: 150000, type: "gelir" },
      { id: "bt-2", month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`, category: "Hizmet", targetAmount: 50000, type: "gelir" },
      { id: "bt-3", month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`, category: "Maaş", targetAmount: 50000, type: "gider" },
      { id: "bt-4", month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`, category: "Kira", targetAmount: 20000, type: "gider" },
      { id: "bt-5", month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`, category: "Fatura", targetAmount: 10000, type: "gider" },
    ],
    documents: [],
  };
}
