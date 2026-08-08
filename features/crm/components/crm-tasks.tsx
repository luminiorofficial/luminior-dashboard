"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
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
import { EmptyState, PageTransition } from "@/components/states";
import { useCrm, useCrmAction } from "@/hooks/use-crm";
import type {
  CrmProject,
  CrmTask,
  CrmTaskStatus,
  CrmTeamMember,
} from "@/features/crm/types";
import { CrmLoadState } from "./crm-load-state";
import {
  CreateProjectDialog,
  CreateTaskDialog,
  ManageTaskDialog,
} from "./crm-dialogs";
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
  const action = useCrmAction();
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
    task.lastUpdateAt,
  ]);

  async function save() {
    try {
      await action.mutateAsync({
        action: "update_task",
        taskId: task.id,
        status,
        progress,
        note,
        isBlocked,
        blockerReason,
      });
      toast.success(
        status === "done" ? "Task approved and completed" : "Task progress updated",
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <Card
      className={
        task.activeFocusStartedAt
          ? "border-primary/55 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15"
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
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  Blocked
                </span>
              )}
              {task.activeFocusStartedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  <span className="relative flex h-2 w-2 rounded-full bg-primary">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-50" />
                  </span>
                  Working now
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {task.projectName}
              {task.assigneeName ? ` · ${task.assigneeName}` : " · Unassigned"}
              {` · Due ${formatDate(task.dueDate)}`}
              {task.estimatedMinutes
                ? ` · Est. ${Math.round((task.estimatedMinutes / 60) * 10) / 10}h`
                : ""}
            </p>
            {task.description && (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {task.description}
              </p>
            )}
            {task.isBlocked && task.blockerReason && (
              <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <strong>Blocker:</strong> {task.blockerReason}
              </p>
            )}
            {task.activeFocusStartedAt && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-primary/20 bg-background/50 px-3 py-2 text-xs">
                <span>
                  Started <strong>{formatTime(task.activeFocusStartedAt)}</strong>
                </span>
                <span>
                  Total time <FocusTimer startedAt={task.activeFocusStartedAt} />
                </span>
                {task.activeFocusUserName && (
                  <span className="text-muted-foreground">
                    {task.activeFocusUserName}
                  </span>
                )}
              </div>
            )}
            <CrmProgress value={task.progress} className="mt-3 max-w-xl" />
            {task.lastUpdateAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last update by {task.lastUpdatedByName || "team member"} on{" "}
                {formatDate(task.lastUpdateAt)}
                {task.lastUpdateNote ? `: ${task.lastUpdateNote}` : ""}
              </p>
            )}
          </div>

          {canUpdate && (
            <div className="w-full rounded-lg border border-border bg-muted/30 p-3 lg:w-80">
              <div className="flex gap-2">
                <Select
                  value={status}
                  onValueChange={(value) => {
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
                    action.isPending ||
                    (isBlocked && blockerReason.trim().length === 0)
                  }
                  onClick={() => void save()}
                >
                  Save
                </Button>
              </div>
              <label className="mt-3 block text-xs text-muted-foreground">
                Progress: {progress}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(event) => setProgress(Number(event.target.value))}
                  className="mt-1 block w-full accent-primary"
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
                  className="accent-primary"
                />
                This task is blocked
              </label>
              {isBlocked && (
                <Textarea
                  value={blockerReason}
                  onChange={(event) => setBlockerReason(event.target.value)}
                  placeholder="What is blocking delivery?"
                  className="mt-2 min-h-16 text-xs"
                  maxLength={600}
                />
              )}
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  status === "review"
                    ? "What is ready for POC review?"
                    : "Optional progress or review note"
                }
                className="mt-2 min-h-16 text-xs"
                maxLength={600}
              />
              {requiresPocReview && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Submit as Review; the project POC approves Done.
                </p>
              )}
              {canManage && (
                <div className="mt-2 flex justify-end">
                  <ManageTaskDialog task={task} project={project} team={team} />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CrmTasks() {
  const crm = useCrm();
  const data = crm.data;
  const [filter, setFilter] = useState<
    "open" | "attention" | "done" | "all"
  >("open");

  const tasks = useMemo(() => {
    const source = data?.tasks ?? [];
    const filtered =
      filter === "open"
        ? source.filter((task) => task.status !== "done")
        : filter === "attention"
          ? source.filter((task) => task.isBlocked || task.status === "review")
          : filter === "done"
            ? source.filter((task) => task.status === "done")
            : source;
    return [...filtered].sort((a, b) => {
      if (a.activeFocusStartedAt && !b.activeFocusStartedAt) return -1;
      if (!a.activeFocusStartedAt && b.activeFocusStartedAt) return 1;
      if (a.isBlocked && !b.isBlocked) return -1;
      if (!a.isBlocked && b.isBlocked) return 1;
      if (a.status === "review" && b.status !== "review") return -1;
      if (a.status !== "review" && b.status === "review") return 1;
      const priorityOrder = compareTaskPriority(a, b);
      if (priorityOrder !== 0) return priorityOrder;
      return 0;
    });
  }, [data?.tasks, filter]);

  if (!data) {
    const isManager = true;
    return (
      <PageTransition className="space-y-6">
        <PageHeader
          eyebrow="CRM · Execution"
          title="Team tasks"
          description="Assign deliverables and see exactly how far every task has moved."
          actions={<CreateProjectDialog team={[]} />}
        />
        <EmptyState
          title="No tasks here"
          message="Create a task and assign it to a project member."
          icon={ClipboardCheck}
          action={<CreateProjectDialog team={[]} />}
        />
      </PageTransition>
    );
  }

  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;
  const manageableProjects = isManager
    ? data.projects
    : data.projects.filter((project) =>
        data.pocProjectIds.includes(project.id),
      );

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="CRM · Execution"
        title={isManager ? "Team tasks" : isPoc ? "My tasks & POC reviews" : "My tasks"}
        description={
          isManager
            ? "Assign deliverables and see exactly how far every task has moved."
            : isPoc
              ? "Manage assigned projects, resolve blockers and approve reviewed work."
              : "Update the status and progress of work assigned to you."
        }
        actions={
          manageableProjects.length > 0 ? (
            <CreateTaskDialog projects={manageableProjects} team={data.team} />
          ) : undefined
        }
      />

      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 sm:w-fit">
        {(["open", "attention", "done", "all"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title={filter === "done" ? "No completed tasks" : "No tasks here"}
          message={
            isManager || isPoc
              ? "Create a task and assign it to a project member."
              : "There are no tasks matching this view."
          }
          icon={filter === "done" ? CheckCircle2 : ClipboardCheck}
          action={
            isManager ? (
              <div className="flex flex-wrap justify-center gap-2">
                <CreateProjectDialog team={data.team} />
                {manageableProjects.length > 0 && (
                  <CreateTaskDialog projects={manageableProjects} team={data.team} />
                )}
              </div>
            ) : manageableProjects.length > 0 ? (
              <CreateTaskDialog projects={manageableProjects} team={data.team} />
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const project = data.projects.find(
              (candidate) => candidate.id === task.projectId,
            );
            if (!project) return null;
            const canManage =
              isManager || data.pocProjectIds.includes(task.projectId);
            const isAssignee = task.assigneeId === data.currentUserId;
            return (
              <TaskCard
                key={task.id}
                task={task}
                canUpdate={
                  canManage ||
                  (isAssignee && !(project.pocId && task.status === "done"))
                }
                canManage={canManage}
                requiresPocReview={
                  !canManage && isAssignee && Boolean(project.pocId)
                }
                project={project}
                team={data.team}
              />
            );
          })}
        </div>
      )}

      {(isManager || isPoc) && data.taskUpdates.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4">
              <p className="font-semibold">Recent delivery updates</p>
              <p className="text-xs text-muted-foreground">
                Status, progress, blocker and review activity across the projects
                you manage.
              </p>
            </div>
            <div className="space-y-3">
              {data.taskUpdates.slice(0, 10).map((update) => {
                const task = data.tasks.find(
                  (candidate) => candidate.id === update.taskId,
                );
                return (
                  <div
                    key={update.id}
                    className="flex flex-col gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {task?.title || "Task update"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {update.actorName}
                        {update.previousStatus
                          ? ` · ${update.previousStatus.replace("_", " ")} → ${update.status.replace("_", " ")}`
                          : ` · ${update.status.replace("_", " ")}`}
                        {` · ${update.progress}%`}
                      </p>
                      {(update.note || update.blockerReason) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {update.blockerReason
                            ? `Blocker: ${update.blockerReason}`
                            : update.note}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(update.createdAt)} {formatTime(update.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}
