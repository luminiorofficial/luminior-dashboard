"use client";

import { CrmTeam } from "@/features/crm/components/crm-team";
import { useCrm } from "@/features/crm/hooks/use-crm";

export default function CrmTeamPage() {
  const { data, isLoading, error } = useCrm();
  return <CrmTeam data={data} isLoading={isLoading} error={error} />;
}
