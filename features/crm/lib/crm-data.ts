export type CrmProject = {
  id: string;
  name: string;
  owner: string;
  status: "active" | "planning" | "paused";
  dueDate: string;
};

export type CrmTask = {
  id: string;
  title: string;
  assignee: string;
  priority: "High" | "Medium" | "Low";
  status: "In progress" | "Review" | "Done";
};

export type CrmTeamMember = {
  id: string;
  name: string;
  role: string;
  email: string;
  availability: string;
};

export type CrmAttendanceRecord = {
  id: string;
  name: string;
  date: string;
  status: "Present" | "Remote" | "Leave";
};

export const crmProjects: CrmProject[] = [
  { id: "prj-1", name: "Northwind Rebrand", owner: "Mina", status: "active", dueDate: "2026-08-21" },
  { id: "prj-2", name: "Mobile Checkout Launch", owner: "Ava", status: "planning", dueDate: "2026-09-03" },
  { id: "prj-3", name: "Partner Portal", owner: "Liam", status: "paused", dueDate: "2026-09-14" },
];

export const crmTasks: CrmTask[] = [
  { id: "task-1", title: "Finalize onboarding copy", assignee: "Mina", priority: "High", status: "In progress" },
  { id: "task-2", title: "Sync API contract", assignee: "Ava", priority: "Medium", status: "Review" },
  { id: "task-3", title: "Prepare launch checklist", assignee: "Liam", priority: "Low", status: "Done" },
];

export const crmTeam: CrmTeamMember[] = [
  { id: "member-1", name: "Mina Patel", role: "Product Lead", email: "mina@luminior.com", availability: "Focused" },
  { id: "member-2", name: "Ava Chen", role: "Engineering", email: "ava@luminior.com", availability: "Available" },
  { id: "member-3", name: "Liam Brooks", role: "Operations", email: "liam@luminior.com", availability: "In meetings" },
];

export const crmAttendance: CrmAttendanceRecord[] = [
  { id: "att-1", name: "Mina Patel", date: "2026-08-08", status: "Present" },
  { id: "att-2", name: "Ava Chen", date: "2026-08-08", status: "Remote" },
  { id: "att-3", name: "Liam Brooks", date: "2026-08-08", status: "Leave" },
];
