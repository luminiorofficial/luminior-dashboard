export type CrmProjectStatus = "planning" | "active" | "on_hold" | "completed";
export type CrmTaskStatus = "todo" | "in_progress" | "review" | "done";
export type CrmPriority = "p0" | "p1" | "p2" | "p3";
export type CrmTimerStatus = "working" | "on_break" | "stopped";
export type CrmLeaveStatus = "pending" | "approved" | "rejected";

export const taskPriorityLabels: Record<CrmPriority, string> = {
  p0: "P0",
  p1: "P1",
  p2: "P2",
  p3: "P3",
};

export const taskPriorityRank: Record<CrmPriority, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3,
};

export interface CrmTeamMember {
  id: string;
  email: string;
  fullName: string | null;
  role: "user" | "admin" | "superadmin";
  isActive: boolean;
  jobTitle: string | null;
  department: string | null;
  createdAt: string;
  attendanceStatus: "working" | "on_break" | "offline" | "absent" | "inactive";
  activeSince: string | null;
  workedMinutesToday: number;
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentProjectSince: string | null;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  projectTrackedMinutesToday: number;
  brandIds: number[];
}

export interface CrmProject {
  id: string;
  name: string;
  clientName: string | null;
  description: string | null;
  status: CrmProjectStatus;
  priority: CrmPriority;
  startDate: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  pocId: string | null;
  pocName: string | null;
  memberIds: string[];
  memberNames: string[];
  taskCount: number;
  completedTaskCount: number;
  reviewTaskCount: number;
  blockedTaskCount: number;
  overdueTaskCount: number;
  loggedMinutes: number;
  progress: number;
}

export interface CrmTask {
  id: string;
  projectId: string;
  projectName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  title: string;
  description: string | null;
  status: CrmTaskStatus;
  priority: CrmPriority;
  progress: number;
  estimatedMinutes: number | null;
  isBlocked: boolean;
  blockerReason: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  lastUpdateNote: string | null;
  lastUpdatedByName: string | null;
  lastUpdateAt: string | null;
  activeFocusStartedAt: string | null;
  activeFocusUserId: string | null;
  activeFocusUserName: string | null;
}

export interface CrmTaskUpdate {
  id: number;
  taskId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  previousStatus: CrmTaskStatus | null;
  status: CrmTaskStatus;
  previousProgress: number | null;
  progress: number;
  note: string | null;
  isBlocked: boolean;
  blockerReason: string | null;
  createdAt: string;
}

export interface CrmTimeEntry {
  id: number;
  userId: string;
  userName: string;
  workDate: string;
  clockIn: string;
  clockOut: string | null;
  breakStartedAt: string | null;
  breakLabel: string | null;
  breakMinutes: number;
  status: CrmTimerStatus;
  workedMinutes: number;
}

export interface CrmProjectWorkEntry {
  id: number;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  taskId: string | null;
  taskTitle: string | null;
  workDate: string;
  startedAt: string;
  endedAt: string | null;
  note: string | null;
  workedMinutes: number;
  status: "active" | "completed";
}

export interface CrmLeaveRequest {
  id: string;
  userId: string;
  userName: string;
  leaveType: "casual" | "sick" | "earned" | "unpaid";
  startDate: string;
  endDate: string;
  reason: string | null;
  status: CrmLeaveStatus;
  managerNote: string | null;
  createdAt: string;
}

export interface CrmBrandOption {
  accountId: number;
  name: string;
}

export interface CrmSnapshot {
  accountId: number;
  role: "manager" | "member";
  currentUserId: string;
  pocProjectIds: string[];
  brands: CrmBrandOption[];
  team: CrmTeamMember[];
  projects: CrmProject[];
  tasks: CrmTask[];
  taskUpdates: CrmTaskUpdate[];
  timeEntries: CrmTimeEntry[];
  projectWorkEntries: CrmProjectWorkEntry[];
  leaveRequests: CrmLeaveRequest[];
}

export type CRMModule = "dashboard" | "projects" | "tasks" | "team" | "attendance";
