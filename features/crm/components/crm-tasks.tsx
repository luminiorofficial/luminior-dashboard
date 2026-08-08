import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { crmTasks } from "@/features/crm/lib/crm-data";

export function CrmTasks() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Tasks"
        title="Task queue"
        description="Keep work moving with clear ownership and priority."
      />

      <Card>
        <CardHeader>
          <CardTitle>Current work items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crmTasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-900">{task.title}</p>
                <p className="text-sm text-slate-500">{task.assignee}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">{task.priority}</span>
                <span className="text-sm text-slate-500">{task.status}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
