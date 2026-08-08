"use client";

import { CalendarDays, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageTransition } from "@/components/states";
import { useCrm, useCrmAction } from "@/hooks/use-crm";
import type { CrmLeaveRequest } from "@/features/crm/types";
import { CrmLoadState } from "./crm-load-state";
import { LeaveRequestDialog } from "./crm-dialogs";
import { CrmBadge, formatDate } from "./crm-ui";

function LeaveRow({
  leave,
  canReview,
}: {
  leave: CrmLeaveRequest;
  canReview: boolean;
}) {
  const action = useCrmAction();

  async function review(status: "approved" | "rejected") {
    try {
      await action.mutateAsync({
        action: "review_leave",
        leaveId: leave.id,
        status,
        managerNote: "",
      });
      toast.success(`Leave ${status}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const days =
    Math.round(
      (new Date(`${leave.endDate}T00:00:00`).getTime() -
        new Date(`${leave.startDate}T00:00:00`).getTime()) /
        86_400_000,
    ) + 1;

  return (
    <div className="rounded-lg border border-border bg-background/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{leave.userName}</p>
            <CrmBadge value={leave.leaveType} />
            <CrmBadge value={leave.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
            <span className="ml-1">({days} {days === 1 ? "day" : "days"})</span>
          </p>
          {leave.reason && (
            <p className="mt-2 text-sm leading-relaxed">{leave.reason}</p>
          )}
          {leave.managerNote && (
            <p className="mt-2 text-xs text-muted-foreground">
              Manager note: {leave.managerNote}
            </p>
          )}
        </div>
        {canReview && leave.status === "pending" && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              disabled={action.isPending}
              onClick={() => void review("approved")}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={action.isPending}
              onClick={() => void review("rejected")}
            >
              <X className="h-4 w-4" /> Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CrmLeave() {
  const crm = useCrm();
  const data = crm.data;
  if (!data) {
    return (
      <CrmLoadState
        loading={crm.isLoading}
        error={(crm.error as Error) ?? null}
        retry={() => void crm.refetch()}
      />
    );
  }
  const isManager = data.role === "manager";
  const pending = data.leaveRequests.filter((leave) => leave.status === "pending");
  const history = data.leaveRequests.filter((leave) => leave.status !== "pending");

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="CRM · Availability"
        title={isManager ? "Team leave" : "My leave"}
        description={
          isManager
            ? "Review requests and see who is unavailable across the team."
            : "Submit leave plans and follow their approval status."
        }
        actions={!isManager ? <LeaveRequestDialog /> : undefined}
      />

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isManager ? `Pending approval (${pending.length})` : "Pending requests"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((leave) => (
              <LeaveRow key={leave.id} leave={leave} canReview={isManager} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <EmptyState
              title="No leave history"
              message="Approved or rejected leave requests will appear here."
              icon={CalendarDays}
            />
          ) : (
            history.map((leave) => (
              <LeaveRow key={leave.id} leave={leave} canReview={false} />
            ))
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
