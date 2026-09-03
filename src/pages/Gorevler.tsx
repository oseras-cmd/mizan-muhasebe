import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useFinanceData } from "@/lib/finance/store";
import {
  addTodo,
  addTodoSection,
  addSubtask,
  toggleTodoComplete,
  toggleSubtask,
  deleteTodo,
  deleteSubtask,
  deleteTodoSection,
  updateTodo,
  updateTodoSection,
} from "@/lib/finance/store";
import type { TodoPriority, TodoTask, TodoSection, RecurringType } from "@/lib/finance/types";
import { TODO_PRIORITY_LABELS, TODO_PRIORITY_COLORS, RECURRING_LABELS } from "@/lib/finance/types";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow, addDays, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Plus,
  Check,
  Circle,
  CircleCheck,
  Calendar,
  ChevronDown,
  ChevronRight,
  Trash2,
  Pencil,
  Flag,
  Tag,
  LayoutList,
  ListChecks,
  X,
  Search,
  SortAsc,
  Clock,
  CheckCircle2,
  Inbox,
  Timer,
  Repeat,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type FilterType = "all" | "today" | "upcoming" | "completed";
type SortType = "date" | "priority" | "name";

const SECTION_COLORS = [
  "#6366f1", "#ef4444", "#22c55e", "#f97316", "#a855f7",
  "#06b6d4", "#eab308", "#ec4899", "#84cc16", "#64748b",
];

function dueLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Bugün";
  if (isTomorrow(date)) return "Yarın";
  if (isPast(date)) return "Gecikmiş";
  return format(date, "d MMM", { locale: tr });
}

function dueDateClass(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isPast(date) && !isToday(date)) return "text-red-500 font-medium";
  if (isToday(date)) return "text-orange-500 font-medium";
  if (isTomorrow(date)) return "text-blue-500";
  return "text-muted-foreground";
}

function TodoItem({
  task,
  sections,
}: {
  task: TodoTask;
  sections: TodoSection[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description ?? "");
  const [editPriority, setEditPriority] = useState<TodoPriority>(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.dueDate ?? "");
  const [editSection, setEditSection] = useState(task.sectionId ?? "");
  const [editEstimatedHours, setEditEstimatedHours] = useState(task.estimatedHours?.toString() ?? "");
  const [editActualHours, setEditActualHours] = useState(task.actualHours?.toString() ?? "");
  const [editStartTime, setEditStartTime] = useState(task.startTime ?? "");
  const [editEndTime, setEditEndTime] = useState(task.endTime ?? "");
  const [editRecurringType, setEditRecurringType] = useState<RecurringType>(task.recurringType ?? "yok");
  const [editRecurringEndDate, setEditRecurringEndDate] = useState(task.recurringEndDate ?? "");
  const [editReminderDays, setEditReminderDays] = useState(task.reminderDays?.toString() ?? "1");
  const [newSubtask, setNewSubtask] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);

  const completedSubs = task.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubs = task.subtasks?.length ?? 0;

  const handleSave = () => {
    if (!editTitle.trim()) return;
    updateTodo(task.id, {
      title: editTitle.trim(),
      description: editDesc.trim() || undefined,
      priority: editPriority,
      dueDate: editDueDate || undefined,
      sectionId: editSection || undefined,
      estimatedHours: editEstimatedHours ? parseFloat(editEstimatedHours) : undefined,
      actualHours: editActualHours ? parseFloat(editActualHours) : undefined,
      startTime: editStartTime || undefined,
      endTime: editEndTime || undefined,
      recurringType: editRecurringType,
      recurringEndDate: editRecurringType !== "yok" ? editRecurringEndDate || undefined : undefined,
      reminderDays: editReminderDays ? parseInt(editReminderDays) : undefined,
    });
    setEditing(false);
    toast.success("Görev güncellendi");
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    addSubtask(task.id, newSubtask.trim());
    setNewSubtask("");
    toast.success("Alt görev eklendi");
  };

  return (
    <div
      className={cn(
        "group rounded-lg border border-border/60 bg-card transition-all hover:border-border",
        task.completed && "opacity-60",
        !task.completed && task.dueDate && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate))
          ? "border-l-2 border-l-red-400"
          : ""
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => toggleTodoComplete(task.id)}
          className="mt-0.5 shrink-0"
          aria-label={task.completed ? "Görevi geri al" : "Görevi tamamla"}
        >
          {task.completed ? (
            <CircleCheck className="size-5 text-green-500" />
          ) : (
            <Circle className="size-5 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm leading-snug",
                task.completed && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </span>
            {/* Priority flag */}
            {task.priority <= 2 && (
              <Flag className={cn("size-3.5 shrink-0", TODO_PRIORITY_COLORS[task.priority])} />
            )}
            {/* Recurring badge */}
            {task.recurringType && task.recurringType !== "yok" && (
              <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                <Repeat className="size-2.5" />
                {RECURRING_LABELS[task.recurringType]}
              </span>
            )}
            {/* Reminder badge */}
            {task.reminderDays !== undefined && task.reminderDays !== null && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                <Bell className="size-2.5" />
                {task.reminderDays}g önce
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.dueDate && (
              <span className={cn("flex items-center gap-1", dueDateClass(task.dueDate))}>
                <Calendar className="size-3" />
                {dueLabel(task.dueDate)}
              </span>
            )}
            {task.labels?.map((label) => (
              <span key={label} className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium">
                <Tag className="size-2.5" />
                {label}
              </span>
            ))}
            {totalSubs > 0 && (
              <span className="flex items-center gap-1">
                <ListChecks className="size-3" />
                {completedSubs}/{totalSubs}
              </span>
            )}
            {/* Time tracking */}
            {task.estimatedHours !== undefined && (
              <span className="flex items-center gap-1">
                <Timer className="size-3" />
                {task.estimatedHours}h tahmini
                {task.actualHours !== undefined && (
                  <span className="text-muted-foreground">/ {task.actualHours}h gerçek</span>
                )}
              </span>
            )}
            {task.startTime && task.endTime && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                {task.startTime}–{task.endTime}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {totalSubs > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setEditing(!editing);
              setExpanded(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => {
              deleteTodo(task.id);
              toast.success("Görev silindi");
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded: subtasks + edit */}
      {(expanded || editing) && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3">
          {/* Edit form */}
          {editing && (
            <div className="space-y-2 rounded-md bg-muted/30 p-3">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Görev başlığı"
                className="h-8 text-sm"
              />
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Açıklama (isteğe bağlı)"
                className="h-8 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(Number(e.target.value) as TodoPriority)}
                  className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <option value={0}>🔴 Yüksek</option>
                  <option value={1}>🔴 Yüksek</option>
                  <option value={2}>🟠 Orta</option>
                  <option value={3}>🔵 Düşük</option>
                  <option value={4}>⚪ Normal</option>
                </select>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <select
                value={editSection}
                onChange={(e) => setEditSection(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
              >
                <option value="">Bölüm yok</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {/* Time tracking */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tahmini süre (saat)</label>
                  <Input type="number" step="0.5" min="0" value={editEstimatedHours} onChange={(e) => setEditEstimatedHours(e.target.value)} placeholder="0" className="h-7 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Gerçek süre (saat)</label>
                  <Input type="number" step="0.5" min="0" value={editActualHours} onChange={(e) => setEditActualHours(e.target.value)} placeholder="0" className="h-7 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Başlangıç saati</label>
                  <Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bitiş saati</label>
                  <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="h-7 text-xs" />
                </div>
              </div>
              {/* Recurring */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tekrarlama</label>
                  <select value={editRecurringType} onChange={(e) => setEditRecurringType(e.target.value as RecurringType)} className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                    {Object.entries(RECURRING_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                {editRecurringType !== "yok" && (
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bitiş tarihi</label>
                    <Input type="date" value={editRecurringEndDate} onChange={(e) => setEditRecurringEndDate(e.target.value)} className="h-7 text-xs" />
                  </div>
                )}
              </div>
              {/* Reminder */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hatırlatma (gün)</label>
                  <select value={editReminderDays} onChange={(e) => setEditReminderDays(e.target.value)} className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                    <option value="0">Bugün</option>
                    <option value="1">1 gün önce</option>
                    <option value="2">2 gün önce</option>
                    <option value="3">3 gün önce</option>
                    <option value="7">7 gün önce</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="h-7 text-xs" onClick={handleSave}>
                  Kaydet
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
                  İptal
                </Button>
              </div>
            </div>
          )}

          {/* Subtasks */}
          {(expanded || task.subtasks?.length) && !editing && (
            <div className="space-y-1">
              {task.subtasks?.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 group/sub">
                  <button
                    type="button"
                    onClick={() => toggleSubtask(task.id, sub.id)}
                    className="shrink-0"
                  >
                    {sub.completed ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground hover:text-foreground transition-colors" />
                    )}
                  </button>
                  <span className={cn("text-xs flex-1", sub.completed && "line-through text-muted-foreground")}>
                    {sub.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteSubtask(task.id, sub.id)}
                    className="opacity-0 group-hover/sub:opacity-100 shrink-0"
                  >
                    <X className="size-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              {/* Add subtask */}
              {showSubtaskInput ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Alt görev ekle..."
                    className="h-7 text-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSubtask();
                      if (e.key === "Escape") setShowSubtaskInput(false);
                    }}
                  />
                  <Button type="button" size="sm" className="h-7 text-xs" onClick={handleAddSubtask}>
                    Ekle
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-1"
                  onClick={() => setShowSubtaskInput(true)}
                >
                  <Plus className="size-3" />
                  Alt görev ekle
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Gorevler() {
  const data = useFinanceData();
  const { todos, todoSections } = data;

  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("date");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Add task
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TodoPriority>(4);
  const [newDueDate, setNewDueDate] = useState("");
  const [newSection, setNewSection] = useState<string>("");
  const [newEstHours, setNewEstHours] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newRecurringType, setNewRecurringType] = useState<RecurringType>("yok");
  const [newRecurringEndDate, setNewRecurringEndDate] = useState("");
  const [newReminderDays, setNewReminderDays] = useState("1");
  const [showAddForm, setShowAddForm] = useState(false);

  // Add section
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionColor, setNewSectionColor] = useState(SECTION_COLORS[0]);

  const handleAddTodo = () => {
    if (!newTitle.trim()) return;
    addTodo({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      priority: newPriority,
      dueDate: newDueDate || undefined,
      sectionId: newSection || undefined,
      estimatedHours: newEstHours ? parseFloat(newEstHours) : undefined,
      startTime: newStartTime || undefined,
      endTime: newEndTime || undefined,
      recurringType: newRecurringType,
      recurringEndDate: newRecurringType !== "yok" ? newRecurringEndDate || undefined : undefined,
      reminderDays: newReminderDays ? parseInt(newReminderDays) : undefined,
    });
    setNewTitle("");
    setNewDesc("");
    setNewPriority(4);
    setNewDueDate("");
    setNewEstHours("");
    setNewStartTime("");
    setNewEndTime("");
    setNewRecurringType("yok");
    setNewRecurringEndDate("");
    setNewReminderDays("1");
    setShowAddForm(false);
    toast.success("Görev eklendi");
  };

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    addTodoSection(newSectionName.trim(), newSectionColor);
    setNewSectionName("");
    setShowAddSection(false);
    toast.success("Bölüm eklendi");
  };

  // Filter and sort
  const filteredTodos = useMemo(() => {
    let result = [...todos];

    // Section filter
    if (selectedSection) {
      result = result.filter((t) => t.sectionId === selectedSection);
    }

    // Status filter
    if (filter === "today") {
      result = result.filter((t) => t.dueDate && isToday(parseISO(t.dueDate)) && !t.completed);
    } else if (filter === "upcoming") {
      const today = new Date();
      const weekLater = addDays(today, 7);
      result = result.filter(
        (t) => t.dueDate && !t.completed && parseISO(t.dueDate) <= weekLater
      );
    } else if (filter === "completed") {
      result = result.filter((t) => t.completed);
    } else {
      // "all" — show incomplete by default
      if (!showCompleted) {
        result = result.filter((t) => !t.completed);
      }
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.labels?.some((l) => l.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sort === "priority") return a.priority - b.priority;
      if (sort === "name") return a.title.localeCompare(b.title, "tr");
      // date
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    return result;
  }, [todos, filter, sort, searchQuery, selectedSection, showCompleted]);

  // Stats
  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const today = todos.filter((t) => t.dueDate && isToday(parseISO(t.dueDate)) && !t.completed).length;
    const overdue = todos.filter(
      (t) => !t.completed && t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate))
    ).length;
    return { total, completed, today, overdue };
  }, [todos]);

  // Group by section
  const groupedBySection = useMemo(() => {
    if (selectedSection || filter !== "all") return null;
    const map = new Map<string | undefined, TodoTask[]>();
    // Sectionless first
    const sectionLess = filteredTodos.filter((t) => !t.sectionId);
    if (sectionLess.length > 0) map.set(undefined, sectionLess);
    for (const section of todoSections) {
      const items = filteredTodos.filter((t) => t.sectionId === section.id);
      if (items.length > 0) map.set(section.id, items);
    }
    return map;
  }, [filteredTodos, todoSections, selectedSection, filter]);

  return (
    <div className="min-h-screen bg-background pl-64 text-foreground">
      <AppHeader />
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <LayoutList className="size-5 text-muted-foreground" />
            Görevler
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.total} görev · {stats.completed} tamamlandı · {stats.overdue} gecikmiş
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="size-3.5" />
          Yeni Görev
        </Button>
      </div>

      {/* Add task form */}
      {showAddForm && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4 space-y-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ne yapılacak?"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleAddTodo();
              if (e.key === "Escape") setShowAddForm(false);
            }}
          />
          <Input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Açıklama (isteğe bağlı)"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(Number(e.target.value) as TodoPriority)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
            >
              <option value={0}>🔴 Yüksek</option>
              <option value={1}>🔴 Yüksek</option>
              <option value={2}>🟠 Orta</option>
              <option value={3}>🔵 Düşük</option>
              <option value={4}>⚪ Normal</option>
            </select>
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-9 text-xs"
            />
            <select
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
            >
              <option value="">Bölüm yok</option>
              {todoSections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {/* Time & recurrence */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tahmini süre (saat)</label>
              <Input type="number" step="0.5" min="0" value={newEstHours} onChange={(e) => setNewEstHours(e.target.value)} placeholder="0" className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Başlangıç</label>
              <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bitiş</label>
              <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tekrarlama</label>
              <select value={newRecurringType} onChange={(e) => setNewRecurringType(e.target.value as RecurringType)} className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                {Object.entries(RECURRING_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            {newRecurringType !== "yok" && (
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bitiş tarihi</label>
                <Input type="date" value={newRecurringEndDate} onChange={(e) => setNewRecurringEndDate(e.target.value)} className="h-8 text-xs" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hatırlatma</label>
              <select value={newReminderDays} onChange={(e) => setNewReminderDays(e.target.value)} className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                <option value="0">Bugün</option>
                <option value="1">1 gün önce</option>
                <option value="2">2 gün önce</option>
                <option value="3">3 gün önce</option>
                <option value="7">7 gün önce</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAddTodo}>
              Ekle
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              İptal
            </Button>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => { setFilter("all"); setSelectedSection(null); }}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
            filter === "all" && !selectedSection
              ? "border-foreground/20 bg-muted/50 text-foreground"
              : "border-border/60 text-muted-foreground hover:bg-muted/30"
          )}
        >
          <Inbox className="size-3.5" />
          <span className="font-medium">{stats.total - stats.completed}</span>
          <span className="text-muted-foreground">görev</span>
        </button>
        <button
          type="button"
          onClick={() => { setFilter("today"); setSelectedSection(null); }}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
            filter === "today"
              ? "border-orange-300 bg-orange-500/10 text-orange-600"
              : "border-border/60 text-muted-foreground hover:bg-muted/30"
          )}
        >
          <Clock className="size-3.5" />
          <span className="font-medium">{stats.today}</span>
          <span className="text-muted-foreground">bugün</span>
        </button>
        <button
          type="button"
          onClick={() => { setFilter("upcoming"); setSelectedSection(null); }}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
            filter === "upcoming"
              ? "border-blue-300 bg-blue-500/10 text-blue-600"
              : "border-border/60 text-muted-foreground hover:bg-muted/30"
          )}
        >
          <Calendar className="size-3.5" />
          <span className="font-medium">7 gün</span>
        </button>
        <button
          type="button"
          onClick={() => { setFilter("completed"); setSelectedSection(null); }}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
            filter === "completed"
              ? "border-green-300 bg-green-500/10 text-green-600"
              : "border-border/60 text-muted-foreground hover:bg-muted/30"
          )}
        >
          <CheckCircle2 className="size-3.5" />
          <span className="font-medium">{stats.completed}</span>
          <span className="text-muted-foreground">tamam</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Görev ara..."
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortType)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
        >
          <option value="date">📅 Tarihe göre</option>
          <option value="priority">🏁 Önceliğe göre</option>
          <option value="name">🔤 Ada göre</option>
        </select>

        {/* Add section */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => setShowAddSection(!showAddSection)}
        >
          <Plus className="size-3" />
          Bölüm
        </Button>
      </div>

      {/* Add section form */}
      {showAddSection && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-3">
          <Input
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="Bölüm adı"
            className="h-8 flex-1 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSection();
              if (e.key === "Escape") setShowAddSection(false);
            }}
          />
          <div className="flex gap-1">
            {SECTION_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  "size-5 rounded-full border-2 transition-transform hover:scale-110",
                  newSectionColor === color ? "border-foreground scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
                onClick={() => setNewSectionColor(color)}
              />
            ))}
          </div>
          <Button type="button" size="sm" className="h-8 text-xs" onClick={handleAddSection}>
            Ekle
          </Button>
        </div>
      )}

      {/* Section filters (sidebar-like) */}
      {todoSections.length > 0 && filter === "all" && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedSection(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selectedSection === null
                ? "border-foreground/20 bg-muted text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-muted/30"
            )}
          >
            Tümü
          </button>
          {todoSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setSelectedSection(selectedSection === section.id ? null : section.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                selectedSection === section.id
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-muted/30"
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: section.color }} />
              {section.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTodoSection(section.id);
                  setSelectedSection(null);
                  toast.success("Bölüm silindi");
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-2.5" />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Task list */}
      <div className="space-y-4">
        {groupedBySection ? (
          // Grouped view
          Array.from(groupedBySection.entries()).map(([sectionId, tasks]) => {
            const section = todoSections.find((s) => s.id === sectionId);
            return (
              <div key={sectionId ?? "none"}>
                {section && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: section.color }} />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.name}
                    </h3>
                    <span className="text-[10px] text-muted-foreground">({tasks.length})</span>
                  </div>
                )}
                {!section && todoSections.length > 0 && tasks.length > 0 && (
                  <div className="mb-2 flex items-center gap-2">
                    <Inbox className="size-3 text-muted-foreground" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Bölüm yok
                    </h3>
                    <span className="text-[10px] text-muted-foreground">({tasks.length})</span>
                  </div>
                )}
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TodoItem key={task.id} task={task} sections={todoSections} />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Flat view
          <div className="space-y-2">
            {filteredTodos.map((task) => (
              <TodoItem key={task.id} task={task} sections={todoSections} />
            ))}
          </div>
        )}

        {filteredTodos.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 p-12 text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {searchQuery
                ? "Aramanızla eşleşen görev bulunamadı"
                : filter === "completed"
                  ? "Henüz tamamlanmış görev yok"
                  : "Bu kategoride görev yok"
              }
            </p>
            {!searchQuery && filter !== "completed" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 gap-1 text-xs"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="size-3" />
                Yeni görev ekle
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
