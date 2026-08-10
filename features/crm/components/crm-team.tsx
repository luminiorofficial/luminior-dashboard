"use client";

import { Clock3, Mail, Power, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTransition } from "@/components/states";
import { useCrm, useCrmAction } from "@/hooks/use-crm";
import { initials } from "@/lib/utils";
import type { CrmTeamMember } from "@/features/crm/types";
import { CrmLoadState } from "./crm-load-state";
import { CreateMemberDialog, InviteLinkDialog } from "./crm-dialogs";
import { CrmBadge, FocusTimer, formatMinutes, formatTime } from "./crm-ui";

function MemberStatusControl({ member }: { member: CrmTeamMember }) {
  const action = useCrmAction();
  const nextActive = !member.isActive;

  async function updateStatus() {
    try {
      await action.mutateAsync({
        action: "set_member_active",
        userId: member.id,
        isActive: nextActive,
      });
      toast.success(
        nextActive ? "Team member reactivated" : "Team member deactivated",
        {
          description: nextActive
            ? "They can sign in again with their existing credentials."
            : "Login is disabled and all past history has been preserved.",
        },
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant={member.isActive ? "outline" : "secondary"}
          className={member.isActive ? "text-destructive hover:text-destructive" : ""}
        >
          {member.isActive ? (
            <Power className="h-4 w-4" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {member.isActive ? "Deactivate" : "Reactivate"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {member.isActive ? "Deactivate team member?" : "Reactivate team member?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {member.isActive
              ? `${member.fullName || member.email} will no longer be able to sign in. Their projects, tasks, attendance and leave history will remain available.`
              : `${member.fullName || member.email} will be able to sign in again with their existing credentials.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={member.isActive ? "destructive" : "default"}
            disabled={action.isPending}
            onClick={() => void updateStatus()}
          >
            {member.isActive ? "Deactivate" : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CrmTeam() {
  const crm = useCrm();
  const data = crm.data;
  if (!data) {
    return (
      <PageTransition className="space-y-6">
        <PageHeader
          eyebrow="CRM · People"
          title="Team members"
          description="Manage active and former members without losing their work history."
          actions={<CreateMemberDialog />}
        />
        <EmptyState
          title="No team members yet"
          message="Add the first member to create their private CRM login."
          icon={Users}
          action={<CreateMemberDialog />}
        />
      </PageTransition>
    );
  }
  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="CRM · People"
        title={isManager ? "Team members" : isPoc ? "My project team" : "My profile"}
        description={
          isManager
            ? "Manage active and former members without losing their work history."
            : isPoc
              ? "Members assigned to projects where you are the POC."
              : "Your CRM identity and current attendance status."
        }
        actions={
          isManager ? (
            <div className="flex flex-wrap gap-2">
              <InviteLinkDialog />
              <CreateMemberDialog />
            </div>
          ) : undefined
        }
      />

      {data.team.length === 0 ? (
        <EmptyState
          title="No team members yet"
          message="Add the first member to create their private CRM login."
          icon={Users}
          action={isManager ? <CreateMemberDialog /> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.team.map((member) => (
            <Card key={member.id} className={!member.isActive ? "opacity-75" : undefined}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback>
                      {initials(member.fullName || member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {member.fullName || member.email}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.jobTitle ||
                            (member.role === "admin" || member.role === "superadmin"
                              ? "Manager"
                              : "Team member")}
                        </p>
                      </div>
                      <CrmBadge value={member.attendanceStatus} />
                    </div>
                    {member.department && (
                      <p className="mt-1 text-xs text-primary">{member.department}</p>
                    )}
                  </div>
                </div>
                <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{member.email}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock3 className="h-3.5 w-3.5" />
                    {isPoc && member.id !== data.currentUserId
                      ? `${formatMinutes(member.projectTrackedMinutesToday)} on POC projects today`
                      : `${formatMinutes(member.workedMinutesToday)} worked today`}
                  </p>
                  {member.currentProjectName && (
                    <p className="flex items-center gap-2 text-foreground">
                      <span className="relative flex h-2 w-2 rounded-full bg-success">
                        <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-50" />
                      </span>
                      <span className="truncate">
                        Working on {member.currentTaskTitle || member.currentProjectName}
                      </span>
                    </p>
                  )}
                  {member.currentProjectSince && (
                    <p className="flex items-center gap-2 pl-4">
                      Started {formatTime(member.currentProjectSince)}
                      <span>·</span>
                      <FocusTimer startedAt={member.currentProjectSince} compact />
                    </p>
                  )}
                  {isManager && member.role !== "admin" && member.role !== "superadmin" && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <MemberStatusControl member={member} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
