"use client";

import { useState } from "react";
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Users,
} from "@/lib/lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CrmBadge,
  CrmProgress,
  CrmStatCard,
  compareTaskPriority,
  formatDate,
  formatMinutes,
  formatTime,
  ActiveTimer,
  TimerControls,
  ProjectWorkControls,
  TaskPriorityBadge,
} from "./crm-ui";
import { CreateMemberDialog, CreateProjectDialog } from "./crm-dialogs";
import type {
  CrmSnapshot,
  CrmTeamMember,
  CrmProject,
  CrmTask,
  CrmTimeEntry,
  CrmProjectWorkEntry,
} from "@/features/crm/types";

interface CrmDashboardProps {
  data?: CrmSnapshot | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function CrmDashboard({
  data,
  isLoading,
  error,
}: CrmDashboardProps = {}) {
  const [pendingTimerAction, setPendingTimerAction] = useState<
    "clock_in" | "end_break" | "clock_out" | null
  >(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="CRM"
          title="Dashboard"
          description="Track projects, tasks, and team activity."
        />
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-200 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="CRM"
          title="Dashboard"
          description="Track projects, tasks, and team activity."
        />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700">
              {error?.message || "Failed to load CRM data"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;
  const me = data.team.find((member) => member.id === data.currentUserId);
  const myTasks = data.tasks.filter((task) => task.assigneeId === data.currentUserId);
  const activeProjects = data.projects.filter((project) => project.status === "active");
  const activePocProjects = activeProjects.filter((project) =>
    data.pocProjectIds.includes(project.id),
  );
  const openTasks = data.tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      if (a.activeFocusStartedAt && !b.activeFocusStartedAt) return -1;
      if (!a.activeFocusStartedAt && b.activeFocusStartedAt) return 1;
      const priorityOrder = compareTaskPriority(a, b);
      if (priorityOrder !== 0) return priorityOrder;
      return 0;
    });
  const completedTasks = data.tasks.filter((task) => task.status === "done");
  const attentionTasks = data.tasks.filter(
    (task) => task.isBlocked || task.status === "review",
  );
  const pendingLeave = data.leaveRequests.filter((leave) => leave.status === "pending");
  const workingNow = data.team.filter((member) => member.attendanceStatus === "working");
  const activeMembers = data.team.filter((member) => member.isActive);
  const myActiveEntry = data.timeEntries.find(
    (entry) => entry.userId === data.currentUserId && entry.status !== "stopped",
  );
  const myActiveProjectEntry = data.projectWorkEntries.find(
    (entry) => entry.userId === data.currentUserId && entry.status === "active",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title={isManager ? "Dashboard" : "My workspace"}
        description={
          isManager
            ? "Track projects, tasks, and team activity."
            : "Your CRM workspace overview and quick actions."
        }
      />

      {!isManager && (
        <>
          <Card className="overflow-hidden border-blue-200">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
                  My workday
                </p>
                <div className="mt-2">
                  <ActiveTimer
                    status={myActiveEntry?.status ?? "stopped"}
                    since={myActiveEntry?.clockIn ?? null}
                    breakStartedAt={myActiveEntry?.breakStartedAt ?? null}
                    breakMinutes={myActiveEntry?.breakMinutes ?? 0}
                    breakLabel={myActiveEntry?.breakLabel ?? null}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-600">
                  {formatMinutes(me?.workedMinutesToday ?? 0)} recorded today
                </p>
              </div>
              <TimerControls
                status={myActiveEntry?.status ?? "stopped"}
                busy={false}
                pendingAction={pendingTimerAction}
                onAction={() => {}}
              />
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">My project focus</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectWorkControls
                projects={data.projects}
                tasks={myTasks}
                activeEntry={myActiveProjectEntry}
                attendanceStatus={me?.attendanceStatus}
                busy={false}
                onStart={() => {}}
                onStop={() => {}}
              />
            </CardContent>
          </Card>
        </>
      )}

      {isManager &&
        (data.team.length === 0 ||
          data.projects.length === 0 ||
          data.tasks.length === 0) && (
          <Card className="border-dashed border-blue-300 bg-blue-50">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
                  CRM is ready
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  Start building your team and delivery pipeline
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  This workspace is empty. Add your first team member and project to begin
                  tracking work.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CreateMemberDialog brands={data.brands} />
                <CreateProjectDialog team={data.team} />
              </div>
            </CardContent>
          </Card>
        )}

      <div
        className={`grid gap-4 sm:grid-cols-2 ${
          isManager ? "xl:grid-cols-5" : "xl:grid-cols-4"
        }`}
      >
        <CrmStatCard
          label={isManager ? "Active projects" : isPoc ? "POC projects" : "My projects"}
          value={isPoc && !isManager ? activePocProjects.length : activeProjects.length}
          detail={`${data.projects.length} total projects`}
          icon={FolderKanban}
          accent
        />
        {isManager && (
          <CrmStatCard
            label="Total team members"
            value={data.team.length}
            detail={`${activeMembers.length} active members`}
            icon={Users}
          />
        )}
        <CrmStatCard
          label="Open tasks"
          value={openTasks.length}
          detail={`${completedTasks.length} completed`}
          icon={CheckCircle2}
        />
        <CrmStatCard
          label="Working now"
          value={workingNow.length}
          detail={`${activeMembers.length} active`}
          icon={Activity}
        />
        {isManager && (
          <CrmStatCard
            label="Leave requests"
            value={pendingLeave.length}
            detail="Awaiting approval"
            icon={CalendarCheck}
          />
        )}
      </div>

      {attentionTasks.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base">Tasks needing attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attentionTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-amber-900">{task.title}</p>
                    <p className="text-xs text-amber-700">
                      {task.projectName} · {task.assigneeName || "Unassigned"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {task.isBlocked && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                        Blocked
                      </span>
                    )}
                    {task.status === "review" && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        In review
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-start justify-between gap-2 pb-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{task.title}</p>
                  <p className="text-xs text-slate-600">Due {formatDate(task.dueDate || "")}</p>
                </div>
                <TaskPriorityBadge priority={task.priority} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workingNow.slice(0, 3).map((member) => (
              <div key={member.id} className="flex items-center justify-between pb-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{member.fullName || member.email}</p>
                  <p className="text-xs text-slate-600">
                    {member.currentProjectName || "Idle"}
                  </p>
                </div>
                <CrmBadge value={member.attendanceStatus} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
