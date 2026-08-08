import "server-only";
import { query, queryOne } from "@/lib/db/mssql";
import type {
  CrmBrandOption,
  CrmLeaveRequest,
  CrmProject,
  CrmProjectWorkEntry,
  CrmSnapshot,
  CrmTask,
  CrmTaskUpdate,
  CrmTeamMember,
  CrmTimeEntry,
} from "@/features/crm/types";

let schemaPromise: Promise<void> | null = null;

/**
 * CRM data is tenant-scoped by account_id. The migration statements below are
 * additive and preserve records created before brand scoping was introduced.
 */
export function ensureCrmSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await query(`
        IF OBJECT_ID('dbo.tbl_crm_member_profiles', 'U') IS NULL
        CREATE TABLE dbo.tbl_crm_member_profiles (
          account_id INT NOT NULL,
          user_id UNIQUEIDENTIFIER NOT NULL,
          job_title NVARCHAR(120) NULL,
          department NVARCHAR(120) NULL,
          is_active BIT NOT NULL CONSTRAINT DF_crm_profile_active DEFAULT 1,
          created_at DATETIME2(3) NOT NULL CONSTRAINT DF_crm_profile_created DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_crm_profile_updated DEFAULT SYSUTCDATETIME(),
          CONSTRAINT PK_tbl_crm_member_profiles PRIMARY KEY (account_id, user_id),
          CONSTRAINT FK_crm_profile_account FOREIGN KEY (account_id)
            REFERENCES dbo.tbl_accounts(account_id) ON DELETE CASCADE,
          CONSTRAINT FK_crm_profile_user FOREIGN KEY (user_id)
            REFERENCES dbo.tbl_users(id) ON DELETE CASCADE
        );
      `);
      await query(`
        IF OBJECT_ID('dbo.tbl_crm_projects', 'U') IS NULL
        CREATE TABLE dbo.tbl_crm_projects (
          id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_tbl_crm_projects PRIMARY KEY DEFAULT NEWID(),
          account_id INT NOT NULL CONSTRAINT FK_crm_project_account
            REFERENCES dbo.tbl_accounts(account_id) ON DELETE CASCADE,
          name NVARCHAR(200) NOT NULL,
          client_name NVARCHAR(200) NULL,
          description NVARCHAR(1000) NULL,
          status VARCHAR(20) NOT NULL CONSTRAINT DF_crm_project_status DEFAULT 'planning'
            CONSTRAINT CK_crm_project_status CHECK (status IN ('planning','active','on_hold','completed')),
          priority VARCHAR(20) NOT NULL CONSTRAINT DF_crm_project_priority DEFAULT 'p2'
            CONSTRAINT CK_crm_project_priority CHECK (priority IN ('p0','p1','p2','p3')),
          start_date DATE NULL,
          due_date DATE NULL,
          poc_user_id UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_crm_project_poc REFERENCES dbo.tbl_users(id),
          created_by UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_crm_project_creator REFERENCES dbo.tbl_users(id),
          created_at DATETIME2(3) NOT NULL CONSTRAINT DF_crm_project_created DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_crm_project_updated DEFAULT SYSUTCDATETIME(),
          CONSTRAINT UQ_crm_project_account_id UNIQUE (account_id, id)
        );
      `);
      await query(`
        IF OBJECT_ID('dbo.tbl_crm_project_members', 'U') IS NULL
        CREATE TABLE dbo.tbl_crm_project_members (
          account_id INT NOT NULL CONSTRAINT FK_crm_pm_account REFERENCES dbo.tbl_accounts(account_id),
          project_id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT FK_crm_pm_project REFERENCES dbo.tbl_crm_projects(id) ON DELETE CASCADE,
          user_id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT FK_crm_pm_user REFERENCES dbo.tbl_users(id) ON DELETE CASCADE,
          assigned_at DATETIME2(3) NOT NULL CONSTRAINT DF_crm_pm_assigned DEFAULT SYSUTCDATETIME(),
          CONSTRAINT PK_tbl_crm_project_members PRIMARY KEY (account_id, project_id, user_id)
        );
      `);
      await query(`
        IF OBJECT_ID('dbo.tbl_crm_tasks', 'U') IS NULL
        CREATE TABLE dbo.tbl_crm_tasks (
          id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_tbl_crm_tasks PRIMARY KEY DEFAULT NEWID(),
          account_id INT NOT NULL CONSTRAINT FK_crm_task_account REFERENCES dbo.tbl_accounts(account_id),
          project_id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT FK_crm_task_project REFERENCES dbo.tbl_crm_projects(id) ON DELETE CASCADE,
          assignee_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_crm_task_assignee REFERENCES dbo.tbl_users(id),
          title NVARCHAR(240) NOT NULL,
          description NVARCHAR(1200) NULL,
          status VARCHAR(20) NOT NULL CONSTRAINT DF_crm_task_status DEFAULT 'todo'
            CONSTRAINT CK_crm_task_status CHECK (status IN ('todo','in_progress','review','done')),
          priority VARCHAR(20) NOT NULL CONSTRAINT DF_crm_task_priority DEFAULT 'p2'
            CONSTRAINT CK_crm_task_priority CHECK (priority IN ('p0','p1','p2','p3')),
          progress TINYINT NOT NULL CONSTRAINT DF_crm_task_progress DEFAULT 0
            CONSTRAINT CK_crm_task_progress CHECK (progress BETWEEN 0 AND 100),
          estimated_minutes INT NULL
            CONSTRAINT CK_crm_task_estimate CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
          is_blocked BIT NOT NULL CONSTRAINT DF_crm_task_blocked DEFAULT 0,
          blocker_reason NVARCHAR(600) NULL,
          due_date DATE NULL,
          created_by UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_crm_task_creator REFERENCES dbo.tbl_users(id),
          created_at DATETIME2(3) NOT NULL CONSTRAINT DF_crm_task_created DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_crm_task_updated DEFAULT SYSUTCDATETIME()
        );
      `);
      await query(`
        IF COL_LENGTH('dbo.tbl_crm_projects', 'poc_user_id') IS NULL
          ALTER TABLE dbo.tbl_crm_projects ADD poc_user_id UNIQUEIDENTIFIER NULL;

        IF COL_LENGTH('dbo.tbl_crm_tasks', 'estimated_minutes') IS NULL
          ALTER TABLE dbo.tbl_crm_tasks ADD estimated_minutes INT NULL;
        IF COL_LENGTH('dbo.tbl_crm_tasks', 'is_blocked') IS NULL
          ALTER TABLE dbo.tbl_crm_tasks
            ADD is_blocked BIT NOT NULL
              CONSTRAINT DF_crm_task_blocked DEFAULT 0 WITH VALUES;
        IF COL_LENGTH('dbo.tbl_crm_tasks', 'blocker_reason') IS NULL
          ALTER TABLE dbo.tbl_crm_tasks ADD blocker_reason NVARCHAR(600) NULL;
      `);
      // Constraints and indexes must be compiled in a later SQL batch. SQL
      // Server resolves referenced columns before executing earlier statements
      // in the same batch, which breaks upgrades where these columns are new.
      await query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_project_poc'
        )
          ALTER TABLE dbo.tbl_crm_projects
            ADD CONSTRAINT FK_crm_project_poc
              FOREIGN KEY (poc_user_id) REFERENCES dbo.tbl_users(id);
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE object_id = OBJECT_ID('dbo.tbl_crm_projects')
            AND name = 'IX_crm_project_poc'
        )
          CREATE INDEX IX_crm_project_poc
            ON dbo.tbl_crm_projects(account_id, poc_user_id)
            WHERE poc_user_id IS NOT NULL;

        IF NOT EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_tasks')
            AND name = 'CK_crm_task_estimate'
        )
          ALTER TABLE dbo.tbl_crm_tasks WITH CHECK
            ADD CONSTRAINT CK_crm_task_estimate
              CHECK (estimated_minutes IS NULL OR estimated_minutes > 0);
      `);
      await query(`
        IF OBJECT_ID('dbo.tbl_crm_task_updates', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.tbl_crm_task_updates (
            id BIGINT IDENTITY(1,1) NOT NULL
              CONSTRAINT PK_tbl_crm_task_updates PRIMARY KEY,
            account_id INT NOT NULL
              CONSTRAINT FK_crm_task_update_account
                REFERENCES dbo.tbl_accounts(account_id),
            task_id UNIQUEIDENTIFIER NOT NULL
              CONSTRAINT FK_crm_task_update_task
                REFERENCES dbo.tbl_crm_tasks(id) ON DELETE CASCADE,
            actor_id UNIQUEIDENTIFIER NOT NULL
              CONSTRAINT FK_crm_task_update_actor REFERENCES dbo.tbl_users(id),
            previous_status VARCHAR(20) NULL,
            status VARCHAR(20) NOT NULL,
            previous_progress TINYINT NULL,
            progress TINYINT NOT NULL,
            note NVARCHAR(600) NULL,
            is_blocked BIT NOT NULL CONSTRAINT DF_crm_task_update_blocked DEFAULT 0,
            blocker_reason NVARCHAR(600) NULL,
            created_at DATETIME2(3) NOT NULL
              CONSTRAINT DF_crm_task_update_created DEFAULT SYSUTCDATETIME(),
            CONSTRAINT CK_crm_task_update_status
              CHECK (status IN ('todo','in_progress','review','done')),
            CONSTRAINT CK_crm_task_update_previous_status
              CHECK (previous_status IS NULL OR previous_status IN ('todo','in_progress','review','done')),
            CONSTRAINT CK_crm_task_update_progress CHECK (progress BETWEEN 0 AND 100),
            CONSTRAINT CK_crm_task_update_previous_progress
              CHECK (previous_progress IS NULL OR previous_progress BETWEEN 0 AND 100)
          );
          CREATE INDEX IX_crm_task_updates_task
            ON dbo.tbl_crm_task_updates(account_id, task_id, created_at DESC);
        END;
      `);
      await query(`
        SET XACT_ABORT ON;
        BEGIN TRY
          BEGIN TRANSACTION;

          IF EXISTS (
            SELECT 1 FROM dbo.tbl_crm_projects
            WHERE priority IN ('urgent', 'high', 'medium', 'low')
          )
          OR NOT EXISTS (
            SELECT 1
            FROM sys.default_constraints dc
            INNER JOIN sys.columns c
              ON c.object_id = dc.parent_object_id
              AND c.column_id = dc.parent_column_id
            WHERE dc.parent_object_id = OBJECT_ID('dbo.tbl_crm_projects')
              AND c.name = 'priority'
              AND dc.definition LIKE '%p2%'
          )
          OR NOT EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_projects')
              AND name = 'CK_crm_project_priority'
              AND definition LIKE '%p0%'
              AND definition LIKE '%p3%'
          )
          BEGIN
            IF EXISTS (
              SELECT 1 FROM sys.default_constraints
              WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_projects')
                AND name = 'DF_crm_project_priority'
            )
              ALTER TABLE dbo.tbl_crm_projects
                DROP CONSTRAINT DF_crm_project_priority;
            IF EXISTS (
              SELECT 1 FROM sys.check_constraints
              WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_projects')
                AND name = 'CK_crm_project_priority'
            )
              ALTER TABLE dbo.tbl_crm_projects
                DROP CONSTRAINT CK_crm_project_priority;

            UPDATE dbo.tbl_crm_projects
            SET priority = CASE priority
              WHEN 'urgent' THEN 'p0'
              WHEN 'high' THEN 'p1'
              WHEN 'medium' THEN 'p2'
              WHEN 'low' THEN 'p3'
              ELSE priority
            END;

            ALTER TABLE dbo.tbl_crm_projects
              ADD CONSTRAINT DF_crm_project_priority DEFAULT 'p2' FOR priority;
            ALTER TABLE dbo.tbl_crm_projects WITH CHECK
              ADD CONSTRAINT CK_crm_project_priority
                CHECK (priority IN ('p0','p1','p2','p3'));
          END;

          IF EXISTS (
            SELECT 1 FROM dbo.tbl_crm_tasks
            WHERE priority IN ('urgent', 'high', 'medium', 'low')
          )
          OR NOT EXISTS (
            SELECT 1
            FROM sys.default_constraints dc
            INNER JOIN sys.columns c
              ON c.object_id = dc.parent_object_id
              AND c.column_id = dc.parent_column_id
            WHERE dc.parent_object_id = OBJECT_ID('dbo.tbl_crm_tasks')
              AND c.name = 'priority'
              AND dc.definition LIKE '%p2%'
          )
          OR NOT EXISTS (
            SELECT 1 FROM sys.check_constraints
            WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_tasks')
              AND name = 'CK_crm_task_priority'
              AND definition LIKE '%p0%'
              AND definition LIKE '%p3%'
          )
          BEGIN
            IF EXISTS (
              SELECT 1 FROM sys.default_constraints
              WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_tasks')
                AND name = 'DF_crm_task_priority'
            )
              ALTER TABLE dbo.tbl_crm_tasks
                DROP CONSTRAINT DF_crm_task_priority;
            IF EXISTS (
              SELECT 1 FROM sys.check_constraints
              WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_tasks')
                AND name = 'CK_crm_task_priority'
            )
              ALTER TABLE dbo.tbl_crm_tasks
                DROP CONSTRAINT CK_crm_task_priority;

            UPDATE dbo.tbl_crm_tasks
            SET priority = CASE priority
              WHEN 'urgent' THEN 'p0'
              WHEN 'high' THEN 'p1'
              WHEN 'medium' THEN 'p2'
              WHEN 'low' THEN 'p3'
              ELSE priority
            END;

            ALTER TABLE dbo.tbl_crm_tasks
              ADD CONSTRAINT DF_crm_task_priority DEFAULT 'p2' FOR priority;
            ALTER TABLE dbo.tbl_crm_tasks WITH CHECK
              ADD CONSTRAINT CK_crm_task_priority
                CHECK (priority IN ('p0','p1','p2','p3'));
          END;

          COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
          THROW;
        END CATCH;
      `);
      await query(`
        IF OBJECT_ID('dbo.tbl_crm_time_entries', 'U') IS NULL
        CREATE TABLE dbo.tbl_crm_time_entries (
          id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_tbl_crm_time_entries PRIMARY KEY,
          account_id INT NOT NULL CONSTRAINT FK_crm_time_account
            REFERENCES dbo.tbl_accounts(account_id) ON DELETE CASCADE,
          user_id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT FK_crm_time_user REFERENCES dbo.tbl_users(id) ON DELETE CASCADE,
          work_date DATE NOT NULL CONSTRAINT DF_crm_time_date DEFAULT CONVERT(date, SYSUTCDATETIME()),
          clock_in DATETIME2(3) NOT NULL CONSTRAINT DF_crm_time_in DEFAULT SYSUTCDATETIME(),
          clock_out DATETIME2(3) NULL,
          break_started_at DATETIME2(3) NULL,
          break_label NVARCHAR(120) NULL,
          break_minutes INT NOT NULL CONSTRAINT DF_crm_break_minutes DEFAULT 0,
          status VARCHAR(20) NOT NULL CONSTRAINT DF_crm_time_status DEFAULT 'working'
            CONSTRAINT CK_crm_time_status CHECK (status IN ('working','on_break','stopped'))
        );
      `);
      await query(`
        IF OBJECT_ID('dbo.tbl_crm_project_work_entries', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.tbl_crm_project_work_entries (
            id BIGINT IDENTITY(1,1) NOT NULL
              CONSTRAINT PK_tbl_crm_project_work_entries PRIMARY KEY,
            account_id INT NOT NULL
              CONSTRAINT FK_crm_project_work_account
                REFERENCES dbo.tbl_accounts(account_id),
            project_id UNIQUEIDENTIFIER NOT NULL
              CONSTRAINT FK_crm_project_work_project
                REFERENCES dbo.tbl_crm_projects(id) ON DELETE CASCADE,
            task_id UNIQUEIDENTIFIER NULL
              CONSTRAINT FK_crm_project_work_task
                REFERENCES dbo.tbl_crm_tasks(id),
            user_id UNIQUEIDENTIFIER NOT NULL
              CONSTRAINT FK_crm_project_work_user
                REFERENCES dbo.tbl_users(id) ON DELETE CASCADE,
            work_date DATE NOT NULL
              CONSTRAINT DF_crm_project_work_date DEFAULT CONVERT(date, SYSUTCDATETIME()),
            started_at DATETIME2(3) NOT NULL
              CONSTRAINT DF_crm_project_work_started DEFAULT SYSUTCDATETIME(),
            ended_at DATETIME2(3) NULL,
            note NVARCHAR(300) NULL,
            CONSTRAINT CK_crm_project_work_range
              CHECK (ended_at IS NULL OR ended_at >= started_at)
          );
          CREATE UNIQUE INDEX UX_crm_project_work_active
            ON dbo.tbl_crm_project_work_entries(account_id, user_id)
            WHERE ended_at IS NULL;
          CREATE INDEX IX_crm_project_work_history
            ON dbo.tbl_crm_project_work_entries(account_id, work_date, user_id)
            INCLUDE (project_id, started_at, ended_at);
        END;
      `);
      await query(`
        IF COL_LENGTH('dbo.tbl_crm_project_work_entries', 'task_id') IS NULL
          ALTER TABLE dbo.tbl_crm_project_work_entries ADD task_id UNIQUEIDENTIFIER NULL;
        IF NOT EXISTS (
          SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_project_work_task'
        )
          ALTER TABLE dbo.tbl_crm_project_work_entries
            ADD CONSTRAINT FK_crm_project_work_task
              FOREIGN KEY (task_id) REFERENCES dbo.tbl_crm_tasks(id);
      `);
      await query(`
        IF OBJECT_ID('dbo.tbl_crm_leave_requests', 'U') IS NULL
        CREATE TABLE dbo.tbl_crm_leave_requests (
          id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_tbl_crm_leave_requests PRIMARY KEY DEFAULT NEWID(),
          account_id INT NOT NULL CONSTRAINT FK_crm_leave_account
            REFERENCES dbo.tbl_accounts(account_id) ON DELETE CASCADE,
          user_id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT FK_crm_leave_user REFERENCES dbo.tbl_users(id) ON DELETE CASCADE,
          leave_type VARCHAR(20) NOT NULL
            CONSTRAINT CK_crm_leave_type CHECK (leave_type IN ('casual','sick','earned','unpaid')),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          reason NVARCHAR(800) NULL,
          status VARCHAR(20) NOT NULL CONSTRAINT DF_crm_leave_status DEFAULT 'pending'
            CONSTRAINT CK_crm_leave_status CHECK (status IN ('pending','approved','rejected')),
          manager_note NVARCHAR(800) NULL,
          reviewed_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_crm_leave_reviewer REFERENCES dbo.tbl_users(id),
          reviewed_at DATETIME2(3) NULL,
          created_at DATETIME2(3) NOT NULL CONSTRAINT DF_crm_leave_created DEFAULT SYSUTCDATETIME()
        );
      `);

      // Upgrade installations that created CRM records before account scoping.
      await query(`
        IF COL_LENGTH('dbo.tbl_crm_member_profiles', 'account_id') IS NULL
          ALTER TABLE dbo.tbl_crm_member_profiles ADD account_id INT NULL;
        IF COL_LENGTH('dbo.tbl_crm_member_profiles', 'is_active') IS NULL
          ALTER TABLE dbo.tbl_crm_member_profiles
            ADD is_active BIT NOT NULL CONSTRAINT DF_crm_profile_active DEFAULT 1 WITH VALUES;
        IF COL_LENGTH('dbo.tbl_crm_projects', 'account_id') IS NULL
          ALTER TABLE dbo.tbl_crm_projects ADD account_id INT NULL;
        IF COL_LENGTH('dbo.tbl_crm_project_members', 'account_id') IS NULL
          ALTER TABLE dbo.tbl_crm_project_members ADD account_id INT NULL;
        IF COL_LENGTH('dbo.tbl_crm_tasks', 'account_id') IS NULL
          ALTER TABLE dbo.tbl_crm_tasks ADD account_id INT NULL;
        IF COL_LENGTH('dbo.tbl_crm_time_entries', 'account_id') IS NULL
          ALTER TABLE dbo.tbl_crm_time_entries ADD account_id INT NULL;
        IF COL_LENGTH('dbo.tbl_crm_time_entries', 'break_label') IS NULL
          ALTER TABLE dbo.tbl_crm_time_entries ADD break_label NVARCHAR(120) NULL;
        IF COL_LENGTH('dbo.tbl_crm_leave_requests', 'account_id') IS NULL
          ALTER TABLE dbo.tbl_crm_leave_requests ADD account_id INT NULL;
      `);
      await query(`
        UPDATE p SET account_id = COALESCE(
          (SELECT MIN(ua.account_id) FROM dbo.tbl_user_accounts ua WHERE ua.user_id = p.user_id),
          (SELECT MIN(a.account_id) FROM dbo.tbl_accounts a)
        )
        FROM dbo.tbl_crm_member_profiles p WHERE p.account_id IS NULL;

        UPDATE p SET account_id = COALESCE(
          (SELECT MIN(ua.account_id) FROM dbo.tbl_user_accounts ua WHERE ua.user_id = p.created_by),
          (SELECT MIN(a.account_id) FROM dbo.tbl_accounts a)
        )
        FROM dbo.tbl_crm_projects p WHERE p.account_id IS NULL;

        UPDATE pm SET account_id = p.account_id
        FROM dbo.tbl_crm_project_members pm
        INNER JOIN dbo.tbl_crm_projects p ON p.id = pm.project_id
        WHERE pm.account_id IS NULL;

        UPDATE t SET account_id = p.account_id
        FROM dbo.tbl_crm_tasks t
        INNER JOIN dbo.tbl_crm_projects p ON p.id = t.project_id
        WHERE t.account_id IS NULL;

        UPDATE t SET account_id = COALESCE(
          (SELECT MIN(ua.account_id) FROM dbo.tbl_user_accounts ua WHERE ua.user_id = t.user_id),
          (SELECT MIN(a.account_id) FROM dbo.tbl_accounts a)
        )
        FROM dbo.tbl_crm_time_entries t WHERE t.account_id IS NULL;

        UPDATE l SET account_id = COALESCE(
          (SELECT MIN(ua.account_id) FROM dbo.tbl_user_accounts ua WHERE ua.user_id = l.user_id),
          (SELECT MIN(a.account_id) FROM dbo.tbl_accounts a)
        )
        FROM dbo.tbl_crm_leave_requests l WHERE l.account_id IS NULL;
      `);
      await query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_crm_member_profiles WHERE account_id IS NULL)
          AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tbl_crm_member_profiles') AND name = 'account_id' AND is_nullable = 1)
          ALTER TABLE dbo.tbl_crm_member_profiles ALTER COLUMN account_id INT NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_crm_projects WHERE account_id IS NULL)
          AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tbl_crm_projects') AND name = 'account_id' AND is_nullable = 1)
          ALTER TABLE dbo.tbl_crm_projects ALTER COLUMN account_id INT NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_crm_project_members WHERE account_id IS NULL)
          AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tbl_crm_project_members') AND name = 'account_id' AND is_nullable = 1)
          ALTER TABLE dbo.tbl_crm_project_members ALTER COLUMN account_id INT NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_crm_tasks WHERE account_id IS NULL)
          AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tbl_crm_tasks') AND name = 'account_id' AND is_nullable = 1)
          ALTER TABLE dbo.tbl_crm_tasks ALTER COLUMN account_id INT NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_crm_time_entries WHERE account_id IS NULL)
          AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tbl_crm_time_entries') AND name = 'account_id' AND is_nullable = 1)
          ALTER TABLE dbo.tbl_crm_time_entries ALTER COLUMN account_id INT NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_crm_leave_requests WHERE account_id IS NULL)
          AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tbl_crm_leave_requests') AND name = 'account_id' AND is_nullable = 1)
          ALTER TABLE dbo.tbl_crm_leave_requests ALTER COLUMN account_id INT NOT NULL;
      `);
      await query(`
        IF EXISTS (
          SELECT 1 FROM sys.key_constraints kc
          WHERE kc.parent_object_id = OBJECT_ID('dbo.tbl_crm_member_profiles')
            AND kc.name = 'PK_tbl_crm_member_profiles'
            AND NOT EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
              WHERE ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
                AND c.name = 'account_id'
            )
        )
          ALTER TABLE dbo.tbl_crm_member_profiles DROP CONSTRAINT PK_tbl_crm_member_profiles;
        IF NOT EXISTS (
          SELECT 1 FROM sys.key_constraints
          WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_member_profiles') AND type = 'PK'
        )
          ALTER TABLE dbo.tbl_crm_member_profiles
            ADD CONSTRAINT PK_tbl_crm_member_profiles PRIMARY KEY (account_id, user_id);

        IF EXISTS (
          SELECT 1 FROM sys.key_constraints kc
          WHERE kc.parent_object_id = OBJECT_ID('dbo.tbl_crm_project_members')
            AND kc.name = 'PK_tbl_crm_project_members'
            AND NOT EXISTS (
              SELECT 1 FROM sys.index_columns ic
              INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
              WHERE ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
                AND c.name = 'account_id'
            )
        )
          ALTER TABLE dbo.tbl_crm_project_members DROP CONSTRAINT PK_tbl_crm_project_members;
        IF NOT EXISTS (
          SELECT 1 FROM sys.key_constraints
          WHERE parent_object_id = OBJECT_ID('dbo.tbl_crm_project_members') AND type = 'PK'
        )
          ALTER TABLE dbo.tbl_crm_project_members
            ADD CONSTRAINT PK_tbl_crm_project_members PRIMARY KEY (account_id, project_id, user_id);
      `);
      await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_profile_account')
          ALTER TABLE dbo.tbl_crm_member_profiles ADD CONSTRAINT FK_crm_profile_account
            FOREIGN KEY (account_id) REFERENCES dbo.tbl_accounts(account_id) ON DELETE CASCADE;
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_project_account')
          ALTER TABLE dbo.tbl_crm_projects ADD CONSTRAINT FK_crm_project_account
            FOREIGN KEY (account_id) REFERENCES dbo.tbl_accounts(account_id) ON DELETE CASCADE;
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_pm_account')
          ALTER TABLE dbo.tbl_crm_project_members ADD CONSTRAINT FK_crm_pm_account
            FOREIGN KEY (account_id) REFERENCES dbo.tbl_accounts(account_id);
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_task_account')
          ALTER TABLE dbo.tbl_crm_tasks ADD CONSTRAINT FK_crm_task_account
            FOREIGN KEY (account_id) REFERENCES dbo.tbl_accounts(account_id);
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_time_account')
          ALTER TABLE dbo.tbl_crm_time_entries ADD CONSTRAINT FK_crm_time_account
            FOREIGN KEY (account_id) REFERENCES dbo.tbl_accounts(account_id) ON DELETE CASCADE;
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_leave_account')
          ALTER TABLE dbo.tbl_crm_leave_requests ADD CONSTRAINT FK_crm_leave_account
            FOREIGN KEY (account_id) REFERENCES dbo.tbl_accounts(account_id) ON DELETE CASCADE;
        IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_crm_project_account_id')
          ALTER TABLE dbo.tbl_crm_projects
            ADD CONSTRAINT UQ_crm_project_account_id UNIQUE (account_id, id);
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_pm_project_account')
          ALTER TABLE dbo.tbl_crm_project_members ADD CONSTRAINT FK_crm_pm_project_account
            FOREIGN KEY (account_id, project_id) REFERENCES dbo.tbl_crm_projects(account_id, id);
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_crm_task_project_account')
          ALTER TABLE dbo.tbl_crm_tasks ADD CONSTRAINT FK_crm_task_project_account
            FOREIGN KEY (account_id, project_id) REFERENCES dbo.tbl_crm_projects(account_id, id);
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
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

export async function ensureCrmMembership(
  accountId: number,
  userId: string,
  isManager: boolean,
) {
  await ensureCrmSchema();
  if (isManager) {
    await query(`
      MERGE dbo.tbl_crm_member_profiles AS target
      USING (SELECT @AccountId account_id, @UserId user_id) AS source
        ON target.account_id = source.account_id AND target.user_id = source.user_id
      WHEN MATCHED THEN UPDATE SET is_active = 1, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (account_id, user_id, job_title, department, is_active)
        VALUES (@AccountId, @UserId, N'Manager', N'Management', 1);
    `, { AccountId: accountId, UserId: userId });
    return true;
  }
  const row = await queryOne<{ allowed: number }>(`
    SELECT 1 allowed
    FROM dbo.tbl_crm_member_profiles p
    INNER JOIN dbo.tbl_users u ON u.id = p.user_id
    WHERE p.account_id = @AccountId AND p.user_id = @UserId
      AND p.is_active = 1 AND u.is_active = 1
  `, { AccountId: accountId, UserId: userId });
  return Boolean(row);
}

export async function getCrmSnapshot(
  accountId: number,
  userId: string,
  isManager: boolean,
): Promise<CrmSnapshot> {
  await ensureCrmSchema();
  const params = { AccountId: accountId, UserId: userId };
  const scope = isManager
    ? ""
    : `AND (
      u.id = @UserId OR (
        u.role NOT IN ('admin', 'superadmin') AND EXISTS (
          SELECT 1
          FROM dbo.tbl_crm_projects poc_project
          WHERE poc_project.account_id = @AccountId
            AND poc_project.poc_user_id = @UserId
        )
      )
    )`;
  const activeProjectScope = isManager
    ? ""
    : "AND (u.id = @UserId OR project.poc_user_id = @UserId)";
  const trackedProjectScope = isManager
    ? ""
    : "AND (u.id = @UserId OR tracked_project.poc_user_id = @UserId)";
  const teamRows = await query<TeamRow>(`
    SELECT u.id, u.email, u.full_name, u.role,
      CAST(CASE WHEN u.is_active = 1 AND p.is_active = 1 THEN 1 ELSE 0 END AS bit) is_active,
      p.job_title, p.department, p.created_at,
      active_timer.status timer_status, active_timer.clock_in active_since,
      COALESCE(today_time.worked_minutes, 0) worked_minutes,
      active_project.project_id current_project_id,
      active_project.project_name current_project_name,
      active_project.started_at current_project_since,
      active_project.task_id current_task_id,
      active_project.task_title current_task_title,
      COALESCE(today_project_time.worked_minutes, 0) project_tracked_minutes,
      CAST(CASE WHEN EXISTS (
        SELECT 1 FROM dbo.tbl_crm_leave_requests l
        WHERE l.account_id = @AccountId AND l.user_id = u.id AND l.status = 'approved'
          AND CONVERT(date, SYSUTCDATETIME()) BETWEEN l.start_date AND l.end_date
      ) THEN 1 ELSE 0 END AS bit) on_leave
    FROM dbo.tbl_crm_member_profiles p
    INNER JOIN dbo.tbl_users u ON u.id = p.user_id
    OUTER APPLY (
      SELECT TOP 1 t.status, t.clock_in
      FROM dbo.tbl_crm_time_entries t
      WHERE t.account_id = @AccountId AND t.user_id = u.id
        AND t.status IN ('working','on_break')
      ORDER BY t.clock_in DESC
    ) active_timer
    OUTER APPLY (
      SELECT SUM(CASE
        WHEN t.status = 'stopped' THEN DATEDIFF(MINUTE, t.clock_in, t.clock_out) - t.break_minutes
        ELSE DATEDIFF(MINUTE, t.clock_in, SYSUTCDATETIME()) - t.break_minutes
          - CASE WHEN t.status = 'on_break' THEN DATEDIFF(MINUTE, t.break_started_at, SYSUTCDATETIME()) ELSE 0 END
      END) worked_minutes
      FROM dbo.tbl_crm_time_entries t
      WHERE t.account_id = @AccountId AND t.user_id = u.id
        AND t.work_date = CONVERT(date, SYSUTCDATETIME())
    ) today_time
    OUTER APPLY (
      SELECT TOP 1 w.project_id, project.name project_name, w.started_at,
        w.task_id, task.title task_title
      FROM dbo.tbl_crm_project_work_entries w
      INNER JOIN dbo.tbl_crm_projects project
        ON project.account_id = w.account_id AND project.id = w.project_id
      LEFT JOIN dbo.tbl_crm_tasks task
        ON task.account_id = w.account_id AND task.id = w.task_id
      WHERE w.account_id = @AccountId AND w.user_id = u.id
        AND w.ended_at IS NULL ${activeProjectScope}
      ORDER BY w.started_at DESC
    ) active_project
    OUTER APPLY (
      SELECT SUM(DATEDIFF(SECOND, w.started_at, COALESCE(w.ended_at, SYSUTCDATETIME()))) / 60.0 worked_minutes
      FROM dbo.tbl_crm_project_work_entries w
      INNER JOIN dbo.tbl_crm_projects tracked_project
        ON tracked_project.account_id = w.account_id
        AND tracked_project.id = w.project_id
      WHERE w.account_id = @AccountId AND w.user_id = u.id
        AND w.work_date = CONVERT(date, SYSUTCDATETIME())
        ${trackedProjectScope}
    ) today_project_time
    WHERE p.account_id = @AccountId ${scope}
    ORDER BY p.is_active DESC, CASE WHEN u.role IN ('admin', 'superadmin') THEN 0 ELSE 1 END, u.full_name, u.email
  `, params);

  const memberScope = isManager
    ? ""
    : `AND (
      EXISTS (
        SELECT 1 FROM dbo.tbl_crm_project_members mine
        WHERE mine.account_id = @AccountId AND mine.project_id = p.id AND mine.user_id = @UserId
      )
      OR EXISTS (
        SELECT 1 FROM dbo.tbl_crm_tasks mt
        WHERE mt.account_id = @AccountId AND mt.project_id = p.id AND mt.assignee_id = @UserId
      )
    )`;
  const projectRows = await query<ProjectRow>(`
    SELECT p.id, p.name, p.client_name, p.description, p.status, p.priority,
      p.start_date, p.due_date, p.created_by, p.created_at, p.poc_user_id,
      COALESCE(poc.full_name, poc.email) poc_name,
      STRING_AGG(CONVERT(nvarchar(36), pm.user_id), ',') member_ids,
      STRING_AGG(COALESCE(u.full_name, u.email), ', ') member_names,
      (SELECT COUNT(*) FROM dbo.tbl_crm_tasks t
        WHERE t.account_id = @AccountId AND t.project_id = p.id) task_count,
      (SELECT COUNT(*) FROM dbo.tbl_crm_tasks t
        WHERE t.account_id = @AccountId AND t.project_id = p.id AND t.status = 'done') completed_task_count,
      (SELECT COUNT(*) FROM dbo.tbl_crm_tasks t
        WHERE t.account_id = @AccountId AND t.project_id = p.id AND t.status = 'review') review_task_count,
      (SELECT COUNT(*) FROM dbo.tbl_crm_tasks t
        WHERE t.account_id = @AccountId AND t.project_id = p.id AND t.is_blocked = 1) blocked_task_count,
      (SELECT COUNT(*) FROM dbo.tbl_crm_tasks t
        WHERE t.account_id = @AccountId AND t.project_id = p.id
          AND t.status <> 'done' AND t.due_date < CONVERT(date, SYSUTCDATETIME())) overdue_task_count,
      (SELECT COALESCE(SUM(
        DATEDIFF(SECOND, w.started_at, COALESCE(w.ended_at, SYSUTCDATETIME()))
      ) / 60.0, 0)
        FROM dbo.tbl_crm_project_work_entries w
        WHERE w.account_id = @AccountId AND w.project_id = p.id) logged_minutes,
      (SELECT COALESCE(
        SUM(CONVERT(float, t.progress) * COALESCE(NULLIF(t.estimated_minutes, 0), 60))
          / NULLIF(SUM(COALESCE(NULLIF(t.estimated_minutes, 0), 60)), 0),
        0
      ) FROM dbo.tbl_crm_tasks t
        WHERE t.account_id = @AccountId AND t.project_id = p.id) progress
    FROM dbo.tbl_crm_projects p
    LEFT JOIN dbo.tbl_crm_project_members pm
      ON pm.account_id = p.account_id AND pm.project_id = p.id
    LEFT JOIN dbo.tbl_users u ON u.id = pm.user_id
    LEFT JOIN dbo.tbl_users poc ON poc.id = p.poc_user_id
    WHERE p.account_id = @AccountId ${memberScope}
    GROUP BY p.id, p.name, p.client_name, p.description, p.status, p.priority,
      p.start_date, p.due_date, p.created_by, p.created_at, p.updated_at,
      p.poc_user_id, poc.full_name, poc.email
    ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END,
      p.due_date
  `, params);

  const taskRows = await query<TaskRow>(`
    SELECT t.id, t.project_id, p.name project_name, t.assignee_id,
      COALESCE(u.full_name, u.email) assignee_name, t.title, t.description,
      t.status, t.priority, t.progress, t.estimated_minutes, t.is_blocked,
      t.blocker_reason, t.due_date, t.created_at, t.updated_at,
      latest_update.note last_update_note,
      latest_update.actor_name last_updated_by_name,
      latest_update.created_at last_update_at,
      active_focus.started_at active_focus_started_at,
      active_focus.user_id active_focus_user_id,
      active_focus.user_name active_focus_user_name
    FROM dbo.tbl_crm_tasks t
    INNER JOIN dbo.tbl_crm_projects p
      ON p.account_id = t.account_id AND p.id = t.project_id
    LEFT JOIN dbo.tbl_users u ON u.id = t.assignee_id
    OUTER APPLY (
      SELECT TOP 1 w.started_at, w.user_id,
        COALESCE(focus_user.full_name, focus_user.email) user_name
      FROM dbo.tbl_crm_project_work_entries w
      INNER JOIN dbo.tbl_users focus_user ON focus_user.id = w.user_id
      WHERE w.account_id = t.account_id AND w.task_id = t.id
        AND w.ended_at IS NULL
      ORDER BY w.started_at DESC
    ) active_focus
    OUTER APPLY (
      SELECT TOP 1 update_row.note, update_row.created_at,
        COALESCE(update_actor.full_name, update_actor.email) actor_name
      FROM dbo.tbl_crm_task_updates update_row
      INNER JOIN dbo.tbl_users update_actor ON update_actor.id = update_row.actor_id
      WHERE update_row.account_id = t.account_id
        AND update_row.task_id = t.id
      ORDER BY update_row.created_at DESC, update_row.id DESC
    ) latest_update
    WHERE t.account_id = @AccountId ${
      isManager
        ? ""
        : "AND (t.assignee_id = @UserId OR p.poc_user_id = @UserId)"
    }
    ORDER BY CASE WHEN active_focus.started_at IS NOT NULL THEN 0 ELSE 1 END,
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'review' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
      t.due_date
  `, params);

  const timeRows = await query<TimeRow>(`
    SELECT t.id, t.user_id, COALESCE(u.full_name, u.email) user_name,
      t.work_date, t.clock_in, t.clock_out, t.break_started_at, t.break_label,
      t.break_minutes, t.status,
      CASE WHEN t.status = 'stopped'
        THEN DATEDIFF(MINUTE, t.clock_in, t.clock_out) - t.break_minutes
        ELSE DATEDIFF(MINUTE, t.clock_in, SYSUTCDATETIME()) - t.break_minutes
          - CASE WHEN t.status = 'on_break' THEN DATEDIFF(MINUTE, t.break_started_at, SYSUTCDATETIME()) ELSE 0 END
      END worked_minutes
    FROM dbo.tbl_crm_time_entries t
    INNER JOIN dbo.tbl_users u ON u.id = t.user_id
    WHERE t.account_id = @AccountId
      AND t.work_date >= DATEADD(DAY, -30, CONVERT(date, SYSUTCDATETIME()))
      ${isManager ? "" : "AND t.user_id = @UserId"}
    ORDER BY t.clock_in DESC
  `, params);

  const projectWorkRows = await query<ProjectWorkRow>(`
    SELECT w.id, w.user_id, COALESCE(u.full_name, u.email) user_name,
      w.project_id, p.name project_name, w.task_id, task.title task_title,
      w.work_date, w.started_at, w.ended_at, w.note,
      DATEDIFF(SECOND, w.started_at, COALESCE(w.ended_at, SYSUTCDATETIME())) / 60.0 worked_minutes
    FROM dbo.tbl_crm_project_work_entries w
    INNER JOIN dbo.tbl_users u ON u.id = w.user_id
    INNER JOIN dbo.tbl_crm_projects p
      ON p.account_id = w.account_id AND p.id = w.project_id
    LEFT JOIN dbo.tbl_crm_tasks task
      ON task.account_id = w.account_id AND task.id = w.task_id
    WHERE w.account_id = @AccountId
      AND w.work_date >= DATEADD(DAY, -30, CONVERT(date, SYSUTCDATETIME()))
      ${
        isManager
          ? ""
          : "AND (w.user_id = @UserId OR p.poc_user_id = @UserId)"
      }
    ORDER BY w.started_at DESC
  `, params);

  const taskUpdateRows = await query<TaskUpdateRow>(`
    SELECT TOP 250 update_row.id, update_row.task_id, task.project_id,
      update_row.actor_id,
      COALESCE(actor.full_name, actor.email) actor_name,
      update_row.previous_status, update_row.status,
      update_row.previous_progress, update_row.progress,
      update_row.note, update_row.is_blocked, update_row.blocker_reason,
      update_row.created_at
    FROM dbo.tbl_crm_task_updates update_row
    INNER JOIN dbo.tbl_crm_tasks task
      ON task.account_id = update_row.account_id
      AND task.id = update_row.task_id
    INNER JOIN dbo.tbl_crm_projects project
      ON project.account_id = task.account_id
      AND project.id = task.project_id
    INNER JOIN dbo.tbl_users actor ON actor.id = update_row.actor_id
    WHERE update_row.account_id = @AccountId ${
      isManager
        ? ""
        : "AND (task.assignee_id = @UserId OR project.poc_user_id = @UserId)"
    }
    ORDER BY update_row.created_at DESC, update_row.id DESC
  `, params);

  const leaveRows = await query<LeaveRow>(`
    SELECT l.id, l.user_id, COALESCE(u.full_name, u.email) user_name,
      l.leave_type, l.start_date, l.end_date, l.reason, l.status,
      l.manager_note, l.created_at
    FROM dbo.tbl_crm_leave_requests l
    INNER JOIN dbo.tbl_users u ON u.id = l.user_id
    WHERE l.account_id = @AccountId ${isManager ? "" : "AND l.user_id = @UserId"}
    ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.created_at DESC
  `, params);

  // Brand-access checkboxes (Team page) are manager-only: a plain member has
  // no use for the full brand list, and exposing it would leak brand names
  // beyond what they're linked to.
  let brands: CrmBrandOption[] = [];
  const memberBrandIds = new Map<string, number[]>();
  if (isManager) {
    const brandRows = await query<{ account_id: number; name: string }>(`
      SELECT account_id, name FROM dbo.tbl_accounts ORDER BY name
    `);
    brands = brandRows.map((row) => ({ accountId: row.account_id, name: row.name }));

    const memberIds = teamRows.filter((row) => row.role === "user").map((row) => row.id);
    if (memberIds.length > 0) {
      const idParams: Record<string, unknown> = {};
      const placeholders = memberIds.map((id, i) => {
        idParams[`U${i}`] = id;
        return `@U${i}`;
      });
      const brandMemberRows = await query<{ user_id: string; account_id: number }>(`
        SELECT user_id, account_id
        FROM dbo.tbl_crm_member_profiles
        WHERE is_active = 1 AND user_id IN (${placeholders.join(",")})
      `, idParams);
      for (const row of brandMemberRows) {
        const list = memberBrandIds.get(row.user_id) ?? [];
        list.push(row.account_id);
        memberBrandIds.set(row.user_id, list);
      }
    }
  }

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
    brandIds:
      row.role === "user"
        ? (memberBrandIds.get(row.id) ?? (isManager ? [] : [accountId]))
        : [],
  }));

  return {
    accountId,
    role: isManager ? "manager" : "member",
    currentUserId: userId,
    pocProjectIds: projectRows
      .filter((row) => row.poc_user_id === userId)
      .map((row) => row.id),
    brands,
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
  accountId: number,
  userId: string,
  jobTitle: string | null,
  department: string | null,
) {
  await ensureCrmSchema();
  await query(`
    MERGE dbo.tbl_crm_member_profiles AS target
    USING (SELECT @AccountId account_id, @UserId user_id) AS source
      ON target.account_id = source.account_id AND target.user_id = source.user_id
    WHEN MATCHED THEN UPDATE SET job_title = @JobTitle, department = @Department,
      is_active = 1, updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (account_id, user_id, job_title, department, is_active)
      VALUES (@AccountId, @UserId, @JobTitle, @Department, 1);

    IF NOT EXISTS (
      SELECT 1 FROM dbo.tbl_user_accounts WHERE account_id = @AccountId AND user_id = @UserId
    )
      INSERT INTO dbo.tbl_user_accounts (account_id, user_id) VALUES (@AccountId, @UserId);
    UPDATE dbo.tbl_users SET is_active = 1 WHERE id = @UserId;
  `, {
    AccountId: accountId, UserId: userId,
    JobTitle: jobTitle, Department: department,
  });
}

export async function setCrmMemberActive(
  accountId: number,
  userId: string,
  isActive: boolean,
) {
  await ensureCrmSchema();
  const rows = await query<{ id: string }>(`
    DECLARE @Changed TABLE (id UNIQUEIDENTIFIER);
    UPDATE p SET is_active = @IsActive, updated_at = SYSUTCDATETIME()
    OUTPUT inserted.user_id INTO @Changed(id)
    FROM dbo.tbl_crm_member_profiles p
    INNER JOIN dbo.tbl_users u ON u.id = p.user_id
    WHERE p.account_id = @AccountId AND p.user_id = @UserId AND u.role = 'user';

    IF EXISTS (SELECT 1 FROM @Changed)
    BEGIN
      IF @IsActive = 0
      BEGIN
        UPDATE dbo.tbl_crm_time_entries SET
          break_minutes = break_minutes + CASE
            WHEN status = 'on_break' THEN DATEDIFF(MINUTE, break_started_at, SYSUTCDATETIME())
            ELSE 0
          END,
          break_started_at = NULL, clock_out = SYSUTCDATETIME(), status = 'stopped'
        WHERE account_id = @AccountId AND user_id = @UserId
          AND status IN ('working', 'on_break');
        UPDATE dbo.tbl_crm_project_work_entries
        SET ended_at = SYSUTCDATETIME()
        WHERE account_id = @AccountId AND user_id = @UserId
          AND ended_at IS NULL;
        DELETE FROM dbo.tbl_user_accounts
        WHERE account_id = @AccountId AND user_id = @UserId;
        IF NOT EXISTS (SELECT 1 FROM dbo.tbl_user_accounts WHERE user_id = @UserId)
          UPDATE dbo.tbl_users SET is_active = 0 WHERE id = @UserId;
      END
      ELSE
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM dbo.tbl_user_accounts WHERE account_id = @AccountId AND user_id = @UserId
        )
          INSERT INTO dbo.tbl_user_accounts (account_id, user_id) VALUES (@AccountId, @UserId);
        UPDATE dbo.tbl_users SET is_active = 1 WHERE id = @UserId;
      END
    END;
    SELECT id FROM @Changed;
  `, { AccountId: accountId, UserId: userId, IsActive: isActive });
  return rows.length > 0;
}

/**
 * Sync a team member's brand access to exactly the given set of accounts —
 * the CRM Team page's per-member brand checkboxes ("this brand" / "all
 * brands"). Grants both Operations (tbl_user_accounts) and CRM
 * (tbl_crm_member_profiles) access together, since the two are meant to move
 * as one unit: a brand a member can see data for is a brand they're a CRM
 * member of, and vice versa.
 *
 * Reuses upsertMemberProfile (add) and setCrmMemberActive (remove) so the
 * same, already-exercised logic — timer/work-entry cleanup on removal,
 * activation on add — runs no matter which surface triggers it. Manager/
 * admin accounts are out of scope: they already reach every brand.
 */
export async function setMemberBrandAccess(
  userId: string,
  accountIds: number[],
): Promise<boolean> {
  await ensureCrmSchema();
  const target = await queryOne<{ role: string }>(`
    SELECT role FROM dbo.tbl_users WHERE id = @UserId
  `, { UserId: userId });
  if (!target || target.role !== "user") return false;

  const existingRows = await query<{ account_id: number }>(`
    SELECT account_id FROM dbo.tbl_crm_member_profiles
    WHERE user_id = @UserId AND is_active = 1
  `, { UserId: userId });
  const existing = new Set(existingRows.map((row) => row.account_id));
  const desired = new Set(accountIds);

  // New brands inherit this member's job title/department from their most
  // recently touched profile, so the identity stays consistent across brands
  // instead of starting blank.
  const template = await queryOne<{
    job_title: string | null;
    department: string | null;
  }>(`
    SELECT TOP 1 job_title, department
    FROM dbo.tbl_crm_member_profiles
    WHERE user_id = @UserId
    ORDER BY CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at DESC
  `, { UserId: userId });

  for (const accountId of desired) {
    if (!existing.has(accountId)) {
      await upsertMemberProfile(
        accountId,
        userId,
        template?.job_title ?? null,
        template?.department ?? null,
      );
    }
  }
  for (const accountId of existing) {
    if (!desired.has(accountId)) {
      await setCrmMemberActive(accountId, userId, false);
    }
  }
  return true;
}

export async function createCrmProject(input: {
  accountId: number; name: string; clientName: string | null; description: string | null;
  status: string; priority: string; startDate: string | null; dueDate: string | null;
  createdBy: string; memberIds: string[]; pocUserId: string | null;
}) {
  await ensureCrmSchema();
  const row = await queryOne<{ id: string }>(`
    INSERT INTO dbo.tbl_crm_projects
      (account_id, name, client_name, description, status, priority, start_date,
        due_date, poc_user_id, created_by)
    OUTPUT inserted.id
    VALUES (
      @AccountId, @Name, @ClientName, @Description, @Status, @Priority,
      @StartDate, @DueDate,
      CASE WHEN EXISTS (
        SELECT 1 FROM dbo.tbl_crm_member_profiles
        WHERE account_id = @AccountId AND user_id = @PocUserId AND is_active = 1
      ) THEN @PocUserId ELSE NULL END,
      @CreatedBy
    )
  `, {
    AccountId: input.accountId, Name: input.name, ClientName: input.clientName,
    Description: input.description, Status: input.status, Priority: input.priority,
    StartDate: input.startDate, DueDate: input.dueDate,
    PocUserId: input.pocUserId, CreatedBy: input.createdBy,
  });
  if (!row) throw new Error("Could not create project");
  const projectMembers = input.pocUserId
    ? [...input.memberIds, input.pocUserId]
    : input.memberIds;
  for (const memberId of [...new Set(projectMembers)]) {
    await query(`
      IF EXISTS (
        SELECT 1 FROM dbo.tbl_crm_member_profiles
        WHERE account_id = @AccountId AND user_id = @UserId AND is_active = 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM dbo.tbl_crm_project_members
        WHERE account_id = @AccountId AND project_id = @ProjectId AND user_id = @UserId
      )
        INSERT INTO dbo.tbl_crm_project_members (account_id, project_id, user_id)
        VALUES (@AccountId, @ProjectId, @UserId);
    `, { AccountId: input.accountId, ProjectId: row.id, UserId: memberId });
  }
  return row.id;
}

export async function assignCrmMember(
  accountId: number,
  projectId: string,
  userId: string,
) {
  await ensureCrmSchema();
  const rows = await query<{ id: string }>(`
    IF EXISTS (
      SELECT 1 FROM dbo.tbl_crm_projects WHERE account_id = @AccountId AND id = @ProjectId
    )
    AND EXISTS (
      SELECT 1 FROM dbo.tbl_crm_member_profiles
      WHERE account_id = @AccountId AND user_id = @UserId AND is_active = 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM dbo.tbl_crm_project_members
      WHERE account_id = @AccountId AND project_id = @ProjectId AND user_id = @UserId
    )
    BEGIN
      INSERT INTO dbo.tbl_crm_project_members (account_id, project_id, user_id)
      VALUES (@AccountId, @ProjectId, @UserId);
      SELECT @ProjectId id;
    END
  `, { AccountId: accountId, ProjectId: projectId, UserId: userId });
  return rows.length > 0;
}

export async function isCrmProjectPoc(
  accountId: number,
  projectId: string,
  userId: string,
) {
  await ensureCrmSchema();
  const row = await queryOne<{ allowed: number }>(`
    SELECT 1 allowed
    FROM dbo.tbl_crm_projects
    WHERE account_id = @AccountId AND id = @ProjectId
      AND poc_user_id = @UserId
  `, { AccountId: accountId, ProjectId: projectId, UserId: userId });
  return Boolean(row);
}

export async function setCrmProjectPoc(
  accountId: number,
  projectId: string,
  pocUserId: string | null,
) {
  await ensureCrmSchema();
  const rows = await query<{ id: string }>(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    IF EXISTS (
      SELECT 1 FROM dbo.tbl_crm_projects
      WHERE account_id = @AccountId AND id = @ProjectId
    )
    AND (
      @PocUserId IS NULL OR EXISTS (
        SELECT 1
        FROM dbo.tbl_crm_member_profiles profile
        INNER JOIN dbo.tbl_users app_user ON app_user.id = profile.user_id
        WHERE profile.account_id = @AccountId
          AND profile.user_id = @PocUserId
          AND profile.is_active = 1
          AND app_user.is_active = 1
          AND app_user.role NOT IN ('admin', 'superadmin')
      )
    )
    BEGIN
      UPDATE dbo.tbl_crm_projects
      SET poc_user_id = @PocUserId, updated_at = SYSUTCDATETIME()
      OUTPUT inserted.id
      WHERE account_id = @AccountId AND id = @ProjectId;

      IF @PocUserId IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM dbo.tbl_crm_project_members
        WHERE account_id = @AccountId AND project_id = @ProjectId
          AND user_id = @PocUserId
      )
        INSERT INTO dbo.tbl_crm_project_members (account_id, project_id, user_id)
        VALUES (@AccountId, @ProjectId, @PocUserId);
    END;

    COMMIT TRANSACTION;
  `, {
    AccountId: accountId,
    ProjectId: projectId,
    PocUserId: pocUserId,
  });
  return rows.length > 0;
}

export async function updateCrmProjectStatus(input: {
  accountId: number;
  projectId: string;
  status: CrmProject["status"];
  canReopen: boolean;
}) {
  await ensureCrmSchema();
  const rows = await query<{ id: string }>(`
    UPDATE dbo.tbl_crm_projects
    SET status = @Status, updated_at = SYSUTCDATETIME()
    OUTPUT inserted.id
    WHERE account_id = @AccountId AND id = @ProjectId
      ${input.canReopen ? "" : "AND status <> 'completed'"}
      AND (
        @Status <> 'completed' OR NOT EXISTS (
          SELECT 1 FROM dbo.tbl_crm_tasks task
          WHERE task.account_id = @AccountId
            AND task.project_id = @ProjectId
            AND (task.status <> 'done' OR task.is_blocked = 1)
        )
      );
  `, {
    AccountId: input.accountId,
    ProjectId: input.projectId,
    Status: input.status,
  });
  return rows.length > 0;
}

export async function getCrmTaskAccess(
  accountId: number,
  taskId: string,
  actorId: string,
) {
  await ensureCrmSchema();
  return queryOne<{
    project_id: string;
    status: CrmTask["status"];
    is_assignee: boolean;
    is_poc: boolean;
    has_poc: boolean;
  }>(`
    SELECT task.project_id, task.status,
      CAST(CASE WHEN task.assignee_id = @ActorId THEN 1 ELSE 0 END AS bit) is_assignee,
      CAST(CASE WHEN project.poc_user_id = @ActorId THEN 1 ELSE 0 END AS bit) is_poc,
      CAST(CASE WHEN project.poc_user_id IS NOT NULL THEN 1 ELSE 0 END AS bit) has_poc
    FROM dbo.tbl_crm_tasks task
    INNER JOIN dbo.tbl_crm_projects project
      ON project.account_id = task.account_id
      AND project.id = task.project_id
    WHERE task.account_id = @AccountId AND task.id = @TaskId
  `, {
    AccountId: accountId,
    TaskId: taskId,
    ActorId: actorId,
  });
}

export async function createCrmTask(input: {
  accountId: number; projectId: string; assigneeId: string | null; title: string;
  description: string | null; priority: string; dueDate: string | null;
  estimatedMinutes: number | null; createdBy: string;
}) {
  await ensureCrmSchema();
  const rows = await query<{ id: string }>(`
    DECLARE @Created TABLE (
      id UNIQUEIDENTIFIER,
      status VARCHAR(20),
      progress TINYINT,
      is_blocked BIT,
      blocker_reason NVARCHAR(600)
    );

    IF EXISTS (
      SELECT 1 FROM dbo.tbl_crm_projects WHERE account_id = @AccountId AND id = @ProjectId
    )
    AND (
      @AssigneeId IS NULL OR EXISTS (
        SELECT 1
        FROM dbo.tbl_crm_project_members pm
        INNER JOIN dbo.tbl_crm_member_profiles profile
          ON profile.account_id = pm.account_id
          AND profile.user_id = pm.user_id
          AND profile.is_active = 1
        WHERE pm.account_id = @AccountId
          AND pm.project_id = @ProjectId
          AND pm.user_id = @AssigneeId
      )
    )
    BEGIN
      INSERT INTO dbo.tbl_crm_tasks
        (account_id, project_id, assignee_id, title, description, priority,
          due_date, estimated_minutes, created_by)
      OUTPUT inserted.id, inserted.status, inserted.progress,
        inserted.is_blocked, inserted.blocker_reason
        INTO @Created
      VALUES (
        @AccountId, @ProjectId, @AssigneeId, @Title, @Description, @Priority,
        @DueDate, @EstimatedMinutes, @CreatedBy
      );

      INSERT INTO dbo.tbl_crm_task_updates (
        account_id, task_id, actor_id, previous_status, status,
        previous_progress, progress, note, is_blocked, blocker_reason
      )
      SELECT @AccountId, id, @CreatedBy, NULL, status,
        NULL, progress, N'Task created', is_blocked, blocker_reason
      FROM @Created;

      SELECT id FROM @Created;
    END
  `, {
    AccountId: input.accountId, ProjectId: input.projectId,
    AssigneeId: input.assigneeId, Title: input.title,
    Description: input.description, Priority: input.priority,
    DueDate: input.dueDate, EstimatedMinutes: input.estimatedMinutes,
    CreatedBy: input.createdBy,
  });
  return rows.length > 0;
}

export async function updateCrmTask(input: {
  accountId: number; taskId: string; actorId: string;
  canManage: boolean; status: CrmTask["status"]; progress: number;
  note: string | null; isBlocked: boolean; blockerReason: string | null;
}) {
  await ensureCrmSchema();
  const result = await query<{ id: string }>(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    DECLARE @PreviousStatus VARCHAR(20);
    DECLARE @PreviousProgress TINYINT;
    SELECT @PreviousStatus = status, @PreviousProgress = progress
    FROM dbo.tbl_crm_tasks WITH (UPDLOCK, HOLDLOCK)
    WHERE account_id = @AccountId AND id = @TaskId
      ${input.canManage ? "" : "AND assignee_id = @ActorId"};

    IF @PreviousStatus IS NOT NULL
    BEGIN
      UPDATE dbo.tbl_crm_tasks SET
        status = @Status,
        progress = CASE WHEN @Status = 'done' THEN 100 ELSE @Progress END,
        is_blocked = CASE WHEN @Status = 'done' THEN 0 ELSE @IsBlocked END,
        blocker_reason = CASE
          WHEN @Status = 'done' OR @IsBlocked = 0 THEN NULL
          ELSE @BlockerReason
        END,
        updated_at = SYSUTCDATETIME()
      WHERE account_id = @AccountId AND id = @TaskId;

      INSERT INTO dbo.tbl_crm_task_updates (
        account_id, task_id, actor_id, previous_status, status,
        previous_progress, progress, note, is_blocked, blocker_reason
      )
      VALUES (
        @AccountId, @TaskId, @ActorId, @PreviousStatus, @Status,
        @PreviousProgress,
        CASE WHEN @Status = 'done' THEN 100 ELSE @Progress END,
        @Note,
        CASE WHEN @Status = 'done' THEN 0 ELSE @IsBlocked END,
        CASE
          WHEN @Status = 'done' OR @IsBlocked = 0 THEN NULL
          ELSE @BlockerReason
        END
      );

      IF @Status = 'done'
        UPDATE dbo.tbl_crm_project_work_entries
        SET ended_at = SYSUTCDATETIME()
        WHERE account_id = @AccountId AND task_id = @TaskId
          AND ended_at IS NULL;

      SELECT @TaskId id;
    END;

    COMMIT TRANSACTION;
  `, {
    AccountId: input.accountId, TaskId: input.taskId, ActorId: input.actorId,
    Status: input.status, Progress: input.progress, Note: input.note,
    IsBlocked: input.isBlocked, BlockerReason: input.blockerReason,
  });
  return result.length > 0;
}

export async function manageCrmTask(input: {
  accountId: number;
  taskId: string;
  actorId: string;
  assigneeId: string | null;
  priority: CrmTask["priority"];
  dueDate: string | null;
  estimatedMinutes: number | null;
}) {
  await ensureCrmSchema();
  const rows = await query<{ id: string }>(`
    DECLARE @Changed TABLE (
      id UNIQUEIDENTIFIER,
      status VARCHAR(20),
      progress TINYINT,
      is_blocked BIT,
      blocker_reason NVARCHAR(600)
    );

    UPDATE task SET
      assignee_id = @AssigneeId,
      priority = @Priority,
      due_date = @DueDate,
      estimated_minutes = @EstimatedMinutes,
      updated_at = SYSUTCDATETIME()
    OUTPUT inserted.id, inserted.status, inserted.progress,
      inserted.is_blocked, inserted.blocker_reason
      INTO @Changed
    FROM dbo.tbl_crm_tasks task
    WHERE task.account_id = @AccountId AND task.id = @TaskId
      AND (
        @AssigneeId IS NULL OR EXISTS (
          SELECT 1
          FROM dbo.tbl_crm_project_members member
          INNER JOIN dbo.tbl_crm_member_profiles profile
            ON profile.account_id = member.account_id
            AND profile.user_id = member.user_id
            AND profile.is_active = 1
          WHERE member.account_id = @AccountId
            AND member.project_id = task.project_id
            AND member.user_id = @AssigneeId
        )
      );

    INSERT INTO dbo.tbl_crm_task_updates (
      account_id, task_id, actor_id, previous_status, status,
      previous_progress, progress, note, is_blocked, blocker_reason
    )
    SELECT @AccountId, id, @ActorId, status, status,
      progress, progress, N'Task assignment or planning details updated',
      is_blocked, blocker_reason
    FROM @Changed;

    SELECT id FROM @Changed;
  `, {
    AccountId: input.accountId,
    TaskId: input.taskId,
    ActorId: input.actorId,
    AssigneeId: input.assigneeId,
    Priority: input.priority,
    DueDate: input.dueDate,
    EstimatedMinutes: input.estimatedMinutes,
  });
  return rows.length > 0;
}

export async function performTimerAction(
  accountId: number,
  userId: string,
  action: "clock_in" | "start_break" | "end_break" | "clock_out",
  breakLabel: string | null = null,
) {
  await ensureCrmSchema();
  const params = { AccountId: accountId, UserId: userId };
  if (action === "clock_in") {
    const active = await queryOne<{ id: number }>(`
      SELECT TOP 1 id FROM dbo.tbl_crm_time_entries
      WHERE account_id = @AccountId AND user_id = @UserId
        AND status IN ('working','on_break')
    `, params);
    if (active) return false;
    await query(`
      INSERT INTO dbo.tbl_crm_time_entries (account_id, user_id)
      VALUES (@AccountId, @UserId)
    `, params);
    return true;
  }
  const expectedStatus = action === "start_break" ? "working" : "on_break";
  const active = await queryOne<{ id: number }>(`
    SELECT TOP 1 id FROM dbo.tbl_crm_time_entries
    WHERE account_id = @AccountId AND user_id = @UserId AND status = @Status
    ORDER BY clock_in DESC
  `, { ...params, Status: action === "clock_out" ? "working" : expectedStatus });
  if (!active && action === "clock_out") {
    const onBreak = await queryOne<{ id: number }>(`
      SELECT TOP 1 id FROM dbo.tbl_crm_time_entries
      WHERE account_id = @AccountId AND user_id = @UserId AND status = 'on_break'
      ORDER BY clock_in DESC
    `, params);
    if (!onBreak) return false;
    await query(`
      UPDATE dbo.tbl_crm_project_work_entries
      SET ended_at = SYSUTCDATETIME()
      WHERE account_id = @AccountId AND user_id = @UserId
        AND ended_at IS NULL;
      UPDATE dbo.tbl_crm_time_entries SET
        break_minutes = break_minutes + DATEDIFF(MINUTE, break_started_at, SYSUTCDATETIME()),
        break_started_at = NULL, clock_out = SYSUTCDATETIME(), status = 'stopped'
      WHERE id = @Id AND account_id = @AccountId
    `, { ...params, Id: onBreak.id });
    return true;
  }
  if (!active) return false;
  if (action === "start_break") {
    await query(`
      UPDATE dbo.tbl_crm_project_work_entries
      SET ended_at = SYSUTCDATETIME()
      WHERE account_id = @AccountId AND user_id = @UserId
        AND ended_at IS NULL;
      UPDATE dbo.tbl_crm_time_entries SET
        break_started_at = SYSUTCDATETIME(),
        break_label = @BreakLabel,
        status = 'on_break'
      WHERE id = @Id AND account_id = @AccountId
    `, {
      ...params,
      Id: active.id,
      BreakLabel: breakLabel?.trim() || "General break",
    });
  } else if (action === "end_break") {
    await query(`
      UPDATE dbo.tbl_crm_time_entries SET
        break_minutes = break_minutes + DATEDIFF(MINUTE, break_started_at, SYSUTCDATETIME()),
        break_started_at = NULL, status = 'working'
      WHERE id = @Id AND account_id = @AccountId
    `, { Id: active.id, AccountId: accountId });
  } else {
    await query(`
      UPDATE dbo.tbl_crm_project_work_entries
      SET ended_at = SYSUTCDATETIME()
      WHERE account_id = @AccountId AND user_id = @UserId
        AND ended_at IS NULL;
      UPDATE dbo.tbl_crm_time_entries SET clock_out = SYSUTCDATETIME(), status = 'stopped'
      WHERE id = @Id AND account_id = @AccountId
    `, { ...params, Id: active.id });
  }
  return true;
}

export async function performProjectWorkAction(input: {
  accountId: number;
  userId: string;
  isManager: boolean;
  action: "start" | "stop";
  projectId: string | null;
  taskId: string | null;
  note: string | null;
}) {
  await ensureCrmSchema();

  if (input.action === "stop") {
    const rows = await query<{ id: number }>(`
      UPDATE dbo.tbl_crm_project_work_entries
      SET ended_at = SYSUTCDATETIME()
      OUTPUT inserted.id
      WHERE account_id = @AccountId AND user_id = @UserId
        AND ended_at IS NULL;
    `, { AccountId: input.accountId, UserId: input.userId });
    return rows.length > 0;
  }

  if (!input.projectId) return false;
  const rows = await query<{ id: number }>(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    IF EXISTS (
      SELECT 1
      FROM dbo.tbl_crm_time_entries
      WHERE account_id = @AccountId AND user_id = @UserId
        AND status = 'working'
    )
    AND EXISTS (
      SELECT 1 FROM dbo.tbl_crm_projects
      WHERE account_id = @AccountId AND id = @ProjectId
        AND status <> 'completed'
    )
    AND (
      @TaskId IS NULL OR EXISTS (
        SELECT 1 FROM dbo.tbl_crm_tasks
        WHERE account_id = @AccountId AND id = @TaskId
          AND project_id = @ProjectId AND assignee_id = @UserId
          AND status <> 'done'
      )
    )
    AND (
      ${input.isManager ? "1 = 1" : `EXISTS (
        SELECT 1 FROM dbo.tbl_crm_project_members
        WHERE account_id = @AccountId AND project_id = @ProjectId
          AND user_id = @UserId
      ) OR EXISTS (
        SELECT 1 FROM dbo.tbl_crm_tasks
        WHERE account_id = @AccountId AND project_id = @ProjectId
          AND assignee_id = @UserId
      )`}
    )
    BEGIN
      DECLARE @ActiveId BIGINT;
      DECLARE @ActiveProjectId UNIQUEIDENTIFIER;
      DECLARE @ActiveTaskId UNIQUEIDENTIFIER;
      SELECT TOP 1
        @ActiveId = id,
        @ActiveProjectId = project_id,
        @ActiveTaskId = task_id
      FROM dbo.tbl_crm_project_work_entries WITH (UPDLOCK, HOLDLOCK)
      WHERE account_id = @AccountId AND user_id = @UserId
        AND ended_at IS NULL;

      IF @ActiveProjectId = @ProjectId
        AND (
          @ActiveTaskId = @TaskId
          OR (@ActiveTaskId IS NULL AND @TaskId IS NULL)
        )
      BEGIN
        UPDATE dbo.tbl_crm_project_work_entries
        SET note = COALESCE(@Note, note)
        WHERE id = @ActiveId;
        SELECT @ActiveId id;
      END
      ELSE
      BEGIN
        UPDATE dbo.tbl_crm_project_work_entries
        SET ended_at = SYSUTCDATETIME()
        WHERE id = @ActiveId;

        INSERT INTO dbo.tbl_crm_project_work_entries
          (account_id, project_id, task_id, user_id, note)
        VALUES (@AccountId, @ProjectId, @TaskId, @UserId, @Note);

        INSERT INTO dbo.tbl_crm_task_updates (
          account_id, task_id, actor_id, previous_status, status,
          previous_progress, progress, note, is_blocked, blocker_reason
        )
        SELECT account_id, id, @UserId, status, 'in_progress',
          progress, progress, COALESCE(@Note, N'Work started'),
          is_blocked, blocker_reason
        FROM dbo.tbl_crm_tasks
        WHERE account_id = @AccountId AND id = @TaskId
          AND status = 'todo';

        UPDATE dbo.tbl_crm_tasks
        SET status = CASE WHEN status = 'todo' THEN 'in_progress' ELSE status END,
          updated_at = SYSUTCDATETIME()
        WHERE account_id = @AccountId AND id = @TaskId;
        SELECT CAST(SCOPE_IDENTITY() AS BIGINT) id;
      END
    END;

    COMMIT TRANSACTION;
  `, {
    AccountId: input.accountId,
    UserId: input.userId,
    ProjectId: input.projectId,
    TaskId: input.taskId,
    Note: input.note,
  });
  return rows.length > 0;
}

export async function createLeaveRequest(input: {
  accountId: number; userId: string; leaveType: string;
  startDate: string; endDate: string; reason: string | null;
}) {
  await ensureCrmSchema();
  await query(`
    INSERT INTO dbo.tbl_crm_leave_requests
      (account_id, user_id, leave_type, start_date, end_date, reason)
    VALUES (@AccountId, @UserId, @LeaveType, @StartDate, @EndDate, @Reason)
  `, {
    AccountId: input.accountId, UserId: input.userId, LeaveType: input.leaveType,
    StartDate: input.startDate, EndDate: input.endDate, Reason: input.reason,
  });
}

export async function reviewLeaveRequest(input: {
  accountId: number; leaveId: string; reviewerId: string;
  status: "approved" | "rejected"; managerNote: string | null;
}) {
  await ensureCrmSchema();
  const rows = await query<{ id: string }>(`
    UPDATE dbo.tbl_crm_leave_requests SET status = @Status, manager_note = @ManagerNote,
      reviewed_by = @ReviewerId, reviewed_at = SYSUTCDATETIME()
    OUTPUT inserted.id
    WHERE account_id = @AccountId AND id = @LeaveId AND status = 'pending'
  `, {
    AccountId: input.accountId, LeaveId: input.leaveId,
    ReviewerId: input.reviewerId, Status: input.status,
    ManagerNote: input.managerNote,
  });
  return rows.length > 0;
}
