import { beforeEach, describe, expect, test } from "bun:test";
import {
  clearCalculations,
  countSavedCalculations,
  deleteCalculation,
  listSavedCalculations,
  saveCalculation,
} from "../src/components/calculators/engine/calcSave";
import type { ExcelSection } from "../src/components/calculators/engine/calcExport";

/** Basit bellek içi localStorage taklidi — test ortamında gerçek depo yoktur. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

const SECTIONS: ExcelSection[] = [
  { title: "Girdiler", headers: ["Parametre", "Değer"], rows: [["Tutar", 1000]] },
  { title: "Sonuçlar", headers: ["Kalem", "Değer"], rows: [["Net", 850]] },
];

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe("hesaplama kaydı (calcSave)", () => {
  test("kaydet → listede görünür, alanlar korunur", () => {
    const rec = saveCalculation({
      calcId: "kdv",
      title: "KDV Hesaplama",
      sheet: "KDV",
      sections: SECTIONS,
    });
    expect(rec).not.toBeNull();

    const list = listSavedCalculations("kdv");
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("KDV Hesaplama");
    expect(list[0].sections).toHaveLength(2);
    expect(list[0].sections[1].rows[0]).toEqual(["Net", 850]);
    expect(countSavedCalculations("kdv")).toBe(1);
  });

  test("farklı hesaplayıcıların kayıtları birbirine karışmaz", () => {
    saveCalculation({ calcId: "kdv", title: "KDV", sheet: "KDV", sections: SECTIONS });
    saveCalculation({ calcId: "maas", title: "Maaş", sheet: "Maaş", sections: SECTIONS });

    expect(listSavedCalculations("kdv")).toHaveLength(1);
    expect(listSavedCalculations("maas")).toHaveLength(1);
    expect(listSavedCalculations("bilinmeyen")).toHaveLength(0);
  });

  test("boş bölüm kaydı reddedilir", () => {
    const rec = saveCalculation({
      calcId: "kdv",
      title: "KDV",
      sheet: "KDV",
      sections: [{ title: "Boş", rows: [] }],
    });
    expect(rec).toBeNull();
    expect(listSavedCalculations("kdv")).toHaveLength(0);
  });

  test("en yeni kayıt başa gelir", () => {
    saveCalculation({ calcId: "adat", title: "1", sheet: "Adat", sections: SECTIONS });
    saveCalculation({ calcId: "adat", title: "2", sheet: "Adat", sections: SECTIONS });
    const list = listSavedCalculations("adat");
    expect(list[0].title).toBe("2");
    expect(list[1].title).toBe("1");
  });

  test("hesaplayıcı başına azami 25 kayıt tutulur", () => {
    for (let i = 0; i < 30; i++) {
      saveCalculation({
        calcId: "stopaj",
        title: `Stopaj ${i}`,
        sheet: "Stopaj",
        sections: SECTIONS,
      });
    }
    const list = listSavedCalculations("stopaj");
    expect(list.length).toBe(25);
    // en yeniler korunur
    expect(list[0].title).toBe("Stopaj 29");
    expect(list.some((r) => r.title === "Stopaj 0")).toBe(false);
  });

  test("kayıt silme ve tümünü temizleme", () => {
    const a = saveCalculation({ calcId: "kdv", title: "A", sheet: "KDV", sections: SECTIONS });
    saveCalculation({ calcId: "kdv", title: "B", sheet: "KDV", sections: SECTIONS });
    saveCalculation({ calcId: "maas", title: "Maaş", sheet: "Maaş", sections: SECTIONS });

    deleteCalculation(a!.id);
    expect(listSavedCalculations("kdv").map((r) => r.title)).toEqual(["B"]);

    clearCalculations("kdv");
    expect(listSavedCalculations("kdv")).toHaveLength(0);
    expect(listSavedCalculations("maas")).toHaveLength(1);
  });

  test("bozuk depo verisi çökertmez, boş liste döner", () => {
    localStorage.setItem("mizan.hesapKayitlari.v1", "{bozuk-json");
    expect(listSavedCalculations("kdv")).toHaveLength(0);

    localStorage.setItem(
      "mizan.hesapKayitlari.v1",
      JSON.stringify([{ id: 1, calcId: "kdv" }, "garip", null]),
    );
    expect(listSavedCalculations("kdv")).toHaveLength(0);
  });

  test("localStorage erişilemezse kaydetme null döner (çökmez)", () => {
    const original = (globalThis as { localStorage?: unknown }).localStorage;
    try {
      delete (globalThis as { localStorage?: unknown }).localStorage;
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
          throw new Error("Erişim reddedildi");
        },
      });
      expect(
        saveCalculation({ calcId: "kdv", title: "KDV", sheet: "KDV", sections: SECTIONS }),
      ).toBeNull();
      expect(listSavedCalculations("kdv")).toHaveLength(0);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
      (globalThis as { localStorage?: unknown }).localStorage = original;
    }
  });
});
