import { useEffect, useState } from "react";
import { todayIso } from "./format";
import { formatCurrency } from "./format";
import { getFinanceData, getTodoReminders, type TodoReminder } from "./store";
import type { UpcomingPayment } from "./types";

/* ─── Storage Keys ─── */
const DISMISSED_KEY = "mizan-dismissed-notifications-v1";
const READ_KEY = "mizan-read-notifications-v1";
/** Günlük tur durumu: bugün hangi turların tamamlandığı */
const ROUND_STATE_KEY = "mizan-reminder-rounds-v1";
/** Acil kalemlerin bugün bildirildiği kaydı (tur beklemeden anında bildirim) */
const URGENT_NOTIFIED_KEY = "mizan-reminder-urgent-v1";

/* ─── Helpers ─── */
function daysUntil(dateIso: string): number {
  const today = new Date(todayIso());
  const due = new Date(dateIso);
  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getJsonSet(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveJsonSet(ids: Set<string>, storageKey: string) {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...ids]));
  } catch {}
}

/** Günlük hatırlatma turları — kullanıcı gün içinde 3 kez hatırlatılır.
 *  Sabit saatler (yerel saat): 12:00, 14:00, 16:00. Uygulama o saatte açık değilse
 *  bir sonraki açılışta ilk fırsatta telafi edilir. */
export const REMINDER_HOURS = [12, 14, 16] as const;

interface RoundState {
  day: string;
  /** Bugün tamamlanan tur sayısı (0–3) */
  round: number;
}

function getRoundState(): RoundState {
  try {
    const raw = localStorage.getItem(ROUND_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RoundState>;
      if (typeof parsed.day === "string" && typeof parsed.round === "number") {
        return { day: parsed.day, round: parsed.round };
      }
    }
  } catch {}
  return { day: todayIso(), round: 0 };
}

function setRoundState(state: RoundState) {
  try {
    localStorage.setItem(ROUND_STATE_KEY, JSON.stringify(state));
  } catch {}
}


/* ─── Types ─── */
export interface PaymentReminder {
  payment: UpcomingPayment;
  daysLeft: number;
  urgency: "today" | "tomorrow" | "soon" | "overdue";
  message: string;
}

export interface CombinedReminder {
  kind: "payment" | "task";
  id: string;
  title: string;
  message: string;
  urgency: "today" | "tomorrow" | "soon" | "overdue";
  date?: string;
  amount?: number;
  dismissed?: boolean;
  read?: boolean;
}

/* ─── Core ─── */
export function getUpcomingReminders(): PaymentReminder[] {
  const data = getFinanceData();
  const reminders: PaymentReminder[] = [];

  for (const payment of data.upcomingPayments) {
    const paid = payment.paidAmount ?? 0;
    if (paid >= payment.amount) continue;

    const days = daysUntil(payment.dueDate);

    let urgency: PaymentReminder["urgency"];
    let message: string;

    if (days < 0) {
      urgency = "overdue";
      message = `${Math.abs(days)} gün gecikti!`;
    } else if (days === 0) {
      urgency = "today";
      message = "Bugün vadesi doluyor!";
    } else if (days === 1) {
      urgency = "tomorrow";
      message = "Yarın vadesi doluyor";
    } else if (days <= 3) {
      urgency = "soon";
      message = `${days} gün kaldı`;
    } else {
      continue;
    }

    reminders.push({ payment, daysLeft: days, urgency, message });
  }

  return reminders.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getTaskReminders(): TodoReminder[] {
  return getTodoReminders();
}

export function getAllReminders(): CombinedReminder[] {
  const payments = getUpcomingReminders();
  const tasks = getTaskReminders();
  const dismissed = getJsonSet(DISMISSED_KEY);
  const read = getJsonSet(READ_KEY);

  const combined: CombinedReminder[] = [
    ...payments.map((r) => ({
      kind: "payment" as const,
      id: r.payment.id,
      title: r.payment.label,
      message: r.message,
      urgency: r.urgency,
      date: r.payment.dueDate,
      amount: r.payment.amount,
      dismissed: dismissed.has(`payment-${r.payment.id}`),
      read: read.has(`payment-${r.payment.id}`),
    })),
    ...tasks.map((r) => ({
      kind: "task" as const,
      id: r.task.id,
      title: r.task.title,
      message: r.message,
      urgency: r.urgency,
      date: r.task.dueDate,
      dismissed: dismissed.has(`task-${r.task.id}`),
      read: read.has(`task-${r.task.id}`),
    })),
  ];

  return combined.sort((a, b) => {
    // Show non-dismissed first, then by urgency
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    const order = { overdue: 0, today: 1, tomorrow: 2, soon: 3 };
    return (order[a.urgency] ?? 4) - (order[b.urgency] ?? 4);
  });
}

/** Get only active (non-dismissed) reminders */
export function getActiveReminders(): CombinedReminder[] {
  return getAllReminders().filter((r) => !r.dismissed);
}

export function usePaymentReminders(): CombinedReminder[] {
  const [reminders, setReminders] = useState<CombinedReminder[]>([]);

  useEffect(() => {
    setReminders(getAllReminders());
    const interval = setInterval(() => {
      setReminders(getAllReminders());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return reminders;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/** Fire native OS notifications — günde 3 sabit tur (09:00 / 14:00 / 19:00).
 *  Her tur okunmamış + kapatılmamış tüm hatırlatmaları tek özet bildirimle hatırlatır.
 *  Ek olarak, bugün vadesi dolan/gecikmiş kalemler ilk kez ortaya çıktığında tur
 *  beklemeden hemen bildirilir (günde en fazla bir kez acil bildirim).
 */
export function fireNativeNotifications() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const reminders = getActiveReminders().filter((r) => !r.read);
  if (reminders.length === 0) return;

  const today = todayIso();
  const state = getRoundState();
  const roundsDone = state.day === today ? state.round : 0;

  // Vadesi gelen turlar: saat 09/14/19'u geçtiyse o tur yapılmalı
  const nowHour = new Date().getHours();
  const dueRounds = REMINDER_HOURS.filter((h) => nowHour >= h).length;
  const roundDue = dueRounds > roundsDone;

  // Acil kalem: bugün vadesi dolan/gecikmiş ve bugün henüz bildirilmemiş
  const urgentNotified = getJsonSet(URGENT_NOTIFIED_KEY);
  const urgent = reminders.filter(
    (r) =>
      (r.urgency === "today" || r.urgency === "overdue") &&
      !urgentNotified.has(`${r.kind}-${r.id}-${today}`),
  );

  if (!roundDue && urgent.length === 0) return;

  const fresh = roundDue ? reminders : urgent;

  // Tek özet bildirimi gönder (Windows bildirim ekranını doldurmasın)
  const payments = fresh.filter((r) => r.kind === "payment");
  const tasks = fresh.filter((r) => r.kind === "task");
  const parts: string[] = [];
  if (payments.length > 0) parts.push(`${payments.length} ödeme`);
  if (tasks.length > 0) parts.push(`${tasks.length} görev`);
  const first = fresh[0];
  const title =
    fresh.length === 1
      ? first.kind === "payment"
        ? "Mizan — Ödeme Hatırlatması"
        : "Mizan — Görev Hatırlatması"
      : `Mizan — ${parts.join(" · ")} hatırlatması`;

  let body: string;
  if (fresh.length === 1) {
    body = `${first.title}: ${first.message}`;
    if (first.kind === "payment" && first.amount !== undefined) {
      const data = getFinanceData();
      const payment = data.upcomingPayments.find((p) => p.id === first.id);
      body += `\nTutar: ${formatCurrency(first.amount, payment?.currency ?? "TRY")}`;
    }
  } else {
    body = fresh
      .slice(0, 4)
      .map((r) => `• ${r.title} — ${r.message}`)
      .join("\n");
    const extra = fresh.length - 4;
    if (extra > 0) body += `\n+${extra} kalem daha…`;
  }

  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `mizan-reminder-${today}-${roundsDone + 1}`,
    });
  } catch {}

  // Tur ve acil kayıtlarını işaretle
  if (roundDue) setRoundState({ day: today, round: dueRounds });
  for (const r of urgent) {
    urgentNotified.add(`${r.kind}-${r.id}-${today}`);
  }
  if (urgent.length > 0) saveJsonSet(urgentNotified, URGENT_NOTIFIED_KEY);
}

/* ─── Dismiss / Read / Clear ─── */

/**
 * Bildirim izni verilmemişse sessizce ister. Uygulama ilk açılışında çağrılır;
 * tarayıcı/Electron izin penceresini gösterir, kullanıcı verirse bildirimler akmaya başlar.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

/** Dismiss a single reminder (hide from list) */
export function dismissReminder(kind: "payment" | "task", id: string) {
  const dismissed = getJsonSet(DISMISSED_KEY);
  dismissed.add(`${kind}-${id}`);
  saveJsonSet(dismissed, DISMISSED_KEY);
}

/** Restore a dismissed reminder */
export function restoreReminder(kind: "payment" | "task", id: string) {
  const dismissed = getJsonSet(DISMISSED_KEY);
  dismissed.delete(`${kind}-${id}`);
  saveJsonSet(dismissed, DISMISSED_KEY);
}

/** Mark reminder as read */
export function markAsRead(kind: "payment" | "task", id: string) {
  const read = getJsonSet(READ_KEY);
  read.add(`${kind}-${id}`);
  saveJsonSet(read, READ_KEY);
}

/** Mark all as read */
export function markAllAsRead() {
  const reminders = getAllReminders();
  const read = getJsonSet(READ_KEY);
  for (const r of reminders) {
    if (!r.dismissed) {
      read.add(`${r.kind}-${r.id}`);
    }
  }
  saveJsonSet(read, READ_KEY);
}

/** Dismiss all */
export function dismissAll() {
  const reminders = getAllReminders();
  const dismissed = getJsonSet(DISMISSED_KEY);
  for (const r of reminders) {
    dismissed.add(`${r.kind}-${r.id}`);
  }
  saveJsonSet(dismissed, DISMISSED_KEY);
}

/** Restore all dismissed */
export function restoreAll() {
  saveJsonSet(new Set(), DISMISSED_KEY);
}

/** Clear all notification tracking */
export function clearAllNotificationData() {
  try {
    localStorage.removeItem(DISMISSED_KEY);
    localStorage.removeItem(READ_KEY);
    localStorage.removeItem(ROUND_STATE_KEY);
    localStorage.removeItem(URGENT_NOTIFIED_KEY);
    // Eski sürüm anahtarları (temizlik)
    localStorage.removeItem("mizan-notified-payments-v1");
    localStorage.removeItem("mizan-notified-todos-v1");
    localStorage.removeItem("mizan-last-native-notif-v1");
  } catch {}
}

export { getJsonSet as getNotifiedIds, saveJsonSet as saveNotifiedIds };
