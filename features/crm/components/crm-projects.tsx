"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Eye,
  FolderKanban,
  History,
  ListChecks,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageTransition } from "@/components/states";
import { useCrm, useCrmAction } from "@/hooks/use-crm";
import { cn } from "@/lib/utils";
import { CrmLoadState } from "./crm-load-state";
import {
  AssignMemberDialog,
  CreateProjectDialog,
  SetProjectPocDialog,
} from "./crm-dialogs";
import {
  CrmBadge,
  CrmProgress,
  formatDate,
  formatMinutes,
  formatTime,
  PriorityBadge,
} from "./crm-ui";
import type {
  CrmProject,
  CrmProjectWorkEntry,
  CrmTeamMember,
} from "@/features/crm/types";

function formatWorkStartedAt(value: string) {
  const started = new Date(value);
  if (Number.isNaN(started.getTime())) return "Invalid time";

  const today = new Date();
  const isToday =
    started.getFullYear() === today.getFullYear() &&
    started.getMonth() === today.getMonth() &&
    started.getDate() === today.getDate();

  return `${isToday ? "Today" : formatDate(value)}, ${formatTime(value)}`;
}

function ProjectStatusControl({
  project,
  canComplete,
}: {
  project: CrmProject;
  canComplete: boolean;
}) {
  const action = useCrmAction();

  async function update(status: CrmProject["status"]) {
    try {
      await action.mutateAsync({
        action: "update_project",
        projectId: project.id,
        status,
      });
      toast.success("Project status updated");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <Select
      value={project.status}
      disabled={
        action.isPending || (!canComplete && project.status === "completed")
      }
      onValueChange={(value) => void update(value as CrmProject["status"])}
    >
      <SelectTrigger className="h-8 w-32 text-xs" aria-label="Project status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="planning">Planning</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="on_hold">On hold</SelectItem>
        <SelectItem value="completed" disabled={!canComplete}>
          Completed
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function DetailStat({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof ListChecks;
  label: string;
  value: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <Icon
        className={cn(
          "mb-2 h-4 w-4 text-primary",
          warning && "text-amber-500",
        )}
      />
      <p className="text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ProjectDetailsDialog({
  project,
  open,
  onOpenChange,
  canManage,
  isManager,
  workEntries,
}: {
  project: CrmProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  isManager: boolean;
  workEntries: CrmProjectWorkEntry[];
}) {
  const workHistory = workEntries.filter(
    (entry) => entry.status === "completed" || Boolean(entry.endedAt),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{project.name}</DialogTitle>
            <PriorityBadge priority={project.priority} />
            <CrmBadge value={project.status} />
          </div>
          <DialogDescription>
            {project.clientName
              ? `Client project · ${project.clientName}`
              : "In-house project"}
          </DialogDescription>
        </DialogHeader>

        <section className="rounded-lg bg-muted/35 p-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {project.description || "No description has been added."}
          </p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Overall progress</span>
            <span className="tabular-nums text-muted-foreground">
              {project.progress}%
            </span>
          </div>
          <CrmProgress value={project.progress} showLabel={false} />
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Delivery details
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DetailStat
              icon={ListChecks}
              label="Tasks done"
              value={`${project.completedTaskCount}/${project.taskCount}`}
            />
            <DetailStat
              icon={Users}
              label="Members"
              value={project.memberIds.length}
            />
            <DetailStat
              icon={CalendarDays}
              label="Due date"
              value={formatDate(project.dueDate)}
            />
            <DetailStat
              icon={Clock3}
              label="Time logged"
              value={formatMinutes(project.loggedMinutes)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-semibold">{project.reviewTaskCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">In review</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-sm font-semibold">
                  {project.blockedTaskCount}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Blocked</p>
            </div>
            <div className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-semibold">{project.overdueTaskCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border/60 p-4 text-sm">
          <div className="flex items-start gap-2">
            <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Project POC</p>
              <p className="font-medium">{project.pocName || "Not assigned"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Assigned people</p>
              <p className="font-medium">
                {project.memberNames.length
                  ? project.memberNames.join(", ")
                  : "No members assigned"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Start date</p>
              <p className="font-medium">{formatDate(project.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due date</p>
              <p className="font-medium">{formatDate(project.dueDate)}</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Work history
            </p>
          </div>
          {workHistory.length ? (
            <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
              {workHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="space-y-1 bg-muted/20 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="font-medium">{entry.userName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.taskTitle || "General project work"}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-medium tabular-nums">
                      {formatMinutes(entry.workedMinutes)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatWorkStartedAt(entry.startedAt)}
                    {" – "}
                    {formatTime(entry.endedAt)}
                  </p>
                  {entry.note && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {entry.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No completed work sessions yet. Stopped sessions will appear here.
            </div>
          )}
        </section>

        {canManage && (
          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">Project status</p>
            <ProjectStatusControl project={project} canComplete={isManager} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({
  project,
  team,
  isManager,
  isPoc,
  workEntries,
}: {
  project: CrmProject;
  team: CrmTeamMember[];
  isManager: boolean;
  isPoc: boolean;
  workEntries: CrmProjectWorkEntry[];
}) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const canManage = isManager || isPoc;
  const activeEntries = workEntries.filter(
    (entry) => entry.status === "active" && !entry.endedAt,
  );
  const isRunning = activeEntries.length > 0;

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden",
          isRunning &&
            "border-amber-400/60 bg-amber-500/[0.06] shadow-sm ring-1 ring-amber-400/20",
        )}
      >
        <CardHeader className="space-y-2.5 px-5 pb-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{project.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {project.clientName
                  ? `Client · ${project.clientName}`
                  : "In-house project"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  <span className="relative flex h-2 w-2 rounded-full bg-amber-500">
                    <span className="absolute inset-0 animate-ping rounded-full bg-amber-500 opacity-50" />
                  </span>
                  Running now
                </span>
              )}
              <PriorityBadge priority={project.priority} />
            </div>
          </div>

          {project.description ? (
            <button
              type="button"
              className="line-clamp-2 w-full cursor-pointer text-left text-sm leading-relaxed text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setDetailsOpen(true)}
              aria-label={`Read full description for ${project.name}`}
            >
              {project.description}
            </button>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No description added
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-3 px-5 pb-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{project.progress}%</span>
            </div>
            <CrmProgress value={project.progress} showLabel={false} />
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/25 p-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-primary" />
              <p className="truncate">
                <span className="font-medium">Assigned: </span>
                <span className="text-muted-foreground">
                  {project.memberNames.length
                    ? project.memberNames.join(", ")
                    : "No one assigned"}
                </span>
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <UserRoundCheck className="h-4 w-4 shrink-0 text-primary" />
              <p className="truncate">
                <span className="font-medium">POC: </span>
                <span className="text-muted-foreground">
                  {project.pocName || "Not assigned"}
                </span>
              </p>
            </div>
          </div>

          {activeEntries.length > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-400/35 bg-amber-500/[0.08] p-3">
              {activeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="relative mt-1 flex h-2 w-2 shrink-0 rounded-full bg-amber-500">
                    <span className="absolute inset-0 animate-ping rounded-full bg-amber-500 opacity-50" />
                  </span>
                  <div className="min-w-0">
                    <p>
                      <span className="font-semibold">Running by: </span>
                      {entry.userName}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Started:{" "}
                      </span>
                      {formatWorkStartedAt(entry.startedAt)}
                      {entry.taskTitle ? ` · ${entry.taskTitle}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
            <Button
              size="sm"
              variant="ghost"
              className="px-2"
              onClick={() => setDetailsOpen(true)}
            >
              <Eye />
              View details
            </Button>
            {canManage && (
              <div className="flex flex-wrap justify-end gap-2">
                <AssignMemberDialog project={project} team={team} />
                {isManager && (
                  <SetProjectPocDialog project={project} team={team} />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ProjectDetailsDialog
        project={project}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        canManage={canManage}
        isManager={isManager}
        workEntries={workEntries}
      />
    </>
  );
}

export function CrmProjects() {
  const crm = useCrm();
  const data = crm.data;
  if (!data) {
    const isManager = true;
    return (
      <PageTransition className="space-y-6">
        <PageHeader
          eyebrow="CRM · Delivery"
          title="Projects"
          description="Plan work, assign members and track delivery across the team."
          actions={<CreateProjectDialog team={[]} />}
        />
        <EmptyState
          title="Create your first project"
          message="Add a project, choose its team and start assigning tasks."
          icon={FolderKanban}
          action={<CreateProjectDialog team={[]} />}
        />
      </PageTransition>
    );
  }
  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="CRM · Delivery"
        title={
          isManager
            ? "Projects"
            : isPoc
              ? "My projects & POC delivery"
              : "My projects"
        }
        description={
          isManager
            ? "Plan work, assign members and track delivery across the team."
            : isPoc
              ? "Track delivery and manage the projects where you are the assigned POC."
              : "Only projects assigned to your login are shown here."
        }
        actions={isManager ? <CreateProjectDialog team={data.team} /> : undefined}
      />

      {data.projects.length === 0 ? (
        <EmptyState
          title={isManager ? "Create your first project" : "No projects assigned"}
          message={
            isManager
              ? "Add a project, choose its team and start assigning tasks."
              : "A manager has not assigned a project to you yet."
          }
          icon={FolderKanban}
          action={isManager ? <CreateProjectDialog team={data.team} /> : undefined}
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {data.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              team={data.team}
              isManager={isManager}
              isPoc={data.pocProjectIds.includes(project.id)}
              workEntries={data.projectWorkEntries.filter(
                (entry) => entry.projectId === project.id,
              )}
            />
          ))}
        </div>
      )}
    </PageTransition>
  );
}
