"use client";

import { CrmDashboard } from "@/features/crm/components/crm-dashboard";
import { useCrm } from "@/features/crm/hooks/use-crm";

export default function CRMDashboardPage() {
  const { data, isLoading, error } = useCrm();
  return <CrmDashboard data={data} isLoading={isLoading} error={error} />;
}
