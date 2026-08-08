"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Clock3,
  Play,
  Loader2,
  Square,
  FolderKanban,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  taskPriorityLabels,
  taskPriorityRank,
} from "@/features/crm/types";
import type {
  CrmPriority,
  CrmProject,
  CrmProjectWorkEntry,
  CrmTask,
  CrmTeamMember,
  CrmTaskStatus,
  CrmTimerStatus,
} from "@/features/crm/types";

export function CrmStatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <Card className={cn(accent && "border-primary/30 bg-primary/[0.04]")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            {detail && (
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            )}
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const statusVariant: Record<string, BadgeProps["variant"]> = {
  active: "success",
  completed: "success",
  done: "success",
  working: "success",
  approved: "success",
  planning: "default",
  in_progress: "default",
  review: "warning",
  pending: "warning",
  on_break: "warning",
  on_hold: "warning",
  rejected: "destructive",
  offline: "secondary",
  absent: "destructive",
  inactive: "outline",
  todo: "secondary",
};

export function CrmBadge({ value }: { value: string }) {
  return (
    <Badge variant={statusVariant[value] ?? "outline"}>
      {value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: CrmPriority }) {
  const variant: BadgeProps["variant"] =
    priority === "p0"
      ? "destructive"
      : priority === "p1"
        ? "warning"
        : priority === "p2"
          ? "default"
          : "secondary";
  return <Badge variant={variant}>{taskPriorityLabels[priority]}</Badge>;
}

export function TaskPriorityBadge({ priority }: { priority: CrmPriority }) {
  const variant: BadgeProps["variant"] =
    priority === "p0"
      ? "destructive"
      : priority === "p1"
        ? "warning"
        : priority === "p2"
          ? "default"
          : "secondary";
  return <Badge variant={variant}>{taskPriorityLabels[priority]}</Badge>;
}

export function compareTaskPriority(a: CrmTask, b: CrmTask) {
  return taskPriorityRank[a.priority] - taskPriorityRank[b.priority];
}

export function CrmProgress({
  value,
  className,
  showLabel = true,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${safe}%` }}
        />
      </div>
      {showLabel && (
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
          {safe}%
        </span>
      )}
    </div>
  );
}

export function formatMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

export function formatDate(value: string | null) {
  if (!value) return "No date";
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
  );
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatTime(value: string | null) {
  const parsed = value ? new Date(value) : null;
  if (parsed && Number.isNaN(parsed.getTime())) return "Invalid time";
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed!);
}

export function TimerControls({
  status,
  busy,
  pendingAction,
  onAction,
}: {
  status: CrmTimerStatus | "idle";
  busy: boolean;
  pendingAction: "clock_in" | "end_break" | "clock_out" | null;
  onAction: (action: "clock_in" | "end_break" | "clock_out") => void;
}) {
  if (status === "idle" || status === "stopped") {
    return (
      <Button disabled={busy} onClick={() => onAction("clock_in")}>
        <Play className="h-4 w-4" /> Start work
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2" aria-busy={busy}>
      {status === "on_break" && (
        <Button
          disabled={busy}
          onClick={() => onAction("end_break")}
        >
          <Play className="h-4 w-4" /> Resume work
        </Button>
      )}
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => onAction("clock_out")}
        aria-label={pendingAction === "clock_out" ? "Stopping workday" : "Stop workday"}
      >
        {pendingAction === "clock_out" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Stopping…
          </>
        ) : (
          <>
            <Square className="h-4 w-4" /> Stop
          </>
        )}
      </Button>
    </div>
  );
}

export function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function FocusTimer({
  startedAt,
  compact = false,
}: {
  startedAt: string;
  compact?: boolean;
}) {
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  const startedMs = new Date(startedAt).getTime();
  const elapsed = Math.max(0, (now ?? startedMs) - startedMs);

  return (
    <span className={cn("tabular-nums", !compact && "font-mono font-semibold")}>
      {formatElapsed(elapsed)}
    </span>
  );
}

export function ActiveTimer({
  status,
  since,
  breakStartedAt = null,
  breakMinutes = 0,
  breakLabel = null,
}: {
  status: CrmTimerStatus | "idle";
  since: string | null;
  breakStartedAt?: string | null;
  breakMinutes?: number;
  breakLabel?: string | null;
}) {
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (status !== "working" && status !== "on_break") {
      setNow(null);
      return;
    }
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [status, since, breakStartedAt]);

  const clockInMs = since ? new Date(since).getTime() : Number.NaN;
  const breakStartMs = breakStartedAt
    ? new Date(breakStartedAt).getTime()
    : Number.NaN;
  const workEndMs =
    status === "on_break" && Number.isFinite(breakStartMs)
      ? breakStartMs
      : now;
  const workedMs =
    workEndMs !== null && Number.isFinite(clockInMs)
      ? workEndMs - clockInMs - breakMinutes * 60_000
      : 0;
  const currentBreakMs =
    status === "on_break" && now !== null && Number.isFinite(breakStartMs)
      ? now - breakStartMs
      : 0;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <span
          className={cn(
            "relative flex h-2.5 w-2.5 rounded-full",
            status === "working"
              ? "bg-success"
              : status === "on_break"
                ? "bg-warning"
                : "bg-muted-foreground/40",
          )}
        >
          {status === "working" && (
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-50" />
          )}
        </span>
        <Clock3 className="h-4 w-4 text-muted-foreground" />
        <span>
          {status === "working"
            ? `Working since ${formatTime(since)}`
            : status === "on_break"
              ? `On ${breakLabel || "General break"}`
              : "Not clocked in"}
        </span>
      </div>
      {(status === "working" || status === "on_break") && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Work timer
            </p>
            <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {now === null ? "00:00:00" : formatElapsed(workedMs)}
            </p>
          </div>
          {status === "on_break" && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-warning">
                Break timer
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums text-warning">
                {now === null ? "00:00:00" : formatElapsed(currentBreakMs)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectWorkControls({
  projects,
  tasks,
  activeEntry,
  attendanceStatus,
  busy,
  onStart,
  onStop,
}: {
  projects: CrmProject[];
  tasks: CrmTask[];
  activeEntry: CrmProjectWorkEntry | undefined;
  attendanceStatus: CrmTeamMember["attendanceStatus"] | undefined;
  busy: boolean;
  onStart: (projectId: string, taskId: string | null, note: string) => void;
  onStop: () => void;
}) {
  const availableProjects = React.useMemo(
    () => projects.filter((project) => project.status !== "completed"),
    [projects],
  );
  const [projectId, setProjectId] = React.useState(
    activeEntry?.projectId ?? availableProjects[0]?.id ?? "",
  );
  const availableTasks = React.useMemo(
    () =>
      tasks
        .filter(
          (task) => task.projectId === projectId && task.status !== "done",
        )
        .sort(compareTaskPriority),
    [projectId, tasks],
  );
  const [taskId, setTaskId] = React.useState(activeEntry?.taskId ?? "");
  const [note, setNote] = React.useState("");
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (activeEntry?.projectId) {
      setProjectId(activeEntry.projectId);
    }
  }, [activeEntry?.id, activeEntry?.projectId]);

  React.useEffect(() => {
    if (!availableProjects.some((project) => project.id === projectId)) {
      setProjectId(availableProjects[0]?.id ?? "");
    }
  }, [availableProjects, projectId]);

  React.useEffect(() => {
    if (activeEntry?.taskId) {
      setTaskId(activeEntry.taskId);
    }
  }, [activeEntry?.id, activeEntry?.taskId]);

  React.useEffect(() => {
    if (
      availableTasks.length > 0 &&
      !availableTasks.some((task) => task.id === taskId)
    ) {
      setTaskId(availableTasks[0]?.id ?? "");
    }
    if (availableTasks.length === 0 && taskId) {
      setTaskId("");
    }
  }, [availableTasks, taskId]);

  React.useEffect(() => {
    if (!activeEntry) {
      setNow(null);
      return;
    }
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [activeEntry]);

  const canTrack = attendanceStatus === "working";
  const isSameFocus =
    activeEntry?.projectId === projectId &&
    (activeEntry.taskId ?? "") === taskId;
  const elapsed = activeEntry
    ? Math.max(
        0,
        (now ?? new Date(activeEntry.startedAt).getTime()) -
          new Date(activeEntry.startedAt).getTime(),
      )
    : 0;

  if (availableProjects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        No active project is assigned to this login yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderKanban className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {activeEntry
              ? activeEntry.taskTitle || activeEntry.projectName
              : "Choose your project and task"}
          </p>
          <p className="text-xs text-muted-foreground">
            {activeEntry
              ? `Focused since ${formatTime(activeEntry.startedAt)} · ${formatElapsed(elapsed)}`
              : canTrack
                ? "Start a task timer to show your manager what you are working on."
                : attendanceStatus === "on_break"
                  ? "Resume your attendance timer before choosing a project."
                  : "Clock in before starting project work."}
          </p>
          {activeEntry?.note && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Note: {activeEntry.note}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[minmax(170px,0.8fr)_minmax(190px,1fr)_minmax(180px,1fr)_auto]">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger aria-label="Project to work on">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {availableProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={taskId || "__project__"}
          onValueChange={(value) =>
            setTaskId(value === "__project__" ? "" : value)
          }
        >
          <SelectTrigger aria-label="Task to work on">
            <SelectValue placeholder="Select task" />
          </SelectTrigger>
          <SelectContent>
            {availableTasks.length === 0 ? (
              <SelectItem value="__project__">General project work</SelectItem>
            ) : (
              availableTasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          placeholder="What are you working on? (optional)"
          aria-label="Project work note"
        />
        <div className="flex gap-2">
          <Button
            disabled={
              busy ||
              !canTrack ||
              !projectId ||
              (availableTasks.length > 0 && !taskId) ||
              isSameFocus
            }
            onClick={() => onStart(projectId, taskId || null, note)}
          >
            <Play className="h-4 w-4" />
            {activeEntry ? "Switch" : "Start"}
          </Button>
          {activeEntry && (
            <Button variant="secondary" disabled={busy} onClick={onStop}>
              <Square className="h-4 w-4" /> Stop
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export const taskStatusOptions: { value: CrmTaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "In review" },
  { value: "done", label: "Done" },
];
