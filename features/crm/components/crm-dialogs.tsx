"use client";

import { useState, type FormEvent, type ReactNode } from "react";
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

export function CreateMemberDialog({ brands }: { brands: CrmBrandOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add team member</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              Create a private CRM login for a new member.
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create login</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateProjectDialog({ team }: { team: CrmTeamMember[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add project</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add new project</DialogTitle>
            <DialogDescription>
              Create a new project to track work and team assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project name" className="sm:col-span-2">
              <Input name="name" placeholder="e.g. Mobile App v2.0" required minLength={2} />
            </Field>
            <Field label="Client name">
              <Input name="clientName" placeholder="Optional" />
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue="p2">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p0">P0 (Critical)</SelectItem>
                  <SelectItem value="p1">P1 (High)</SelectItem>
                  <SelectItem value="p2">P2 (Medium)</SelectItem>
                  <SelectItem value="p3">P3 (Low)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" className="sm:col-span-2">
              <Select name="status" defaultValue="planning">
                <SelectTrigger>
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
            <Field label="Description" className="sm:col-span-2">
              <Textarea name="description" placeholder="Project description" rows={3} />
            </Field>
            <Field label="Start date">
              <Input name="startDate" type="date" />
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTaskDialog({ project }: { project: CrmProject }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add task</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add task to {project.name}</DialogTitle>
            <DialogDescription>
              Create a new task and assign it to a team member.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Task title">
              <Input name="title" placeholder="e.g. Design login screen" required minLength={2} />
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue="p2">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p0">P0 (Critical)</SelectItem>
                  <SelectItem value="p1">P1 (High)</SelectItem>
                  <SelectItem value="p2">P2 (Medium)</SelectItem>
                  <SelectItem value="p3">P3 (Low)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description">
              <Textarea name="description" placeholder="Task details" rows={3} />
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" />
            </Field>
            <Field label="Estimated hours">
              <Input name="estimatedMinutes" type="number" placeholder="Estimated duration in minutes" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignMemberDialog({ project, team }: { project: CrmProject; team: CrmTeamMember[] }) {
  const [open, setOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(project.memberIds);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Manage team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign team members</DialogTitle>
          <DialogDescription>
            Select which team members should have access to this project.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {team.map((member) => (
            <label key={member.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-accent rounded">
              <input
                type="checkbox"
                checked={selectedMembers.includes(member.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMembers([...selectedMembers, member.id]);
                  } else {
                    setSelectedMembers(selectedMembers.filter((id) => id !== member.id));
                  }
                }}
                className="accent-primary"
              />
              <span className="text-sm">{member.fullName || member.email}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">Update members</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SetProjectPocDialog({ project, team }: { project: CrmProject; team: CrmTeamMember[] }) {
  const [open, setOpen] = useState(false);
  const [selectedPoc, setSelectedPoc] = useState<string>(project.pocId || "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {project.pocName ? "Change POC" : "Set POC"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project Point of Contact</DialogTitle>
          <DialogDescription>
            Select a team member to be the point of contact for this project.
          </DialogDescription>
        </DialogHeader>
        <Select value={selectedPoc} onValueChange={setSelectedPoc}>
          <SelectTrigger>
            <SelectValue placeholder="Select a team member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {team.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.fullName || member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">Update POC</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ManageTaskDialog({ task, team }: { task: CrmTask; team: CrmTeamMember[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>
              Update task details and assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Assignee">
              <Select name="assigneeId" defaultValue={task.assigneeId || ""}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {team.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="p0">P0 (Critical)</SelectItem>
                  <SelectItem value="p1">P1 (High)</SelectItem>
                  <SelectItem value="p2">P2 (Medium)</SelectItem>
                  <SelectItem value="p3">P3 (Low)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date">
              <Input name="dueDate" type="date" defaultValue={task.dueDate || ""} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Update task</Button>
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Brands
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Brand access</DialogTitle>
          <DialogDescription>
            Manage which brands {member.fullName || member.email} can access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {brands.map((brand) => (
            <label key={brand.accountId} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-accent rounded">
              <input
                type="checkbox"
                defaultChecked={member.brandIds.includes(brand.accountId)}
                className="accent-primary"
              />
              <span className="text-sm">{brand.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">Update brands</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
