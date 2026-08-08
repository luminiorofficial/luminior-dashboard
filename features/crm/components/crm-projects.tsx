import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { crmProjects } from "@/features/crm/lib/crm-data";

export function CrmProjects() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Projects"
        title="Active initiatives"
        description="Track key delivery programs and who owns each one."
      />

      <div className="grid gap-4">
        {crmProjects.map((project) => (
          <Card key={project.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{project.name}</p>
                <p className="text-sm text-slate-500">Owner: {project.owner}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">Due {project.dueDate}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                  {project.status}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
