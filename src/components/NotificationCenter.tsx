import { Button } from "@/components/ui/button";
import { formatTRY, todayIso } from "@/lib/finance/format";
import {
  getActiveReminders,
  getAllReminders,
  requestNotificationPermission,
  dismissReminder,
  restoreReminder,
  markAsRead,
  markAllAsRead,
  dismissAll,
  restoreAll,
  type CombinedReminder,
} from "@/lib/finance/reminders";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckSquare,
  X,
  Wallet,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCheck,
  Trash2,
  Filter,
} from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { fireNativeNotifications, ensureNotificationPermission } from "@/lib/finance/reminders";

/* ─── Urgency Styling ─── */
function urgencyBadge(urgency: CombinedReminder["urgency"]) {
  switch (urgency) {
    case "overdue":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "today":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    case "tomorrow":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "soon":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  }
}

function urgencyIcon(urgency: CombinedReminder["urgency"]) {
  switch (urgency) {
    case "overdue":
      return <AlertTriangle className="size-3.5" />;
    case "today":
      return <Clock className="size-3.5" />;
    case "tomorrow":
      return <CalendarClock className="size-3.5" />;
    case "soon":
      return <CalendarClock className="size-3.5" />;
  }
}

function urgencyLabel(urgency: CombinedReminder["urgency"]) {
  switch (urgency) {
    case "overdue":
      return "Gecikmiş";
    case "today":
      return "Bugün";
    case "tomorrow":
      return "Yarın";
    case "soon":
      return "Yakın";
  }
}

type TabFilter = "all" | "payment" | "task";

export function NotificationCenter() {
  const reminders = getAllReminders();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<TabFilter>("all");
  const [notifEnabled, setNotifEnabled] = useState(
    () => typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const activeReminders = reminders.filter((r) => !r.dismissed);
  const dismissedReminders = reminders.filter((r) => r.dismissed);
  const [showDismissed, setShowDismissed] = useState(false);

  const unreadCount = activeReminders.filter((r) => !r.read).length;
  const totalCount = activeReminders.length;

  // Uygulama açılışında izni sessizce iste, ardından hatırlatma turlarını başlat.
  // fireNativeNotifications kendi içinde günde 3-4 tur limiti uygular.
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      await ensureNotificationPermission();
      if (!cancelled) fireNativeNotifications();
    };
    boot();
    const interval = setInterval(fireNativeNotifications, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filteredReminders = showDismissed
    ? dismissedReminders.filter((r) => tab === "all" || r.kind === tab)
    : activeReminders.filter((r) => tab === "all" || r.kind === tab);

  const handleEnableNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotifEnabled(granted);
  }, []);

  const handleDismiss = useCallback((kind: "payment" | "task", id: string) => {
    dismissReminder(kind, id);
    // Force re-render by updating state
    setIsOpen((prev) => prev);
  }, []);

  const handleRestore = useCallback((kind: "payment" | "task", id: string) => {
    restoreReminder(kind, id);
    setIsOpen((prev) => prev);
  }, []);

  const handleRead = useCallback((kind: "payment" | "task", id: string) => {
    markAsRead(kind, id);
    setIsOpen((prev) => prev);
  }, []);

  const handleReadAll = useCallback(() => {
    markAllAsRead();
    setIsOpen((prev) => prev);
  }, []);

  const handleDismissAll = useCallback(() => {
    dismissAll();
    setIsOpen((prev) => prev);
  }, []);

  const handleRestoreAll = useCallback(() => {
    restoreAll();
    setIsOpen((prev) => prev);
  }, []);

  const handleNavigate = useCallback(
    (kind: "payment" | "task") => {
      setIsOpen(false);
      if (kind === "payment") navigate("/odemeler");
      else navigate("/gorevler");
    },
    [navigate],
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative size-9 text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Bildirimler${unreadCount > 0 ? ` — ${unreadCount} okunmamış` : ""}`}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white animate-in fade-in zoom-in duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="border-b border-border/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Hatırlatmalar
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {unreadCount > 0
                    ? `${unreadCount} okunmamış · ${totalCount} toplam`
                    : totalCount > 0
                      ? `${totalCount} aktif hatırlatma`
                      : "Hatırlatma yok"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-emerald-600"
                    onClick={handleReadAll}
                    title="Tümünü okundu işaretle"
                  >
                    <CheckCheck className="size-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-3 flex gap-1 rounded-lg bg-muted/50 p-0.5">
              {([
                { key: "all" as TabFilter, label: "Tümü" },
                { key: "payment" as TabFilter, label: "Ödemeler" },
                { key: "task" as TabFilter, label: "Görevler" },
              ]).map((t) => {
                const count = showDismissed
                  ? dismissedReminders.filter((r) => t.key === "all" || r.kind === t.key).length
                  : activeReminders.filter((r) => t.key === "all" || r.kind === t.key).length;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={cn(
                      "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                      tab === t.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                    {count > 0 && (
                      <span className="ml-1 text-[10px] opacity-60">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notification Permission Banner */}
          {!notifEnabled && (
            <div className="border-b border-border/50 bg-muted/20 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <BellOff className="size-3.5 shrink-0 text-muted-foreground" />
                <p className="flex-1 text-[11px] text-muted-foreground">
                  OS bildirimleri kapalı. Açmak ister misiniz?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-[11px]"
                  onClick={handleEnableNotifications}
                >
                  Aç
                </Button>
              </div>
            </div>
          )}

          {/* Reminder List */}
          {filteredReminders.length === 0 ? (
            <div className="px-4 py-10 text-center">
              {showDismissed ? (
                <>
                  <CheckCircle2 className="mx-auto size-6 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kapatılmış hatırlatma yok
                  </p>
                </>
              ) : (
                <>
                  <BellOff className="mx-auto size-6 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {tab === "all"
                      ? "Yaklaşan hatırlatma yok"
                      : tab === "payment"
                        ? "Yaklaşan ödeme hatırlatması yok"
                        : "Yaklaşan görev hatırlatması yok"}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground/50">
                    Ödemeler ve görevler vadesine yaklaştığında burada görünecek
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {filteredReminders.map((reminder) => (
                <li
                  key={`${reminder.kind}-${reminder.id}`}
                  className={cn(
                    "group border-b border-border/30 transition-colors",
                    reminder.read
                      ? "bg-transparent opacity-70 hover:opacity-100"
                      : reminder.kind === "payment"
                        ? "bg-blue-500/[0.03] hover:bg-blue-500/[0.06]"
                        : "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]",
                  )}
                >
                  <div className="flex items-start gap-3 px-4 py-3">
                    {/* Urgency indicator */}
                    <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full border",
                          urgencyBadge(reminder.urgency),
                        )}
                      >
                        {urgencyIcon(reminder.urgency)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {reminder.kind === "payment" ? (
                          <Wallet className="size-3 shrink-0 text-blue-500" />
                        ) : (
                          <CheckSquare className="size-3 shrink-0 text-emerald-500" />
                        )}
                        <p
                          className={cn(
                            "truncate text-[13px] font-medium text-foreground",
                            !reminder.read && "font-semibold",
                          )}
                        >
                          {reminder.title}
                        </p>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium",
                            urgencyBadge(reminder.urgency),
                          )}
                        >
                          {urgencyLabel(reminder.urgency)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {reminder.message}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        {reminder.amount !== undefined && (
                          <span className="font-medium tabular-nums">
                            {formatTRY(reminder.amount)}
                          </span>
                        )}
                        {reminder.date && (
                          <span>
                            {new Date(reminder.date).toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!reminder.read && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-emerald-600"
                          onClick={() => handleRead(reminder.kind, reminder.id)}
                          title="Okundu işaretle"
                        >
                          <Eye className="size-3" />
                        </Button>
                      )}
                      {showDismissed ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-blue-500"
                          onClick={() => handleRestore(reminder.kind, reminder.id)}
                          title="Geri yükle"
                        >
                          <RotateCcw className="size-3" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDismiss(reminder.kind, reminder.id)}
                          title="Kapat"
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Footer */}
          <div className="border-t border-border/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Toggle dismissed */}
                {dismissedReminders.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setShowDismissed(!showDismissed)}
                  >
                    {showDismissed ? (
                      <>
                        <EyeOff className="size-3" />
                        Aktif olanlar
                      </>
                    ) : (
                      <>
                        <Eye className="size-3" />
                        Kapatılanlar ({dismissedReminders.length})
                      </>
                    )}
                  </Button>
                )}

                {showDismissed && dismissedReminders.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:text-emerald-600"
                    onClick={handleRestoreAll}
                  >
                    <RotateCcw className="size-3" />
                    Tümünü Geri Yükle
                  </Button>
                )}
              </div>

              {!showDismissed && activeReminders.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={handleDismissAll}
                >
                  <Trash2 className="size-3" />
                  Tümünü Kapat
                </Button>
              )}
            </div>

            {/* Navigate to page */}
            {!showDismissed && activeReminders.length > 0 && (
              <div className="mt-1 flex gap-1">
                {activeReminders.some((r) => r.kind === "payment") && (
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-muted/50 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => handleNavigate("payment")}
                  >
                    <Wallet className="size-3" />
                    Ödemelere Git
                    <ChevronRight className="size-3" />
                  </button>
                )}
                {activeReminders.some((r) => r.kind === "task") && (
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-muted/50 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => handleNavigate("task")}
                  >
                    <CheckSquare className="size-3" />
                    Görevlere Git
                    <ChevronRight className="size-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
