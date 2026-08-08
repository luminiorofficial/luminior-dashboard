"use client";

import { Clock3, Mail, Power, RotateCcw, Users } from "lucide-react";
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
import { initials } from "@/lib/utils";
import type { CrmTeamMember, CrmSnapshot } from "@/features/crm/types";
import { CrmLoadState } from "./crm-load-state";
import { CreateMemberDialog, ManageMemberBrandsDialog } from "./crm-dialogs";
import { CrmBadge, FocusTimer, formatMinutes, formatTime } from "./crm-ui";

function MemberStatusControl({ member }: { member: CrmTeamMember }) {
  const nextActive = !member.isActive;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant={member.isActive ? "outline" : "secondary"}
          className={member.isActive ? "text-red-600 hover:text-red-600" : ""}
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
          <AlertDialogAction variant={member.isActive ? "destructive" : "default"}>
            {member.isActive ? "Deactivate" : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CrmTeamProps {
  data?: CrmSnapshot | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function CrmTeam({
  data,
  isLoading,
  error,
}: CrmTeamProps = {}) {
  if (isLoading) {
    return <CrmLoadState loading={true} error={null} retry={() => {}} />;
  }

  if (error || !data) {
    return <CrmLoadState loading={false} error={error || new Error("No data")} retry={() => {}} />;
  }

  const isManager = data.role === "manager";
  const isPoc = data.pocProjectIds.length > 0;

  const displayTeam = isManager
    ? data.team
    : isPoc
      ? data.team.filter((m) => {
          const pocProjects = data.projects.filter(
            (p) => data.pocProjectIds.includes(p.id) && p.memberIds.includes(m.id),
          );
          return pocProjects.length > 0;
        })
      : data.team.filter((m) => m.id === data.currentUserId);

  return (
    <div className="space-y-6">
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
        actions={isManager ? <CreateMemberDialog brands={data.brands} /> : undefined}
      />

      {displayTeam.length === 0 ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-sm font-medium text-slate-900">No team members yet</p>
            <p className="text-xs text-slate-600 mt-1">
              Add the first member to create their private CRM login.
            </p>
            {isManager && <CreateMemberDialog brands={data.brands} />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayTeam.map((member) => (
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
                        <p className="truncate text-xs text-slate-600">
                          {member.jobTitle ||
                            (member.role === "admin" || member.role === "superadmin"
                              ? "Manager"
                              : "Team member")}
                        </p>
                      </div>
                      <CrmBadge value={member.attendanceStatus} />
                    </div>
                    {member.department && (
                      <p className="mt-1 text-xs text-blue-600">{member.department}</p>
                    )}
                  </div>
                </div>
                <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
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
                    <p className="flex items-center gap-2 text-slate-900">
                      <span className="relative flex h-2 w-2 rounded-full bg-green-500">
                        <span className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-50" />
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
                      {data.brands.length > 0 && (
                        <ManageMemberBrandsDialog member={member} brands={data.brands} />
                      )}
                      <MemberStatusControl member={member} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}