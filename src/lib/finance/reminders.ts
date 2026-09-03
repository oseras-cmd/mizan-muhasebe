import { useEffect, useState } from "react";
import { todayIso } from "./format";
import { getFinanceData, getTodoReminders, type TodoReminder } from "./store";
import type { UpcomingPayment } from "./types";

/* ─── Storage Keys ─── */
const NOTIFIED_KEY = "mizan-notified-payments-v1";
const NOTIFIED_TODO_KEY = "mizan-notified-todos-v1";
const DISMISSED_KEY = "mizan-dismissed-notifications-v1";
const READ_KEY = "mizan-read-notifications-v1";
const LAST_NATIVE_NOTIF_KEY = "mizan-last-native-notif-v1";

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

function daysSinceLastNativeNotif(): number {
  try {
    const raw = localStorage.getItem(LAST_NATIVE_NOTIF_KEY);
    if (!raw) return 999;
    const last = new Date(raw);
    const now = new Date();
    return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

function markNativeNotifSent() {
  try {
    localStorage.setItem(LAST_NATIVE_NOTIF_KEY, new Date().toISOString());
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

/** Fire native OS notifications — max once per day */
export function fireNativeNotifications() {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  // Only once per day
  if (daysSinceLastNativeNotif() < 1) return;

  const reminders = getActiveReminders();
  const notified = getJsonSet(NOTIFIED_KEY);
  const notifiedTodo = getJsonSet(NOTIFIED_TODO_KEY);
  let firedAny = false;

  for (const r of reminders) {
    if (r.read) continue; // Don't re-notify read items

    const key = `${r.id}-${todayIso()}`;

    if (r.kind === "payment" && !notified.has(key)) {
      new Notification("Mizan — Ödeme Hatırlatması", {
        body: `${r.title}: ${r.message}${r.amount ? `\nTutar: ₺${r.amount.toLocaleString("tr-TR")}` : ""}`,
        icon: "/favicon.ico",
        tag: key,
      });
      notified.add(key);
      firedAny = true;
    }

    if (r.kind === "task" && !notifiedTodo.has(key)) {
      new Notification("Mizan — Görev Hatırlatması", {
        body: `${r.title}: ${r.message}`,
        icon: "/favicon.ico",
        tag: key,
      });
      notifiedTodo.add(key);
      firedAny = true;
    }
  }

  if (firedAny) {
    saveJsonSet(notified, NOTIFIED_KEY);
    saveJsonSet(notifiedTodo, NOTIFIED_TODO_KEY);
    markNativeNotifSent();
  }
}

/* ─── Dismiss / Read / Clear ─── */

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
    localStorage.removeItem(NOTIFIED_KEY);
    localStorage.removeItem(NOTIFIED_TODO_KEY);
    localStorage.removeItem(DISMISSED_KEY);
    localStorage.removeItem(READ_KEY);
    localStorage.removeItem(LAST_NATIVE_NOTIF_KEY);
  } catch {}
}

export { getJsonSet as getNotifiedIds, saveJsonSet as saveNotifiedIds };
