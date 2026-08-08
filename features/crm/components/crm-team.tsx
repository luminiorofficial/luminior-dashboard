import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { crmTeam } from "@/features/crm/lib/crm-data";

export function CrmTeam() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Team"
        title="Core team"
        description="A clean directory of the people driving delivery."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {crmTeam.map((member) => (
          <Card key={member.id}>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{member.name}</p>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                  {member.availability}
                </span>
              </div>
              <p className="text-sm text-slate-600">{member.role}</p>
              <p className="text-sm text-slate-500">{member.email}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
