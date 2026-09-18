/**
 * Nakit akış projeksiyonu testleri.
 */

import { describe, expect, it } from "bun:test";
import { buildCashflowProjection } from "../cashflow";
import type { FinanceData } from "../types";

function makeData(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    accounts: [],
    transactions: [],
    upcomingPayments: [],
    contacts: [],
    invoices: [],
    transfers: [],
    todoSections: [],
    todos: [],
    products: [],
    budgetTargets: [],
    documents: [],
    ...overrides,
  };
}

describe("buildCashflowProjection", () => {
  it("30 gün için 30 nokta üretir", () => {
    const data = makeData();
    const r = buildCashflowProjection(data, 30, new Date(2026, 8, 17));
    expect(r.points).toHaveLength(30);
  });

  it("boş veride bakiye sabit kalır", () => {
    const data = makeData();
    const r = buildCashflowProjection(data, 10, new Date(2026, 8, 17));
    for (const p of r.points) {
      expect(p.balance).toBe(r.points[0]?.balance);
    }
    expect(r.hasShortfall).toBe(false);
  });

  it("planlı ödeme kendi vadesinde düşer", () => {
    const data = makeData({
      accounts: [{ id: "a1", name: "Kasa", type: "kasa", balance: 50_000, currency: "TRY" }],
      upcomingPayments: [
        {
          id: "p1",
          label: "Kira",
          accountId: "a1",
          amount: 10_000,
          dueDate: "2026-09-20",
        },
      ],
    });
    const r = buildCashflowProjection(data, 30, new Date(2026, 8, 17));
    const today = r.points[0];
    const payday = r.points.find((p) => p.date === "2026-09-20");
    expect(today?.balance).toBe(50_000);
    expect(payday?.outgoing).toBe(10_000);
    expect(payday?.balance).toBe(40_000);
    // sonraki gün bakiye sabit
    const after = r.points.find((p) => p.date === "2026-09-21");
    expect(after?.balance).toBe(40_000);
  });

  it("geçmiş vadeli ödemeler bugüne yansıtılır", () => {
    const data = makeData({
      accounts: [{ id: "a1", name: "Kasa", type: "kasa", balance: 20_000, currency: "TRY" }],
      upcomingPayments: [
        {
          id: "p1",
          label: "Geciken ödeme",
          accountId: "a1",
          amount: 5_000,
          dueDate: "2026-09-01",
        },
      ],
    });
    const r = buildCashflowProjection(data, 5, new Date(2026, 8, 17));
    // 20.000 − 5.000 = 15.000 bugün
    expect(r.points[0]?.balance).toBe(15_000);
  });

  it("kısmi ödenmiş ödemede sadece kalan tutar düşer", () => {
    const data = makeData({
      accounts: [{ id: "a1", name: "Kasa", type: "kasa", balance: 10_000, currency: "TRY" }],
      upcomingPayments: [
        {
          id: "p1",
          label: "Kısmi",
          accountId: "a1",
          amount: 8_000,
          paidAmount: 3_000,
          dueDate: "2026-09-18",
        },
      ],
    });
    const r = buildCashflowProjection(data, 5, new Date(2026, 8, 17));
    // Bugün çıkış yok
    expect(r.points[0]?.outgoing).toBe(0);
    expect(r.points[0]?.balance).toBe(10_000);
    // Vade gününde kalan 5.000 düşer
    const payday = r.points.find((p) => p.date === "2026-09-18");
    expect(payday?.outgoing).toBe(5_000);
    expect(payday?.balance).toBe(5_000);
  });

  it("nakit açığı tespit eder", () => {
    const data = makeData({
      accounts: [{ id: "a1", name: "Kasa", type: "kasa", balance: 3_000, currency: "TRY" }],
      upcomingPayments: [
        { id: "p1", label: "Büyük ödeme", accountId: "a1", amount: 10_000, dueDate: "2026-09-25" },
      ],
    });
    const r = buildCashflowProjection(data, 30, new Date(2026, 8, 17));
    expect(r.hasShortfall).toBe(true);
    expect(r.minBalance).toBeLessThan(0);
    expect(r.minBalanceDate).toBe("2026-09-25");
  });

  it("toplam çıkış, tüm kalan ödemelerin toplamına eşittir", () => {
    const data = makeData({
      accounts: [{ id: "a1", name: "Kasa", type: "kasa", balance: 100_000, currency: "TRY" }],
      upcomingPayments: [
        { id: "p1", label: "A", accountId: "a1", amount: 1_000, dueDate: "2026-09-20" },
        { id: "p2", label: "B", accountId: "a1", amount: 2_000, dueDate: "2026-10-15" },
        { id: "p3", label: "C", accountId: "a1", amount: 4_000, dueDate: "2026-11-01" },
      ],
    });
    const r = buildCashflowProjection(data, 30, new Date(2026, 8, 17));
    expect(r.totalOutgoing).toBe(7_000);
  });

  it("tamamen ödenmiş ödemeler hesaba katılmaz", () => {
    const data = makeData({
      accounts: [{ id: "a1", name: "Kasa", type: "kasa", balance: 10_000, currency: "TRY" }],
      upcomingPayments: [
        { id: "p1", label: "Ödendi", accountId: "a1", amount: 5_000, paidAmount: 5_000, dueDate: "2026-09-20" },
      ],
    });
    const r = buildCashflowProjection(data, 30, new Date(2026, 8, 17));
    expect(r.totalOutgoing).toBe(0);
    expect(r.points[0]?.balance).toBe(10_000);
  });
});
