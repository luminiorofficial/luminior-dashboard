export type CRMStatus = "active" | "pending" | "archived";

export type CRMRecord = {
  id: string;
  name: string;
  status: CRMStatus;
};
