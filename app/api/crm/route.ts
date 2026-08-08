import { NextResponse } from "next/server";
import type {
  CrmSnapshot,
  CrmTeamMember,
  CrmProject,
  CrmTask,
  CrmTimeEntry,
  CrmProjectWorkEntry,
  CrmLeaveRequest,
  CrmTaskUpdate,
} from "@/features/crm/types";

// Mock data - in production this would come from a database
const mockTeam: CrmTeamMember[] = [
  {
    id: "member-1",
    email: "mina@luminior.com",
    fullName: "Mina Patel",
    role: "admin",
    isActive: true,
    jobTitle: "Product Lead",
    department: "Product",
    createdAt: new Date().toISOString(),
    attendanceStatus: "working",
    activeSince: new Date(Date.now() - 3600000).toISOString(),
    workedMinutesToday: 240,
    currentProjectId: "proj-1",
    currentProjectName: "Dashboard Redesign",
    currentProjectSince: new Date(Date.now() - 1800000).toISOString(),
    currentTaskId: "task-1",
    currentTaskTitle: "Create wireframes",
    projectTrackedMinutesToday: 120,
    brandIds: [1],
  },
  {
    id: "member-2",
    email: "ava@luminior.com",
    fullName: "Ava Chen",
    role: "user",
    isActive: true,
    jobTitle: "UI Designer",
    department: "Design",
    createdAt: new Date().toISOString(),
    attendanceStatus: "offline",
    activeSince: null,
    workedMinutesToday: 0,
    currentProjectId: null,
    currentProjectName: null,
    currentProjectSince: null,
    currentTaskId: null,
    currentTaskTitle: null,
    projectTrackedMinutesToday: 0,
    brandIds: [1],
  },
  {
    id: "member-3",
    email: "liam@luminior.com",
    fullName: "Liam Brooks",
    role: "user",
    isActive: true,
    jobTitle: "Developer",
    department: "Engineering",
    createdAt: new Date().toISOString(),
    attendanceStatus: "on_break",
    activeSince: new Date(Date.now() - 7200000).toISOString(),
    workedMinutesToday: 180,
    currentProjectId: "proj-2",
    currentProjectName: "API Integration",
    currentProjectSince: new Date(Date.now() - 900000).toISOString(),
    currentTaskId: "task-3",
    currentTaskTitle: "Implement auth endpoints",
    projectTrackedMinutesToday: 90,
    brandIds: [1],
  },
];

const mockProjects: CrmProject[] = [
  {
    id: "proj-1",
    name: "Dashboard Redesign",
    clientName: null,
    description: "Complete redesign of the main dashboard UI and UX",
    status: "active",
    priority: "p1",
    startDate: new Date(Date.now() - 86400000 * 7).toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0],
    createdBy: "member-1",
    createdAt: new Date().toISOString(),
    pocId: "member-1",
    pocName: "Mina Patel",
    memberIds: ["member-1", "member-2"],
    memberNames: ["Mina Patel", "Ava Chen"],
    taskCount: 12,
    completedTaskCount: 5,
    reviewTaskCount: 2,
    blockedTaskCount: 0,
    overdueTaskCount: 0,
    loggedMinutes: 480,
    progress: 42,
  },
  {
    id: "proj-2",
    name: "API Integration",
    clientName: "TechCorp",
    description: "Integrate third-party APIs for real-time data sync",
    status: "active",
    priority: "p0",
    startDate: new Date(Date.now() - 86400000 * 5).toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 86400000 * 10).toISOString().split("T")[0],
    createdBy: "member-1",
    createdAt: new Date().toISOString(),
    pocId: "member-3",
    pocName: "Liam Brooks",
    memberIds: ["member-1", "member-3"],
    memberNames: ["Mina Patel", "Liam Brooks"],
    taskCount: 8,
    completedTaskCount: 3,
    reviewTaskCount: 1,
    blockedTaskCount: 1,
    overdueTaskCount: 0,
    loggedMinutes: 360,
    progress: 50,
  },
  {
    id: "proj-3",
    name: "Mobile App",
    clientName: null,
    description: "Mobile-first version of the web application",
    status: "planning",
    priority: "p2",
    startDate: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 86400000 * 90).toISOString().split("T")[0],
    createdBy: "member-1",
    createdAt: new Date().toISOString(),
    pocId: null,
    pocName: null,
    memberIds: ["member-2"],
    memberNames: ["Ava Chen"],
    taskCount: 5,
    completedTaskCount: 0,
    reviewTaskCount: 0,
    blockedTaskCount: 0,
    overdueTaskCount: 0,
    loggedMinutes: 0,
    progress: 0,
  },
];

const mockTasks: CrmTask[] = [
  {
    id: "task-1",
    projectId: "proj-1",
    projectName: "Dashboard Redesign",
    assigneeId: "member-2",
    assigneeName: "Ava Chen",
    title: "Create wireframes",
    description: "Design wireframes for dashboard layout",
    status: "in_progress",
    priority: "p1",
    progress: 60,
    estimatedMinutes: 480,
    isBlocked: false,
    blockerReason: null,
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUpdateNote: null,
    lastUpdatedByName: null,
    lastUpdateAt: null,
    activeFocusStartedAt: new Date(Date.now() - 1800000).toISOString(),
    activeFocusUserId: "member-1",
    activeFocusUserName: "Mina Patel",
  },
  {
    id: "task-2",
    projectId: "proj-1",
    projectName: "Dashboard Redesign",
    assigneeId: "member-1",
    assigneeName: "Mina Patel",
    title: "Create component library",
    description: "Build reusable components for dashboard",
    status: "review",
    priority: "p1",
    progress: 90,
    estimatedMinutes: 600,
    isBlocked: false,
    blockerReason: null,
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUpdateNote: "Awaiting design review",
    lastUpdatedByName: "Mina Patel",
    lastUpdateAt: new Date(Date.now() - 3600000).toISOString(),
    activeFocusStartedAt: null,
    activeFocusUserId: null,
    activeFocusUserName: null,
  },
  {
    id: "task-3",
    projectId: "proj-2",
    projectName: "API Integration",
    assigneeId: "member-3",
    assigneeName: "Liam Brooks",
    title: "Implement auth endpoints",
    description: "Create authentication and authorization endpoints",
    status: "in_progress",
    priority: "p0",
    progress: 75,
    estimatedMinutes: 720,
    isBlocked: true,
    blockerReason: "Waiting for database schema approval",
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUpdateNote: null,
    lastUpdatedByName: null,
    lastUpdateAt: null,
    activeFocusStartedAt: new Date(Date.now() - 900000).toISOString(),
    activeFocusUserId: "member-3",
    activeFocusUserName: "Liam Brooks",
  },
  {
    id: "task-4",
    projectId: "proj-2",
    projectName: "API Integration",
    assigneeId: null,
    assigneeName: null,
    title: "Setup database models",
    description: "Define database schema and models",
    status: "todo",
    priority: "p0",
    progress: 0,
    estimatedMinutes: 480,
    isBlocked: false,
    blockerReason: null,
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUpdateNote: null,
    lastUpdatedByName: null,
    lastUpdateAt: null,
    activeFocusStartedAt: null,
    activeFocusUserId: null,
    activeFocusUserName: null,
  },
];

const mockTimeEntries: CrmTimeEntry[] = [
  {
    id: 1,
    userId: "member-1",
    userName: "Mina Patel",
    workDate: new Date().toISOString().split("T")[0],
    clockIn: new Date(Date.now() - 14400000).toISOString(),
    clockOut: null,
    breakStartedAt: new Date(Date.now() - 7200000).toISOString(),
    breakLabel: "Lunch",
    breakMinutes: 60,
    status: "working",
    workedMinutes: 240,
  },
];

const mockProjectWorkEntries: CrmProjectWorkEntry[] = [
  {
    id: 1,
    userId: "member-1",
    userName: "Mina Patel",
    projectId: "proj-1",
    projectName: "Dashboard Redesign",
    taskId: "task-1",
    taskTitle: "Create wireframes",
    workDate: new Date().toISOString().split("T")[0],
    startedAt: new Date(Date.now() - 1800000).toISOString(),
    endedAt: null,
    note: "Working on dashboard wireframes",
    workedMinutes: 30,
    status: "active",
  },
];

const mockLeaveRequests: CrmLeaveRequest[] = [
  {
    id: "leave-1",
    userId: "member-2",
    userName: "Ava Chen",
    leaveType: "casual",
    startDate: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
    endDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
    reason: "Personal time off",
    status: "pending",
    managerNote: null,
    createdAt: new Date().toISOString(),
  },
];

export async function GET(request: Request) {
  try {
    // In production, get the session and resolve account ID
    // For now, return mock data

    const snapshot: CrmSnapshot = {
      accountId: 1,
      role: "manager",
      currentUserId: "member-1",
      pocProjectIds: ["proj-1"],
      brands: [{ accountId: 1, name: "Main Brand" }],
      team: mockTeam,
      projects: mockProjects,
      tasks: mockTasks,
      taskUpdates: [],
      timeEntries: mockTimeEntries,
      projectWorkEntries: mockProjectWorkEntries,
      leaveRequests: mockLeaveRequests,
    };

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("CRM API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch CRM data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Mock action handling - in production this would update the database
    switch (action) {
      case "create_member":
        return NextResponse.json({ success: true });
      case "create_project":
        return NextResponse.json({ success: true });
      case "create_task":
        return NextResponse.json({ success: true });
      case "update_task":
        return NextResponse.json({ success: true });
      case "update_project":
        return NextResponse.json({ success: true });
      case "timer":
        return NextResponse.json({ success: true });
      case "start_project_work":
        return NextResponse.json({ success: true });
      case "stop_project_work":
        return NextResponse.json({ success: true });
      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("CRM API error:", error);
    return NextResponse.json(
      { error: "Failed to process CRM action" },
      { status: 500 },
    );
  }
}

