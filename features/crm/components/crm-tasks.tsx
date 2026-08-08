"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CrmLoadState } from "./crm-load-state";
import { CreateProjectDialog, CreateTaskDialog, ManageTaskDialog } from "./crm-dialogs";
import {
  CrmBadge,
  CrmProgress,
  compareTaskPriority,
  formatDate,
  formatTime,
  FocusTimer,
  TaskPriorityBadge,
  taskStatusOptions,
} from "./crm-ui";
import type {
  CrmProject,
  CrmTask,
  CrmTaskStatus,
  CrmTeamMember,
  CrmSnapshot,
} from "@/features/crm/types";

function TaskCard({
  task,
  canUpdate,
  canManage,
  requiresPocReview,
  project,
  team,
}: {
  task: CrmTask;
  canUpdate: boolean;
  canManage: boolean;
  requiresPocReview: boolean;
  project: CrmProject;
  team: CrmTeamMember[];
}) {
  const [status, setStatus] = useState<CrmTaskStatus>(task.status);
  const [progress, setProgress] = useState(task.progress);
  const [isBlocked, setIsBlocked] = useState(task.isBlocked);
  const [blockerReason, setBlockerReason] = useState(task.blockerReason ?? "");
  const [note, setNote] = useState("");
  const dirty =
    status !== task.status ||
    progress !== task.progress ||
    isBlocked !== task.isBlocked ||
    blockerReason !== (task.blockerReason ?? "") ||
    note.trim().length > 0;

  useEffect(() => {
    setStatus(task.status);
    setProgress(task.progress);
    setIsBlocked(task.isBlocked);
    setBlockerReason(task.blockerReason ?? "");
    setNote("");
  }, [
    task.status,
    task.progress,
    task.isBlocked,
    task.blockerReason,
    task.updatedAt,
  ]);

  return (
    <Card
      className={
        task.activeFocusStartedAt
          ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200"
          : task.isBlocked
            ? "border-amber-500/35"
            : undefined
      }
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{task.title}</p>
              <TaskPriorityBadge priority={task.priority} />
              <CrmBadge value={task.status} />
              {task.isBlocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Blocked
                </span>
              )}
              {task.activeFocusStartedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/12 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                  <span className="relative flex h-2 w-2 rounded-full bg-blue-600">
                    <span className="absolute inset-0 animate-ping rounded-full bg-blue-600 opacity-50" />
                  </span>
                  Working now
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {task.projectName}
              {task.assigneeName ? ` · ${task.assigneeName}` : " · Unassigned"}
              {` · Due ${formatDate(task.dueDate || "")}`}
              {task.estimatedMinutes
                ? ` · Est. ${Math.round((task.estimatedMinutes / 60) * 10) / 10}h`
                : ""}
            </p>
            {task.description && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                {task.description}
              </p>
            )}
            {task.isBlocked && task.blockerReason && (
              <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700">
                <strong>Blocker:</strong> {task.blockerReason}
              </p>
            )}
            {task.activeFocusStartedAt && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs">
                <span>
                  Started <strong>{formatTime(task.activeFocusStartedAt)}</strong>
                </span>
                <span>
                  Total time <FocusTimer startedAt={task.activeFocusStartedAt} />
                </span>
                {task.activeFocusUserName && (
                  <span className="text-slate-600">
                    {task.activeFocusUserName}
                  </span>
                )}
              </div>
            )}
            <CrmProgress value={task.progress} className="mt-3 max-w-xl" />
            {task.lastUpdateAt && (
              <p className="mt-2 text-xs text-slate-600">
                Last update by {task.lastUpdatedByName || "team member"} on{" "}
                {formatDate(task.lastUpdateAt)}
                {task.lastUpdateNote ? `: ${task.lastUpdateNote}` : ""}
              </p>
            )}
          </div>

          {canUpdate && (
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 lg:w-80">
              <div className="flex gap-2">
                <Select
                  value={status}
                  onValueChange={(value: string) => {
                    const next = value as CrmTaskStatus;
                    setStatus(next);
                    if (next === "done") {
                      setProgress(100);
                      setIsBlocked(false);
                      setBlockerReason("");
                    }
                  }}
                >
                  <SelectTrigger
                    className="h-8 min-w-0 flex-1 text-xs"
                    aria-label="Task status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskStatusOptions
                      .filter(
                        (option) =>
                          !requiresPocReview || option.value !== "done",
                      )
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={
                    !dirty ||
                    (isBlocked && blockerReason.trim().length === 0)
                  }
                >
                  Save
                </Button>
              </div>
              <label className="mt-3 block text-xs text-slate-600">
                Progress: {progress}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setProgress(Number(event.target.value))}
                  className="mt-1 block w-full accent-blue-600"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={isBlocked}
                  onChange={(event) => {
                    setIsBlocked(event.target.checked);
                    if (!event.target.checked) setBlockerReason("");
                  }}
                  className="accent-blue-600"
                />
                This task is blocked
              </label>
              {isBlocked && (
                <Textarea
                  value={blockerReason}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setBlockerReason(event.target.value)}
                  placeholder="What is blocking delivery?"
                  className="mt-2 min-h-16 text-xs"
                  maxLength={600}
                />
              )}
              <Textarea
                value={note}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)}
                placeholder="Add an update note"
                className="mt-2 min-h-16 text-xs"
                maxLength={600}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CrmTasksProps {
  data?: CrmSnapshot | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function CrmTasks({
  data,
  isLoading,
  error,
}: CrmTasksProps = {}) {
  const [filterProject, setFilterProject] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<CrmTaskStatus | "all">("all");

  if (isLoading) {
    return <CrmLoadState loading={true} error={null} retry={() => {}} />;
  }

  if (error || !data) {
    return <CrmLoadState loading={false} error={error || new Error("No data")} retry={() => {}} />;
  }

  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;

  const filteredTasks = useMemo(() => {
    let tasks = data.tasks;

    if (!isManager && !isPoc) {
      tasks = tasks.filter((t) => t.assigneeId === data.currentUserId);
    } else if (isPoc && !isManager) {
      tasks = tasks.filter((t) =>
        data.pocProjectIds.includes(t.projectId),
      );
    }

    if (filterProject && filterProject !== "all") {
      tasks = tasks.filter((t) => t.projectId === filterProject);
    }

    if (filterStatus !== "all") {
      tasks = tasks.filter((t) => t.status === filterStatus);
    }

    return tasks.sort((a, b) => {
      if (a.activeFocusStartedAt && !b.activeFocusStartedAt) return -1;
      if (!a.activeFocusStartedAt && b.activeFocusStartedAt) return 1;
      return compareTaskPriority(a, b);
    });
  }, [data, filterProject, filterStatus, isManager, isPoc, data.currentUserId]);

  const projects = isManager ? data.projects : data.projects.filter((p) =>
    p.memberIds.includes(data.currentUserId),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Tasks"
        title={isManager ? "All tasks" : isPoc ? "My POC tasks" : "My tasks"}
        description={
          isManager
            ? "Track all team work and delivery status."
            : isPoc
              ? "Tasks in projects where you are the POC."
              : "Your assigned work and progress."
        }
        actions={
          isManager && projects.length > 0 ? (
            <CreateTaskDialog project={projects[0]} />
          ) : isManager ? (
            <CreateProjectDialog team={data.team} />
          ) : undefined
        }
      />

      {projects.length === 0 && !isManager ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-sm font-medium text-slate-900">No tasks yet</p>
            <p className="text-xs text-slate-600 mt-1">
              You are not assigned to any tasks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-4 flex-col sm:flex-row">
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v: string) => setFilterStatus(v as any)}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {taskStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredTasks.length === 0 ? (
            <Card className="border-dashed border-slate-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardCheck className="h-12 w-12 text-slate-400 mb-4" />
                <p className="text-sm font-medium text-slate-900">No tasks match filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => {
                const project = data.projects.find((p) => p.id === task.projectId);
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canUpdate={
                      isManager || task.assigneeId === data.currentUserId
                    }
                    canManage={isManager}
                    requiresPocReview={
                      project ? data.pocProjectIds.includes(project.id) : false
                    }
                    project={project || ({} as CrmProject)}
                    team={data.team}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}