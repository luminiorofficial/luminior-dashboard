import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { crmAttendance } from "@/features/crm/lib/crm-data";

export function CrmAttendance() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Attendance"
        title="Attendance overview"
        description="Track who is present, remote, or on leave this week."
      />

      <Card>
        <CardHeader>
          <CardTitle>Status board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crmAttendance.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-900">{entry.name}</p>
                <p className="text-sm text-slate-500">{entry.date}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                {entry.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
