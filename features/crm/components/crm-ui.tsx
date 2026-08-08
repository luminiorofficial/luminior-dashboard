"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CrmPriority,
  CrmProjectStatus,
  CrmTaskStatus,
  CrmTimerStatus,
} from "@/features/crm/types";

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid time";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function compareTaskPriority(
  a: { priority: CrmPriority },
  b: { priority: CrmPriority },
): number {
  const priorityRank: Record<CrmPriority, number> = {
    p0: 0,
    p1: 1,
    p2: 2,
    p3: 3,
  };
  return priorityRank[a.priority] - priorityRank[b.priority];
}

export const taskStatusOptions = [
  { value: "todo" as CrmTaskStatus, label: "To do" },
  { value: "in_progress" as CrmTaskStatus, label: "In progress" },
  { value: "review" as CrmTaskStatus, label: "In review" },
  { value: "done" as CrmTaskStatus, label: "Done" },
];

export function CrmBadge({ value }: { value: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    planning: { bg: "bg-slate-100", text: "text-slate-700" },
    active: { bg: "bg-blue-100", text: "text-blue-700" },
    on_hold: { bg: "bg-amber-100", text: "text-amber-700" },
    completed: { bg: "bg-green-100", text: "text-green-700" },
    todo: { bg: "bg-slate-100", text: "text-slate-700" },
    in_progress: { bg: "bg-blue-100", text: "text-blue-700" },
    review: { bg: "bg-amber-100", text: "text-amber-700" },
    done: { bg: "bg-green-100", text: "text-green-700" },
    working: { bg: "bg-green-100", text: "text-green-700" },
    on_break: { bg: "bg-yellow-100", text: "text-yellow-700" },
    stopped: { bg: "bg-slate-100", text: "text-slate-700" },
    absent: { bg: "bg-slate-100", text: "text-slate-700" },
    inactive: { bg: "bg-gray-100", text: "text-gray-700" },
    offline: { bg: "bg-slate-100", text: "text-slate-700" },
  };

  const color = colors[value] || { bg: "bg-slate-100", text: "text-slate-700" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        color.bg,
        color.text,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function TaskPriorityBadge({ priority }: { priority: CrmPriority }) {
  const colors: Record<CrmPriority, { bg: string; text: string }> = {
    p0: { bg: "bg-red-100", text: "text-red-700" },
    p1: { bg: "bg-orange-100", text: "text-orange-700" },
    p2: { bg: "bg-yellow-100", text: "text-yellow-700" },
    p3: { bg: "bg-green-100", text: "text-green-700" },
  };

  const color = colors[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        color.bg,
        color.text,
      )}
    >
      {priority}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: CrmPriority }) {
  return <TaskPriorityBadge priority={priority} />;
}

export function CrmProgress({
  value,
  className = "",
  showLabel = true,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">Progress</span>
        {showLabel && <span className="text-muted-foreground">{value}%</span>}
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-blue-500 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function CrmStatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        accent
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-white",
      )}
    >
      <Icon className={cn("h-5 w-5 mb-2", accent ? "text-blue-600" : "text-slate-600")} />
      <p className={cn("text-2xl font-bold", accent ? "text-blue-900" : "text-slate-900")}>
        {value}
      </p>
      <p className="text-xs text-slate-600 mt-1">{label}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function FocusTimer({ startedAt, compact }: { startedAt: string; compact?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = new Date(startedAt);
    if (Number.isNaN(started.getTime())) return;

    const timer = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - started.getTime();
      setElapsed(Math.floor(diff / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startedAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  if (compact) {
    if (hours > 0) return <span>{hours}h {minutes}m</span>;
    return <span>{minutes}m {seconds}s</span>;
  }

  return (
    <span className="font-mono">
      {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
      {String(seconds).padStart(2, "0")}
    </span>
  );
}

export function ActiveTimer({
  status,
  since,
  breakStartedAt,
  breakMinutes,
  breakLabel,
}: {
  status: "working" | "on_break" | "stopped";
  since: string | null;
  breakStartedAt: string | null;
  breakMinutes: number;
  breakLabel: string | null;
}) {
  if (!since || status === "stopped") {
    return <p className="text-sm text-slate-600">Not clocked in</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 rounded-full bg-green-500">
          <span className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-50" />
        </span>
        <span className="text-sm font-medium">
          {status === "on_break" ? "On break" : "Working"}
        </span>
      </div>
      <FocusTimer
        startedAt={status === "on_break" && breakStartedAt ? breakStartedAt : since}
        compact
      />
      {status === "on_break" && breakLabel && (
        <span className="text-xs text-slate-500">· {breakLabel}</span>
      )}
    </div>
  );
}

export function TimerControls({
  status,
  busy,
  pendingAction,
  onAction,
}: {
  status: "working" | "on_break" | "stopped";
  busy: boolean;
  pendingAction: "clock_in" | "end_break" | "clock_out" | null;
  onAction: (action: "clock_in" | "end_break" | "clock_out") => void;
}) {
  const isClocking = pendingAction === "clock_in" || pendingAction === "clock_out";

  if (status === "stopped") {
    return (
      <button
        disabled={busy}
        onClick={() => onAction("clock_in")}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {pendingAction === "clock_in" && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
        Clock in
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      {status === "on_break" ? (
        <button
          disabled={busy}
          onClick={() => onAction("end_break")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pendingAction === "end_break" && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
          End break
        </button>
      ) : null}
      <button
        disabled={busy || isClocking}
        onClick={() => onAction("clock_out")}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {pendingAction === "clock_out" && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
        Clock out
      </button>
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
  projects: any[];
  tasks: any[];
  activeEntry: any | null;
  attendanceStatus?: string;
  busy: boolean;
  onStart: (projectId: string, taskId: string | null, note: string) => void;
  onStop: () => void;
}) {
  const [selectedProject, setSelectedProject] = useState<string>(activeEntry?.projectId || "");
  const [selectedTask, setSelectedTask] = useState<string>(activeEntry?.taskId || "");
  const [note, setNote] = useState(activeEntry?.note || "");

  const projectTasks = selectedProject
    ? tasks.filter((t) => t.projectId === selectedProject)
    : [];

  if (activeEntry) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">
            Working on {activeEntry.projectName}
            {activeEntry.taskTitle && ` · ${activeEntry.taskTitle}`}
          </p>
          {activeEntry.note && <p className="text-xs text-blue-700 mt-1">{activeEntry.note}</p>}
        </div>
        <button
          disabled={busy}
          onClick={onStop}
          className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Stop project work
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <select
        value={selectedProject}
        onChange={(e) => {
          setSelectedProject(e.target.value);
          setSelectedTask("");
        }}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="">Select a project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {projectTasks.length > 0 && (
        <select
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Select a task (optional)</option>
          {projectTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
        rows={2}
      />

      <button
        disabled={busy || !selectedProject}
        onClick={() =>
          onStart(selectedProject, selectedTask || null, note)
        }
        className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Start project work
      </button>
    </div>
  );
}