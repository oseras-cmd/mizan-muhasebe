import { beforeEach, describe, expect, test } from "bun:test";
import {
  addInvoice,
  addTransaction,
  addTransfer,
  addUpcomingPayment,
  completeUpcomingPayment,
  deleteInvoice,
  deleteUpcomingPayment,
  exportFinanceData,
  getFinanceData,
  importFinanceData,
  resetFinanceData,
  setInvoicePaid,
} from "../src/lib/finance/store";
import {
  accountLedger,
  categoryTotalsByKey,
  contactBalance,
  dueLabel,
  monthKeyOf,
  monthSeriesByKey,
  monthTotalsByKey,
  overduePayments,
  totalAlacak,
  totalBorc,
} from "../src/lib/finance/dashboard";
import { todayIso } from "../src/lib/finance/format";
import {
  computePolicySchedule,
  deleteSavedPolicy,
  getSavedPolicies,
  savePolicy,
} from "../src/lib/finance/policies";
import { convertRate, type ExchangeRates } from "../src/lib/finance/rates";
import { computeTiftikMaliyet } from "../src/lib/finance/tiftik";

function isoFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

beforeEach(() => {
  resetFinanceData();
});

describe("Gelir/Gider kayıtları", () => {
  test("gelir bakiyeyi artırır, gider azaltır", () => {
    const data = getFinanceData();
    const before = data.accounts.find((a) => a.id === "bank-1")!.balance;

    addTransaction({
      type: "gelir",
      description: "Test geliri",
      category: "Satış",
      accountId: "bank-1",
      amount: 500,
      date: todayIso(),
    });
    expect(
      getFinanceData().accounts.find((a) => a.id === "bank-1")!.balance,
    ).toBeCloseTo(before + 500, 2);

    addTransaction({
      type: "gider",
      description: "Test gideri",
      category: "Diğer",
      accountId: "bank-1",
      amount: 200.5,
      date: todayIso(),
    });
    expect(
      getFinanceData().accounts.find((a) => a.id === "bank-1")!.balance,
    ).toBeCloseTo(before + 500 - 200.5, 2);
  });

  test("virman iki bakiyeyi de atomik günceller, toplam değişmez", () => {
    const data = getFinanceData();
    const totalBefore = data.accounts.reduce((s, a) => s + a.balance, 0);

    addTransfer({
      fromAccountId: "bank-1",
      toAccountId: "kasa-1",
      amount: 2500,
      date: todayIso(),
      note: "test",
    });

    const after = getFinanceData();
    const from = after.accounts.find((a) => a.id === "bank-1")!.balance;
    const to = after.accounts.find((a) => a.id === "kasa-1")!.balance;
    expect(from).toBeCloseTo(data.accounts.find((a) => a.id === "bank-1")!.balance - 2500, 2);
    expect(to).toBeCloseTo(data.accounts.find((a) => a.id === "kasa-1")!.balance + 2500, 2);
    expect(after.accounts.reduce((s, a) => s + a.balance, 0)).toBeCloseTo(totalBefore, 2);
  });
});

describe("Fatura numaralandırma ve KDV", () => {
  test("müşteriye satış (FT), tedarikçiye alış (AL) serisi verilir", () => {
    const data = getFinanceData();
    const year = new Date().getFullYear();
    const items = [
      {
        id: "it-x",
        description: "Ürün",
        quantity: 2,
        unitPrice: 1000,
        kdvRate: 20 as const,
      },
    ];

    const sales = addInvoice({ contactId: "ct-1", date: todayIso(), items });
    expect(sales.invoiceNo).toBe(`FT-${year}-0003`);

    const purchase = addInvoice({ contactId: "ct-3", date: todayIso(), items });
    expect(purchase.invoiceNo).toBe(`AL-${year}-0003`);
  });

  test("KDV dahil toplamlar store'da hesaplanır", () => {
    const items = [
      {
        id: "it-y",
        description: "Kalem",
        quantity: 10,
        unitPrice: 200,
        kdvRate: 10 as const,
      },
    ];
    const invoice = addInvoice({ contactId: "ct-1", date: todayIso(), items });
    expect(invoice.subtotal).toBeCloseTo(2000, 2);
    expect(invoice.kdvTotal).toBeCloseTo(200, 2);
    expect(invoice.total).toBeCloseTo(2200, 2);
  });
});

describe("Fatura ödeme takibi", () => {
  test("ödendi işaretleme bağlı tahsilat kaydı oluşturur ve bakiyeleri günceller", () => {
    const data = getFinanceData();
    const invoice = data.invoices.find((i) => i.invoiceNo.endsWith("0001") && i.invoiceNo.startsWith("FT"))!;
    const bankBefore = data.accounts.find((a) => a.id === "bank-1")!.balance;
    const cariBefore = contactBalance(data, invoice.contactId);

    setInvoicePaid(invoice.id, true, { accountId: "bank-1", date: invoice.date });

    const after = getFinanceData();
    const marked = after.invoices.find((i) => i.id === invoice.id)!;
    expect(marked.paid).toBe(true);
    expect(marked.paidAt).toBe(invoice.date);

    const linked = after.transactions.find((t) => t.invoiceId === invoice.id);
    expect(linked).toBeDefined();
    expect(linked!.type).toBe("gelir");
    expect(linked!.category).toBe("Tahsilat");
    expect(linked!.amount).toBeCloseTo(invoice.total, 2);

    expect(
      after.accounts.find((a) => a.id === "bank-1")!.balance,
    ).toBeCloseTo(bankBefore + invoice.total, 2);
    expect(contactBalance(after, invoice.contactId)).toBeCloseTo(cariBefore - invoice.total, 2);
    expect(totalAlacak(after)).toBeCloseTo(totalAlacak(data) - invoice.total, 2);
  });

  test("ödemeyi geri alma bağlı kaydı siler ve bakiyeyi düzeltir", () => {
    const data = getFinanceData();
    const invoice = data.invoices.find((i) => i.invoiceNo.endsWith("0001") && i.invoiceNo.startsWith("FT"))!;
    const bankBefore = data.accounts.find((a) => a.id === "bank-1")!.balance;

    setInvoicePaid(invoice.id, true, { accountId: "bank-1" });
    setInvoicePaid(invoice.id, false);

    const after = getFinanceData();
    expect(after.invoices.find((i) => i.id === invoice.id)!.paid).toBeFalsy();
    expect(after.transactions.some((t) => t.invoiceId === invoice.id)).toBe(false);
    expect(
      after.accounts.find((a) => a.id === "bank-1")!.balance,
    ).toBeCloseTo(bankBefore, 2);
  });

  test("fatura silinince bağlı kayıt da silinir ve bakiye düzelir", () => {
    const data = getFinanceData();
    const invoice = data.invoices.find((i) => i.invoiceNo.endsWith("0001") && i.invoiceNo.startsWith("FT"))!;
    const bankBefore = data.accounts.find((a) => a.id === "bank-1")!.balance;

    setInvoicePaid(invoice.id, true, { accountId: "bank-1" });
    deleteInvoice(invoice.id);

    const after = getFinanceData();
    expect(after.invoices.some((i) => i.id === invoice.id)).toBe(false);
    expect(after.transactions.some((t) => t.invoiceId === invoice.id)).toBe(false);
    expect(
      after.accounts.find((a) => a.id === "bank-1")!.balance,
    ).toBeCloseTo(bankBefore, 2);
  });

  test("alış faturası ödenince gider (Ödeme) kaydı oluşur ve borç düşer", () => {
    const data = getFinanceData();
    const invoice = data.invoices.find((i) => i.invoiceNo.startsWith("AL"))!;
    const borcBefore = totalBorc(data);

    setInvoicePaid(invoice.id, true, { accountId: "bank-2" });

    const after = getFinanceData();
    const linked = after.transactions.find((t) => t.invoiceId === invoice.id);
    expect(linked!.type).toBe("gider");
    expect(linked!.category).toBe("Ödeme");
    expect(totalBorc(after)).toBeCloseTo(borcBefore - invoice.total, 2);
  });
});

describe("Planlı ödemeler", () => {
  test("geciken ödeme tespit edilir ve etiket doğru yazılır", () => {
    const overdue = overduePayments(getFinanceData());
    expect(overdue.length).toBeGreaterThan(0);
    for (const payment of overdue) {
      expect(payment.dueDate < todayIso()).toBe(true);
    }
    expect(dueLabel(isoFromToday(-3))).toBe("3 gün gecikti");
    expect(dueLabel(isoFromToday(0))).toBe("Bugün");
    expect(dueLabel(isoFromToday(2))).toBe("2 gün kaldı");
  });

  test("ödeme tamamlanınca gider kaydı işlenir ve bakiye düşer", () => {
    const data = getFinanceData();
    const bank2Before = data.accounts.find((a) => a.id === "bank-2")!.balance;
    const payment = addUpcomingPayment({
      label: "Test ödemesi",
      accountId: "bank-2",
      amount: 1234.5,
      dueDate: isoFromToday(3),
    });

    completeUpcomingPayment(payment.id);

    const after = getFinanceData();
    expect(after.upcomingPayments.some((p) => p.id === payment.id)).toBe(false);
    const gider = after.transactions.find((t) => t.description.includes("Test ödemesi"));
    expect(gider).toBeDefined();
    expect(gider!.type).toBe("gider");
    expect(gider!.category).toBe("Ödeme");
    expect(
      after.accounts.find((a) => a.id === "bank-2")!.balance,
    ).toBeCloseTo(bank2Before - 1234.5, 2);
  });

  test("ödeme silinebilir", () => {
    const payment = addUpcomingPayment({
      label: "Silinecek",
      accountId: "bank-1",
      amount: 100,
      dueDate: todayIso(),
    });
    deleteUpcomingPayment(payment.id);
    expect(
      getFinanceData().upcomingPayments.some((p) => p.id === payment.id),
    ).toBe(false);
  });
});

describe("Hesap dökümü (ekstre)", () => {
  test("satır bakiyeleri güncel bakiyeye ulaşır ve virmanlar dahildir", () => {
    const data = getFinanceData();
    const { openingBalance, entries } = accountLedger(data, "kasa-1");

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.kind === "virman-giris")).toBe(true);

    const finalBalance =
      openingBalance +
      entries.reduce(
        (sum, e) =>
          sum +
          (e.kind === "gelir" || e.kind === "virman-giris" ? e.amount : -e.amount),
        0,
      );
    expect(finalBalance).toBeCloseTo(
      data.accounts.find((a) => a.id === "kasa-1")!.balance,
      2,
    );

    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i - 1].date >= entries[i].date).toBe(true);
    }
  });
});

describe("Rapor yardımcıları", () => {
  test("aylık toplamlar manuel filtreyle örtüşür", () => {
    const data = getFinanceData();
    const key = monthKeyOf(new Date());

    const manual = data.transactions.reduce(
      (acc, tx) => {
        if (monthKeyOf(new Date(`${tx.date}T00:00:00`)) !== key) return acc;
        if (tx.type === "gelir") acc.income += tx.amount;
        else acc.expense += tx.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );

    const totals = monthTotalsByKey(data, key);
    expect(totals.income).toBeCloseTo(manual.income, 2);
    expect(totals.expense).toBeCloseTo(manual.expense, 2);
  });

  test("kategori toplamları sıralı ve türleri korunur", () => {
    const key = monthKeyOf(new Date());
    const categories = categoryTotalsByKey(getFinanceData(), key);

    expect(categories.length).toBeGreaterThan(0);
    for (let i = 1; i < categories.length; i += 1) {
      expect(categories[i - 1].total).toBeGreaterThanOrEqual(categories[i].total);
    }
    expect(categories.every((c) => c.type === "gelir" || c.type === "gider")).toBe(true);
  });

  test("ay serisi ayın tüm günlerini kapsar", () => {
    const now = new Date();
    const key = monthKeyOf(now);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const series = monthSeriesByKey(getFinanceData(), key);

    expect(series).toHaveLength(daysInMonth);
    expect(series.every((s) => s.gelir >= 0 && s.gider >= 0)).toBe(true);
  });
});

describe("Poliçe gider dağılımı", () => {
  test("binek araçta %30 K.K.E.G. ayrılır ve toplam korunur", () => {
    const schedule = computePolicySchedule({
      type: "Binek Araç",
      account: "770",
      startDate: "2026-02-15",
      amount: 25000,
    });

    expect(schedule.kkegAmount).toBeCloseTo(7500, 2);
    expect(schedule.rows).toHaveLength(12);
    // İlk ay seçilen gider hesabına yazılır
    expect(schedule.rows[0].accountCode).toBe("770");
    expect(schedule.rows[0].monthName).toBe("Şubat");
    // 12. ay (Ocak 2027) yıl dönümü → 280
    expect(schedule.rows[11].accountCode).toBe("280");
    // Aradakiler 180
    expect(schedule.rows[1].accountCode).toBe("180");
    expect(schedule.rows[10].accountCode).toBe("180");

    const monthsTotal = schedule.rows.reduce((sum, r) => sum + r.amount, 0);
    expect(monthsTotal + schedule.kkegAmount).toBeCloseTo(25000, 2);
    const totalsTotal =
      (schedule.totals["770"] ?? 0) +
      (schedule.totals["180"] ?? 0) +
      (schedule.totals["280"] ?? 0) +
      schedule.totals["kkeg"];
    expect(totalsTotal).toBeCloseTo(25000, 2);
  });

  test("ticari araçta K.K.E.G. ayrılmaz", () => {
    const schedule = computePolicySchedule({
      type: "Ticari Araç",
      account: "770",
      startDate: "2026-06-01",
      amount: 12000,
    });
    expect(schedule.kkegAmount).toBe(0);
    expect(schedule.rows.reduce((sum, r) => sum + r.amount, 0)).toBeCloseTo(12000, 2);
    expect(schedule.totals["689"]).toBeUndefined();
  });

  test("işyeri poliçesinde ilk ay 740'a yazılır", () => {
    const schedule = computePolicySchedule({
      type: "İşyeri Poliçesi",
      account: "740",
      startDate: "2026-01-10",
      amount: 6000,
    });
    expect(schedule.rows[0].accountCode).toBe("740");
    expect(schedule.rows[0].periodLabel).toBe("2026 / 1. Dönem");
  });

  test("kaydedilen poliçe listelenir ve silinebilir", () => {
    const before = getSavedPolicies().length;
    const policy = savePolicy({
      type: "Binek Araç",
      account: "770",
      number: "TEST/001",
      date: "2026-05-01",
      amount: 15000,
    });
    expect(getSavedPolicies().length).toBe(before + 1);
    expect(getSavedPolicies().some((p) => p.id === policy.id)).toBe(true);

    deleteSavedPolicy(policy.id);
    expect(getSavedPolicies().some((p) => p.id === policy.id)).toBe(false);
  });
});

describe("Tiftik maliyet hesabı", () => {
  const defaults = {
    miktar: 11440,
    alimUsd: 10,
    kur: 48,
    yikamaFirePct: 28,
    islemeFirePct: 10,
    bozMalKg: 0,
    yikamaUcreti: 30,
    genelGiderler: 0,
    isciSayisi: 5,
    isciMaas: 32000,
    aySayisi: 4,
    satisUsd: 18,
  };

  test("fire akışı ve maliyet kalemleri örnekteki değerlerle örtüşür", () => {
    const r = computeTiftikMaliyet(defaults);
    expect(r.alimTL).toBeCloseTo(480, 2);
    expect(r.satisTL).toBeCloseTo(864, 2);
    expect(r.yikamaSonrasi).toBeCloseTo(8236.8, 2);
    expect(r.netKg).toBeCloseTo(7413.12, 2);
    expect(r.hamAlim).toBeCloseTo(5491200, 2);
    expect(r.yikamaUcretiToplam).toBeCloseTo(343200, 2);
    expect(r.iscilik).toBeCloseTo(640000, 2);
    expect(r.toplamMaliyet).toBeCloseTo(6474400, 2);
    expect(r.birimMaliyet).toBeCloseTo(6474400 / 7413.12, 2);
  });

  test("boz mal çıkınca net kg düşer ve birim maliyet yükselir", () => {
    const withBoz = computeTiftikMaliyet({ ...defaults, bozMalKg: 500 });
    const without = computeTiftikMaliyet(defaults);
    expect(withBoz.netKg).toBeCloseTo((8236.8 - 500) * 0.9, 2);
    expect(withBoz.bozMalSonrasi).toBeCloseTo(8236.8 - 500, 2);
    expect(withBoz.birimMaliyet!).toBeGreaterThan(without.birimMaliyet!);
  });

  test("satış, kâr ve başabaş hesabı doğru", () => {
    const r = computeTiftikMaliyet(defaults);
    expect(r.toplamGelir).toBeCloseTo(r.netKg * 864, 2);
    expect(r.brutKar).toBeCloseTo(r.toplamGelir! - r.toplamMaliyet, 2);
    expect(r.kiloBasiKar).toBeCloseTo(864 - r.birimMaliyet!, 2);
    expect(r.karMarjiPct).toBeCloseTo((r.brutKar! / r.toplamGelir!) * 100, 2);
    expect(r.basabasUsd).toBeCloseTo(r.birimMaliyet! / 48, 2);
    // 6.474.400 ÷ 7.413,12 ≈ 873,37 TL/kg → başabaş ≈ 18,20 USD/kg (> 18 satış)
    expect(r.basabasUsd!).toBeGreaterThan(18);
    expect(r.kiloBasiKar!).toBeLessThan(0);
  });

  test("boz mal kg bilinmiyorsa kilo başı maliyet hesaplanamaz", () => {
    const r = computeTiftikMaliyet({ ...defaults, bozMalKg: NaN });
    expect(Number.isNaN(r.netKg)).toBe(true);
    expect(r.birimMaliyet).toBeNull();
    expect(r.toplamGelir).toBeNull();
    expect(r.basabasUsd).toBeNull();
    // maliyet kalemleri yine de hesaplanır
    expect(r.toplamMaliyet).toBeCloseTo(6474400, 2);
  });

  test("net kg sıfıra inerse birim maliyet hesaplanamaz", () => {
    const r = computeTiftikMaliyet({ ...defaults, bozMalKg: 9000 });
    expect(r.netKg).toBeLessThanOrEqual(0);
    expect(r.birimMaliyet).toBeNull();
    expect(r.brutKar).toBeNull();
  });

  test("boz mal yıkama sonrasına yaklaşınca birim maliyet saçma büyümez", () => {
    // 8.236,80 kg boz mal → net kg kayan nokta artığına düşebilir;
    // 6.474.400 ÷ 10⁻¹⁴ ≈ 5,5×10²⁰ gibi saçma sonuç üretilmemeli.
    const exact = computeTiftikMaliyet({ ...defaults, bozMalKg: 8236.8 });
    expect(exact.netKg).toBe(0);
    expect(exact.birimMaliyet).toBeNull();
    expect(exact.basabasUsd).toBeNull();

    const residue = computeTiftikMaliyet({ ...defaults, bozMalKg: 8236.8 - 1e-11 });
    expect(residue.netKg).toBe(0);
    expect(residue.birimMaliyet).toBeNull();
    expect(residue.kiloBasiKar).toBeNull();
    expect(residue.karMarjiPct).toBeNull();
  });

  test("nokta ondalık kur girişi 100 katına çıkmaz (47.96 → 47,96)", () => {
    const r = computeTiftikMaliyet({ ...defaults, kur: 47.96 });
    expect(r.alimTL).toBeCloseTo(479.6, 2);
    expect(r.satisTL).toBeCloseTo(863.28, 2);
    expect(r.birimMaliyet).toBeCloseTo(r.toplamMaliyet / r.netKg, 2);
    expect(r.basabasUsd).toBeCloseTo(r.birimMaliyet! / 47.96, 2);
  });
});

describe("Kur hesaplamaları", () => {
  const rates: ExchangeRates = {
    USD: 40,
    EUR: 45,
    GBP: 50,
    XAU: 3200,
    XAG: null,
  };

  test("TL dönüşümleri doğru yapılır", () => {
    expect(convertRate(rates, "TRY", "USD", 1000)).toBeCloseTo(25, 6);
    expect(convertRate(rates, "USD", "TRY", 1)).toBeCloseTo(40, 6);
    expect(convertRate(rates, "USD", "EUR", 10)).toBeCloseTo((10 * 40) / 45, 6);
  });

  test("kuru olmayan birim için null döner", () => {
    expect(convertRate(rates, "XAG", "TRY", 5)).toBeNull();
    expect(convertRate(rates, "TRY", "XAG", 5)).toBeNull();
  });
});

describe("Yedekleme", () => {
  test("dışa aktarılan yedek geri yüklenebilir", () => {
    const data = getFinanceData();
    addTransaction({
      type: "gelir",
      description: "Yedek sonrası işlem",
      category: "Satış",
      accountId: "kasa-1",
      amount: 999,
      date: todayIso(),
    });

    const raw = exportFinanceData();
    const restored = importFinanceData(raw);
    expect(restored).toBe(true);

    const after = getFinanceData();
    expect(after.transactions.length).toBe(data.transactions.length + 1);
    expect(after.transactions.some((t) => t.description === "Yedek sonrası işlem")).toBe(true);
  });

  test("bozuk ve eksik yedekler reddedilir", () => {
    expect(importFinanceData("{bozuk json")).toBe(false);
    expect(importFinanceData('{"foo": 1}')).toBe(false);
  });
});
