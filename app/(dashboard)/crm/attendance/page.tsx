"use client";

import { CrmAttendance } from "@/features/crm/components/crm-attendance";
import { useCrm } from "@/features/crm/hooks/use-crm";

export default function CrmAttendancePage() {
  const { data, isLoading, error } = useCrm();
  return <CrmAttendance data={data} isLoading={isLoading} error={error} />;
}
