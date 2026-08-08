"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrmAction } from "@/hooks/use-crm";
import { useAccountStore } from "@/store/account-store";
import type {
  CrmBrandOption,
  CrmProject,
  CrmTask,
  CrmTeamMember,
} from "@/features/crm/types";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function DialogError({ message }: { message?: string }) {
  return message ? (
    <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      {message}
    </p>
  ) : null;
}

/** Shared checkbox list for brand assignment — "all brands" plus a specific pick. */
function BrandCheckboxes({
  brands,
  accountIds,
  onChange,
}: {
  brands: CrmBrandOption[];
  accountIds: number[];
  onChange: (accountIds: number[]) => void;
}) {
  const allSelected = brands.length > 0 && accountIds.length === brands.length;

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2.5 text-sm font-medium hover:bg-accent">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(event) =>
            onChange(event.target.checked ? brands.map((b) => b.accountId) : [])
          }
          className="accent-primary"
        />
        All brands
      </label>
      <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
        {brands.map((brand) => (
          <label
            key={brand.accountId}
            className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent"
          >
            <input
              type="checkbox"
              checked={accountIds.includes(brand.accountId)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...accountIds, brand.accountId]
                    : accountIds.filter((id) => id !== brand.accountId),
                )
              }
              className="accent-primary"
            />
            <span className="truncate">{brand.name}</span>
          </label>
        ))}
        {brands.length === 0 && (
          <p className="text-xs text-muted-foreground">No brands configured yet.</p>
        )}
      </div>
    </div>
  );
}

export function CreateMemberDialog({ brands }: { brands: CrmBrandOption[] }) {
  const [open, setOpen] = useState(false);
  const [accountIds, setAccountIds] = useState<number[]>([]);
  const action = useCrmAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await action.mutateAsync({
        action: "create_member",
        fullName: form.get("fullName"),
        email: form.get("email"),
        password: form.get("password"),
        jobTitle: form.get("jobTitle"),
        department: form.get("department"),
        accountIds,
      });
      toast.success("Team member added", {
        description:
          "They can sign in with this email and password. The credential applies across their brands.",
      });
      setAccountIds([]);
      setOpen(false);
    } catch {
      // The inline error below carries the server's safe message.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        action.reset();
        if (!next) setAccountIds([]);
      }}
    >
      <DialogTrigger asChild>
        <Button>Add team member</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              Create a private CRM login for a new member. If the email
              already exists, this password resets that identity&apos;s login
              across its brands.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input name="fullName" placeholder="e.g. Riya Das" required minLength={2} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="riya@company.com" required />
            </Field>
            <Field label="Job title">
              <Input name="jobTitle" placeholder="e.g. UI Designer" />
            </Field>
            <Field label="Department">
              <Input name="department" placeholder="e.g. Creative" />
            </Field>
            <Field label="Temporary password" className="sm:col-span-2">
              <Input
                name="password"
                type="password"
                minLength={8}
                maxLength={72}
                placeholder="Minimum 8 characters"
                required
              />
            </Field>
          </div>
          {brands.length > 0 && (
            <Field label="Also give access to">
              <BrandCheckboxes
                brands={brands}
                accountIds={accountIds}
                onChange={setAccountIds}
              />
              <p className="text-xs text-muted-foreground">
                The current brand is included automatically. Pick any additional
                brands here, or select all brands.
              </p>
            </Field>
          )}
          <DialogError message={action.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? "Creating…" : "Create login"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ManageMemberBrandsDialog({
  member,
  brands,
}: {
  member: CrmTeamMember;
  brands: CrmBrandOption[];
}) {
  const [open, setOpen] = useState(false);
  const [accountIds, setAccountIds] = useState<number[]>(member.brandIds);
  const action = useCrmAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await action.mutateAsync({
        action: "set_member_brands",
        userId: member.id,
        accountIds,
      });
      toast.success("Brand access updated", {
        description: `${member.fullName || member.email} now has CRM and brand access to ${
          accountIds.length === 0
            ? "no brands"
            : accountIds.length === 1
              ? "1 brand"
              : `${accountIds.length} brands`
        }.`,
      });
      setOpen(false);
    } catch {}
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        action.reset();
        if (next) setAccountIds(member.brandIds);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Brands
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Brand access</DialogTitle>
            <DialogDescription>
              Choose which brands {member.fullName || member.email} can see —
              both their Operations data and that brand&apos;s CRM. They will
              still only see their own tasks and work, not the full CRM view.
            </DialogDescription>
          </DialogHeader>
          <BrandCheckboxes
            brands={brands}
            accountIds={accountIds}
            onChange={setAccountIds}
          />
          <DialogError message={action.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? "Saving…" : "Save brand access"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateProjectDialog({ team }: { team: CrmTeamMember[] }) {
  const [open, setOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [pocUserId, setPocUserId] = useState("");
  const action = useCrmAction();
  const activeMembers = team.filter(
    (member) => member.role !== "admin" &&
      member.role !== "superadmin" && member.isActive,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await action.mutateAsync({
        action: "create_project",
        name: form.get("name"),
        clientName: form.get("clientName"),
        description: form.get("description"),
        status: form.get("status"),
        priority: form.get("priority"),
        startDate: form.get("startDate") || undefined,
        dueDate: form.get("dueDate") || undefined,
        memberIds,
        pocUserId: pocUserId || null,
      });
      toast.success("Project created");
      setMemberIds([]);
      setPocUserId("");
      setOpen(false);
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); action.reset(); }}>
      <DialogTrigger asChild>
        <Button>New project</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
            <DialogDescription>
              Set up the project, dates and the members who should see it.
            </DialogDescription>
          </DialogHeader>
          <Field label="Project name">
            <Input name="name" placeholder="Website redesign" minLength={2} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client">
              <Input name="clientName" placeholder="Client or internal team" />
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue="p2">
                <SelectTrigger aria-label="Project priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p0">P0</SelectItem>
                  <SelectItem value="p1">P1</SelectItem>
                  <SelectItem value="p2">P2</SelectItem>
                  <SelectItem value="p3">P3</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="planning">
                <SelectTrigger aria-label="Project status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project POC">
              <Select
                value={pocUserId || "__none__"}
                onValueChange={(value) =>
                  setPocUserId(value === "__none__" ? "" : value)
                }
              >
                <SelectTrigger aria-label="Project POC">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Assign later</SelectItem>
                  {activeMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start date">
              <Input name="startDate" type="date" />
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea name="description" placeholder="Project goal, scope and deliverables…" />
          </Field>
          <Field label="Assign team">
            <div className="grid max-h-36 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
              {activeMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={memberIds.includes(member.id)}
                    onChange={(event) =>
                      setMemberIds((current) =>
                        event.target.checked
                          ? [...current, member.id]
                          : current.filter((id) => id !== member.id),
                      )
                    }
                    className="accent-primary"
                  />
                  <span className="truncate">{member.fullName || member.email}</span>
                </label>
              ))}
              {activeMembers.length === 0 && (
                <p className="text-xs text-muted-foreground">Add a team member first.</p>
              )}
            </div>
            {pocUserId && (
              <p className="text-xs text-muted-foreground">
                The selected POC is automatically added to the project team.
              </p>
            )}
          </Field>
          <DialogError message={action.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTaskDialog({
  projects,
  team,
}: {
  projects: CrmProject[];
  team: CrmTeamMember[];
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const action = useCrmAction();
  const selectedProject =
    projects.find((project) => project.id === projectId) ?? projects[0];
  const availableAssignees = team.filter(
    (member) =>
      member.role !== "admin" &&
      member.role !== "superadmin" &&
      member.isActive &&
      Boolean(selectedProject?.memberIds.includes(member.id)),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const estimatedHours = String(form.get("estimatedHours") || "");
    try {
      await action.mutateAsync({
        action: "create_task",
        projectId: form.get("projectId"),
        assigneeId: String(form.get("assigneeId") || "") || null,
        title: form.get("title"),
        description: form.get("description"),
        priority: form.get("priority"),
        dueDate: form.get("dueDate") || undefined,
        estimatedMinutes: estimatedHours
          ? Math.round(Number(estimatedHours) * 60)
          : null,
      });
      toast.success("Task created and assigned");
      setOpen(false);
    } catch {}
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        action.reset();
        if (next) {
          setProjectId(projects[0]?.id ?? "");
          setAssigneeId("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={projects.length === 0}>New task</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>
              Add a clear deliverable and assign it to a team member.
            </DialogDescription>
          </DialogHeader>
          <Field label="Task title">
            <Input name="title" placeholder="Prepare final landing page mockups" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project">
              <Select
                name="projectId"
                value={selectedProject?.id ?? ""}
                onValueChange={(value) => {
                  setProjectId(value);
                  setAssigneeId("");
                }}
                required
              >
                <SelectTrigger aria-label="Project">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assign to">
              <input type="hidden" name="assigneeId" value={assigneeId} />
              <Select
                value={assigneeId || "__unassigned__"}
                onValueChange={(value) =>
                  setAssigneeId(value === "__unassigned__" ? "" : value)
                }
              >
                <SelectTrigger aria-label="Task assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {availableAssignees.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue="p2">
                <SelectTrigger aria-label="Task priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p0">P0</SelectItem>
                  <SelectItem value="p1">P1</SelectItem>
                  <SelectItem value="p2">P2</SelectItem>
                  <SelectItem value="p3">P3</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" />
            </Field>
            <Field label="Estimated hours">
              <Input
                name="estimatedHours"
                type="number"
                min="0.25"
                max="1000"
                step="0.25"
                placeholder="e.g. 4"
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea name="description" placeholder="Acceptance criteria or useful context…" />
          </Field>
          <DialogError message={action.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignMemberDialog({
  project,
  team,
}: {
  project: CrmProject;
  team: CrmTeamMember[];
}) {
  const [open, setOpen] = useState(false);
  const action = useCrmAction();
  const available = team.filter(
    (member) =>
      member.role !== "admin" &&
      member.role !== "superadmin" &&
      member.isActive &&
      !project.memberIds.includes(member.id),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await action.mutateAsync({
        action: "assign_member",
        projectId: project.id,
        userId: form.get("userId"),
      });
      toast.success("Member assigned to project");
      setOpen(false);
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); action.reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={available.length === 0}>
          Assign member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Assign to {project.name}</DialogTitle>
            <DialogDescription>
              The member will immediately see this project in their own CRM login.
            </DialogDescription>
          </DialogHeader>
          <Field label="Team member">
            <Select name="userId" defaultValue={available[0]?.id} required>
              <SelectTrigger aria-label="Team member">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {available.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.fullName || member.email}
                    {member.jobTitle ? ` · ${member.jobTitle}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogError message={action.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? "Assigning…" : "Assign member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SetProjectPocDialog({
  project,
  team,
}: {
  project: CrmProject;
  team: CrmTeamMember[];
}) {
  const [open, setOpen] = useState(false);
  const [pocUserId, setPocUserId] = useState(project.pocId ?? "");
  const action = useCrmAction();
  const available = team.filter(
    (member) => member.role !== "admin" &&
      member.role !== "superadmin" && member.isActive,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await action.mutateAsync({
        action: "set_project_poc",
        projectId: project.id,
        pocUserId: pocUserId || null,
      });
      toast.success(pocUserId ? "Project POC assigned" : "Project POC removed");
      setOpen(false);
    } catch {}
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        action.reset();
        if (next) setPocUserId(project.pocId ?? "");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {project.pocId ? "Change POC" : "Assign POC"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Project POC</DialogTitle>
            <DialogDescription>
              The POC can manage tasks, review delivery and see work activity
              only for {project.name}.
            </DialogDescription>
          </DialogHeader>
          <Field label="Point of contact">
            <Select
              value={pocUserId || "__none__"}
              onValueChange={(value) =>
                setPocUserId(value === "__none__" ? "" : value)
              }
            >
              <SelectTrigger aria-label="Project POC">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No POC</SelectItem>
                {available.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.fullName || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogError message={action.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? "Saving…" : "Save POC"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ManageTaskDialog({
  task,
  project,
  team,
}: {
  task: CrmTask;
  project: CrmProject;
  team: CrmTeamMember[];
}) {
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const action = useCrmAction();
  const available = team.filter(
    (member) =>
      member.role !== "admin" &&
      member.role !== "superadmin" &&
      member.isActive &&
      project.memberIds.includes(member.id),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const estimatedHours = String(form.get("estimatedHours") || "");
    try {
      await action.mutateAsync({
        action: "manage_task",
        taskId: task.id,
        assigneeId: assigneeId || null,
        priority: form.get("priority"),
        dueDate: form.get("dueDate") || undefined,
        estimatedMinutes: estimatedHours
          ? Math.round(Number(estimatedHours) * 60)
          : null,
      });
      toast.success("Task assignment updated");
      setOpen(false);
    } catch {}
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        action.reset();
        if (next) setAssigneeId(task.assigneeId ?? "");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Manage task</DialogTitle>
            <DialogDescription>
              Update ownership, priority, due date and the effort used to weight
              project progress.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">{task.title}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assign to">
              <Select
                value={assigneeId || "__unassigned__"}
                onValueChange={(value) =>
                  setAssigneeId(value === "__unassigned__" ? "" : value)
                }
              >
                <SelectTrigger aria-label="Task assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {available.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger aria-label="Task priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p0">P0</SelectItem>
                  <SelectItem value="p1">P1</SelectItem>
                  <SelectItem value="p2">P2</SelectItem>
                  <SelectItem value="p3">P3</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" defaultValue={task.dueDate ?? ""} />
            </Field>
            <Field label="Estimated hours">
              <Input
                name="estimatedHours"
                type="number"
                min="0.25"
                max="1000"
                step="0.25"
                defaultValue={
                  task.estimatedMinutes ? task.estimatedMinutes / 60 : ""
                }
              />
            </Field>
          </div>
          <DialogError message={action.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? "Saving…" : "Save task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveRequestDialog() {
  const [open, setOpen] = useState(false);
  const action = useCrmAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await action.mutateAsync({
        action: "request_leave",
        leaveType: form.get("leaveType"),
        startDate: form.get("startDate"),
        endDate: form.get("endDate"),
        reason: form.get("reason"),
      });
      toast.success("Leave request submitted");
      setOpen(false);
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); action.reset(); }}>
      <DialogTrigger asChild>
        <Button>Request leave</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>
              Your manager will see this request and can approve or reject it.
            </DialogDescription>
          </DialogHeader>
          <Field label="Leave type">
            <Select name="leaveType" defaultValue="casual">
              <SelectTrigger aria-label="Leave type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual leave</SelectItem>
                <SelectItem value="sick">Sick leave</SelectItem>
                <SelectItem value="earned">Earned leave</SelectItem>
                <SelectItem value="unpaid">Unpaid leave</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From">
              <Input name="startDate" type="date" required />
            </Field>
            <Field label="To">
              <Input name="endDate" type="date" required />
            </Field>
          </div>
          <Field label="Reason">
            <Textarea name="reason" placeholder="Optional note for your manager…" />
          </Field>
          <DialogError message={action.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
