import "server-only";
import { query, queryOne, withTransaction } from "@/lib/db/postgres";
import type {
  CrmLeaveRequest,
  CrmProject,
  CrmProjectWorkEntry,
  CrmSnapshot,
  CrmTask,
  CrmTaskUpdate,
  CrmTeamMember,
  CrmTimeEntry,
} from "@/features/crm/types";

// Schema lives in db/table.sql (run once against the database) — nothing here
// creates or migrates tables at runtime. Every Admin/Super Admin owns exactly
// one company; every query below is scoped to a single company_id — the
// caller's own company — passed in explicitly by app/api/crm/route.ts.

export async function ensureCrmMembership(
  userId: string,
  isManager: boolean,
  companyId: number,
): Promise<boolean> {
  if (isManager) {
    await query(
      `
      INSERT INTO tbl_crm_member_profiles (user_id, company_id, job_title, department, is_active)
      VALUES ($1, $2, 'Manager', 'Management', true)
      ON CONFLICT (user_id) DO UPDATE SET is_active = true
      `,
      [userId, companyId],
    );
    return true;
  }
  const row = await queryOne<{ allowed: number }>(
    `
    SELECT 1 AS allowed
    FROM tbl_crm_member_profiles p
    INNER JOIN tbl_users u ON u.id = p.user_id
    WHERE p.user_id = $1 AND p.company_id = $2 AND p.is_active = true AND u.is_active = true
    `,
    [userId, companyId],
  );
  return Boolean(row);
}

type TeamRow = {
  id: string; email: string; full_name: string | null; role: "user" | "admin" | "superadmin";
  is_active: boolean; job_title: string | null; department: string | null;
  created_at: Date; timer_status: string | null; active_since: Date | null;
  worked_minutes: number | null; on_leave: boolean;
  current_project_id: string | null; current_project_name: string | null;
  current_project_since: Date | null; current_task_id: string | null;
  current_task_title: string | null; project_tracked_minutes: number | null;
};
type ProjectRow = {
  id: string; name: string; client_name: string | null; description: string | null;
  status: CrmProject["status"]; priority: CrmProject["priority"];
  start_date: Date | null; due_date: Date | null; created_by: string; created_at: Date;
  poc_user_id: string | null; poc_name: string | null;
  member_ids: string | null; member_names: string | null;
  task_count: number; completed_task_count: number; review_task_count: number;
  blocked_task_count: number; overdue_task_count: number;
  logged_minutes: number | null; progress: number | null;
};
type TaskRow = {
  id: string; project_id: string; project_name: string; assignee_id: string | null;
  assignee_name: string | null; title: string; description: string | null;
  status: CrmTask["status"]; priority: CrmTask["priority"]; progress: number;
  estimated_minutes: number | null; is_blocked: boolean; blocker_reason: string | null;
  due_date: Date | null; created_at: Date; updated_at: Date;
  last_update_note: string | null; last_updated_by_name: string | null;
  last_update_at: Date | null;
  active_focus_started_at: Date | null; active_focus_user_id: string | null;
  active_focus_user_name: string | null;
};
type TaskUpdateRow = {
  id: number; task_id: string; project_id: string; actor_id: string;
  actor_name: string; previous_status: CrmTask["status"] | null;
  status: CrmTask["status"]; previous_progress: number | null; progress: number;
  note: string | null; is_blocked: boolean; blocker_reason: string | null;
  created_at: Date;
};
type TimeRow = {
  id: number; user_id: string; user_name: string; work_date: Date; clock_in: Date;
  clock_out: Date | null; break_started_at: Date | null; break_label: string | null;
  break_minutes: number;
  status: CrmTimeEntry["status"]; worked_minutes: number;
};
type ProjectWorkRow = {
  id: number; user_id: string; user_name: string; project_id: string;
  project_name: string; task_id: string | null; task_title: string | null;
  work_date: Date; started_at: Date; ended_at: Date | null; note: string | null;
  worked_minutes: number;
};
type LeaveRow = {
  id: string; user_id: string; user_name: string;
  leave_type: CrmLeaveRequest["leaveType"]; start_date: Date; end_date: Date;
  reason: string | null; status: CrmLeaveRequest["status"];
  manager_note: string | null; created_at: Date;
};

const iso = (value: Date | null) => value ? new Date(value).toISOString() : null;
const dateOnly = (value: Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

export async function getCrmSnapshot(
  userId: string,
  isManager: boolean,
  companyId: number,
): Promise<CrmSnapshot> {
  // $2 (isManager) is included as a bind param — rather than the query text
  // conditionally omitting $1 entirely when isManager is true — so every
  // query below always references the same placeholders. Postgres infers a
  // prepared statement's expected param count from the highest placeholder
  // actually present in the text; a query that happened to drop every $1
  // reference (manager branch) while still being called with a 3-element
  // params array raised "bind message supplies N parameters, but prepared
  // statement requires fewer".
  const params = [userId, isManager, companyId];
  const scope = `AND (
      $2 OR u.id = $1 OR (
        u.role NOT IN ('admin', 'superadmin') AND EXISTS (
          SELECT 1 FROM tbl_crm_projects poc_project
          WHERE poc_project.poc_user_id = $1 AND poc_project.company_id = $3
        )
      )
    )`;
  const activeProjectScope = "AND ($2 OR u.id = $1 OR project.poc_user_id = $1)";
  const trackedProjectScope = "AND ($2 OR u.id = $1 OR tracked_project.poc_user_id = $1)";

  const teamRows = await query<TeamRow>(`
    SELECT u.id, u.email, u.full_name, u.role,
      (u.is_active AND p.is_active) AS is_active,
      p.job_title, p.department, p.created_at,
      active_timer.status AS timer_status, active_timer.clock_in AS active_since,
      COALESCE(today_time.worked_minutes, 0) AS worked_minutes,
      active_project.project_id AS current_project_id,
      active_project.project_name AS current_project_name,
      active_project.started_at AS current_project_since,
      active_project.task_id AS current_task_id,
      active_project.task_title AS current_task_title,
      COALESCE(today_project_time.worked_minutes, 0) AS project_tracked_minutes,
      EXISTS (
        SELECT 1 FROM tbl_crm_leave_requests l
        WHERE l.user_id = u.id AND l.status = 'approved'
          AND (now() AT TIME ZONE 'utc')::date BETWEEN l.start_date AND l.end_date
      ) AS on_leave
    FROM tbl_crm_member_profiles p
    INNER JOIN tbl_users u ON u.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT t.status, t.clock_in
      FROM tbl_crm_time_entries t
      WHERE t.user_id = u.id AND t.status IN ('working', 'on_break')
      ORDER BY t.clock_in DESC
      LIMIT 1
    ) active_timer ON true
    LEFT JOIN LATERAL (
      SELECT SUM(CASE
        WHEN t.status = 'stopped' THEN
          FLOOR(EXTRACT(EPOCH FROM (t.clock_out - t.clock_in)) / 60) - t.break_minutes
        ELSE
          FLOOR(EXTRACT(EPOCH FROM (now() - t.clock_in)) / 60) - t.break_minutes
            - CASE WHEN t.status = 'on_break'
                THEN FLOOR(EXTRACT(EPOCH FROM (now() - t.break_started_at)) / 60)
                ELSE 0 END
      END) AS worked_minutes
      FROM tbl_crm_time_entries t
      WHERE t.user_id = u.id AND t.work_date = (now() AT TIME ZONE 'utc')::date
    ) today_time ON true
    LEFT JOIN LATERAL (
      SELECT w.project_id, project.name AS project_name, w.started_at,
        w.task_id, task.title AS task_title
      FROM tbl_crm_project_work_entries w
      INNER JOIN tbl_crm_projects project ON project.id = w.project_id
      LEFT JOIN tbl_crm_tasks task ON task.id = w.task_id
      WHERE w.user_id = u.id AND w.ended_at IS NULL ${activeProjectScope}
      ORDER BY w.started_at DESC
      LIMIT 1
    ) active_project ON true
    LEFT JOIN LATERAL (
      SELECT SUM(EXTRACT(EPOCH FROM (COALESCE(w.ended_at, now()) - w.started_at))) / 60.0 AS worked_minutes
      FROM tbl_crm_project_work_entries w
      INNER JOIN tbl_crm_projects tracked_project ON tracked_project.id = w.project_id
      WHERE w.user_id = u.id AND w.work_date = (now() AT TIME ZONE 'utc')::date
        ${trackedProjectScope}
    ) today_project_time ON true
    WHERE p.company_id = $3 ${scope}
    ORDER BY p.is_active DESC, CASE WHEN u.role IN ('admin', 'superadmin') THEN 0 ELSE 1 END, u.full_name, u.email
  `, params);

  const memberScope = `AND (
      $2 OR EXISTS (
        SELECT 1 FROM tbl_crm_project_members mine WHERE mine.project_id = p.id AND mine.user_id = $1
      )
      OR EXISTS (
        SELECT 1 FROM tbl_crm_tasks mt WHERE mt.project_id = p.id AND mt.assignee_id = $1
      )
    )`;
  const projectRows = await query<ProjectRow>(`
    SELECT p.id, p.name, p.client_name, p.description, p.status, p.priority,
      p.start_date, p.due_date, p.created_by, p.created_at, p.poc_user_id,
      COALESCE(poc.full_name, poc.email) AS poc_name,
      string_agg(pm.user_id::text, ',') AS member_ids,
      string_agg(COALESCE(u.full_name, u.email), ', ') AS member_names,
      (SELECT COUNT(*) FROM tbl_crm_tasks t WHERE t.project_id = p.id) AS task_count,
      (SELECT COUNT(*) FROM tbl_crm_tasks t WHERE t.project_id = p.id AND t.status = 'done') AS completed_task_count,
      (SELECT COUNT(*) FROM tbl_crm_tasks t WHERE t.project_id = p.id AND t.status = 'review') AS review_task_count,
      (SELECT COUNT(*) FROM tbl_crm_tasks t WHERE t.project_id = p.id AND t.is_blocked = true) AS blocked_task_count,
      (SELECT COUNT(*) FROM tbl_crm_tasks t
        WHERE t.project_id = p.id AND t.status <> 'done' AND t.due_date < (now() AT TIME ZONE 'utc')::date) AS overdue_task_count,
      (SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (COALESCE(w.ended_at, now()) - w.started_at))
      ) / 60.0, 0)
        FROM tbl_crm_project_work_entries w WHERE w.project_id = p.id) AS logged_minutes,
      (SELECT COALESCE(
        SUM(t.progress::float * COALESCE(NULLIF(t.estimated_minutes, 0), 60))
          / NULLIF(SUM(COALESCE(NULLIF(t.estimated_minutes, 0), 60)), 0),
        0
      ) FROM tbl_crm_tasks t WHERE t.project_id = p.id) AS progress
    FROM tbl_crm_projects p
    LEFT JOIN tbl_crm_project_members pm ON pm.project_id = p.id
    LEFT JOIN tbl_users u ON u.id = pm.user_id
    LEFT JOIN tbl_users poc ON poc.id = p.poc_user_id
    WHERE p.company_id = $3 ${memberScope}
    GROUP BY p.id, p.name, p.client_name, p.description, p.status, p.priority,
      p.start_date, p.due_date, p.created_by, p.created_at, p.updated_at,
      p.poc_user_id, poc.full_name, poc.email
    ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END,
      p.due_date
  `, params);

  const taskRows = await query<TaskRow>(`
    SELECT t.id, t.project_id, p.name AS project_name, t.assignee_id,
      COALESCE(u.full_name, u.email) AS assignee_name, t.title, t.description,
      t.status, t.priority, t.progress, t.estimated_minutes, t.is_blocked,
      t.blocker_reason, t.due_date, t.created_at, t.updated_at,
      latest_update.note AS last_update_note,
      latest_update.actor_name AS last_updated_by_name,
      latest_update.created_at AS last_update_at,
      active_focus.started_at AS active_focus_started_at,
      active_focus.user_id AS active_focus_user_id,
      active_focus.user_name AS active_focus_user_name
    FROM tbl_crm_tasks t
    INNER JOIN tbl_crm_projects p ON p.id = t.project_id
    LEFT JOIN tbl_users u ON u.id = t.assignee_id
    LEFT JOIN LATERAL (
      SELECT w.started_at, w.user_id,
        COALESCE(focus_user.full_name, focus_user.email) AS user_name
      FROM tbl_crm_project_work_entries w
      INNER JOIN tbl_users focus_user ON focus_user.id = w.user_id
      WHERE w.task_id = t.id AND w.ended_at IS NULL
      ORDER BY w.started_at DESC
      LIMIT 1
    ) active_focus ON true
    LEFT JOIN LATERAL (
      SELECT update_row.note, update_row.created_at,
        COALESCE(update_actor.full_name, update_actor.email) AS actor_name
      FROM tbl_crm_task_updates update_row
      INNER JOIN tbl_users update_actor ON update_actor.id = update_row.actor_id
      WHERE update_row.task_id = t.id
      ORDER BY update_row.created_at DESC, update_row.id DESC
      LIMIT 1
    ) latest_update ON true
    WHERE t.company_id = $3 AND ($2 OR t.assignee_id = $1 OR p.poc_user_id = $1)
    ORDER BY CASE WHEN active_focus.started_at IS NOT NULL THEN 0 ELSE 1 END,
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'review' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
      t.due_date
  `, params);

  const timeRows = await query<TimeRow>(`
    SELECT t.id, t.user_id, COALESCE(u.full_name, u.email) AS user_name,
      t.work_date, t.clock_in, t.clock_out, t.break_started_at, t.break_label,
      t.break_minutes, t.status,
      CASE WHEN t.status = 'stopped'
        THEN FLOOR(EXTRACT(EPOCH FROM (t.clock_out - t.clock_in)) / 60) - t.break_minutes
        ELSE FLOOR(EXTRACT(EPOCH FROM (now() - t.clock_in)) / 60) - t.break_minutes
          - CASE WHEN t.status = 'on_break'
              THEN FLOOR(EXTRACT(EPOCH FROM (now() - t.break_started_at)) / 60)
              ELSE 0 END
      END AS worked_minutes
    FROM tbl_crm_time_entries t
    INNER JOIN tbl_users u ON u.id = t.user_id
    WHERE t.company_id = $3
      AND t.work_date >= (now() AT TIME ZONE 'utc')::date - 30
      AND ($2 OR t.user_id = $1)
    ORDER BY t.clock_in DESC
  `, params);

  const projectWorkRows = await query<ProjectWorkRow>(`
    SELECT w.id, w.user_id, COALESCE(u.full_name, u.email) AS user_name,
      w.project_id, p.name AS project_name, w.task_id, task.title AS task_title,
      w.work_date, w.started_at, w.ended_at, w.note,
      EXTRACT(EPOCH FROM (COALESCE(w.ended_at, now()) - w.started_at)) / 60.0 AS worked_minutes
    FROM tbl_crm_project_work_entries w
    INNER JOIN tbl_users u ON u.id = w.user_id
    INNER JOIN tbl_crm_projects p ON p.id = w.project_id
    LEFT JOIN tbl_crm_tasks task ON task.id = w.task_id
    WHERE w.company_id = $3
      AND w.work_date >= (now() AT TIME ZONE 'utc')::date - 30
      AND ($2 OR w.user_id = $1 OR p.poc_user_id = $1)
    ORDER BY w.started_at DESC
  `, params);

  const taskUpdateRows = await query<TaskUpdateRow>(`
    SELECT update_row.id, update_row.task_id, task.project_id,
      update_row.actor_id,
      COALESCE(actor.full_name, actor.email) AS actor_name,
      update_row.previous_status, update_row.status,
      update_row.previous_progress, update_row.progress,
      update_row.note, update_row.is_blocked, update_row.blocker_reason,
      update_row.created_at
    FROM tbl_crm_task_updates update_row
    INNER JOIN tbl_crm_tasks task ON task.id = update_row.task_id
    INNER JOIN tbl_crm_projects project ON project.id = task.project_id
    INNER JOIN tbl_users actor ON actor.id = update_row.actor_id
    WHERE update_row.company_id = $3 AND ($2 OR task.assignee_id = $1 OR project.poc_user_id = $1)
    ORDER BY update_row.created_at DESC, update_row.id DESC
    LIMIT 250
  `, params);

  const leaveRows = await query<LeaveRow>(`
    SELECT l.id, l.user_id, COALESCE(u.full_name, u.email) AS user_name,
      l.leave_type, l.start_date, l.end_date, l.reason, l.status,
      l.manager_note, l.created_at
    FROM tbl_crm_leave_requests l
    INNER JOIN tbl_users u ON u.id = l.user_id
    WHERE l.company_id = $3 AND ($2 OR l.user_id = $1)
    ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.created_at DESC
  `, params);

  const team: CrmTeamMember[] = teamRows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    jobTitle: row.job_title,
    department: row.department,
    createdAt: iso(row.created_at)!,
    attendanceStatus: !row.is_active
      ? "inactive"
      : row.on_leave
        ? "absent"
        : row.timer_status === "working" || row.timer_status === "on_break"
          ? row.timer_status
          : "offline",
    activeSince: iso(row.active_since),
    workedMinutesToday: Math.max(0, Number(row.worked_minutes ?? 0)),
    currentProjectId: row.current_project_id,
    currentProjectName: row.current_project_name,
    currentProjectSince: iso(row.current_project_since),
    currentTaskId: row.current_task_id,
    currentTaskTitle: row.current_task_title,
    projectTrackedMinutesToday: Math.max(
      0,
      Number(row.project_tracked_minutes ?? 0),
    ),
  }));

  return {
    role: isManager ? "manager" : "member",
    currentUserId: userId,
    pocProjectIds: projectRows
      .filter((row) => row.poc_user_id === userId)
      .map((row) => row.id),
    team,
    projects: projectRows.map((row) => ({
      id: row.id, name: row.name, clientName: row.client_name,
      description: row.description, status: row.status, priority: row.priority,
      startDate: dateOnly(row.start_date), dueDate: dateOnly(row.due_date),
      createdBy: row.created_by, createdAt: iso(row.created_at)!,
      pocId: row.poc_user_id, pocName: row.poc_name,
      memberIds: row.member_ids ? row.member_ids.split(",") : [],
      memberNames: row.member_names ? row.member_names.split(", ") : [],
      taskCount: Number(row.task_count), completedTaskCount: Number(row.completed_task_count),
      reviewTaskCount: Number(row.review_task_count),
      blockedTaskCount: Number(row.blocked_task_count),
      overdueTaskCount: Number(row.overdue_task_count),
      loggedMinutes: Math.max(0, Number(row.logged_minutes ?? 0)),
      progress: Math.round(Number(row.progress ?? 0)),
    })),
    tasks: taskRows.map((row) => ({
      id: row.id, projectId: row.project_id, projectName: row.project_name,
      assigneeId: row.assignee_id, assigneeName: row.assignee_name, title: row.title,
      description: row.description, status: row.status, priority: row.priority,
      progress: Number(row.progress), estimatedMinutes: row.estimated_minutes,
      isBlocked: Boolean(row.is_blocked), blockerReason: row.blocker_reason,
      dueDate: dateOnly(row.due_date),
      createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!,
      lastUpdateNote: row.last_update_note,
      lastUpdatedByName: row.last_updated_by_name,
      lastUpdateAt: iso(row.last_update_at),
      activeFocusStartedAt: iso(row.active_focus_started_at),
      activeFocusUserId: row.active_focus_user_id,
      activeFocusUserName: row.active_focus_user_name,
    })),
    taskUpdates: taskUpdateRows.map((row): CrmTaskUpdate => ({
      id: Number(row.id),
      taskId: row.task_id,
      projectId: row.project_id,
      actorId: row.actor_id,
      actorName: row.actor_name,
      previousStatus: row.previous_status,
      status: row.status,
      previousProgress: row.previous_progress,
      progress: Number(row.progress),
      note: row.note,
      isBlocked: Boolean(row.is_blocked),
      blockerReason: row.blocker_reason,
      createdAt: iso(row.created_at)!,
    })),
    timeEntries: timeRows.map((row) => ({
      id: Number(row.id), userId: row.user_id, userName: row.user_name,
      workDate: dateOnly(row.work_date)!, clockIn: iso(row.clock_in)!,
      clockOut: iso(row.clock_out), breakStartedAt: iso(row.break_started_at),
      breakLabel: row.break_label, breakMinutes: Number(row.break_minutes),
      status: row.status,
      workedMinutes: Math.max(0, Number(row.worked_minutes)),
    })),
    projectWorkEntries: projectWorkRows.map((row): CrmProjectWorkEntry => ({
      id: Number(row.id),
      userId: row.user_id,
      userName: row.user_name,
      projectId: row.project_id,
      projectName: row.project_name,
      taskId: row.task_id,
      taskTitle: row.task_title,
      workDate: dateOnly(row.work_date)!,
      startedAt: iso(row.started_at)!,
      endedAt: iso(row.ended_at),
      note: row.note,
      workedMinutes: Math.max(0, Number(row.worked_minutes)),
      status: row.ended_at ? "completed" : "active",
    })),
    leaveRequests: leaveRows.map((row) => ({
      id: row.id, userId: row.user_id, userName: row.user_name,
      leaveType: row.leave_type, startDate: dateOnly(row.start_date)!,
      endDate: dateOnly(row.end_date)!, reason: row.reason, status: row.status,
      managerNote: row.manager_note, createdAt: iso(row.created_at)!,
    })),
  };
}

export async function upsertMemberProfile(
  userId: string,
  companyId: number,
  jobTitle: string | null,
  department: string | null,
) {
  await query(
    `
    INSERT INTO tbl_crm_member_profiles (user_id, company_id, job_title, department, is_active)
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (user_id) DO UPDATE
      SET job_title = $3, department = $4, is_active = true
    `,
    [userId, companyId, jobTitle, department],
  );
  await query(`UPDATE tbl_users SET is_active = true WHERE id = $1`, [userId]);
}

export async function setCrmMemberActive(userId: string, companyId: number, isActive: boolean) {
  const changed = await query<{ user_id: string }>(
    `
    UPDATE tbl_crm_member_profiles p
    SET is_active = $3
    FROM tbl_users u
    WHERE p.user_id = $1 AND p.company_id = $2 AND u.id = p.user_id AND u.role = 'user'
    RETURNING p.user_id
    `,
    [userId, companyId, isActive],
  );
  if (changed.length === 0) return false;

  if (!isActive) {
    await query(
      `
      UPDATE tbl_crm_time_entries
      SET break_minutes = break_minutes + CASE
            WHEN status = 'on_break'
              THEN FLOOR(EXTRACT(EPOCH FROM (now() - break_started_at)) / 60)
            ELSE 0 END,
          break_started_at = NULL, clock_out = now(), status = 'stopped'
      WHERE user_id = $1 AND status IN ('working', 'on_break')
      `,
      [userId],
    );
    await query(
      `UPDATE tbl_crm_project_work_entries SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL`,
      [userId],
    );
    await query(`UPDATE tbl_users SET is_active = false WHERE id = $1`, [userId]);
  } else {
    await query(`UPDATE tbl_users SET is_active = true WHERE id = $1`, [userId]);
  }
  return true;
}

export async function createCrmProject(input: {
  name: string; clientName: string | null; description: string | null;
  status: string; priority: string; startDate: string | null; dueDate: string | null;
  createdBy: string; companyId: number; memberIds: string[]; pocUserId: string | null;
}) {
  const row = await queryOne<{ id: string }>(
    `
    INSERT INTO tbl_crm_projects
      (company_id, name, client_name, description, status, priority, start_date, due_date, poc_user_id, created_by)
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      CASE WHEN EXISTS (
        SELECT 1 FROM tbl_crm_member_profiles WHERE user_id = $9 AND company_id = $1 AND is_active = true
      ) THEN $9 ELSE NULL END,
      $10
    )
    RETURNING id
    `,
    [
      input.companyId, input.name, input.clientName, input.description,
      input.status, input.priority, input.startDate, input.dueDate,
      input.pocUserId, input.createdBy,
    ],
  );
  if (!row) throw new Error("Could not create project");
  const projectMembers = input.pocUserId
    ? [...input.memberIds, input.pocUserId]
    : input.memberIds;
  for (const memberId of new Set(projectMembers)) {
    await query(
      `
      INSERT INTO tbl_crm_project_members (company_id, project_id, user_id)
      SELECT $1, $2, $3
      WHERE EXISTS (SELECT 1 FROM tbl_crm_member_profiles WHERE user_id = $3 AND company_id = $1 AND is_active = true)
      ON CONFLICT DO NOTHING
      `,
      [input.companyId, row.id, memberId],
    );
  }
  return row.id;
}

export async function assignCrmMember(projectId: string, userId: string, companyId: number) {
  const rows = await query<{ id: string }>(
    `
    INSERT INTO tbl_crm_project_members (company_id, project_id, user_id)
    SELECT $2, $1, $3
    WHERE EXISTS (SELECT 1 FROM tbl_crm_projects WHERE id = $1 AND company_id = $2)
    AND EXISTS (SELECT 1 FROM tbl_crm_member_profiles WHERE user_id = $3 AND company_id = $2 AND is_active = true)
    AND NOT EXISTS (SELECT 1 FROM tbl_crm_project_members WHERE project_id = $1 AND user_id = $3)
    RETURNING project_id AS id
    `,
    [projectId, companyId, userId],
  );
  return rows.length > 0;
}

export async function isCrmProjectPoc(projectId: string, userId: string, companyId: number) {
  const row = await queryOne<{ allowed: number }>(
    `SELECT 1 AS allowed FROM tbl_crm_projects WHERE id = $1 AND company_id = $2 AND poc_user_id = $3`,
    [projectId, companyId, userId],
  );
  return Boolean(row);
}

export async function setCrmProjectPoc(projectId: string, pocUserId: string | null, companyId: number) {
  const rows = await query<{ id: string }>(
    `
    WITH validated AS (
      SELECT $1::uuid AS project_id
      WHERE EXISTS (SELECT 1 FROM tbl_crm_projects WHERE id = $1 AND company_id = $3)
      AND (
        $2::uuid IS NULL OR EXISTS (
          SELECT 1
          FROM tbl_crm_member_profiles profile
          INNER JOIN tbl_users app_user ON app_user.id = profile.user_id
          WHERE profile.user_id = $2
            AND profile.company_id = $3
            AND profile.is_active = true
            AND app_user.is_active = true
            AND app_user.role NOT IN ('admin', 'superadmin')
        )
      )
    ),
    updated AS (
      UPDATE tbl_crm_projects
      SET poc_user_id = $2
      WHERE id = (SELECT project_id FROM validated)
      RETURNING id
    ),
    member_insert AS (
      INSERT INTO tbl_crm_project_members (company_id, project_id, user_id)
      SELECT $3, id, $2 FROM updated WHERE $2::uuid IS NOT NULL
      ON CONFLICT DO NOTHING
      RETURNING project_id
    )
    SELECT u.id FROM updated u LEFT JOIN member_insert m ON true
    `,
    [projectId, pocUserId, companyId],
  );
  return rows.length > 0;
}

export async function updateCrmProjectStatus(input: {
  projectId: string;
  companyId: number;
  status: CrmProject["status"];
  canReopen: boolean;
}) {
  const rows = await query<{ id: string }>(
    `
    UPDATE tbl_crm_projects
    SET status = $2
    WHERE id = $1 AND company_id = $3
      ${input.canReopen ? "" : "AND status <> 'completed'"}
      AND (
        $2 <> 'completed' OR NOT EXISTS (
          SELECT 1 FROM tbl_crm_tasks task
          WHERE task.project_id = $1 AND (task.status <> 'done' OR task.is_blocked = true)
        )
      )
    RETURNING id
    `,
    [input.projectId, input.status, input.companyId],
  );
  return rows.length > 0;
}

export async function getCrmTaskAccess(taskId: string, actorId: string, companyId: number) {
  return queryOne<{
    project_id: string;
    status: CrmTask["status"];
    is_assignee: boolean;
    is_poc: boolean;
    has_poc: boolean;
  }>(
    `
    SELECT task.project_id, task.status,
      COALESCE(task.assignee_id = $2, false) AS is_assignee,
      COALESCE(project.poc_user_id = $2, false) AS is_poc,
      (project.poc_user_id IS NOT NULL) AS has_poc
    FROM tbl_crm_tasks task
    INNER JOIN tbl_crm_projects project ON project.id = task.project_id
    WHERE task.id = $1 AND task.company_id = $3
    `,
    [taskId, actorId, companyId],
  );
}

export async function createCrmTask(input: {
  projectId: string; companyId: number; assigneeId: string | null; title: string;
  description: string | null; priority: string; dueDate: string | null;
  estimatedMinutes: number | null; createdBy: string;
}) {
  const rows = await query<{ id: string }>(
    `
    WITH created AS (
      INSERT INTO tbl_crm_tasks
        (company_id, project_id, assignee_id, title, description, priority, due_date, estimated_minutes, created_by)
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
      WHERE EXISTS (SELECT 1 FROM tbl_crm_projects WHERE id = $2 AND company_id = $1)
      AND (
        $3::uuid IS NULL OR EXISTS (
          SELECT 1
          FROM tbl_crm_project_members pm
          INNER JOIN tbl_crm_member_profiles profile
            ON profile.user_id = pm.user_id AND profile.company_id = $1 AND profile.is_active = true
          WHERE pm.project_id = $2 AND pm.user_id = $3
        )
      )
      RETURNING id, status, progress, is_blocked, blocker_reason
    ),
    audit AS (
      INSERT INTO tbl_crm_task_updates
        (company_id, task_id, actor_id, previous_status, status, previous_progress, progress, note, is_blocked, blocker_reason)
      SELECT $1, id, $9, NULL, status, NULL, progress, 'Task created', is_blocked, blocker_reason
      FROM created
      RETURNING id
    )
    SELECT c.id FROM created c LEFT JOIN audit a ON true
    `,
    [
      input.companyId, input.projectId, input.assigneeId, input.title,
      input.description, input.priority, input.dueDate, input.estimatedMinutes,
      input.createdBy,
    ],
  );
  return rows.length > 0;
}

export async function updateCrmTask(input: {
  taskId: string; companyId: number; actorId: string;
  canManage: boolean; status: CrmTask["status"]; progress: number;
  note: string | null; isBlocked: boolean; blockerReason: string | null;
}) {
  const guard = input.canManage ? "" : "AND assignee_id = $2";
  const rows = await query<{ id: string }>(
    `
    WITH previous AS (
      SELECT status, progress FROM tbl_crm_tasks WHERE id = $1 AND company_id = $8 ${guard}
    ),
    updated AS (
      UPDATE tbl_crm_tasks SET
        status = $3,
        progress = CASE WHEN $3 = 'done' THEN 100 ELSE $4 END,
        is_blocked = CASE WHEN $3 = 'done' THEN false ELSE $6 END,
        blocker_reason = CASE WHEN $3 = 'done' OR NOT $6 THEN NULL ELSE $7 END
      WHERE id = $1 AND company_id = $8 ${guard}
      RETURNING id
    ),
    audit AS (
      INSERT INTO tbl_crm_task_updates
        (company_id, task_id, actor_id, previous_status, status, previous_progress, progress, note, is_blocked, blocker_reason)
      SELECT $8, $1, $2, previous.status, $3, previous.progress,
        CASE WHEN $3 = 'done' THEN 100 ELSE $4 END,
        $5,
        CASE WHEN $3 = 'done' THEN false ELSE $6 END,
        CASE WHEN $3 = 'done' OR NOT $6 THEN NULL ELSE $7 END
      FROM previous, updated
      RETURNING id
    ),
    work_stop AS (
      UPDATE tbl_crm_project_work_entries
      SET ended_at = now()
      WHERE task_id = (SELECT id FROM updated) AND ended_at IS NULL AND $3 = 'done'
      RETURNING id
    )
    SELECT u.id FROM updated u LEFT JOIN audit a ON true LEFT JOIN work_stop w ON true
    `,
    [
      input.taskId, input.actorId, input.status, input.progress,
      input.note, input.isBlocked, input.blockerReason, input.companyId,
    ],
  );
  return rows.length > 0;
}

export async function manageCrmTask(input: {
  taskId: string;
  companyId: number;
  actorId: string;
  assigneeId: string | null;
  priority: CrmTask["priority"];
  dueDate: string | null;
  estimatedMinutes: number | null;
}) {
  const rows = await query<{ id: string }>(
    `
    WITH updated AS (
      UPDATE tbl_crm_tasks task SET
        assignee_id = $3,
        priority = $4,
        due_date = $5,
        estimated_minutes = $6
      WHERE task.id = $1 AND task.company_id = $7
        AND (
          $3::uuid IS NULL OR EXISTS (
            SELECT 1
            FROM tbl_crm_project_members member
            INNER JOIN tbl_crm_member_profiles profile
              ON profile.user_id = member.user_id AND profile.company_id = $7 AND profile.is_active = true
            WHERE member.project_id = task.project_id AND member.user_id = $3
          )
        )
      RETURNING id, status, progress, is_blocked, blocker_reason
    ),
    audit AS (
      INSERT INTO tbl_crm_task_updates
        (company_id, task_id, actor_id, previous_status, status, previous_progress, progress, note, is_blocked, blocker_reason)
      SELECT $7, id, $2, status, status, progress, progress,
        'Task assignment or planning details updated', is_blocked, blocker_reason
      FROM updated
      RETURNING id
    )
    SELECT u.id FROM updated u LEFT JOIN audit a ON true
    `,
    [input.taskId, input.actorId, input.assigneeId, input.priority, input.dueDate, input.estimatedMinutes, input.companyId],
  );
  return rows.length > 0;
}

export async function performTimerAction(
  userId: string,
  companyId: number,
  action: "clock_in" | "start_break" | "end_break" | "clock_out",
  breakLabel: string | null = null,
) {
  const params = [userId];
  if (action === "clock_in") {
    const active = await queryOne<{ id: number }>(
      `SELECT id FROM tbl_crm_time_entries WHERE user_id = $1 AND status IN ('working', 'on_break') LIMIT 1`,
      params,
    );
    if (active) return false;
    await query(`INSERT INTO tbl_crm_time_entries (company_id, user_id) VALUES ($1, $2)`, [companyId, userId]);
    return true;
  }

  const expectedStatus = action === "start_break" ? "working" : "on_break";
  const active = await queryOne<{ id: number }>(
    `
    SELECT id FROM tbl_crm_time_entries
    WHERE user_id = $1 AND status = $2
    ORDER BY clock_in DESC
    LIMIT 1
    `,
    [userId, action === "clock_out" ? "working" : expectedStatus],
  );

  if (!active && action === "clock_out") {
    const onBreak = await queryOne<{ id: number }>(
      `SELECT id FROM tbl_crm_time_entries WHERE user_id = $1 AND status = 'on_break' ORDER BY clock_in DESC LIMIT 1`,
      params,
    );
    if (!onBreak) return false;
    await query(
      `UPDATE tbl_crm_project_work_entries SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL`,
      params,
    );
    await query(
      `
      UPDATE tbl_crm_time_entries SET
        break_minutes = break_minutes + FLOOR(EXTRACT(EPOCH FROM (now() - break_started_at)) / 60),
        break_started_at = NULL, clock_out = now(), status = 'stopped'
      WHERE id = $1
      `,
      [onBreak.id],
    );
    return true;
  }

  if (!active) return false;

  if (action === "start_break") {
    await query(
      `UPDATE tbl_crm_project_work_entries SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL`,
      params,
    );
    await query(
      `
      UPDATE tbl_crm_time_entries SET
        break_started_at = now(), break_label = $2, status = 'on_break'
      WHERE id = $1
      `,
      [active.id, breakLabel?.trim() || "General break"],
    );
  } else if (action === "end_break") {
    await query(
      `
      UPDATE tbl_crm_time_entries SET
        break_minutes = break_minutes + FLOOR(EXTRACT(EPOCH FROM (now() - break_started_at)) / 60),
        break_started_at = NULL, status = 'working'
      WHERE id = $1
      `,
      [active.id],
    );
  } else {
    await query(
      `UPDATE tbl_crm_project_work_entries SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL`,
      params,
    );
    await query(
      `UPDATE tbl_crm_time_entries SET clock_out = now(), status = 'stopped' WHERE id = $1`,
      [active.id],
    );
  }
  return true;
}

export async function performProjectWorkAction(input: {
  userId: string;
  companyId: number;
  isManager: boolean;
  action: "start" | "stop";
  projectId: string | null;
  taskId: string | null;
  note: string | null;
}) {
  if (input.action === "stop") {
    const rows = await query<{ id: number }>(
      `UPDATE tbl_crm_project_work_entries SET ended_at = now() WHERE user_id = $1 AND ended_at IS NULL RETURNING id`,
      [input.userId],
    );
    return rows.length > 0;
  }

  if (!input.projectId) return false;
  const { userId, companyId, projectId, taskId, note, isManager } = input;

  return withTransaction(async (run) => {
    const eligible = await run<{ ok: boolean }>(
      `
      SELECT (
        EXISTS (SELECT 1 FROM tbl_crm_time_entries WHERE user_id = $1 AND status = 'working')
        AND EXISTS (SELECT 1 FROM tbl_crm_projects WHERE id = $2 AND company_id = $5 AND status <> 'completed')
        AND (
          $3::uuid IS NULL OR EXISTS (
            SELECT 1 FROM tbl_crm_tasks
            WHERE id = $3 AND project_id = $2 AND assignee_id = $1 AND status <> 'done'
          )
        )
        AND (
          $4 OR EXISTS (
            SELECT 1 FROM tbl_crm_project_members WHERE project_id = $2 AND user_id = $1
          ) OR EXISTS (
            SELECT 1 FROM tbl_crm_tasks WHERE project_id = $2 AND assignee_id = $1
          )
        )
      ) AS ok
      `,
      [userId, projectId, taskId, isManager, companyId],
    );
    if (!eligible[0]?.ok) return [];

    const active = await run<{ id: number; project_id: string; task_id: string | null }>(
      `
      SELECT id, project_id, task_id
      FROM tbl_crm_project_work_entries
      WHERE user_id = $1 AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId],
    );
    const current = active[0] ?? null;
    const sameEntry =
      current != null &&
      current.project_id === projectId &&
      (current.task_id === taskId || (current.task_id == null && taskId == null));

    if (current && sameEntry) {
      return run<{ id: number }>(
        `UPDATE tbl_crm_project_work_entries SET note = COALESCE($2, note) WHERE id = $1 RETURNING id`,
        [current.id, note],
      );
    }

    if (current) {
      await run(`UPDATE tbl_crm_project_work_entries SET ended_at = now() WHERE id = $1`, [
        current.id,
      ]);
    }

    const inserted = await run<{ id: number }>(
      `
      INSERT INTO tbl_crm_project_work_entries (company_id, project_id, task_id, user_id, note)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [companyId, projectId, taskId, userId, note],
    );

    await run(
      `
      INSERT INTO tbl_crm_task_updates
        (company_id, task_id, actor_id, previous_status, status, previous_progress, progress, note, is_blocked, blocker_reason)
      SELECT $4, id, $2, status, 'in_progress', progress, progress,
        COALESCE($3, 'Work started'), is_blocked, blocker_reason
      FROM tbl_crm_tasks
      WHERE id = $1 AND status = 'todo'
      `,
      [taskId, userId, note, companyId],
    );

    await run(
      `
      UPDATE tbl_crm_tasks
      SET status = CASE WHEN status = 'todo' THEN 'in_progress' ELSE status END
      WHERE id = $1
      `,
      [taskId],
    );

    return inserted;
  }).then((rows) => rows.length > 0);
}

export async function createLeaveRequest(input: {
  userId: string; companyId: number; leaveType: string;
  startDate: string; endDate: string; reason: string | null;
}) {
  await query(
    `
    INSERT INTO tbl_crm_leave_requests (company_id, user_id, leave_type, start_date, end_date, reason)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [input.companyId, input.userId, input.leaveType, input.startDate, input.endDate, input.reason],
  );
}

export async function reviewLeaveRequest(input: {
  leaveId: string; companyId: number; reviewerId: string;
  status: "approved" | "rejected"; managerNote: string | null;
}) {
  const rows = await query<{ id: string }>(
    `
    UPDATE tbl_crm_leave_requests SET status = $2, manager_note = $3,
      reviewed_by = $4, reviewed_at = now()
    WHERE id = $1 AND company_id = $5 AND status = 'pending'
    RETURNING id
    `,
    [input.leaveId, input.status, input.managerNote, input.reviewerId, input.companyId],
  );
  return rows.length > 0;
}

// ── Referral / invite links ─────────────────────────────────────────────────

/** Get (or lazily create) this manager's stable invite link code. */
export async function getOrCreateReferralLink(createdBy: string): Promise<string> {
  const row = await queryOne<{ sp_get_or_create_referral_link: string }>(
    "SELECT sp_get_or_create_referral_link($1)",
    [createdBy],
  );
  if (!row) throw new Error("Could not create invite link");
  return row.sp_get_or_create_referral_link;
}
