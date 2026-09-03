/**
 * Global arama — tüm modüllerde tek arama.
 */

import { useMemo, useState } from "react";
import { useFinanceData } from "./store";

export interface SearchResult {
  kind: "cari" | "islem" | "odeme" | "gorev" | "hesap" | "urun";
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export function useGlobalSearch() {
  const data = useFinanceData();
  const [query, setQuery] = useState("");

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    const matches: SearchResult[] = [];

    // Cariler
    for (const c of data.contacts) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.taxNo?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      ) {
        matches.push({
          kind: "cari",
          id: c.id,
          title: c.name,
          subtitle: c.type === "musteri" ? "Müşteri" : "Tedarikçi",
          url: "/cariler",
        });
      }
    }

    // İşlemler
    for (const t of data.transactions) {
      if (
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      ) {
        matches.push({
          kind: "islem",
          id: t.id,
          title: t.description,
          subtitle: `${t.type === "gelir" ? "Gelir" : "Gider"} · ${t.category} · ${t.date}`,
          url: "/dashboard",
        });
      }
    }

    // Ödemeler
    for (const p of data.upcomingPayments) {
      if (p.label.toLowerCase().includes(q)) {
        matches.push({
          kind: "odeme",
          id: p.id,
          title: p.label,
          subtitle: `Vade: ${p.dueDate} · ₺${p.amount.toLocaleString("tr-TR")}`,
          url: "/odemeler",
        });
      }
    }

    // Görevler
    for (const t of data.todos) {
      if (
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      ) {
        matches.push({
          kind: "gorev",
          id: t.id,
          title: t.title,
          subtitle: t.dueDate ? `Vade: ${t.dueDate}` : t.completed ? "Tamamlandı" : "Devam ediyor",
          url: "/gorevler",
        });
      }
    }

    // Hesaplar
    for (const a of data.accounts) {
      if (a.name.toLowerCase().includes(q)) {
        matches.push({
          kind: "hesap",
          id: a.id,
          title: a.name,
          subtitle: `Bakiye: ₺${a.balance.toLocaleString("tr-TR")}`,
          url: "/kasa-banka",
        });
      }
    }

    // Ürünler
    for (const p of data.products) {
      if (
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      ) {
        matches.push({
          kind: "urun",
          id: p.id,
          title: p.name,
          subtitle: `${p.price.toLocaleString("tr-TR")} ${p.currency}/${p.unit}`,
          url: "/hesaplayicilar",
        });
      }
    }

    return matches.slice(0, 20); // max 20 sonuç
  }, [query, data]);

  return { query, setQuery, results };
}

const KIND_LABELS: Record<string, string> = {
  cari: "Cari",
  islem: "İşlem",
  odeme: "Ödeme",
  gorev: "Görev",
  hesap: "Hesap",
  urun: "Ürün",
};

export function getSearchKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
