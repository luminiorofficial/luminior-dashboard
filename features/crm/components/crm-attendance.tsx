"use client";

import { CalendarDays, Clock3, MapPin } from "@/lib/lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CrmLoadState } from "./crm-load-state";
import { CrmBadge, formatDate, formatMinutes } from "./crm-ui";
import type { CrmSnapshot } from "@/features/crm/types";

interface CrmAttendanceProps {
  data?: CrmSnapshot | null;
  isLoading?: boolean;
  error?: Error | null;
}

export function CrmAttendance({
  data,
  isLoading,
  error,
}: CrmAttendanceProps = {}) {
  if (isLoading) {
    return <CrmLoadState loading={true} error={null} retry={() => {}} />;
  }

  if (error || !data) {
    return <CrmLoadState loading={false} error={error || new Error("No data")} retry={() => {}} />;
  }

  const isManager = data.role === "manager";
  const today = new Date().toISOString().split("T")[0];
  const leaveToday = data.leaveRequests.filter(
    (leave) =>
      leave.startDate <= today &&
      leave.endDate >= today &&
      leave.status === "approved",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Attendance"
        title="Attendance & Leave"
        description="Track team attendance, working status, and leave requests."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.team
              .filter((member) => member.isActive)
              .map((member) => {
                const onLeave = leaveToday.some((l) => l.userId === member.id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {member.fullName || member.email}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                        {onLeave ? (
                          <>
                            <MapPin className="h-3 w-3" />
                            <span>On leave</span>
                          </>
                        ) : (
                          <>
                            <Clock3 className="h-3 w-3" />
                            <span>{formatMinutes(member.workedMinutesToday)} worked</span>
                          </>
                        )}
                      </div>
                    </div>
                    <CrmBadge value={member.attendanceStatus} />
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {isManager && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leave requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.leaveRequests.length === 0 ? (
                <p className="text-sm text-slate-600 py-4">No leave requests</p>
              ) : (
                data.leaveRequests
                  .filter((leave) => leave.status === "pending")
                  .map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-start justify-between p-3 rounded-lg border border-amber-200 bg-amber-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">
                          {leave.userName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-amber-700 mt-1">
                          <CalendarDays className="h-3 w-3" />
                          <span>
                            {formatDate(leave.startDate)} to{" "}
                            {formatDate(leave.endDate)}
                          </span>
                        </div>
                        <p className="text-xs text-amber-600 mt-1">
                          {leave.leaveType} leave{" "}
                          {leave.reason && `· ${leave.reason}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600">
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active time entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.timeEntries.length === 0 ? (
            <p className="text-sm text-slate-600 py-4">No active time entries</p>
          ) : (
            data.timeEntries
              .filter((entry) => entry.status !== "stopped")
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50"
                >
                  <div>
                    <p className="font-medium text-sm text-green-900">
                      {entry.userName}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      {entry.status === "on_break" ? "On break" : "Working"} ·{" "}
                      {formatMinutes(entry.workedMinutes)} so far today
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-green-900">
                      {entry.status === "on_break" && entry.breakLabel
                        ? entry.breakLabel
                        : "Clocked in"}
                    </p>
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
