import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError, errorResponse, requireSession } from "@/lib/userSession";
import {
  createUser,
  getUserByEmail,
  getUserById,
  setUserPasswordByAdmin,
} from "@/lib/db/users";
import {
  assignCrmMember,
  createCrmProject,
  createCrmTask,
  createLeaveRequest,
  ensureCrmMembership,
  getCrmTaskAccess,
  getCrmSnapshot,
  isCrmProjectPoc,
  manageCrmTask,
  performProjectWorkAction,
  performTimerAction,
  reviewLeaveRequest,
  setCrmMemberActive,
  setCrmProjectPoc,
  updateCrmProjectStatus,
  updateCrmTask,
  upsertMemberProfile,
} from "@/lib/db/crm";

const nullableText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);
const nullableDate = z.string().date().optional().transform((value) => value || null);
const id = z.string().uuid();
const priority = z.enum(["p0", "p1", "p2", "p3"]);

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_member"),
    fullName: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(8).max(72),
    jobTitle: nullableText(120),
    department: nullableText(120),
  }),
  z.object({
    action: z.literal("create_project"),
    name: z.string().trim().min(2).max(200),
    clientName: nullableText(200),
    description: nullableText(1000),
    status: z.enum(["planning", "active", "on_hold", "completed"]),
    priority,
    startDate: nullableDate,
    dueDate: nullableDate,
    memberIds: z.array(id).max(100).default([]),
    pocUserId: id.nullable().default(null),
  }),
  z.object({
    action: z.literal("assign_member"),
    projectId: id,
    userId: id,
  }),
  z.object({
    action: z.literal("set_project_poc"),
    projectId: id,
    pocUserId: id.nullable(),
  }),
  z.object({
    action: z.literal("update_project"),
    projectId: id,
    status: z.enum(["planning", "active", "on_hold", "completed"]),
  }),
  z.object({
    action: z.literal("set_member_active"),
    userId: id,
    isActive: z.boolean(),
  }),
  z.object({
    action: z.literal("create_task"),
    projectId: id,
    assigneeId: id.nullable(),
    title: z.string().trim().min(2).max(240),
    description: nullableText(1200),
    priority,
    dueDate: nullableDate,
    estimatedMinutes: z.number().int().min(15).max(60000).nullable().default(null),
  }),
  z.object({
    action: z.literal("update_task"),
    taskId: id,
    status: z.enum(["todo", "in_progress", "review", "done"]),
    progress: z.number().int().min(0).max(100),
    note: nullableText(600),
    isBlocked: z.boolean().default(false),
    blockerReason: nullableText(600),
  }),
  z.object({
    action: z.literal("manage_task"),
    taskId: id,
    assigneeId: id.nullable(),
    priority,
    dueDate: nullableDate,
    estimatedMinutes: z.number().int().min(15).max(60000).nullable().default(null),
  }),
  z.object({
    action: z.literal("timer"),
    timerAction: z.enum(["clock_in", "start_break", "end_break", "clock_out"]),
    breakLabel: z.string().trim().min(1).max(120).optional(),
  }),
  z.object({
    action: z.literal("start_project_work"),
    projectId: id,
    taskId: id.nullable().optional(),
    note: nullableText(300),
  }),
  z.object({
    action: z.literal("stop_project_work"),
  }),
  z.object({
    action: z.literal("request_leave"),
    leaveType: z.enum(["casual", "sick", "earned", "unpaid"]),
    startDate: z.string().date(),
    endDate: z.string().date(),
    reason: nullableText(800),
  }),
  z.object({
    action: z.literal("review_leave"),
    leaveId: id,
    status: z.enum(["approved", "rejected"]),
    managerNote: nullableText(800),
  }),
]);

/** Every CRM route needs the caller's own company scope to operate in. */
async function requireCrmContext() {
  const session = await requireSession();
  const currentUser = await getUserById(session.id);
  if (!currentUser?.is_active) {
    throw new AuthError(403, "This account has been deactivated");
  }
  if (!currentUser.company_id) {
    throw new AuthError(403, "This account is not attached to a company yet");
  }
  const isManager = session.role === "admin" || session.role === "superadmin";
  if (!(await ensureCrmMembership(session.id, isManager, currentUser.company_id))) {
    throw new AuthError(403, "You are not an active CRM member");
  }
  return { session, isManager, companyId: currentUser.company_id };
}

export async function GET() {
  try {
    const { session, isManager, companyId } = await requireCrmContext();
    return NextResponse.json(await getCrmSnapshot(session.id, isManager, companyId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { session, isManager, companyId } = await requireCrmContext();
    const body = await request.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const data = parsed.data;
    if (
      data.action === "create_project" &&
      data.startDate &&
      data.dueDate &&
      data.startDate > data.dueDate
    ) {
      throw new AuthError(400, "Due date must be on or after the start date");
    }
    if (
      data.action === "request_leave" &&
      data.startDate > data.endDate
    ) {
      throw new AuthError(400, "End date must be on or after the start date");
    }
    const managerOnly = [
      "create_member",
      "create_project",
      "set_member_active",
      "set_project_poc",
      "review_leave",
    ];
    if (managerOnly.includes(data.action) && !isManager) {
      throw new AuthError(403, "Manager access required");
    }
    const memberOnly = [
      "timer",
      "start_project_work",
      "stop_project_work",
      "request_leave",
    ];
    if (memberOnly.includes(data.action) && isManager) {
      throw new AuthError(403, "Team member access required");
    }

    switch (data.action) {
      case "create_member": {
        const existing = await getUserByEmail(data.email);
        const passwordHash = await bcrypt.hash(data.password, 12);
        let userId: string;
        if (existing) {
          if (existing.role === "admin" || existing.role === "superadmin") {
            throw new AuthError(409, "This email belongs to a manager account");
          }
          if (existing.company_id && existing.company_id !== companyId) {
            throw new AuthError(409, "This email already belongs to another company");
          }
          userId = existing.id;
          const credentialUpdated = await setUserPasswordByAdmin({
            id: userId,
            passwordHash,
            fullName: data.fullName,
          });
          if (!credentialUpdated) {
            throw new AuthError(409, "Could not update this member's login");
          }
        } else {
          userId = await createUser({
            email: data.email,
            passwordHash,
            fullName: data.fullName,
            role: "user",
            companyId,
          });
        }
        await upsertMemberProfile(userId, companyId, data.jobTitle, data.department);
        break;
      }
      case "create_project":
        await createCrmProject({
          ...data,
          companyId,
          createdBy: session.id,
        });
        break;
      case "assign_member": {
        if (
          !isManager &&
          !(await isCrmProjectPoc(data.projectId, session.id, companyId))
        ) {
          throw new AuthError(403, "Project POC access required");
        }
        const assigned = await assignCrmMember(data.projectId, data.userId, companyId);
        if (!assigned) {
          throw new AuthError(404, "Project or active team member not found");
        }
        break;
      }
      case "set_member_active": {
        if (data.userId === session.id) {
          throw new AuthError(400, "You cannot deactivate your own account");
        }
        const updated = await setCrmMemberActive(data.userId, companyId, data.isActive);
        if (!updated) throw new AuthError(404, "Team member not found");
        break;
      }
      case "create_task": {
        if (
          !isManager &&
          !(await isCrmProjectPoc(data.projectId, session.id, companyId))
        ) {
          throw new AuthError(403, "Project POC access required");
        }
        const created = await createCrmTask({
          ...data,
          companyId,
          createdBy: session.id,
        });
        if (!created) {
          throw new AuthError(
            404,
            "Project not found or assignee is not assigned to this project",
          );
        }
        break;
      }
      case "set_project_poc": {
        const updated = await setCrmProjectPoc(data.projectId, data.pocUserId, companyId);
        if (!updated) {
          throw new AuthError(404, "Project or active POC member not found");
        }
        break;
      }
      case "update_project": {
        const isPoc = await isCrmProjectPoc(data.projectId, session.id, companyId);
        if (!isManager && !isPoc) {
          throw new AuthError(403, "Project POC access required");
        }
        if (!isManager && data.status === "completed") {
          throw new AuthError(403, "Only a manager can complete a project");
        }
        const updated = await updateCrmProjectStatus({
          projectId: data.projectId,
          companyId,
          status: data.status,
          canReopen: isManager,
        });
        if (!updated) {
          throw new AuthError(
            409,
            "Complete all open or blocked tasks before closing the project",
          );
        }
        break;
      }
      case "update_task": {
        const access = await getCrmTaskAccess(data.taskId, session.id, companyId);
        if (!access) throw new AuthError(404, "Task not found");
        const canManage = isManager || Boolean(access.is_poc);
        if (!canManage && !access.is_assignee) {
          throw new AuthError(403, "This task is not assigned to you");
        }
        if (
          !canManage &&
          access.has_poc &&
          (data.status === "done" || access.status === "done")
        ) {
          throw new AuthError(
            403,
            access.status === "done"
              ? "Only the project POC can reopen an approved task"
              : "Submit the task for review; the project POC will mark it done",
          );
        }
        if (data.isBlocked && !data.blockerReason) {
          throw new AuthError(400, "Add a blocker reason");
        }
        const updated = await updateCrmTask({
          ...data,
          companyId,
          actorId: session.id,
          canManage,
        });
        if (!updated) throw new AuthError(404, "Task not found or not assigned to you");
        break;
      }
      case "manage_task": {
        const access = await getCrmTaskAccess(data.taskId, session.id, companyId);
        if (!access) throw new AuthError(404, "Task not found");
        if (!isManager && !access.is_poc) {
          throw new AuthError(403, "Project POC access required");
        }
        const updated = await manageCrmTask({
          ...data,
          companyId,
          actorId: session.id,
        });
        if (!updated) {
          throw new AuthError(
            404,
            "Task not found or assignee is not a project member",
          );
        }
        break;
      }
      case "timer": {
        const changed = await performTimerAction(
          session.id,
          companyId,
          data.timerAction,
          data.breakLabel ?? null,
        );
        if (!changed) throw new AuthError(409, "This timer action is not available right now");
        break;
      }
      case "start_project_work": {
        const changed = await performProjectWorkAction({
          userId: session.id,
          companyId,
          isManager,
          action: "start",
          projectId: data.projectId,
          taskId: data.taskId ?? null,
          note: data.note,
        });
        if (!changed) {
          throw new AuthError(
            409,
            "Clock in and stay off break before starting an assigned project",
          );
        }
        break;
      }
      case "stop_project_work": {
        const changed = await performProjectWorkAction({
          userId: session.id,
          companyId,
          isManager,
          action: "stop",
          projectId: null,
          taskId: null,
          note: null,
        });
        if (!changed) {
          throw new AuthError(409, "No active project timer to stop");
        }
        break;
      }
      case "request_leave":
        await createLeaveRequest({ ...data, companyId, userId: session.id });
        break;
      case "review_leave": {
        const updated = await reviewLeaveRequest({
          leaveId: data.leaveId,
          companyId,
          reviewerId: session.id,
          status: data.status,
          managerNote: data.managerNote,
        });
        if (!updated) throw new AuthError(409, "This leave request has already been reviewed");
        break;
      }
    }

    return NextResponse.json(
      await getCrmSnapshot(session.id, isManager, companyId),
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
