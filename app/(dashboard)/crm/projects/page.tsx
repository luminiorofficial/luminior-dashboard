"use client";

import { CrmProjects } from "@/features/crm/components/crm-projects";
import { useCrm } from "@/features/crm/hooks/use-crm";

export default function CrmProjectsPage() {
  const { data, isLoading, error } = useCrm();
  return <CrmProjects data={data} isLoading={isLoading} error={error} />;
}
