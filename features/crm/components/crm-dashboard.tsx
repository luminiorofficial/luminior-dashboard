"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageTransition } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useCrm, useCrmAction } from "@/hooks/use-crm";
import { CrmLoadState } from "./crm-load-state";
import {
  ActiveTimer,
  CrmBadge,
  CrmProgress,
  CrmStatCard,
  compareTaskPriority,
  formatDate,
  formatMinutes,
  formatTime,
  FocusTimer,
  ProjectWorkControls,
  TaskPriorityBadge,
  TimerControls,
} from "./crm-ui";
import { CreateMemberDialog, CreateProjectDialog } from "./crm-dialogs";

export function CrmDashboard() {
  const crm = useCrm();
  const action = useCrmAction();
  const [pendingTimerAction, setPendingTimerAction] = useState<
    "clock_in" | "end_break" | "clock_out" | null
  >(null);
  const data = crm.data;

  if (!data) {
    const isManager = true;
    return (
      <PageTransition className="space-y-6">
        <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                CRM is ready
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                Start building your team and delivery pipeline
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                This workspace is empty. Add your first team member and project to begin tracking work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CreateMemberDialog brands={[]} />
              <CreateProjectDialog team={[]} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <CrmStatCard label="Active projects" value={0} detail="0 total projects" icon={FolderKanban} accent />
          <CrmStatCard label="Total team members" value={0} detail="0 active members" icon={Users} />
          <CrmStatCard label="Open tasks" value={0} detail="0 completed" icon={CheckCircle2} />
          <CrmStatCard label="Working now" value={0} detail="0 active accounts" icon={Activity} />
          <CrmStatCard label="Leave requests" value={0} detail="Awaiting approval" icon={CalendarCheck} />
        </div>
      </PageTransition>
    );
  }

  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;
  const me = data.team.find((member) => member.id === data.currentUserId);
  const myTasks = data.tasks.filter(
    (task) => task.assigneeId === data.currentUserId,
  );
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

  async function timer(
    timerAction: "clock_in" | "end_break" | "clock_out",
  ) {
    setPendingTimerAction(timerAction);
    try {
      await action.mutateAsync({ action: "timer", timerAction });
      toast.success(
        timerAction === "clock_in"
          ? "Work timer started"
          : timerAction === "clock_out"
            ? "Work timer stopped"
            : "Back to work",
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function startProjectWork(
    projectId: string,
    taskId: string | null,
    note: string,
  ) {
    try {
      await action.mutateAsync({
        action: "start_project_work",
        projectId,
        taskId,
        note,
      });
      toast.success(myActiveProjectEntry ? "Project switched" : "Project timer started");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPendingTimerAction(null);
    }
  }

  async function stopProjectWork() {
    try {
      await action.mutateAsync({ action: "stop_project_work" });
      toast.success("Project timer stopped");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <PageTransition className="space-y-6">
      {!isManager && (
        <>
          <Card className="overflow-hidden border-primary/25">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  My workday
                </p>
                <div className="mt-2">
                  <ActiveTimer
                    status={myActiveEntry?.status ?? "idle"}
                    since={myActiveEntry?.clockIn ?? null}
                    breakStartedAt={myActiveEntry?.breakStartedAt}
                    breakMinutes={myActiveEntry?.breakMinutes}
                    breakLabel={myActiveEntry?.breakLabel}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatMinutes(me?.workedMinutesToday ?? 0)} recorded today
                </p>
              </div>
              <TimerControls
                status={myActiveEntry?.status ?? "idle"}
                busy={action.isPending || pendingTimerAction !== null}
                pendingAction={pendingTimerAction}
                onAction={(value) => void timer(value)}
              />
            </CardContent>
          </Card>

          <Card className="border-primary/25">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">My project focus</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectWorkControls
                projects={data.projects}
                tasks={myTasks}
                activeEntry={myActiveProjectEntry}
                attendanceStatus={me?.attendanceStatus}
                busy={action.isPending}
                onStart={(projectId, taskId, note) =>
                  void startProjectWork(projectId, taskId, note)
                }
                onStop={() => void stopProjectWork()}
              />
            </CardContent>
          </Card>
        </>
      )}

      {(isManager && (data.team.length === 0 || data.projects.length === 0 || data.tasks.length === 0)) && (
        <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                CRM is ready
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                Start building your team and delivery pipeline
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.team.length === 0 && data.projects.length === 0 && data.tasks.length === 0
                  ? "This workspace is empty. Add your first team member and project to begin tracking work."
                  : "Your CRM has been created, but one or more sections are still empty. Add the missing pieces to get visibility into delivery."}
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
          label={isManager ? "Working now" : isPoc ? "Needs attention" : "Hours today"}
          value={
            isManager
              ? workingNow.length
              : isPoc
                ? attentionTasks.length
                : formatMinutes(me?.workedMinutesToday ?? 0)
          }
          detail={
            isManager
              ? `${activeMembers.length} active accounts`
              : isPoc
                ? `${attentionTasks.filter((task) => task.isBlocked).length} blocked`
                : "Live attendance"
          }
          icon={isManager ? Activity : isPoc ? CheckCircle2 : Clock3}
        />
        <CrmStatCard
          label={isManager ? "Leave requests" : "My leave requests"}
          value={pendingLeave.length}
          detail="Awaiting approval"
          icon={CalendarCheck}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">
              {isManager ? "Priority tasks" : isPoc ? "POC priorities" : "My next tasks"}
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/crm/tasks">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {openTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className={
                  task.activeFocusStartedAt
                    ? "rounded-lg border border-primary/50 bg-primary/[0.07] p-3 shadow-sm ring-1 ring-primary/15"
                    : "rounded-lg border border-border bg-background/30 p-3"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {task.projectName}
                      {isManager && task.assigneeName ? ` · ${task.assigneeName}` : ""}
                    </p>
                    {task.activeFocusStartedAt && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-primary">
                        <span className="relative flex h-2 w-2 rounded-full bg-primary">
                          <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-50" />
                        </span>
                        <span>Started {formatTime(task.activeFocusStartedAt)}</span>
                        <span>·</span>
                        <FocusTimer startedAt={task.activeFocusStartedAt} compact />
                      </p>
                    )}
                  </div>
                  <TaskPriorityBadge priority={task.priority} />
                </div>
                <CrmProgress value={task.progress} className="mt-3" />
                <div className="mt-2 flex items-center justify-between">
                  <CrmBadge value={task.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(task.dueDate)}
                  </span>
                </div>
              </div>
            ))}
            {openTasks.length === 0 && (
              <EmptyState
                title="All caught up"
                message="There are no open tasks in your current view."
                icon={CheckCircle2}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">
              {isManager ? "Team right now" : "Project progress"}
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href={isManager ? "/crm/team" : "/crm/projects"}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isManager
              ? data.team.slice(0, 7).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.fullName || member.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.currentProjectName
                          ? `Working on ${member.currentTaskTitle || member.currentProjectName}`
                          : member.jobTitle ||
                            (member.role === "admin" || member.role === "superadmin"
                              ? "Manager"
                              : "Team member")}
                      </p>
                    </div>
                    <CrmBadge value={member.attendanceStatus} />
                  </div>
                ))
              : data.projects.slice(0, 6).map((project) => (
                  <div key={project.id} className="space-y-2 border-b border-border/60 pb-3 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <CrmBadge value={project.status} />
                    </div>
                    <CrmProgress value={project.progress} />
                  </div>
                ))}
            {(isManager ? data.team : data.projects).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No data yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {isManager && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Users className="mr-2 inline h-4 w-4" />
          Managers see the complete workspace. Team members only see projects and
          tasks assigned to their own login.
        </div>
      )}
    </PageTransition>
  );
}
