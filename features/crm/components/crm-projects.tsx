"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  Eye,
  FolderKanban,
  ListChecks,
  UserRoundCheck,
  Users,
} from "@/lib/lucide-react";
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
import { cn } from "@/lib/utils";
import { CrmLoadState } from "./crm-load-state";
import { AssignMemberDialog, CreateProjectDialog, SetProjectPocDialog } from "./crm-dialogs";
import {
  CrmBadge,
  CrmProgress,
  formatDate,
  formatMinutes,
  PriorityBadge,
} from "./crm-ui";
import type {
  CrmProject,
  CrmProjectWorkEntry,
  CrmTeamMember,
  CrmSnapshot,
} from "@/features/crm/types";

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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <Icon
        className={cn(
          "mb-2 h-4 w-4 text-blue-600",
          warning && "text-amber-500",
        )}
      />
      <p className="text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-slate-600">{label}</p>
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

        <section className="rounded-lg bg-slate-50 p-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-600">
            Description
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {project.description || "No description has been added."}
          </p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Overall progress</span>
            <span className="tabular-nums text-slate-600">
              {project.progress}%
            </span>
          </div>
          <CrmProgress value={project.progress} showLabel={false} />
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
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
              value={formatDate(project.dueDate || "")}
            />
            <DetailStat
              icon={Clock3}
              label="Time logged"
              value={formatMinutes(project.loggedMinutes)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold">{project.reviewTaskCount}</p>
              <p className="mt-0.5 text-xs text-slate-600">In review</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-sm font-semibold">
                  {project.blockedTaskCount}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">Blocked</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold">{project.overdueTaskCount}</p>
              <p className="mt-0.5 text-xs text-slate-600">Overdue</p>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
          <div className="flex items-start gap-2">
            <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs text-slate-600">Project POC</p>
              <p className="font-medium">{project.pocName || "Not assigned"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="text-xs text-slate-600">Assigned people</p>
              <p className="font-medium">
                {project.memberNames.length
                  ? project.memberNames.join(", ")
                  : "No members assigned"}
              </p>
            </div>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

interface CrmProjectsProps {
  data?: CrmSnapshot | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function CrmProjects({
  data,
  isLoading,
  error,
}: CrmProjectsProps = {}) {
  const [selectedProject, setSelectedProject] = React.useState<CrmProject | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  if (isLoading) {
    return <CrmLoadState loading={true} error={null} retry={() => {}} />;
  }

  if (error || !data) {
    return <CrmLoadState loading={false} error={error || new Error("No data")} retry={() => {}} />;
  }

  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;
  const projects = isManager
    ? data.projects
    : isPoc
      ? data.projects.filter((p) => data.pocProjectIds.includes(p.id))
      : data.projects.filter((p) => p.memberIds.includes(data.currentUserId));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Projects"
        title={isManager ? "Projects" : isPoc ? "My POC projects" : "My projects"}
        description={
          isManager
            ? "Manage all projects and track their progress."
            : isPoc
              ? "Projects where you are the point of contact."
              : "Projects you are assigned to."
        }
        actions={isManager ? <CreateProjectDialog team={data.team} /> : undefined}
      />

      {projects.length === 0 ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-sm font-medium text-slate-900">No projects yet</p>
            <p className="text-xs text-slate-600 mt-1">
              {isManager ? "Create your first project to get started." : "You are not assigned to any projects."}
            </p>
            {isManager && <CreateProjectDialog team={data.team} />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-slate-900 truncate">{project.name}</p>
                      <PriorityBadge priority={project.priority} />
                      <CrmBadge value={project.status} />
                    </div>
                    {project.clientName && (
                      <p className="text-xs text-slate-600 mt-1">Client: {project.clientName}</p>
                    )}
                    <p className="text-sm text-slate-600 mt-2">
                      {project.pocName ? `POC: ${project.pocName}` : "No POC assigned"} ·{" "}
                      {project.memberIds.length} team members
                    </p>
                    <CrmProgress value={project.progress} className="mt-3 max-w-md" />
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                      <span>{project.completedTaskCount}/{project.taskCount} tasks complete</span>
                      <span>{project.blockedTaskCount} blocked</span>
                      <span>{project.overdueTaskCount} overdue</span>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:mt-0">
                    {isManager && (
                      <>
                        <AssignMemberDialog project={project} team={data.team} />
                        <SetProjectPocDialog project={project} team={data.team} />
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedProject(project);
                        setDetailsOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedProject && (
        <ProjectDetailsDialog
          project={selectedProject}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          canManage={isManager || data.pocProjectIds.includes(selectedProject.id)}
          isManager={isManager}
          workEntries={data.projectWorkEntries.filter(
            (e) => e.projectId === selectedProject.id,
          )}
        />
      )}
    </div>
  );
}
