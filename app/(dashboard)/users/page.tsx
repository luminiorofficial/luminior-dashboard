"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Users as UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageTransition, TableSkeleton } from "@/components/states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiMutate, FetchError } from "@/lib/fetcher";
import { initials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type AdminUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: "user" | "admin" | "superadmin";
  isActive: boolean;
  companyId: number | null;
  companyName: string | null;
  referredBy: string | null;
  createdAt: string;
};

const ROLE_LABEL: Record<AdminUserRow["role"], string> = {
  user: "Member",
  admin: "Admin",
  superadmin: "Super Admin",
};

function useUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiGet<{ users: AdminUserRow[] }>("/api/users"),
    staleTime: 30_000,
  });
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const usersQuery = useUsers();
  const queryClient = useQueryClient();

  const patch = useMutation({
    mutationFn: (payload: { userId: string; role?: AdminUserRow["role"]; isActive?: boolean }) =>
      apiMutate<{ user: AdminUserRow }>("PATCH", "/api/users", { body: payload }),
    onSuccess: (result) => {
      queryClient.setQueryData<{ users: AdminUserRow[] } | undefined>(
        ["admin-users"],
        (current) =>
          current && {
            users: current.users.map((u) => (u.id === result.user.id ? result.user : u)),
          },
      );
      toast.success("User updated");
    },
    onError: (error) => {
      toast.error(error instanceof FetchError ? error.message : "Could not update user");
    },
  });

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data?.users ?? []) {
      map.set(user.id, user.fullName || user.email);
    }
    return map;
  }, [usersQuery.data]);

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Platform · People"
        title="Users"
        description="Every account on the platform. Manage roles and access."
      />

      {usersQuery.isLoading ? (
        <TableSkeleton rows={6} />
      ) : usersQuery.error ? (
        <ErrorState
          message={
            usersQuery.error instanceof FetchError
              ? usersQuery.error.message
              : "Could not load users."
          }
          onRetry={() => void usersQuery.refetch()}
        />
      ) : !usersQuery.data || usersQuery.data.users.length === 0 ? (
        <EmptyState
          title="No users yet"
          message="Once people register through a company invite link, they'll show up here."
          icon={UsersIcon}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Referred by</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.data.users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {initials(user.fullName || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {user.fullName || user.email}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          {user.role === "superadmin" && (
                            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          disabled={isSelf || patch.isPending}
                          onValueChange={(value) =>
                            patch.mutate({ userId: user.id, role: value as AdminUserRow["role"] })
                          }
                        >
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue>{ROLE_LABEL[user.role]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="superadmin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.companyName ? (
                          <span className="text-sm">{user.companyName}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.referredBy ? (
                          <Badge variant="secondary">
                            {userNameById.get(user.referredBy) ?? "Unknown"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={user.isActive}
                          disabled={isSelf || patch.isPending}
                          onCheckedChange={(checked) =>
                            patch.mutate({ userId: user.id, isActive: checked })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}
