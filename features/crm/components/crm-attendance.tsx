"use client";

import { useState } from "react";
import { Clock3, Coffee, FolderKanban, Play, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageTransition } from "@/components/states";
import { useCrm, useCrmAction } from "@/hooks/use-crm";
import { CrmLoadState } from "./crm-load-state";
import {
  ActiveTimer,
  CrmBadge,
  CrmStatCard,
  formatMinutes,
  formatTime,
  ProjectWorkControls,
  TimerControls,
} from "./crm-ui";

export function CrmAttendance() {
  const crm = useCrm();
  const action = useCrmAction();
  const [pendingTimerAction, setPendingTimerAction] = useState<
    "clock_in" | "start_break" | "end_break" | "clock_out" | null
  >(null);
  const data = crm.data;
  if (!data) {
    return (
      <CrmLoadState
        loading={crm.isLoading}
        error={(crm.error as Error) ?? null}
        retry={() => void crm.refetch()}
      />
    );
  }

  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;
  const canTrackProjectTeam = isManager || isPoc;
  const me = data.team.find((member) => member.id === data.currentUserId);
  const myTasks = data.tasks.filter(
    (task) => task.assigneeId === data.currentUserId,
  );
  const active = data.timeEntries.find(
    (entry) => entry.userId === data.currentUserId && entry.status !== "stopped",
  );
  const myEntries = data.timeEntries.filter((entry) => entry.userId === data.currentUserId);
  const activeProjectEntry = data.projectWorkEntries.find(
    (entry) => entry.userId === data.currentUserId && entry.status === "active",
  );
  const visibleProjectEntries = canTrackProjectTeam
    ? data.projectWorkEntries
    : data.projectWorkEntries.filter((entry) => entry.userId === data.currentUserId);
  const today = new Date().toISOString().slice(0, 10);
  const todayAllocations = Array.from(
    visibleProjectEntries
      .filter((entry) => entry.workDate === today)
      .reduce((rows, entry) => {
        const key = `${entry.userId}:${entry.projectId}:${entry.taskId ?? "project"}`;
        const current = rows.get(key);
        rows.set(key, {
          userId: entry.userId,
          userName: entry.userName,
          projectId: entry.projectId,
          projectName: entry.projectName,
          taskId: entry.taskId,
          taskTitle: entry.taskTitle,
          minutes: (current?.minutes ?? 0) + entry.workedMinutes,
        });
        return rows;
      }, new Map<string, {
        userId: string;
        userName: string;
        projectId: string;
        projectName: string;
        taskId: string | null;
        taskTitle: string | null;
        minutes: number;
      }>())
      .values(),
  ).sort((a, b) =>
    a.userName.localeCompare(b.userName) || b.minutes - a.minutes,
  );
  const working = data.team.filter((member) => member.attendanceStatus === "working").length;
  const onBreak = data.team.filter((member) => member.attendanceStatus === "on_break").length;
  const absent = data.team.filter((member) => member.attendanceStatus === "absent").length;
  const activeMembers = data.team.filter((member) => member.isActive).length;

  async function timer(
    timerAction: "clock_in" | "start_break" | "end_break" | "clock_out",
  ) {
    setPendingTimerAction(timerAction);
    try {
      await action.mutateAsync({ action: "timer", timerAction });
      toast.success(
        timerAction === "start_break" ? "Break started" : "Attendance updated",
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPendingTimerAction(null);
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
      toast.success(activeProjectEntry ? "Project switched" : "Project timer started");
    } catch (error) {
      toast.error((error as Error).message);
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
      <PageHeader
        eyebrow="CRM · Time"
        title="Attendance & work log"
        description={
          isManager
            ? "Live work status, breaks and recorded time for the complete team."
            : "Start and stop your workday, record breaks and review your own time."
        }
      />

      {!isManager && (
        <>
          <Card className="border-primary/25">
            <CardContent className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">My timer</p>
                <div className="mt-2">
                  <ActiveTimer
                    status={active?.status ?? "idle"}
                    since={active?.clockIn ?? null}
                    breakStartedAt={active?.breakStartedAt}
                    breakMinutes={active?.breakMinutes}
                    breakLabel={active?.breakLabel}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatMinutes(me?.workedMinutesToday ?? 0)} productive time today
                </p>
              </div>
              <TimerControls
                status={active?.status ?? "idle"}
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
                activeEntry={activeProjectEntry}
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

      {isManager && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CrmStatCard label="Working" value={working} icon={Play} accent />
            <CrmStatCard label="On break" value={onBreak} icon={Coffee} />
            <CrmStatCard label="Absent / leave" value={absent} icon={Users} />
            <CrmStatCard
              label="Offline"
              value={Math.max(0, activeMembers - working - onBreak - absent)}
              icon={Clock3}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s team status</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-3 font-medium">Team member</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Working on</th>
                    <th className="pb-3 font-medium">Started</th>
                    <th className="pb-3 font-medium">Worked today</th>
                    <th className="pb-3 font-medium">Project time</th>
                    <th className="pb-3 font-medium">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {data.team.map((member) => (
                    <tr key={member.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 font-medium">{member.fullName || member.email}</td>
                      <td className="py-3"><CrmBadge value={member.attendanceStatus} /></td>
                      <td className="py-3">
                        {member.currentProjectName ? (
                          <div>
                            <p className="font-medium">{member.currentProjectName}</p>
                            {member.currentTaskTitle && (
                              <p className="text-xs font-medium text-primary">
                                {member.currentTaskTitle}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              since {formatTime(member.currentProjectSince)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">{formatTime(member.activeSince)}</td>
                      <td className="py-3 tabular-nums">{formatMinutes(member.workedMinutesToday)}</td>
                      <td className="py-3 tabular-nums">
                        {formatMinutes(member.projectTrackedMinutesToday)}
                      </td>
                      <td className="py-3 text-muted-foreground">{member.department || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isManager
              ? "Today’s project allocation"
              : isPoc
                ? "POC project allocation today"
                : "My project allocation today"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayAllocations.length === 0 ? (
            <EmptyState
              title="No project time recorded today"
              message="Choose a project after clocking in to build the daily allocation."
              icon={FolderKanban}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    {canTrackProjectTeam && (
                      <th className="pb-3 font-medium">Member</th>
                    )}
                    <th className="pb-3 font-medium">Project</th>
                    <th className="pb-3 font-medium">Task</th>
                    <th className="pb-3 text-right font-medium">Tracked today</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAllocations.map((allocation) => (
                    <tr
                      key={`${allocation.userId}:${allocation.projectId}:${allocation.taskId ?? "project"}`}
                      className="border-b border-border/50 last:border-0"
                    >
                      {canTrackProjectTeam && (
                        <td className="py-3 font-medium">{allocation.userName}</td>
                      )}
                      <td className="py-3">{allocation.projectName}</td>
                      <td className="py-3">{allocation.taskTitle || "—"}</td>
                      <td className="py-3 text-right font-medium tabular-nums">
                        {formatMinutes(allocation.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isManager
              ? "Recent project activity"
              : isPoc
                ? "POC project activity"
                : "My recent project activity"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visibleProjectEntries.length === 0 ? (
            <EmptyState
              title="No project activity yet"
              message="Project start, switch and stop times will appear here."
              icon={FolderKanban}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    {canTrackProjectTeam && (
                      <th className="pb-3 font-medium">Member</th>
                    )}
                    <th className="pb-3 font-medium">Project</th>
                    <th className="pb-3 font-medium">Task</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Started</th>
                    <th className="pb-3 font-medium">Ended</th>
                    <th className="pb-3 font-medium">Duration</th>
                    <th className="pb-3 font-medium">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjectEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 last:border-0">
                      {canTrackProjectTeam && (
                        <td className="py-3 font-medium">{entry.userName}</td>
                      )}
                      <td className="py-3 font-medium">{entry.projectName}</td>
                      <td className="py-3">{entry.taskTitle || "—"}</td>
                      <td className="py-3">{entry.workDate}</td>
                      <td className="py-3">{formatTime(entry.startedAt)}</td>
                      <td className="py-3">{formatTime(entry.endedAt)}</td>
                      <td className="py-3 tabular-nums">{formatMinutes(entry.workedMinutes)}</td>
                      <td className="max-w-[260px] py-3 text-muted-foreground">
                        <span className="block truncate">{entry.note || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isManager ? "Recent time entries" : "My recent time entries"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(isManager ? data.timeEntries : myEntries).length === 0 ? (
            <EmptyState
              title="No time recorded"
              message="Start the work timer to create the first attendance entry."
              icon={Clock3}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    {isManager && <th className="pb-3 font-medium">Member</th>}
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Clock in</th>
                    <th className="pb-3 font-medium">Clock out</th>
                    <th className="pb-3 font-medium">Break</th>
                    <th className="pb-3 font-medium">Worked</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(isManager ? data.timeEntries : myEntries).map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 last:border-0">
                      {isManager && <td className="py-3 font-medium">{entry.userName}</td>}
                      <td className="py-3">{entry.workDate}</td>
                      <td className="py-3">{formatTime(entry.clockIn)}</td>
                      <td className="py-3">{formatTime(entry.clockOut)}</td>
                      <td className="py-3">
                        <span>{formatMinutes(entry.breakMinutes)}</span>
                        {entry.breakLabel && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {entry.breakLabel}
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-medium">{formatMinutes(entry.workedMinutes)}</td>
                      <td className="py-3"><CrmBadge value={entry.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
