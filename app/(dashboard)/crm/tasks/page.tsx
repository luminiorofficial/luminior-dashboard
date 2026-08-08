"use client";

import { CrmTasks } from "@/features/crm/components/crm-tasks";
import { useCrm } from "@/features/crm/hooks/use-crm";

export default function CrmTasksPage() {
  const { data, isLoading, error } = useCrm();
  return <CrmTasks data={data} isLoading={isLoading} error={error} />;
}
